import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';

const PolygonROIDrawer = ({ 
  currentFrame, 
  frameWidth, 
  frameHeight, 
  onPolygonComplete,
  isEnabled = false,
  ingredientType = "sauce"
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);

  // Colors for different ingredient types
  const ingredientColors = {
    sauce: '#FF6B35',      // Orange-red for sauce
    cheese: '#FFD23F',     // Yellow for cheese
    pepperoni: '#D32F2F',  // Red for pepperoni
    vegetables: '#4CAF50', // Green for vegetables
    meat: '#8D4E85',       // Purple for meat
    other: '#00D4FF'       // Blue for other
  };

  const currentColor = ingredientColors[ingredientType] || ingredientColors.other;

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentFrame) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw background frame
      ctx.drawImage(img, 0, 0);
      
      // Draw existing polygon
      drawPolygon(ctx);
    };
    img.src = `data:image/jpeg;base64,${currentFrame}`;
  }, [currentFrame, polygonPoints, previewPoint]);

  const drawPolygon = useCallback((ctx) => {
    if (polygonPoints.length === 0) return;

    ctx.save();
    
    // Draw polygon outline
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
    
    for (let i = 1; i < polygonPoints.length; i++) {
      ctx.lineTo(polygonPoints[i].x, polygonPoints[i].y);
    }
    
    // Draw preview line to current mouse position
    if (previewPoint && isDrawing) {
      ctx.setLineDash([5, 5]);
      ctx.lineTo(previewPoint.x, previewPoint.y);
    }
    
    // Close polygon if we have enough points
    if (polygonPoints.length > 2 && !isDrawing) {
      ctx.lineTo(polygonPoints[0].x, polygonPoints[0].y);
      ctx.fillStyle = currentColor + '20'; // Semi-transparent fill
      ctx.fill();
    }
    
    ctx.stroke();
    
    // Draw points
    polygonPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = currentColor;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Draw point number
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), point.x, point.y + 4);
    });
    
    ctx.restore();
  }, [polygonPoints, previewPoint, isDrawing, currentColor]);

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasClick = (event) => {
    if (!isEnabled) return;
    
    const point = getCanvasCoordinates(event);
    
    // Check if clicking near the first point to close polygon
    if (polygonPoints.length > 2) {
      const firstPoint = polygonPoints[0];
      const distance = Math.sqrt(
        Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.y - firstPoint.y, 2)
      );
      
      if (distance < 15) {
        // Close polygon
        completePolygon();
        return;
      }
    }
    
    // Add new point
    const newPoints = [...polygonPoints, point];
    setPolygonPoints(newPoints);
    setIsDrawing(true);
    
    toast.info(`Point ${newPoints.length} added. ${newPoints.length > 2 ? 'Click near first point to close.' : ''}`);
  };

  const handleMouseMove = (event) => {
    if (!isEnabled || !isDrawing) return;
    
    const point = getCanvasCoordinates(event);
    setPreviewPoint(point);
  };

  const completePolygon = () => {
    if (polygonPoints.length < 3) {
      toast.error('Polygon must have at least 3 points');
      return;
    }
    
    setIsDrawing(false);
    setPreviewPoint(null);
    
    // Calculate polygon area
    const area = calculatePolygonArea(polygonPoints);
    
    toast.success(`Polygon completed with ${polygonPoints.length} points (Area: ${Math.round(area)} px²)`);
    
    if (onPolygonComplete) {
      onPolygonComplete({
        points: polygonPoints,
        area: area,
        ingredientType: ingredientType
      });
    }
  };

  const calculatePolygonArea = (points) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area) / 2;
  };

  const clearPolygon = () => {
    setPolygonPoints([]);
    setIsDrawing(false);
    setPreviewPoint(null);
    toast.info('Polygon cleared');
  };

  const undoLastPoint = () => {
    if (polygonPoints.length > 0) {
      const newPoints = polygonPoints.slice(0, -1);
      setPolygonPoints(newPoints);
      
      if (newPoints.length === 0) {
        setIsDrawing(false);
        setPreviewPoint(null);
      }
      
      toast.info('Last point removed');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Controls */}
      <div style={{
        padding: '12px',
        background: 'rgba(0,0,0,0.8)',
        borderRadius: '8px',
        marginBottom: '12px',
        border: `2px solid ${currentColor}`
      }}>
        <div style={{ 
          color: currentColor, 
          fontWeight: 'bold', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: currentColor,
            borderRadius: '50%'
          }}></div>
          🎯 Polygon ROI Drawing - {ingredientType.toUpperCase()}
        </div>
        
        <div style={{ fontSize: '14px', color: '#ccc', marginBottom: '12px' }}>
          {!isDrawing && polygonPoints.length === 0 && 'Click to start drawing polygon'}
          {isDrawing && polygonPoints.length < 3 && `${polygonPoints.length} points added. Need ${3 - polygonPoints.length} more.`}
          {isDrawing && polygonPoints.length >= 3 && `${polygonPoints.length} points. Click near first point to close.`}
          {!isDrawing && polygonPoints.length >= 3 && `Polygon complete with ${polygonPoints.length} points`}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={undoLastPoint}
            disabled={polygonPoints.length === 0}
            style={{
              padding: '6px 12px',
              background: polygonPoints.length > 0 ? '#FF9800' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: polygonPoints.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
          >
            ↶ Undo Point
          </button>
          
          <button
            onClick={clearPolygon}
            disabled={polygonPoints.length === 0}
            style={{
              padding: '6px 12px',
              background: polygonPoints.length > 0 ? '#f44336' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: polygonPoints.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
          >
            🗑️ Clear
          </button>
          
          <button
            onClick={completePolygon}
            disabled={polygonPoints.length < 3}
            style={{
              padding: '6px 12px',
              background: polygonPoints.length >= 3 ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: polygonPoints.length >= 3 ? 'pointer' : 'not-allowed',
              fontSize: '12px'
            }}
          >
            ✅ Complete
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{
            maxWidth: '100%',
            height: 'auto',
            cursor: isEnabled ? 'crosshair' : 'default',
            border: `2px solid ${currentColor}`,
            borderRadius: '8px'
          }}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
        />
        
        {!currentFrame && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            color: '#ccc',
            borderRadius: '8px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎥</div>
              <p>Upload a video frame to start drawing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PolygonROIDrawer;
