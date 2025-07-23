/**
 * VideoDisplay - Component for displaying video frames with detections and ROI overlays
 */

import React from 'react';
import ROIZoneManager from '../ROIZoneManager';
import ViolationDetector from '../ViolationDetector';

const VideoDisplay = ({
  currentFrame,
  detections,
  violations,
  roiZones,
  frameSize,
  showROIManager,
  isProcessing,
  videoRef,
  canvasRef,
  fullScreenCanvasRef,
  onFrameLoad,
  onZonesUpdate,
  onViolationDetected,
  drawDetections,
  roiZoneManagerRef
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">
          {showROIManager ? '🎯 ROI Zone Configuration' : '📺 Video Processing'}
        </h2>
      </div>
      <div className="card-content">
        
        {/* ROI Zone Manager */}
        {showROIManager && (
          <div style={{ marginBottom: '20px' }}>
            <ROIZoneManager
              ref={roiZoneManagerRef}
              currentFrame={currentFrame}
              onZonesUpdate={onZonesUpdate}
              existingZones={roiZones}
              isEnabled={true}
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
            />
          </div>
        )}

        {/* Video Display Area */}
        <div style={{
          position: 'relative',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: '300px'
        }}>
          {/* Debug Info */}
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 100
          }}>
            Frame: {currentFrame ? `${currentFrame.length} chars` : 'null'} |
            Processing: {isProcessing ? 'Yes' : 'No'} |
            Detections: {detections?.length || 0}
          </div>

          {currentFrame ? (
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
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
                onLoad={() => {
                  console.log('🖼️ Image loaded, updating frame size...');
                  const img = videoRef.current;
                  if (img) {
                    const rect = img.getBoundingClientRect();
                    console.log('📐 Frame size updated:', {
                      natural: `${img.naturalWidth}x${img.naturalHeight}`,
                      display: `${rect.width}x${rect.height}`
                    });
                  }
                  onFrameLoad();
                }}
                onError={(e) => {
                  console.error('❌ Image load error:', e);
                }}
              />
              
              {/* Detection Canvas Overlay */}
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
            </div>
          ) : (
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
          )}
        </div>

        {/* Zone Status Indicators */}
        {!showROIManager && (
          <div style={{ marginTop: '12px' }}>
            {roiZones.length > 0 ? (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(0,255,136,0.2)',
                borderRadius: '6px',
                border: '2px solid #00FF88'
              }}>
                <span style={{ color: '#00FF88', fontWeight: 'bold' }}>
                  🎯 {roiZones.length} ROI Zone{roiZones.length > 1 ? 's' : ''} Active | Violation Detection: ON
                </span>
              </div>
            ) : (
              <div style={{
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
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'rgba(74, 144, 226, 0.2)',
            borderRadius: '6px',
            border: '2px solid #4a90e2'
          }}>
            <span style={{ color: '#4a90e2', fontWeight: 'bold' }}>
              ⏳ Processing video... Real-time detection active
            </span>
          </div>
        )}

        {/* Debug Information */}
        {currentFrame && (
          <div style={{
            marginTop: '12px',
            padding: '8px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            <strong>🔧 Debug Info:</strong><br />
            Image: {videoRef.current?.naturalWidth || 'N/A'}×{videoRef.current?.naturalHeight || 'N/A'} →
            {videoRef.current?.getBoundingClientRect().width.toFixed(0) || 'N/A'}×
            {videoRef.current?.getBoundingClientRect().height.toFixed(0) || 'N/A'}<br />
            Canvas: {canvasRef.current?.width || 'N/A'}×{canvasRef.current?.height || 'N/A'}<br />
            Detections: {detections.length} | Violations: {violations.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoDisplay;
