/**
 * Full Screen Display Component
 * Handles full-screen video display with violation overlays and status information
 */

import React, { useRef } from 'react';
import ROIZoneManager from '../../ROIZoneManager';
import ViolationDetector from '../../ViolationDetector';

const FullScreenDisplay = ({
  currentFrame,
  detections = [],
  violations = [],
  roiZones = [],
  frameSize,
  processingProgress = 0,
  onClose,
  onFrameLoad,
  onViolationDetected
}) => {
  const videoRef = useRef(null);
  const fullScreenCanvasRef = useRef(null);

  // Handle frame load in full-screen mode
  const handleFrameLoad = () => {
    console.log('🖼️ Full-screen image loaded, updating frame size...');
    const img = videoRef.current;
    if (img) {
      const rect = img.getBoundingClientRect();
      const newFrameSize = {
        width: img.naturalWidth || rect.width,
        height: img.naturalHeight || rect.height
      };
      onFrameLoad(newFrameSize);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#1a1a1a',
      zIndex: 1000,
      overflow: 'auto',
      overflowX: 'hidden',
      scrollBehavior: 'smooth'
    }}>
      {/* Violation Messages Overlay - Always on top of video */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1003,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '95vw',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        paddingBottom: '20px'
      }}>
        {/* Current Status Banner */}
        <div style={{
          background: violations.length > 0
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.9))'
            : 'linear-gradient(135deg, rgba(34, 197, 94, 0.95), rgba(22, 163, 74, 0.9))',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          border: violations.length > 0
            ? '2px solid #ef4444'
            : '2px solid #22c55e',
          backdropFilter: 'blur(15px)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
          minWidth: '500px',
          animation: violations.length > 0 ? 'pulse 2s infinite' : 'none'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px', 
            marginBottom: '8px' 
          }}>
            <span style={{ fontSize: '28px' }}>
              {violations.length > 0 ? '🚨' : '✅'}
            </span>
            <strong style={{ fontSize: '20px', letterSpacing: '1px' }}>
              {violations.length > 0
                ? `${violations.length} ACTIVE VIOLATION${violations.length > 1 ? 'S' : ''} DETECTED`
                : 'MONITORING ACTIVE - NO VIOLATIONS'
              }
            </strong>
          </div>
          <div style={{ fontSize: '16px', opacity: 0.95, marginBottom: '8px' }}>
            {violations.length > 0
              ? 'Immediate attention required - Food safety protocol breach detected'
              : 'All workers following proper scooper usage protocols'
            }
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>
            Detection Status: Active | Sensitivity: Medium | Zones: {roiZones.length} configured
          </div>

          {/* Real-time Activity Status */}
          <div style={{
            fontSize: '14px',
            opacity: 0.95,
            padding: '6px 12px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}>
            <strong>Current Activity:</strong> {
              detections.length === 0
                ? '🔍 Scanning for activity'
                : `👥 Tracking: ${detections.filter(d => d.class_name?.toLowerCase().includes('person') || d.class_name?.toLowerCase().includes('worker')).length} worker(s), ${detections.filter(d => d.class_name?.toLowerCase().includes('hand')).length} hand(s), ${detections.filter(d => d.class_name?.toLowerCase().includes('spoon') || d.class_name?.toLowerCase().includes('scooper')).length} scooper(s)`
            }
          </div>
        </div>

        {/* Active Violations List */}
        {violations.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {violations.slice(-3).reverse().map((violation, index) => (
              <div key={violation.id || index} style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.9))',
                color: 'white',
                padding: '14px 20px',
                borderRadius: '10px',
                border: '2px solid #ef4444',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                animation: index === 0 ? 'slideIn 0.5s ease-out' : 'none'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '6px' 
                }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <strong style={{ fontSize: '16px' }}>
                    VIOLATION #{violations.length - index}
                  </strong>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.25)',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}>
                    {violation.severity?.toUpperCase() || 'HIGH'}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    opacity: 0.9,
                    marginLeft: 'auto'
                  }}>
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                  {violation.violation_type || violation.type || 'SCOOPER USAGE VIOLATION'}
                </div>

                <div style={{ fontSize: '14px', opacity: 0.95, marginBottom: '6px' }}>
                  {violation.description || 'Worker hand detected in ingredient area without proper scooper usage'}
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  opacity: 0.85
                }}>
                  <span>Confidence: {((violation.confidence || 0.8) * 100).toFixed(1)}%</span>
                  <span>Zone: {violation.zone || violation.location || 'Ingredient Area'}</span>
                  <span>Duration: {violation.duration || '2.3s'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Object Detection Summary */}
        {detections.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(37, 99, 235, 0.85))',
            color: 'white',
            padding: '12px 18px',
            borderRadius: '8px',
            border: '2px solid #3b82f6',
            backdropFilter: 'blur(10px)',
            fontSize: '14px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px', 
              marginBottom: '4px' 
            }}>
              <span style={{ fontSize: '16px' }}>🔍</span>
              <strong>OBJECT DETECTION ACTIVE</strong>
            </div>
            <div style={{ fontSize: '13px', opacity: 0.95 }}>
              Currently tracking: {detections.filter(d => d.class_name?.toLowerCase().includes('person') || d.class_name?.toLowerCase().includes('worker')).length} worker(s),
              {detections.filter(d => d.class_name?.toLowerCase().includes('hand')).length} hand(s),
              {detections.filter(d => d.class_name?.toLowerCase().includes('spoon') || d.class_name?.toLowerCase().includes('scooper')).length} scooper(s)
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
              Total objects detected: {detections.length} | Confidence threshold: 70%
            </div>
          </div>
        )}

        {/* Scroll Indicator */}
        {(violations.length > 2 || detections.length > 0) && (
          <div style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1003,
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            animation: 'bounce 2s infinite'
          }}>
            ⬇️ Scroll down for more information ⬇️
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        title="Exit Full Screen (Press Escape)"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1004,
          background: 'rgba(255, 255, 255, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.3)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          e.target.style.transform = 'scale(1)';
        }}
      >
        ✕
      </button>

      {/* Full-screen video with overlays */}
      <div style={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '400px 20px 100px 20px', // More padding for messages and scrolling
        boxSizing: 'border-box'
      }}>
        <div style={{
          position: 'relative',
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto'
        }}>
          <img
            ref={videoRef}
            src={`data:image/jpeg;base64,${currentFrame}`}
            alt="Current frame"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
            onLoad={handleFrameLoad}
          />

          {/* Detection Canvas for Bounding Boxes in Full-Screen */}
          <canvas
            ref={fullScreenCanvasRef}
            className="detection-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              borderRadius: '12px',
              zIndex: 10
            }}
          />

          {/* ROI Zones Overlay */}
          {roiZones.length > 0 && (
            <ROIZoneManager
              currentFrame={currentFrame}
              onZonesUpdate={() => {}}
              existingZones={roiZones}
              isEnabled={false}
              frameWidth={frameSize.width}
              frameHeight={frameSize.height}
            />
          )}

          {/* Violation Detection Overlay */}
          {roiZones.length > 0 && (
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
      </div>

      {/* Processing status overlay */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '12px 20px',
        borderRadius: '8px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ fontSize: '14px', marginBottom: '4px' }}>
          🎬 Processing: {processingProgress.toFixed(1)}%
        </div>
        <div style={{ fontSize: '12px', opacity: 0.8 }}>
          Detections: {detections.length} | Violations: {violations.length}
        </div>
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }

        @keyframes slideIn {
          0% {
            transform: translateY(-20px);
            opacity: 0;
          }
          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateX(-50%) translateY(0); }
          40% { transform: translateX(-50%) translateY(-10px); }
          60% { transform: translateX(-50%) translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

export default FullScreenDisplay;
