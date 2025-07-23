/**
 * Video Uploader Component
 * Handles video file selection, upload, and processing controls
 */

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';

const VideoUploader = ({
  selectedFile,
  onFileSelect,
  isProcessing,
  fps,
  onFpsChange,
  processingProgress,
  onStartProcessing,
  onStopProcessing,
  onClearFile
}) => {
  // Handle file drop
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith('video/')) {
      onFileSelect(file);
      toast.success(`Video selected: ${file.name}`);
    } else {
      toast.error('Please select a valid video file');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    multiple: false
  });

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">🎥 Video Processing</h2>
      </div>

      {!selectedFile ? (
        <div {...getRootProps()} className={`upload-area ${isDragActive ? 'drag-over' : ''}`}>
          <input {...getInputProps()} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <h3>Drop video file here or click to browse</h3>
            <p>Supports MP4, AVI, MOV, MKV, WebM</p>
          </div>
        </div>
      ) : (
        <div>
          {/* File Information */}
          <div style={{ 
            marginBottom: '20px', 
            padding: '16px', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '8px' 
          }}>
            <h4>📹 Selected Video:</h4>
            <p><strong>Name:</strong> {selectedFile.name}</p>
            <p><strong>Size:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {selectedFile.type}</p>
          </div>

          {/* FPS Control */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>
              <strong>Processing FPS:</strong>
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={fps}
              onChange={(e) => onFpsChange(parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: '8px' }}
              disabled={isProcessing}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{fps} FPS</span>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                {fps <= 5 && '🐌 Slow & Accurate'}
                {fps > 5 && fps <= 15 && '⚖️ Balanced'}
                {fps > 15 && '🚀 Fast Processing'}
              </div>
            </div>
          </div>

          {/* Processing Controls */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
            {!isProcessing ? (
              <>
                <button 
                  className="btn btn-success" 
                  onClick={onStartProcessing}
                  style={{ flex: 1 }}
                >
                  ▶️ Start Processing
                </button>
                <button 
                  className="btn btn-warning" 
                  onClick={onClearFile}
                  style={{ flex: 1 }}
                >
                  🔄 Select Different Video
                </button>
              </>
            ) : (
              <button 
                className="btn btn-danger" 
                onClick={onStopProcessing}
                style={{ width: '100%' }}
              >
                ⏹️ Stop Processing
              </button>
            )}
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '8px' 
              }}>
                <span>Processing Progress</span>
                <span>{processingProgress.toFixed(1)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${processingProgress}%` }}
                ></div>
              </div>
              
              {/* Processing Status */}
              <div style={{ 
                marginTop: '12px', 
                padding: '8px 12px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '6px',
                border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="processing-spinner"></div>
                  <span style={{ color: '#3b82f6', fontWeight: '500' }}>
                    Processing video at {fps} FPS...
                  </span>
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>
                  {processingProgress < 25 && 'Initializing video processing...'}
                  {processingProgress >= 25 && processingProgress < 50 && 'Analyzing frames...'}
                  {processingProgress >= 50 && processingProgress < 75 && 'Detecting objects...'}
                  {processingProgress >= 75 && processingProgress < 100 && 'Finalizing results...'}
                  {processingProgress >= 100 && 'Processing complete!'}
                </div>
              </div>
            </div>
          )}

          {/* File Format Information */}
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '6px',
            fontSize: '12px',
            opacity: 0.8
          }}>
            <div style={{ marginBottom: '4px' }}>
              <strong>💡 Processing Tips:</strong>
            </div>
            <ul style={{ margin: 0, paddingLeft: '16px' }}>
              <li>Lower FPS = More accurate detection but slower processing</li>
              <li>Higher FPS = Faster processing but may miss quick movements</li>
              <li>Recommended: 10-15 FPS for balanced performance</li>
              <li>Large files may take longer to upload and process</li>
            </ul>
          </div>
        </div>
      )}

      {/* CSS for processing spinner */}
      <style jsx>{`
        .processing-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(59, 130, 246, 0.3);
          border-top: 2px solid #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .upload-area {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          background: rgba(255, 255, 255, 0.05);
        }

        .upload-area:hover {
          border-color: #007bff;
          background: rgba(0, 123, 255, 0.1);
        }

        .upload-area.drag-over {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.1);
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #28a745, #20c997);
          transition: width 0.3s ease;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default VideoUploader;
