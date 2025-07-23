/**
 * useVideoProcessing - Custom hook for video processing operations
 */

import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import databaseClient from '../../../utils/DatabaseClient';

const useVideoProcessing = ({
  selectedFile,
  fps,
  setIsProcessing,
  setProcessingProgress,
  setCurrentFrame,
  setDetections,
  setViolations,
  onSessionUpdate,
  wsRef
}) => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  // Database session management
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [frameCounter, setFrameCounter] = useState(0);

  const uploadVideo = async (file) => {
    console.log('📤 Starting upload for file:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📤 Upload successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Upload error:', error);
      throw error;
    }
  };

  const startProcessing = useCallback(async () => {
    console.log('🚀 startProcessing called');
    console.log('📁 selectedFile:', selectedFile);

    if (!selectedFile) {
      console.error('❌ No file selected');
      toast.error('Please select a video file first');
      return;
    }

    try {
      console.log('✅ Starting processing for file:', selectedFile.name);
      setIsProcessing(true);
      setProcessingProgress(0);
      setDetections([]);
      setViolations([]);

      toast.info('📤 Uploading video...');

      // Upload video first
      const uploadResult = await uploadVideo(selectedFile);
      
      toast.success('✅ Video uploaded successfully');
      toast.info('🚀 Starting video processing...');

      // Start video processing
      const processingRequest = {
        source_type: 'file',
        source_path: uploadResult.absolute_path,
        fps: fps,
        enable_violation_detection: true
      };

      console.log('🎬 Starting processing with request:', processingRequest);

      const response = await fetch(`${API_BASE_URL}/video/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(processingRequest),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Processing request failed:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          request: processingRequest
        });
        throw new Error(`Processing failed: ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Processing started:', result);

      // Create database session
      try {
        const sessionData = {
          id: result.session_id,
          video_path: uploadResult.absolute_path,
          video_filename: selectedFile.name,
          fps: fps,
          metadata: {
            upload_result: uploadResult,
            processing_request: processingRequest,
            websocket_url: result.websocket_url
          }
        };

        await databaseClient.createSession(sessionData);
        setCurrentSessionId(result.session_id);
        setFrameCounter(0);
        console.log('📊 Database session created:', result.session_id);
      } catch (dbError) {
        console.error('❌ Failed to create database session:', dbError);
        // Continue processing even if database fails
      }

      if (onSessionUpdate) {
        onSessionUpdate(result);
      }

      // Connect to WebSocket for real-time updates
      if (result.websocket_url && wsRef) {
        const wsUrl = result.websocket_url.replace('localhost', window.location.hostname);
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        
        try {
          const ws = new WebSocket(wsUrl);
          wsRef.current = ws;

          ws.onopen = () => {
            console.log('✅ WebSocket connected');
            toast.success('🔌 Connected to real-time feed');
          };

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              console.log('📨 WebSocket message:', data.type);

              if (data.type === 'frame_update' || data.type === 'frame_processed') {
                console.log('🔍 Frame message details:', {
                  hasFrameData: !!data.frame_data,
                  frameDataLength: data.frame_data?.length || 0,
                  frameDataType: typeof data.frame_data,
                  hasDetections: !!data.detections,
                  detectionsCount: data.detections?.length || 0,
                  allKeys: Object.keys(data),
                  firstDetection: data.detections?.[0]
                });

                setDetections(data.detections || []);

                if (data.frame_data) {
                  setCurrentFrame(data.frame_data);
                  console.log('✅ Frame data updated - length:', data.frame_data.length);
                } else {
                  console.log('❌ No frame_data in message - keys:', Object.keys(data));
                }

                // Save frame data to database
                if (currentSessionId && data.detections) {
                  const currentFrame = frameCounter + 1;
                  setFrameCounter(currentFrame);

                  // Prepare frame analysis data
                  const detections = data.detections || [];
                  const frameAnalysis = {
                    totalDetections: detections.length,
                    handsCount: detections.filter(d => d.class_name === 'hand').length,
                    personsCount: detections.filter(d => d.class_name === 'person').length,
                    scoopersCount: detections.filter(d => d.class_name === 'scooper').length,
                    pizzasCount: detections.filter(d => d.class_name === 'pizza').length,
                    violationsCount: 0, // Will be updated by violation detector
                    frameSizeBytes: data.frame_data?.length || 0,
                    metadata: {
                      frame_type: data.type,
                      timestamp: new Date().toISOString()
                    }
                  };

                  // Save to database (async, don't block UI)
                  databaseClient.saveBatchData(currentSessionId, currentFrame, {
                    detections: detections,
                    frameAnalysis: frameAnalysis
                  }).catch(error => {
                    console.error('❌ Failed to save frame data to database:', error);
                  });
                }
              } else if (data.type === 'violation_detected') {
                setViolations(prev => [...prev, data.violation]);
                toast.error(`🚨 Violation: ${data.violation.description}`);
              } else if (data.type === 'processing_progress') {
                setProcessingProgress(data.progress || 0);
              } else if (data.type === 'processing_complete') {
                setIsProcessing(false);
                setProcessingProgress(100);
                toast.success('🎉 Video processing completed!');
              } else if (data.type === 'error') {
                console.error('❌ WebSocket error:', data.error);
                toast.error(`Error: ${data.error}`);
                setIsProcessing(false);
              }
            } catch (error) {
              console.error('❌ Error parsing WebSocket message:', error);
            }
          };

          ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            toast.error('WebSocket connection error');
          };

          ws.onclose = (event) => {
            console.log('🔌 WebSocket closed:', event.code, event.reason);
            if (event.code !== 1000) { // Not a normal closure
              toast.warning('WebSocket connection lost');
            }
          };

        } catch (wsError) {
          console.error('❌ WebSocket connection failed:', wsError);
          toast.warning('Real-time updates unavailable');
        }
      }

      toast.success('🎬 Video processing started successfully!');
      return result;

    } catch (error) {
      console.error('❌ Processing error:', error);
      toast.error(`Processing failed: ${error.message}`);
      setIsProcessing(false);
      setProcessingProgress(0);
      throw error;
    }
  }, [selectedFile, fps, setIsProcessing, setProcessingProgress, setDetections, setViolations, onSessionUpdate, wsRef, API_BASE_URL]);

  const stopProcessing = useCallback(async () => {
    try {
      // Close WebSocket connection
      if (wsRef?.current) {
        wsRef.current.close(1000, 'User stopped processing');
        wsRef.current = null;
      }

      // Update database session
      if (currentSessionId) {
        try {
          await databaseClient.updateSession(currentSessionId, {
            end_time: new Date().toISOString(),
            status: 'completed',
            total_frames: frameCounter
          });
          console.log('📊 Database session completed:', currentSessionId);
        } catch (dbError) {
          console.error('❌ Failed to update database session:', dbError);
        }
      }

      console.log('✅ Processing stopped successfully');
      toast.success('⏹️ Video processing stopped');

      // Reset session state
      setCurrentSessionId(null);
      setFrameCounter(0);

      // Note: Backend doesn't seem to have a stop endpoint yet
      // For now, just close the WebSocket and clean up the UI

    } catch (error) {
      console.error('❌ Error stopping processing:', error);
      toast.warning('Error stopping processing, but cleaned up locally');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [wsRef, setIsProcessing, setProcessingProgress]);

  const getProcessingStatus = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/video/status/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();
      return status;
    } catch (error) {
      console.error('❌ Error getting processing status:', error);
      return null;
    }
  }, [API_BASE_URL]);

  return {
    startProcessing,
    stopProcessing,
    getProcessingStatus,
    uploadVideo,
    currentSessionId,
    frameCounter
  };
};

export default useVideoProcessing;
