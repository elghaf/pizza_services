/**
 * Video Display Component
 * Handles video frame display with detection overlays and full-screen mode
 */

import React, { useRef, useEffect } from 'react';
import ROIZoneManager from '../../ROIZoneManager';
import ViolationDetector from '../../ViolationDetector';

const VideoDisplay = ({
  currentFrame,
  detections = [],
  violations = [],
  roiZones = [],
  frameSize,
  isFullScreen,
  onToggleFullScreen,
  onFrameLoad,
  showROIManager = false,
  processingProgress = 0,
  onViolationDetected
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fullScreenCanvasRef = useRef(null);

  // Handle frame load and update frame size
  const handleFrameLoad = () => {
    console.log('🖼️ Image loaded, updating frame size...');
    const img = videoRef.current;
    if (img) {
      const rect = img.getBoundingClientRect();
      const newFrameSize = {
        width: img.naturalWidth || rect.width,
        height: img.naturalHeight || rect.height
      };
      
      console.log('📐 Frame size updated:', {
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        display: `${rect.width}x${rect.height}`
      });
      
      onFrameLoad(newFrameSize);
    }
  };

  if (!currentFrame) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🔍 Real-time Detection & Violations</h2>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '300px',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📺</div>
            <p>Video feed will appear here during processing</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">🔍 Real-time Detection & Violations</h2>
        <button
          className="btn btn-primary"
          onClick={onToggleFullScreen}
          style={{ marginLeft: 'auto' }}
          title="Full Screen (Press F or click)"
        >
          🔍 Full Screen
        </button>
      </div>

      <div className="video-container">
        <div style={{
          position: 'relative',
          display: 'inline-block',
          width: '100%',
          maxWidth: '100%'
        }}>
          {/* Main Video Frame */}
          <img
            ref={videoRef}
            src={`data:image/jpeg;base64,${currentFrame}`}
            alt="Current frame"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '8px',
              display: 'block',
              maxWidth: '100%'
            }}
            onLoad={handleFrameLoad}
            onError={(e) => {
              console.error('❌ Image load error:', e);
            }}
          />

          {/* Detection Canvas for Bounding Boxes */}
          <canvas
            ref={canvasRef}
            className="detection-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              borderRadius: '8px',
              zIndex: 10
            }}
          />

          {/* ROI Zones Overlay in Real-time View */}
          {!showROIManager && roiZones.length > 0 && (
            <ROIZoneManager
              currentFrame={currentFrame}
              onZonesUpdate={() => {}} // Read-only in real-time view
              existingZones={roiZones}
              isEnabled={false} // Read-only overlay
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
            />
          )}

          {/* Violation Detection Overlay - Visual Only */}
          {!showROIManager && roiZones.length > 0 && (
            <div style={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              width: '100%', 
              height: '100%', 
              pointerEvents: 'none', 
              zIndex: 40 
            }}>
              <ViolationDetector
                detections={detections}
                zones={roiZones}
                frameWidth={frameSize.width}
                frameHeight={frameSize.height}
                onViolationDetected={onViolationDetected}
                hideControls={true}
              />
            </div>
          )}

          {/* Detection Count Overlay */}
          {detections.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 50
            }}>
              🔍 {detections.length} object{detections.length !== 1 ? 's' : ''} detected
            </div>
          )}

          {/* Violation Alert Overlay */}
          {violations.length > 0 && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(239, 68, 68, 0.95)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: 50,
              animation: 'pulse 2s infinite'
            }}>
              🚨 {violations.length} violation{violations.length !== 1 ? 's' : ''} detected
            </div>
          )}
        </div>
      </div>

      {/* Zone Status Indicators */}
      {!showROIManager && roiZones.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(0,255,136,0.2)',
          borderRadius: '6px',
          border: '2px solid #00FF88'
        }}>
          <span style={{ color: '#00FF88', fontWeight: 'bold' }}>
            🎯 {roiZones.length} ROI Zone{roiZones.length > 1 ? 's' : ''} Active | Violation Detection: ON
          </span>
        </div>
      )}

      {!showROIManager && roiZones.length === 0 && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(255,210,63,0.2)',
          borderRadius: '6px',
          border: '2px solid #FFD23F'
        }}>
          <span style={{ color: '#FFD23F', fontWeight: 'bold' }}>
            ⚠️ No ROI Zones Configured | Click "🎯 Configure Zones" to set up violation detection
          </span>
        </div>
      )}

      {/* Detection Stats */}
      {detections.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4>Current Detections ({detections.length}):</h4>
          <div className="detection-list" style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {detections.map((detection, index) => (
              <div key={index} className={`detection-item ${detection.class_name}`}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <strong>{detection.class_name.toUpperCase()}</strong>
                  <span style={{
                    background: detection.class_name === 'hand' ? '#00D4FF' :
                              detection.class_name === 'person' ? '#FF6B9D' :
                              detection.class_name === 'scooper' ? '#00FF88' :
                              detection.class_name === 'pizza' ? '#FFB800' : '#666',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    {(detection.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <small style={{ opacity: 0.8 }}>
                  Box: ({detection.bbox.x1.toFixed(0)}, {detection.bbox.y1.toFixed(0)}) →
                  ({detection.bbox.x2.toFixed(0)}, {detection.bbox.y2.toFixed(0)})
                  <br />
                  Size: {detection.bbox.width?.toFixed(0) || (detection.bbox.x2 - detection.bbox.x1).toFixed(0)}×
                  {detection.bbox.height?.toFixed(0) || (detection.bbox.y2 - detection.bbox.y1).toFixed(0)}px
                </small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violation Alerts */}
      {violations.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#ef4444' }}>🚨 Recent Violations:</h4>
          <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
            {violations.slice(-3).map((violation, index) => (
              <div key={index} className="violation-alert">
                <strong>{violation.violation_type}</strong>
                <br />
                <small>{violation.description}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }

        .detection-item {
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          border-left: 4px solid #00D4FF;
        }

        .detection-item.person {
          border-left-color: #FF6B9D;
        }

        .detection-item.scooper {
          border-left-color: #00FF88;
        }

        .detection-item.pizza {
          border-left-color: #FFB800;
        }

        .violation-alert {
          padding: 8px 12px;
          margin-bottom: 8px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 6px;
          border-left: 4px solid #ef4444;
          color: #ef4444;
        }
      `}</style>
    </div>
  );
};

export default VideoDisplay;
