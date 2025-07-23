/**
 * useWebSocket - Custom hook for WebSocket connection management
 */

import { useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';

const useWebSocket = ({
  wsRef,
  setCurrentFrame,
  setDetections,
  setViolations,
  setIsProcessing,
  setProcessingProgress,
  onDetectionUpdate,
  onViolationUpdate
}) => {
  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('📨 WebSocket message received:', data.type);

      switch (data.type) {
        case 'frame_update':
        case 'frame_processed':
          console.log('🖼️ Frame message received:', {
            type: data.type,
            hasFrameData: !!data.frame_data,
            frameDataLength: data.frame_data?.length || 0,
            hasDetections: !!data.detections,
            detectionsCount: data.detections?.length || 0,
            progress: data.progress,
            allKeys: Object.keys(data)
          });

          // Update current frame
          if (data.frame_data) {
            setCurrentFrame(data.frame_data);
            console.log('✅ Frame data updated - length:', data.frame_data.length);
          } else {
            console.log('❌ No frame_data in message');
          }

          // Update detections
          if (data.detections) {
            setDetections(data.detections);
            if (onDetectionUpdate) {
              onDetectionUpdate(data.detections);
            }
          }

          // Update processing progress if available
          if (data.progress !== undefined) {
            setProcessingProgress(data.progress);
          }
          break;

        case 'violation_detected':
          if (data.violation) {
            setViolations(prev => [...prev, data.violation]);
            if (onViolationUpdate) {
              onViolationUpdate(data.violation);
            }
            toast.error(`🚨 Violation: ${data.violation.description || 'Hygiene protocol violation'}`);
          }
          break;

        case 'processing_progress':
          if (data.progress !== undefined) {
            setProcessingProgress(data.progress);
          }
          if (data.status) {
            console.log('📊 Processing status:', data.status);
          }
          break;

        case 'processing_started':
          setIsProcessing(true);
          setProcessingProgress(0);
          toast.success('🎬 Video processing started');
          break;

        case 'processing_complete':
          setIsProcessing(false);
          setProcessingProgress(100);
          toast.success('🎉 Video processing completed!');
          break;

        case 'processing_stopped':
          setIsProcessing(false);
          toast.info('⏹️ Video processing stopped');
          break;

        case 'error':
          console.error('❌ WebSocket error message:', data.error);
          toast.error(`Error: ${data.error || 'Unknown error occurred'}`);
          if (data.fatal) {
            setIsProcessing(false);
          }
          break;

        case 'status_update':
          console.log('📊 Status update:', data.status);
          if (data.status?.frames_processed !== undefined) {
            // Calculate progress based on frames processed
            const totalFrames = data.status.total_frames || 1;
            const processed = data.status.frames_processed || 0;
            const progress = Math.min((processed / totalFrames) * 100, 100);
            setProcessingProgress(progress);
          }
          break;

        case 'connection_established':
          console.log('✅ WebSocket connection established');
          toast.success('🔌 Connected to real-time feed');
          break;

        case 'heartbeat':
          // Silent heartbeat - just log for debugging
          console.log('💓 WebSocket heartbeat');
          break;

        default:
          console.log('📨 Unknown WebSocket message type:', data.type);
          break;
      }
    } catch (error) {
      console.error('❌ Error parsing WebSocket message:', error);
      console.error('Raw message:', event.data);
    }
  }, [
    setCurrentFrame,
    setDetections,
    setViolations,
    setIsProcessing,
    setProcessingProgress,
    onDetectionUpdate,
    onViolationUpdate
  ]);

  // Connect to WebSocket
  const connectWebSocket = useCallback((url, sessionId) => {
    try {
      console.log('🔌 Connecting to WebSocket:', url);
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = (event) => {
        console.log('✅ WebSocket connected');
        toast.success('🔌 Connected to real-time feed');
        
        // Send initial message if needed
        if (sessionId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            session_id: sessionId
          }));
        }
      };

      ws.onmessage = handleWebSocketMessage;

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        toast.error('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        
        if (event.code === 1000) {
          // Normal closure
          console.log('WebSocket closed normally');
        } else if (event.code === 1006) {
          // Abnormal closure
          console.warn('WebSocket closed abnormally');
          toast.warning('Connection lost - attempting to reconnect...');
          
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (wsRef.current?.readyState === WebSocket.CLOSED) {
              console.log('🔄 Attempting to reconnect...');
              connectWebSocket(url, sessionId);
            }
          }, 3000);
        } else {
          toast.warning(`WebSocket connection lost (${event.code})`);
        }
      };

      return ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      toast.error('Failed to establish real-time connection');
      return null;
    }
  }, [wsRef, handleWebSocketMessage]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Disconnecting WebSocket');
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
  }, [wsRef]);

  // Send message through WebSocket
  const sendWebSocketMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
        wsRef.current.send(messageStr);
        console.log('📤 WebSocket message sent:', message);
        return true;
      } catch (error) {
        console.error('❌ Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('⚠️ WebSocket not connected, cannot send message');
      return false;
    }
  }, [wsRef]);

  // Get WebSocket connection status
  const getConnectionStatus = useCallback(() => {
    if (!wsRef.current) return 'disconnected';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'disconnected';
      default:
        return 'unknown';
    }
  }, [wsRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    connectWebSocket,
    disconnectWebSocket,
    sendWebSocketMessage,
    getConnectionStatus
  };
};

export default useWebSocket;
