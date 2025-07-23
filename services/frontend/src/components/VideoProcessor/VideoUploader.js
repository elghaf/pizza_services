/**
 * VideoUploader - Component for handling video file uploads
 */

import React from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-toastify';

const VideoUploader = ({ selectedFile, onFileSelect, isProcessing }) => {
  // Handle file drop
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith('video/')) {
      onFileSelect(file);
    } else {
      toast.error('Please select a valid video file');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    multiple: false,
    disabled: isProcessing
  });

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">📹 Video Upload</h2>
      </div>
      <div className="card-content">
        <div
          {...getRootProps()}
          className={`upload-zone ${isDragActive ? 'drag-active' : ''} ${isProcessing ? 'disabled' : ''}`}
          style={{
            border: '2px dashed #4a90e2',
            borderRadius: '8px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            backgroundColor: isDragActive ? 'rgba(74, 144, 226, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            transition: 'all 0.3s ease',
            opacity: isProcessing ? 0.6 : 1
          }}
        >
          <input {...getInputProps()} />
          
          {selectedFile ? (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ color: '#4a90e2', marginBottom: '8px' }}>
                {selectedFile.name}
              </h3>
              <p style={{ color: '#888', marginBottom: '16px' }}>
                Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              {!isProcessing && (
                <p style={{ color: '#4a90e2' }}>
                  Click or drag to select a different video
                </p>
              )}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
              <h3 style={{ color: '#4a90e2', marginBottom: '8px' }}>
                {isDragActive ? 'Drop video here...' : 'Upload Video File'}
              </h3>
              <p style={{ color: '#888', marginBottom: '16px' }}>
                Drag & drop a video file here, or click to browse
              </p>
              <p style={{ color: '#666', fontSize: '14px' }}>
                Supported formats: MP4, AVI, MOV, MKV, WebM (max 500MB)
              </p>
            </div>
          )}
        </div>

        {selectedFile && (
          <div style={{ 
            marginTop: '16px', 
            padding: '12px', 
            background: 'rgba(74, 144, 226, 0.1)', 
            borderRadius: '6px',
            border: '1px solid rgba(74, 144, 226, 0.3)'
          }}>
            <h4 style={{ margin: '0 0 8px 0', color: '#4a90e2' }}>📋 File Details:</h4>
            <div style={{ fontSize: '14px', color: '#ccc' }}>
              <div><strong>Name:</strong> {selectedFile.name}</div>
              <div><strong>Size:</strong> {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
              <div><strong>Type:</strong> {selectedFile.type}</div>
              <div><strong>Last Modified:</strong> {new Date(selectedFile.lastModified).toLocaleString()}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoUploader;
