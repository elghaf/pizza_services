/**
 * VideoProcessor - Main component for video processing functionality
 * Split into smaller, focused components for better maintainability
 */

import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';

import VideoUploader from './VideoUploader';
import ProcessingControls from './ProcessingControls';
import VideoDisplay from './VideoDisplay';
import DetectionStats from './DetectionStats';
import ViolationAlerts from './ViolationAlerts';
import ViolationControls from './ViolationControls';
import ViolationHistory from './ViolationHistory';
import ViolationStatusOverlay from './ViolationStatusOverlay';
import useVideoProcessing from './hooks/useVideoProcessing';
import useWebSocket from './hooks/useWebSocket';
import useDetectionDrawing from './hooks/useDetectionDrawing';

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
  const [violationStats, setViolationStats] = useState({});

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fullScreenCanvasRef = useRef(null);
  const wsRef = useRef(null);

  // Custom hooks for functionality
  const { startProcessing, stopProcessing } = useVideoProcessing({
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

  // Fetch violation statistics
  const fetchViolationStats = async () => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE_URL}/violations/stats`);
      if (response.ok) {
        const stats = await response.json();
        setViolationStats(stats);
      }
    } catch (error) {
      console.error('Failed to fetch violation statistics:', error);
    }
  };

  // Fetch stats periodically when processing
  React.useEffect(() => {
    if (isProcessing) {
      fetchViolationStats();
      const interval = setInterval(fetchViolationStats, 5000); // Every 5 seconds
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

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
        <ViolationAlerts violations={violations} stats={violationStats} />
      )}

      {/* Violation Detection Controls */}
      {!isProcessing && roiZones.length > 0 && (
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
