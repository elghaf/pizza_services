/**
 * DetectionStats - Component for displaying detection statistics and results
 */

import React, { useState, useEffect } from 'react';

const DetectionStats = ({ detections, videoRef, canvasRef }) => {
  const [selectedDetection, setSelectedDetection] = useState(null);
  const [detectionCounts, setDetectionCounts] = useState({});

  // Calculate detection statistics
  useEffect(() => {
    const counts = {};
    detections.forEach(detection => {
      const className = detection.class_name || detection.class || 'unknown';
      counts[className] = (counts[className] || 0) + 1;
    });
    setDetectionCounts(counts);
  }, [detections]);

  // Highlight specific detection
  const highlightDetection = (detection) => {
    setSelectedDetection(detection);
    
    // Draw highlight on canvas
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (canvas && video) {
      const ctx = canvas.getContext('2d');
      const rect = video.getBoundingClientRect();
      
      // Set canvas size to match video display
      canvas.width = rect.width;
      canvas.height = rect.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate scale factors
      const scaleX = rect.width / (video.naturalWidth || rect.width);
      const scaleY = rect.height / (video.naturalHeight || rect.height);
      
      // Draw all detections with reduced opacity
      detections.forEach(det => {
        const bbox = det.bbox || det.bounding_box;
        if (bbox) {
          const x = bbox.x1 * scaleX;
          const y = bbox.y1 * scaleY;
          const width = (bbox.x2 - bbox.x1) * scaleX;
          const height = (bbox.y2 - bbox.y1) * scaleY;
          
          ctx.strokeStyle = det === detection ? '#00FF88' : 'rgba(74, 144, 226, 0.3)';
          ctx.lineWidth = det === detection ? 3 : 1;
          ctx.strokeRect(x, y, width, height);
          
          if (det === detection) {
            // Fill for highlighted detection
            ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
            ctx.fillRect(x, y, width, height);
            
            // Label for highlighted detection
            ctx.fillStyle = '#00FF88';
            ctx.font = 'bold 14px Arial';
            ctx.fillText(
              `${det.class_name || det.class} (${(det.confidence * 100).toFixed(1)}%)`,
              x,
              y - 5
            );
          }
        }
      });
    }
  };

  // Clear highlight
  const clearHighlight = () => {
    setSelectedDetection(null);
    
    // Redraw all detections normally
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (canvas && video) {
      const ctx = canvas.getContext('2d');
      const rect = video.getBoundingClientRect();
      
      canvas.width = rect.width;
      canvas.height = rect.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const scaleX = rect.width / (video.naturalWidth || rect.width);
      const scaleY = rect.height / (video.naturalHeight || rect.height);
      
      detections.forEach(detection => {
        const bbox = detection.bbox || detection.bounding_box;
        if (bbox) {
          const x = bbox.x1 * scaleX;
          const y = bbox.y1 * scaleY;
          const width = (bbox.x2 - bbox.x1) * scaleX;
          const height = (bbox.y2 - bbox.y1) * scaleY;
          
          ctx.strokeStyle = '#4a90e2';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, width, height);
          
          ctx.fillStyle = '#4a90e2';
          ctx.font = '12px Arial';
          ctx.fillText(
            `${detection.class_name || detection.class} (${(detection.confidence * 100).toFixed(1)}%)`,
            x,
            y - 5
          );
        }
      });
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">📊 Detection Results</h2>
      </div>
      <div className="card-content">
        
        {/* Detection Summary */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '12px',
              background: 'rgba(74, 144, 226, 0.1)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4a90e2' }}>
                {detections.length}
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Total Objects</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'rgba(0, 255, 136, 0.1)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00FF88' }}>
                {Object.keys(detectionCounts).length}
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Object Types</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'rgba(255, 210, 63, 0.1)',
              borderRadius: '6px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#FFD23F' }}>
                {detections.length > 0 ? 
                  (detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length * 100).toFixed(1) + '%' 
                  : '0%'
                }
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Avg Confidence</div>
            </div>
          </div>
        </div>

        {/* Object Type Breakdown */}
        {Object.keys(detectionCounts).length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '12px', color: '#4a90e2' }}>🏷️ Object Types</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(detectionCounts).map(([className, count]) => (
                <div
                  key={className}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(74, 144, 226, 0.2)',
                    borderRadius: '16px',
                    fontSize: '14px',
                    border: '1px solid rgba(74, 144, 226, 0.3)'
                  }}
                >
                  <span style={{ fontWeight: 'bold' }}>{className}</span>
                  <span style={{ 
                    marginLeft: '6px', 
                    padding: '2px 6px', 
                    background: '#4a90e2', 
                    borderRadius: '10px',
                    fontSize: '12px'
                  }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Individual Detections List */}
        <div>
          <h3 style={{ marginBottom: '12px', color: '#4a90e2' }}>🔍 Individual Detections</h3>
          <div style={{ 
            maxHeight: '300px', 
            overflowY: 'auto',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px'
          }}>
            {detections.map((detection, index) => {
              const bbox = detection.bbox || detection.bounding_box;
              const className = detection.class_name || detection.class || 'unknown';
              const confidence = detection.confidence || 0;
              
              return (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    borderBottom: index < detections.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    cursor: 'pointer',
                    background: selectedDetection === detection ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={() => highlightDetection(detection)}
                  onMouseLeave={clearHighlight}
                  onClick={() => highlightDetection(detection)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#4a90e2' }}>
                        {className}
                      </div>
                      {bbox && (
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          Position: ({bbox.x1?.toFixed(0)}, {bbox.y1?.toFixed(0)}) - 
                          ({bbox.x2?.toFixed(0)}, {bbox.y2?.toFixed(0)})
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '4px 8px',
                      background: confidence > 0.8 ? '#00FF88' : confidence > 0.6 ? '#FFD23F' : '#ef4444',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'black'
                    }}>
                      {(confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {detections.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#888'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p>No objects detected in current frame</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DetectionStats;
