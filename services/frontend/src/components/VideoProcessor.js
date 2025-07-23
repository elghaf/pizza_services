/**
 * VideoProcessor - Main component for video processing functionality
 * Split into smaller, focused components for better maintainability
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import databaseClient from '../utils/DatabaseClient';

import VideoUploader from './VideoProcessor/VideoUploader';
import ProcessingControls from './VideoProcessor/ProcessingControls';
import VideoDisplay from './VideoProcessor/VideoDisplay';
import DetectionStats from './VideoProcessor/DetectionStats';
import ViolationAlerts from './VideoProcessor/ViolationAlerts';
import ViolationControls from './VideoProcessor/ViolationControls';
import ViolationHistory from './VideoProcessor/ViolationHistory';
import ViolationStatusOverlay from './VideoProcessor/ViolationStatusOverlay';
import useVideoProcessing from './VideoProcessor/hooks/useVideoProcessing';
import useWebSocket from './VideoProcessor/hooks/useWebSocket';
import useDetectionDrawing from './VideoProcessor/hooks/useDetectionDrawing';

const VideoProcessor = ({ onSessionUpdate, onDetectionUpdate, onViolationUpdate, currentSession }) => {
  // State management
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(null);
  const [detections, setDetections] = useState([]);
  const [violations, setViolations] = useState([]);
  const [fps, setFps] = useState(10);
  const [roiZones, setRoiZones] = useState([]);
  const [showROIManager, setShowROIManager] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 640, height: 480 });
  const [drawingEnabled, setDrawingEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Debug current frame state
  console.log('🎬 VideoProcessor state:', {
    hasCurrentFrame: !!currentFrame,
    currentFrameLength: currentFrame?.length || 0,
    isProcessing,
    showROIManager,
    detectionsCount: detections.length,
    violationsCount: violations.length
  });
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fullScreenCanvasRef = useRef(null);
  const wsRef = useRef(null);
  const roiZoneManagerRef = useRef(null);
  const violationDetectorRef = useRef(null);

  // Custom hooks for functionality
  const {
    startProcessing,
    stopProcessing,
    currentSessionId,
    frameCounter
  } = useVideoProcessing({
    selectedFile,
    fps,
    setIsProcessing,
    setProcessingProgress,
    setCurrentFrame,
    setDetections,
    setViolations,
    onSessionUpdate,
    wsRef
  });

  const { connectWebSocket } = useWebSocket({
    wsRef,
    setCurrentFrame,
    setDetections,
    setViolations,
    setIsProcessing,
    setProcessingProgress,
    onDetectionUpdate,
    onViolationUpdate
  });

  const { drawDetections } = useDetectionDrawing({
    videoRef,
    canvasRef,
    fullScreenCanvasRef
  });

  // Sync session tracking across components
  useEffect(() => {
    if (currentSessionId) {
      console.log('📊 Syncing session tracking across components:', currentSessionId);

      // Set session tracking for ROI Zone Manager
      if (roiZoneManagerRef.current?.setSessionTracking) {
        roiZoneManagerRef.current.setSessionTracking(currentSessionId);
      }
    }
  }, [currentSessionId]);

  // Event handlers
  const handleFileSelect = (file) => {
    setSelectedFile(file);
    toast.success(`Video selected: ${file.name}`);
  };

  const handleViolationDetected = (violation) => {
    setViolations(prev => [...prev, violation]);
    if (onViolationUpdate) {
      onViolationUpdate(violation);
    }
    toast.error(`Violation detected: ${violation.description}`);
  };

  const handleStartProcessing = async () => {
    if (!selectedFile) {
      toast.error('Please select a video file first');
      return;
    }
    await startProcessing();
  };

  const handleStopProcessing = async () => {
    await stopProcessing();
  };

  const handleFpsChange = (newFps) => {
    setFps(newFps);
  };

  const handleToggleROIManager = () => {
    setShowROIManager(!showROIManager);
  };

  const handleZonesUpdate = (zones) => {
    setRoiZones(zones);
  };

  const handleFrameLoad = () => {
    const img = videoRef.current;
    if (img) {
      const rect = img.getBoundingClientRect();
      setFrameSize({
        width: img.naturalWidth || rect.width,
        height: img.naturalHeight || rect.height
      });
      // Small delay to ensure image is fully rendered
      setTimeout(() => drawDetections(detections), 50);
    }
  };

  return (
    <div className="video-processor">
      {/* Video Upload Section */}
      <VideoUploader
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        isProcessing={isProcessing}
      />

      {/* Processing Controls */}
      <ProcessingControls
        selectedFile={selectedFile}
        isProcessing={isProcessing}
        fps={fps}
        processingProgress={processingProgress}
        onStartProcessing={handleStartProcessing}
        onStopProcessing={handleStopProcessing}
        onFpsChange={handleFpsChange}
        onToggleROIManager={handleToggleROIManager}
        showROIManager={showROIManager}
        roiZones={roiZones}
      />

      {/* Video Display */}
      <VideoDisplay
        currentFrame={currentFrame}
        detections={detections}
        violations={violations}
        roiZones={roiZones}
        frameSize={frameSize}
        showROIManager={showROIManager}
        isProcessing={isProcessing}
        videoRef={videoRef}
        canvasRef={canvasRef}
        fullScreenCanvasRef={fullScreenCanvasRef}
        onFrameLoad={handleFrameLoad}
        onZonesUpdate={handleZonesUpdate}
        onViolationDetected={handleViolationDetected}
        drawDetections={drawDetections}
        roiZoneManagerRef={roiZoneManagerRef}
      />

      {/* Detection Statistics */}
      {detections.length > 0 && (
        <DetectionStats
          detections={detections}
          videoRef={videoRef}
          canvasRef={canvasRef}
        />
      )}

      {/* Violation Alerts */}
      {violations.length > 0 && (
        <ViolationAlerts violations={violations} />
      )}

      {/* Violation Detection Controls */}
      {roiZones.length > 0 && (
        <ViolationControls
          detections={detections}
          zones={roiZones}
          frameWidth={frameSize.width}
          frameHeight={frameSize.height}
          onViolationDetected={handleViolationDetected}
        />
      )}

      {/* Violation History */}
      {!isProcessing && violations.length > 0 && (
        <ViolationHistory violations={violations} />
      )}
    </div>
  );
};

export default VideoProcessor;
