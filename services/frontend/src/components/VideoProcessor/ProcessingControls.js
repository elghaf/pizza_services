/**
 * ProcessingControls - Component for video processing controls
 */

import React from 'react';

const ProcessingControls = ({
  selectedFile,
  isProcessing,
  fps,
  processingProgress,
  onStartProcessing,
  onStopProcessing,
  onFpsChange,
  onToggleROIManager,
  showROIManager,
  roiZones
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">⚙️ Processing Controls</h2>
      </div>
      <div className="card-content">
        
        {/* FPS Control */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            🎯 Processing Speed (FPS): {fps}
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={fps}
            onChange={(e) => onFpsChange(parseInt(e.target.value))}
            disabled={isProcessing}
            style={{
              width: '100%',
              marginBottom: '8px'
            }}
          />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '12px', 
            color: '#888',
            marginBottom: '8px'
          }}>
            <span>1 FPS (Fastest)</span>
            <span>15 FPS (Balanced)</span>
            <span>30 FPS (Most Detailed)</span>
          </div>
          <div style={{
            padding: '8px 12px',
            background: 'rgba(74, 144, 226, 0.1)',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#4a90e2'
          }}>
            <strong>ℹ️ Speed Guide:</strong><br />
            • Lower FPS = Faster processing, fewer frames analyzed<br />
            • Higher FPS = Slower processing, more detailed analysis<br />
            • Recommended: 10-15 FPS for balanced performance
          </div>
        </div>

        {/* ROI Zone Configuration */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={onToggleROIManager}
            disabled={isProcessing}
            style={{
              width: '100%',
              padding: '12px',
              background: showROIManager ? '#ef4444' : '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              opacity: isProcessing ? 0.6 : 1,
              transition: 'all 0.3s ease'
            }}
          >
            {showROIManager ? '❌ Close Zone Manager' : '🎯 Configure Zones'}
          </button>
          
          {roiZones.length > 0 && (
            <div style={{
              marginTop: '8px',
              padding: '8px 12px',
              background: 'rgba(0, 255, 136, 0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              fontSize: '14px'
            }}>
              <span style={{ color: '#00FF88', fontWeight: 'bold' }}>
                ✅ {roiZones.length} ROI Zone{roiZones.length > 1 ? 's' : ''} Configured
              </span>
            </div>
          )}
        </div>

        {/* Processing Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <button
            onClick={onStartProcessing}
            disabled={!selectedFile || isProcessing}
            style={{
              flex: 1,
              padding: '12px',
              background: (!selectedFile || isProcessing) ? '#666' : '#00FF88',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: (!selectedFile || isProcessing) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            {isProcessing ? '⏳ Processing...' : '▶️ Start Processing'}
          </button>

          <button
            onClick={onStopProcessing}
            disabled={!isProcessing}
            style={{
              flex: 1,
              padding: '12px',
              background: !isProcessing ? '#666' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: !isProcessing ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            ⏹️ Stop Processing
          </button>
        </div>

        {/* Processing Progress */}
        {isProcessing && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ fontWeight: 'bold' }}>📊 Processing Progress</span>
              <span style={{ color: '#4a90e2', fontWeight: 'bold' }}>
                {processingProgress.toFixed(1)}%
              </span>
            </div>
            <div style={{
              width: '100%',
              height: '8px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${processingProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4a90e2, #00FF88)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}

        {/* Status Information */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>📁 File:</strong> {selectedFile ? selectedFile.name : 'No file selected'}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>⚡ FPS:</strong> {fps} frames per second
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>🎯 ROI Zones:</strong> {roiZones.length} configured
          </div>
          <div>
            <strong>🔄 Status:</strong> {
              isProcessing ? 'Processing video...' :
              selectedFile ? 'Ready to process' :
              'Waiting for video file'
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingControls;
