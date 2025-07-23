import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'react-toastify';


const ROIZoneManager = ({ 
  currentFrame, 
  onZonesUpdate, 
  existingZones = [], 
  isEnabled = true,
  frameWidth = 640,
  frameHeight = 480 
}) => {
  const canvasRef = useRef(null);
  const [zones, setZones] = useState(existingZones);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentZone, setCurrentZone] = useState(null);
  const [selectedZoneType, setSelectedZoneType] = useState('sauce_area');
  const [editingZone, setEditingZone] = useState(null);
  const [showZones, setShowZones] = useState(true);

  // Professional polygon drawing states
  const [drawingMode, setDrawingMode] = useState('polygon'); // Start with polygon for sauce areas
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);

  // Advanced polygon editing states
  const [editingPolygon, setEditingPolygon] = useState(null); // Which polygon is being edited
  const [selectedPointIndex, setSelectedPointIndex] = useState(-1); // Which point is selected
  const [hoveredPointIndex, setHoveredPointIndex] = useState(-1); // Which point is hovered
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState(-1); // Which edge is hovered
  const [isDraggingPoint, setIsDraggingPoint] = useState(false); // Is dragging a point
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Drag offset for smooth dragging
  const [snapToGrid, setSnapToGrid] = useState(false); // Grid snapping
  const [gridSize, setGridSize] = useState(20); // Grid size for snapping
  const [undoStack, setUndoStack] = useState([]); // Undo history
  const [redoStack, setRedoStack] = useState([]); // Redo history

  // Zone types with professional configuration
  const zoneTypes = {
    sauce_area: {
      name: 'Sauce Area',
      color: '#FF6B35',
      fillColor: 'rgba(255, 107, 53, 0.2)',
      requiresScooper: true,
      icon: '🍅',
      description: 'Sauce dispensing and handling area',
      preferredShape: 'polygon' // Sauce areas work better with polygons
    },
    cheese_area: {
      name: 'Cheese Area',
      color: '#FFD23F',
      fillColor: 'rgba(255, 210, 63, 0.2)',
      requiresScooper: true,
      icon: '🧀',
      description: 'Cheese container and handling area',
      preferredShape: 'rectangle' // Cheese containers are usually rectangular
    },
    meat_area: {
      name: 'Meat/Protein Area',
      color: '#FF4757',
      fillColor: 'rgba(255, 71, 87, 0.2)',
      requiresScooper: true,
      icon: '🥓',
      description: 'Meat and protein ingredient area'
    },
    vegetable_area: {
      name: 'Vegetable Area',
      color: '#2ED573',
      fillColor: 'rgba(46, 213, 115, 0.2)',
      requiresScooper: true,
      icon: '🥬',
      description: 'Vegetable and fresh ingredient area'
    },
    prep_surface: {
      name: 'Prep Surface',
      color: '#5352ED',
      fillColor: 'rgba(83, 82, 237, 0.2)',
      requiresScooper: false,
      icon: '🍕',
      description: 'Pizza preparation surface (no scooper required)'
    },
    cleaning_area: {
      name: 'Cleaning Area',
      color: '#00D2D3',
      fillColor: 'rgba(0, 210, 211, 0.2)',
      requiresScooper: false,
      icon: '🧽',
      description: 'Cleaning and sanitization area'
    }
  };

  // Function definitions (moved to top to avoid hoisting issues)
  const findZoneAtPoint = (x, y) => {
    // x, y are in natural coordinates, zones are stored in natural coordinates
    return zones.find(zone => {
      if (zone.shape === 'polygon' && zone.points.length >= 3) {
        return isPointInPolygon(x, y, zone.points);
      } else if (zone.points.length === 2) {
        const [p1, p2] = zone.points;
        const inZone = x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x) &&
                      y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y);

        console.log(`🔍 Checking zone ${zone.name}:`, {
          point: { x, y },
          zone: { p1, p2 },
          inZone
        });

        return inZone;
      }
      return false;
    });
  };

  // Professional polygon editing utilities
  const snapToGridIfEnabled = (point) => {
    if (!snapToGrid) return point;
    return {
      x: Math.round(point.x / gridSize) * gridSize,
      y: Math.round(point.y / gridSize) * gridSize
    };
  };

  const getPointDistance = (p1, p2) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  };

  const findPointAtPosition = (points, position, threshold = 8) => {
    for (let i = 0; i < points.length; i++) {
      if (getPointDistance(points[i], position) <= threshold) {
        return i;
      }
    }
    return -1;
  };

  const findEdgeAtPosition = (points, position, threshold = 5) => {
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const distanceToEdge = distancePointToLine(position, p1, p2);
      if (distanceToEdge <= threshold) {
        return i;
      }
    }
    return -1;
  };

  const distancePointToLine = (point, lineStart, lineEnd) => {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return getPointDistance(point, lineStart);

    let param = dot / lenSq;
    param = Math.max(0, Math.min(1, param));

    const xx = lineStart.x + param * C;
    const yy = lineStart.y + param * D;

    return getPointDistance(point, { x: xx, y: yy });
  };

  const addPointToHistory = (action, data) => {
    const historyEntry = {
      action,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now()
    };

    setUndoStack(prev => [...prev.slice(-19), historyEntry]); // Keep last 20 actions
    setRedoStack([]); // Clear redo stack when new action is performed
  };

  const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
          (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  };

  const undo = () => {
    if (undoStack.length === 0) return;

    const lastAction = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, lastAction]);
    setUndoStack(prev => prev.slice(0, -1));

    // Apply undo logic based on action type
    switch (lastAction.action) {
      case 'addPoint':
        setPolygonPoints(lastAction.data.previousPoints);
        break;
      case 'movePoint':
        // Restore previous point position
        break;
      case 'deletePoint':
        // Restore deleted point
        break;
    }

    toast.info('↶ Undone');
  };

  const redo = () => {
    if (redoStack.length === 0) return;

    const actionToRedo = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, actionToRedo]);
    setRedoStack(prev => prev.slice(0, -1));

    // Apply redo logic
    toast.info('↷ Redone');
  };

  const drawZones = (zonesToDraw = zones) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      // Canvas might not be ready yet, skip drawing
      return;
    }

    const ctx = canvas.getContext('2d');

    // Get the background image to match its size
    const backgroundImg = document.getElementById('roi-background-image');
    let displayWidth, displayHeight, naturalWidth, naturalHeight;

    if (backgroundImg) {
      const rect = backgroundImg.getBoundingClientRect();
      displayWidth = rect.width;
      displayHeight = rect.height;
      naturalWidth = backgroundImg.naturalWidth || frameWidth;
      naturalHeight = backgroundImg.naturalHeight || frameHeight;

      canvas.width = displayWidth;
      canvas.height = displayHeight;
      canvas.style.width = displayWidth + 'px';
      canvas.style.height = displayHeight + 'px';
    } else {
      // Fallback to provided dimensions
      displayWidth = frameWidth;
      displayHeight = frameHeight;
      naturalWidth = frameWidth;
      naturalHeight = frameHeight;
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    // Calculate scaling factors from natural to display size
    const scaleX = displayWidth / naturalWidth;
    const scaleY = displayHeight / naturalHeight;

    console.log('🎨 Drawing zones on canvas:', {
      canvasSize: `${canvas.width}x${canvas.height}`,
      frameSize: `${frameWidth}x${frameHeight}`,
      naturalSize: `${naturalWidth}x${naturalHeight}`,
      displaySize: `${displayWidth}x${displayHeight}`,
      scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`,
      zones: zonesToDraw.length,
      backgroundImg: !!backgroundImg
    });

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showZones) return;

    // Draw each zone with proper coordinate scaling
    zonesToDraw.forEach((zone, index) => {
      const zoneConfig = zoneTypes[zone.type];

      if (zone.shape === 'polygon' && zone.points.length >= 3) {
        drawPolygonZone(ctx, zone, zoneConfig, scaleX, scaleY);
      } else if (zone.points.length >= 2) {
        drawRectangleZone(ctx, zone, zoneConfig, scaleX, scaleY);
      }
    });

    // Draw current polygon being drawn
    if (drawingMode === 'polygon' && polygonPoints.length > 0) {
      console.log('🎨 Drawing polygon preview with', polygonPoints.length, 'points');
      drawPolygonPreview(ctx, polygonPoints, previewPoint, zoneTypes[selectedZoneType]);
    }

    // Draw current zone being drawn (rectangle mode)
    if (drawingMode === 'rectangle' && currentZone && currentZone.points.length === 2) {
      const zoneConfig = zoneTypes[currentZone.type];
      const [p1, p2] = currentZone.points;

      ctx.strokeStyle = zoneConfig.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(
        Math.min(p1.x, p2.x),
        Math.min(p1.y, p2.y),
        Math.abs(p2.x - p1.x),
        Math.abs(p2.y - p1.y)
      );
    }
  };

  const drawPolygonZone = (ctx, zone, zoneConfig, scaleX, scaleY) => {
    const isPreviewZone = zone.isPreview === true;

    // Scale points from natural to display coordinates (unless it's a preview)
    const scaledPoints = zone.points.map(point => {
      if (isPreviewZone) {
        return point; // Already in display coordinates
      } else {
        return {
          x: point.x * scaleX,
          y: point.y * scaleY
        };
      }
    });

    // Draw polygon
    ctx.save();
    ctx.strokeStyle = zoneConfig.color;
    ctx.fillStyle = zoneConfig.fillColor;
    ctx.lineWidth = isPreviewZone ? 3 : 2;
    ctx.setLineDash(isPreviewZone ? [5, 5] : []);

    ctx.beginPath();
    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);

    for (let i = 1; i < scaledPoints.length; i++) {
      ctx.lineTo(scaledPoints[i].x, scaledPoints[i].y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw points
    scaledPoints.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = zoneConfig.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw zone label
    const centerX = scaledPoints.reduce((sum, p) => sum + p.x, 0) / scaledPoints.length;
    const centerY = scaledPoints.reduce((sum, p) => sum + p.y, 0) / scaledPoints.length;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${zoneConfig.icon} ${zone.name}`, centerX, centerY);

    ctx.restore();
  };

  const drawPolygonPreview = (ctx, points, previewPoint, zoneConfig) => {
    console.log('🔺 drawPolygonPreview called with', points.length, 'points', points);
    if (points.length === 0) return;

    ctx.save();

    // Draw grid if enabled
    if (snapToGrid) {
      drawGrid(ctx);
    }

    ctx.strokeStyle = zoneConfig.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    // Draw lines between points
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    // Draw preview line to mouse
    if (previewPoint) {
      ctx.lineTo(previewPoint.x, previewPoint.y);

      // Highlight edge if hovering over it for point insertion
      if (hoveredEdgeIndex >= 0) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 5;
        ctx.setLineDash([]);

        const edgeStart = points[hoveredEdgeIndex];
        const edgeEnd = points[(hoveredEdgeIndex + 1) % points.length];

        ctx.beginPath();
        ctx.moveTo(edgeStart.x, edgeStart.y);
        ctx.lineTo(edgeEnd.x, edgeEnd.y);
        ctx.stroke();

        // Reset style
        ctx.strokeStyle = zoneConfig.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
      }
    }

    ctx.stroke();

    // Draw points with professional styling
    points.forEach((point, index) => {
      const isFirstPoint = index === 0;
      const isSelected = index === selectedPointIndex;
      const isHovered = index === hoveredPointIndex;

      let radius = 6;
      let fillColor = zoneConfig.color;
      let strokeColor = '#fff';
      let strokeWidth = 2;

      if (isFirstPoint && points.length > 2) {
        radius = 8;
        fillColor = '#00FF88';
        strokeWidth = 3;
      }

      if (isSelected) {
        radius = 10;
        fillColor = '#FF6B6B';
        strokeWidth = 3;
      } else if (isHovered) {
        radius = 8;
        fillColor = '#FFD700';
        strokeWidth = 3;
      }

      // Draw point handle
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();

      // Draw point number
      ctx.fillStyle = '#fff';
      ctx.font = isFirstPoint ? 'bold 11px Arial' : '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), point.x, point.y + 3);

      // Add "CLOSE" text near first point when polygon can be closed
      if (isFirstPoint && points.length > 2) {
        ctx.fillStyle = '#00FF88';
        ctx.font = 'bold 9px Arial';
        ctx.fillText('CLOSE', point.x, point.y - 15);
      }

      // Show coordinates for selected point
      if (isSelected) {
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`(${Math.round(point.x)}, ${Math.round(point.y)})`, point.x, point.y - 20);
      }
    });

    ctx.restore();
  };

  const drawGrid = (ctx) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    // Draw vertical lines
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Draw horizontal lines
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawRectangleZone = (ctx, zone, zoneConfig, scaleX, scaleY) => {
    const [p1, p2] = zone.points;

    const isPreviewZone = zone.isPreview === true;

    // Scale coordinates from natural to display (unless it's a preview)
    let x1, y1, x2, y2;
    if (isPreviewZone) {
      x1 = p1.x;
      y1 = p1.y;
      x2 = p2.x;
      y2 = p2.y;
    } else {
      x1 = p1.x * scaleX;
      y1 = p1.y * scaleY;
      x2 = p2.x * scaleX;
      y2 = p2.y * scaleY;
    }

    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    const startX = Math.min(x1, x2);
    const startY = Math.min(y1, y2);

    // Draw rectangle
    ctx.save();
    ctx.fillStyle = zoneConfig.fillColor;
    ctx.fillRect(startX, startY, width, height);

    ctx.strokeStyle = zoneConfig.color;
    ctx.lineWidth = isPreviewZone ? 3 : 2;
    ctx.setLineDash(isPreviewZone ? [10, 5] : []);
    ctx.strokeRect(startX, startY, width, height);

    // Draw zone label
    const labelX = startX + width / 2;
    const labelY = startY + height / 2;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${zoneConfig.icon} ${zone.name || zoneConfig.name}`, labelX, labelY);

    // Draw requirement text
    const reqText = zone.requiresScooper ? 'Scooper Required' : 'No Scooper Required';
    ctx.font = '12px Arial';
    ctx.fillStyle = zone.requiresScooper ? '#FF4757' : '#2ED573';
    ctx.fillText(reqText, labelX, labelY + 18);

    ctx.restore();
  };

  useEffect(() => {
    if (onZonesUpdate) {
      onZonesUpdate(zones);
    }
  }, [zones, onZonesUpdate]);

  // Auto-switch drawing mode based on zone type preference
  useEffect(() => {
    const zoneConfig = zoneTypes[selectedZoneType];
    if (zoneConfig && zoneConfig.preferredShape) {
      setDrawingMode(zoneConfig.preferredShape);
      console.log(`🎯 Auto-switched to ${zoneConfig.preferredShape} mode for ${zoneConfig.name}`);
    }
  }, [selectedZoneType]);

  // Keyboard shortcuts for polygon drawing
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (!isEnabled || drawingMode !== 'polygon') return;

      // Enter key to complete polygon
      if (event.key === 'Enter' && polygonPoints.length >= 3) {
        event.preventDefault();
        completePolygon();
        toast.success('🔺 Polygon completed with Enter key!');
      }

      // Escape key to cancel polygon drawing
      if (event.key === 'Escape' && polygonPoints.length > 0) {
        event.preventDefault();
        setPolygonPoints([]);
        setIsDrawing(false);
        setPreviewPoint(null);
        toast.info('🔺 Polygon drawing cancelled');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isEnabled, drawingMode, polygonPoints.length]);

  // Auto-test polygon drawing when frame is available
  useEffect(() => {
    if (currentFrame && drawingMode === 'polygon' && polygonPoints.length === 0) {
      console.log('🧪 AUTO-TEST: Frame available, testing polygon drawing setup');
      console.log('🧪 AUTO-TEST: Frame size from props:', `${frameWidth}x${frameHeight}`);

      // Get actual frame size from background image
      const backgroundImg = document.getElementById('roi-background-image');
      if (backgroundImg) {
        const actualSize = {
          natural: `${backgroundImg.naturalWidth}x${backgroundImg.naturalHeight}`,
          display: `${backgroundImg.clientWidth}x${backgroundImg.clientHeight}`
        };
        console.log('🧪 AUTO-TEST: Actual image size:', actualSize);

        // Test canvas setup
        const canvas = canvasRef.current;
        if (canvas) {
          console.log('🧪 AUTO-TEST: Canvas size:', `${canvas.width}x${canvas.height}`);
          console.log('🧪 AUTO-TEST: Canvas style:', `${canvas.style.width}x${canvas.style.height}`);
        } else {
          console.log('🧪 AUTO-TEST: ❌ No canvas reference');
        }

        // Auto-test removed - let users start polygon drawing naturally
      }
    }
  }, [currentFrame, drawingMode, polygonPoints.length]);

  useEffect(() => {
    console.log('🎯 ROI Zone Manager useEffect triggered:', {
      currentFrame: !!currentFrame,
      currentFrameType: typeof currentFrame,
      currentFrameLength: currentFrame?.length || 0,
      frameSize: `${frameWidth}x${frameHeight}`,
      zones: zones.length,
      showZones,
      drawingMode,
      polygonPoints: polygonPoints.length
    });

    if (currentFrame) {
      console.log('✅ ROI Manager has frame data - length:', currentFrame.length);
      console.log('🔍 Frame data preview:', currentFrame.substring(0, 50) + '...');
    } else {
      console.log('❌ ROI Manager - No frame data received');
    }

    drawZones();
  }, [zones, currentFrame, showZones, frameWidth, frameHeight]);

  const getCanvasCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // Get display coordinates
    const displayCoords = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };

    // Convert to natural frame coordinates for storage
    const backgroundImg = document.getElementById('roi-background-image');
    let naturalCoords = displayCoords;

    if (backgroundImg) {
      const naturalWidth = backgroundImg.naturalWidth || frameWidth;
      const naturalHeight = backgroundImg.naturalHeight || frameHeight;
      const displayWidth = canvas.width;
      const displayHeight = canvas.height;

      const naturalScaleX = naturalWidth / displayWidth;
      const naturalScaleY = naturalHeight / displayHeight;

      naturalCoords = {
        x: displayCoords.x * naturalScaleX,
        y: displayCoords.y * naturalScaleY
      };
    }

    console.log('🖱️ Mouse coordinates:', {
      client: { x: event.clientX, y: event.clientY },
      display: displayCoords,
      natural: naturalCoords,
      canvas: { width: canvas.width, height: canvas.height },
      frame: { width: frameWidth, height: frameHeight }
    });

    return naturalCoords;
  };

  const handleMouseDown = (event) => {
    console.log('🖱️ MOUSE DOWN DETECTED on canvas!', {
      isEnabled,
      drawingMode,
      selectedZoneType,
      canvasSize: canvasRef.current ? `${canvasRef.current.width}x${canvasRef.current.height}` : 'no canvas'
    });

    if (!isEnabled) {
      console.log('🚫 Drawing disabled');
      return;
    }

    console.log('🖱️ Mouse down event triggered');
    event.preventDefault();

    // Get both natural and display coordinates
    const naturalCoords = getCanvasCoordinates(event); // This returns natural coordinates

    // Also get display coordinates for drawing preview
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const displayCoords = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };

    const snappedCoords = snapToGridIfEnabled(displayCoords);

    // Handle polygon point dragging
    if (drawingMode === 'polygon' && polygonPoints.length > 0) {
      const pointIndex = findPointAtPosition(polygonPoints, snappedCoords);

      if (pointIndex >= 0) {
        // Start dragging this point
        setSelectedPointIndex(pointIndex);
        setIsDraggingPoint(true);
        setDragOffset({
          x: snappedCoords.x - polygonPoints[pointIndex].x,
          y: snappedCoords.y - polygonPoints[pointIndex].y
        });

        addPointToHistory('startDrag', {
          pointIndex,
          originalPosition: polygonPoints[pointIndex]
        });

        toast.info(`🔺 Dragging point ${pointIndex + 1}. Release to finish.`);
        return;
      }
    }

    // Check if clicking on existing zone for editing (use natural coordinates)
    const clickedZone = findZoneAtPoint(naturalCoords.x, naturalCoords.y);
    if (clickedZone && clickedZone.shape === 'polygon') {
      console.log('✏️ Editing existing polygon zone:', clickedZone.name);
      setEditingPolygon(clickedZone);

      // Convert zone points to display coordinates for editing
      const canvas = canvasRef.current;
      const naturalScaleX = frameWidth / canvas.width;
      const naturalScaleY = frameHeight / canvas.height;

      const displayPoints = clickedZone.points.map(point => ({
        x: point.x / naturalScaleX,
        y: point.y / naturalScaleY
      }));

      setPolygonPoints(displayPoints);
      setIsDrawing(true);
      toast.info(`🔺 Editing ${clickedZone.name}. Click points to select, drag to move.`);
      return;
    } else if (clickedZone) {
      console.log('✏️ Editing existing zone:', clickedZone.name);
      setEditingZone(clickedZone);
      return;
    }

    console.log('🖱️ Mouse down - Drawing mode:', drawingMode, 'Zone type:', selectedZoneType);

    if (drawingMode === 'polygon') {
      console.log('🔺 Entering polygon mode');
      handlePolygonClick(snappedCoords, naturalCoords);
    } else {
      console.log('📦 Entering rectangle mode');
      handleRectangleStart(snappedCoords, naturalCoords);
    }
  };

  const handlePolygonClick = (displayCoords, naturalCoords) => {
    console.log('🔺 Polygon click:', { displayCoords, naturalCoords, currentPoints: polygonPoints.length });

    const snappedCoords = snapToGridIfEnabled(displayCoords);

    // Check if editing an existing polygon
    if (editingPolygon) {
      const pointIndex = findPointAtPosition(polygonPoints, snappedCoords);

      if (pointIndex >= 0) {
        // Clicked on existing point - select it
        setSelectedPointIndex(pointIndex);
        toast.info(`🔺 Point ${pointIndex + 1} selected. Drag to move or right-click to delete.`);
        return;
      }

      // Check if clicking on an edge to insert a point
      const edgeIndex = findEdgeAtPosition(polygonPoints, snappedCoords);
      if (edgeIndex >= 0) {
        const newPoints = [...polygonPoints];
        newPoints.splice(edgeIndex + 1, 0, snappedCoords);
        setPolygonPoints(newPoints);
        setSelectedPointIndex(edgeIndex + 1);

        addPointToHistory('insertPoint', {
          previousPoints: polygonPoints,
          newPoints: newPoints,
          insertIndex: edgeIndex + 1
        });

        toast.success(`🔺 Point inserted at position ${edgeIndex + 2}`);
        return;
      }
    }

    // Check if clicking near the first point to close polygon
    if (polygonPoints.length > 2) {
      const firstPoint = polygonPoints[0];
      const distance = getPointDistance(snappedCoords, firstPoint);

      if (distance < 15) {
        // Close polygon
        console.log('✅ Closing polygon with', polygonPoints.length, 'points');
        completePolygon();
        return;
      }
    }

    // Add new point to polygon
    const newPoints = [...polygonPoints, snappedCoords];
    setPolygonPoints(newPoints);
    setIsDrawing(true);

    addPointToHistory('addPoint', {
      previousPoints: polygonPoints,
      newPoints: newPoints
    });

    console.log('➕ Added polygon point:', newPoints.length, 'total points');

    // Provide better user feedback based on polygon progress
    if (newPoints.length === 1) {
      toast.info('🔺 First point added! Click to add more points.');
    } else if (newPoints.length === 2) {
      toast.info('🔺 Second point added! Add one more point, then click near first point to close.');
    } else {
      toast.info(`🔺 Point ${newPoints.length} added. Click near first point to close or press Enter.`);
    }
  };

  const handleRectangleStart = (displayCoords, naturalCoords) => {
    // Start drawing new rectangle zone with display coordinates for preview
    console.log('📦 Starting rectangle zone drawing:', {
      display: displayCoords,
      natural: naturalCoords
    });
    setIsDrawing(true);
    setCurrentZone({
      id: `zone_${Date.now()}`,
      type: selectedZoneType,
      points: [displayCoords], // Use display coordinates for preview
      isComplete: false,
      isPreview: true,
      shape: 'rectangle'
    });
  };

  const completePolygon = () => {
    if (polygonPoints.length < 3) {
      toast.error('Polygon must have at least 3 points');
      return;
    }

    // Convert display coordinates to natural coordinates for storage
    const naturalPoints = polygonPoints.map(point => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = frameWidth / canvas.width;
      const scaleY = frameHeight / canvas.height;

      return {
        x: point.x * scaleX,
        y: point.y * scaleY
      };
    });

    if (editingPolygon) {
      // Update existing polygon
      const updatedZones = zones.map(zone =>
        zone.id === editingPolygon.id
          ? { ...zone, points: naturalPoints }
          : zone
      );

      setZones(updatedZones);
      onZonesUpdate(updatedZones);

      addPointToHistory('updatePolygon', {
        zoneId: editingPolygon.id,
        previousPoints: editingPolygon.points,
        newPoints: naturalPoints
      });

      toast.success(`✏️ ${editingPolygon.name} updated successfully!`);
      setEditingPolygon(null);
    } else {
      // Create new polygon
      const newZone = {
        id: `zone_${Date.now()}`,
        type: selectedZoneType,
        shape: 'polygon',
        points: naturalPoints,
        isComplete: true,
        isPreview: false,
        name: `${zoneTypes[selectedZoneType].name} ${zones.length + 1}`,
        requiresScooper: zoneTypes[selectedZoneType].requiresScooper
      };

      const newZones = [...zones, newZone];
      setZones(newZones);
      onZonesUpdate(newZones);

      addPointToHistory('createPolygon', {
        zone: newZone
      });

      toast.success(`${zoneTypes[selectedZoneType].name} polygon zone created!`);
    }

    // Reset polygon drawing state
    setPolygonPoints([]);
    setIsDrawing(false);
    setPreviewPoint(null);
    setSelectedPointIndex(-1);
    setHoveredPointIndex(-1);
    setHoveredEdgeIndex(-1);

    drawZones(); // Redraw with the updated zones
  };

  const handleMouseMove = (event) => {
    if (!isEnabled) return;

    event.preventDefault();

    // Get display coordinates for preview
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const displayCoords = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };

    const snappedCoords = snapToGridIfEnabled(displayCoords);

    if (drawingMode === 'polygon') {
      // Handle point dragging
      if (isDraggingPoint && selectedPointIndex >= 0) {
        const newPoints = [...polygonPoints];
        newPoints[selectedPointIndex] = {
          x: snappedCoords.x - dragOffset.x,
          y: snappedCoords.y - dragOffset.y
        };
        setPolygonPoints(newPoints);
        drawZones();
        return;
      }

      // Update hover states for better UX
      if (polygonPoints.length > 0) {
        const hoveredPoint = findPointAtPosition(polygonPoints, snappedCoords);
        const hoveredEdge = findEdgeAtPosition(polygonPoints, snappedCoords);

        setHoveredPointIndex(hoveredPoint);
        setHoveredEdgeIndex(hoveredEdge);

        // Change cursor based on what's being hovered
        if (hoveredPoint >= 0) {
          canvas.style.cursor = 'pointer';
        } else if (hoveredEdge >= 0) {
          canvas.style.cursor = 'crosshair';
        } else {
          canvas.style.cursor = 'default';
        }
      }

      if (isDrawing && polygonPoints.length > 0) {
        // Update preview point for polygon
        setPreviewPoint(snappedCoords);
        // Redraw to show polygon preview with current mouse position
        drawZones();
      }
    } else if (drawingMode === 'rectangle' && isDrawing && currentZone) {
      // Update current zone with display coordinates for rectangle preview
      if (currentZone.points.length === 1) {
        const updatedZone = {
          ...currentZone,
          points: [currentZone.points[0], snappedCoords],
          isPreview: true // Mark as preview
        };
        setCurrentZone(updatedZone);
        console.log('🖱️ Mouse move - updating preview:', {
          start: currentZone.points[0],
          current: snappedCoords
        });
        drawZones([...zones, updatedZone]);
      }
    }
  };

  const handleMouseUp = (event) => {
    // Handle polygon point dragging completion
    if (isDraggingPoint && selectedPointIndex >= 0) {
      setIsDraggingPoint(false);

      addPointToHistory('endDrag', {
        pointIndex: selectedPointIndex,
        newPosition: polygonPoints[selectedPointIndex]
      });

      toast.success(`🔺 Point ${selectedPointIndex + 1} moved successfully`);
      return;
    }

    if (!isDrawing || !currentZone) return;

    console.log('🖱️ Mouse up event triggered');
    event.preventDefault();

    // Get display coordinates for the end point
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const displayEndCoords = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };

    // Convert both start and end points from display to natural coordinates for storage
    const backgroundImg = document.getElementById('roi-background-image');
    let naturalStartCoords = currentZone.points[0];
    let naturalEndCoords = displayEndCoords;

    if (backgroundImg) {
      const naturalWidth = backgroundImg.naturalWidth || frameWidth;
      const naturalHeight = backgroundImg.naturalHeight || frameHeight;
      const displayWidth = canvas.width;
      const displayHeight = canvas.height;

      const naturalScaleX = naturalWidth / displayWidth;
      const naturalScaleY = naturalHeight / displayHeight;

      naturalStartCoords = {
        x: currentZone.points[0].x * naturalScaleX,
        y: currentZone.points[0].y * naturalScaleY
      };

      naturalEndCoords = {
        x: displayEndCoords.x * naturalScaleX,
        y: displayEndCoords.y * naturalScaleY
      };
    }

    // Complete rectangle zone with natural coordinates
    if (currentZone.points.length >= 1) {
      const newZone = {
        ...currentZone,
        points: [naturalStartCoords, naturalEndCoords], // Store in natural coordinates
        isComplete: true,
        isPreview: false,
        name: `${zoneTypes[selectedZoneType].name} ${zones.length + 1}`,
        requiresScooper: zoneTypes[selectedZoneType].requiresScooper
      };

      console.log('✅ Zone created:', {
        display: { start: currentZone.points[0], end: displayEndCoords },
        natural: { start: naturalStartCoords, end: naturalEndCoords },
        zone: newZone
      });

      const newZones = [...zones, newZone];
      setZones(newZones);
      onZonesUpdate(newZones);
      toast.success(`${zoneTypes[selectedZoneType].name} zone created!`);
    }

    setIsDrawing(false);
    setCurrentZone(null);
    drawZones(); // Redraw with the new zone
  };

  const deleteZone = (zoneId) => {
    setZones(zones.filter(zone => zone.id !== zoneId));
    setEditingZone(null);
    toast.info('Zone deleted');
  };

  const clearAllZones = () => {
    setZones([]);
    setEditingZone(null);
    toast.info('All zones cleared');
  };

  const exportZones = () => {
    const exportData = {
      zones: zones.map(zone => ({
        ...zone,
        // Convert to relative coordinates (0-1)
        points: zone.points.map(p => ({
          x: p.x / frameWidth,
          y: p.y / frameHeight
        }))
      })),
      frameSize: { width: frameWidth, height: frameHeight },
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roi_zones_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Zones exported successfully!');
  }; // exportZones function closing

  return (
    <div style={{ width: '100%' }}>
      {/* Zone Controls - Only show in editing mode */}
      {isEnabled && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px'
        }}>
        <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>🎯 ROI Zone Manager</h4>
        
        {/* Zone Type Selector */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
            Zone Type:
          </label>
          <select
            value={selectedZoneType}
            onChange={(e) => setSelectedZoneType(e.target.value)}
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              color: 'white',
              width: '200px'
            }}
          >
            {Object.entries(zoneTypes).map(([key, config]) => (
              <option key={key} value={key} style={{ background: '#333', color: 'white' }}>
                {config.icon} {config.name}
              </option>
            ))}
          </select>
        </div>

        {/* Drawing Mode Selector */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>
            Drawing Mode:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setDrawingMode('rectangle')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: drawingMode === 'rectangle' ? '2px solid #00FF88' : '1px solid rgba(255,255,255,0.3)',
                background: drawingMode === 'rectangle' ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.1)',
                color: drawingMode === 'rectangle' ? '#00FF88' : '#fff',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              📦 Rectangle
            </button>
            <button
              onClick={() => setDrawingMode('polygon')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: drawingMode === 'polygon' ? '2px solid #FF6B35' : '1px solid rgba(255,255,255,0.3)',
                background: drawingMode === 'polygon' ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.1)',
                color: drawingMode === 'polygon' ? '#FF6B35' : '#fff',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔺 Polygon
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#ccc', marginTop: '4px' }}>
            {drawingMode === 'rectangle' ?
              '📦 Click and drag to create rectangular zones' :
              '🔺 Professional polygon editor • Drag points • Insert on edges • Right-click options'
            }
          </div>

          {/* Professional Polygon Controls */}
          {drawingMode === 'polygon' && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              background: 'rgba(255,107,53,0.1)',
              borderRadius: '6px',
              border: '1px solid rgba(255,107,53,0.3)'
            }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  style={{
                    padding: '4px 8px',
                    background: snapToGrid ? '#FF6B35' : 'rgba(255,255,255,0.1)',
                    color: snapToGrid ? '#fff' : '#ccc',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '10px'
                  }}
                >
                  🔲 Grid Snap
                </button>

                <button
                  onClick={undo}
                  disabled={undoStack.length === 0}
                  style={{
                    padding: '4px 8px',
                    background: undoStack.length > 0 ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                    color: undoStack.length > 0 ? '#fff' : '#666',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: undoStack.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '10px'
                  }}
                >
                  ↶ Undo
                </button>

                <button
                  onClick={redo}
                  disabled={redoStack.length === 0}
                  style={{
                    padding: '4px 8px',
                    background: redoStack.length > 0 ? '#4CAF50' : 'rgba(255,255,255,0.1)',
                    color: redoStack.length > 0 ? '#fff' : '#666',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '4px',
                    cursor: redoStack.length > 0 ? 'pointer' : 'not-allowed',
                    fontSize: '10px'
                  }}
                >
                  ↷ Redo
                </button>

                {snapToGrid && (
                  <select
                    value={gridSize}
                    onChange={(e) => setGridSize(parseInt(e.target.value))}
                    style={{
                      padding: '4px',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '4px',
                      fontSize: '10px'
                    }}
                  >
                    <option value={10}>Grid: 10px</option>
                    <option value={20}>Grid: 20px</option>
                    <option value={30}>Grid: 30px</option>
                    <option value={50}>Grid: 50px</option>
                  </select>
                )}
              </div>

              {selectedPointIndex >= 0 && (
                <div style={{ fontSize: '10px', color: '#FF6B35' }}>
                  🎯 Point {selectedPointIndex + 1} selected • Drag to move • Right-click to delete
                </div>
              )}

              {editingPolygon && (
                <div style={{ fontSize: '10px', color: '#00FF88' }}>
                  ✏️ Editing: {editingPolygon.name} • Click edges to insert points
                </div>
              )}
            </div>
          )}

          {zoneTypes[selectedZoneType]?.preferredShape && (
            <div style={{
              fontSize: '11px',
              color: zoneTypes[selectedZoneType].preferredShape === 'polygon' ? '#FF6B35' : '#FFD23F',
              marginTop: '2px',
              fontStyle: 'italic'
            }}>
              💡 Recommended: {zoneTypes[selectedZoneType].preferredShape} for {zoneTypes[selectedZoneType].name}
            </div>
          )}
        </div>

        {/* Drawing Status */}
        <div style={{
          padding: '8px 12px',
          background: isEnabled ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.1)',
          borderRadius: '6px',
          marginBottom: '12px',
          border: `2px solid ${isEnabled ? '#00FF88' : 'rgba(255,255,255,0.3)'}`
        }}>
          <span style={{ color: isEnabled ? '#00FF88' : '#fff' }}>
            {isEnabled ?
              (drawingMode === 'polygon' ?
                `🔺 Polygon Mode: ACTIVE ${polygonPoints.length > 0 ? `(${polygonPoints.length} points)` : '- Click anywhere on video to start'}` :
                '📦 Rectangle Mode: ACTIVE - Click and drag to create zones'
              ) :
              '🔒 Drawing Mode: DISABLED'
            }
          </span>
        </div>

        {/* Polygon Drawing Controls */}
        {drawingMode === 'polygon' && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(255,107,53,0.2)',
            borderRadius: '6px',
            marginBottom: '12px',
            border: '2px solid #FF6B35'
          }}>
            <div style={{ color: '#FF6B35', fontWeight: 'bold', marginBottom: '8px' }}>
              🔺 Polygon Drawing Status
            </div>
            <div style={{ fontSize: '12px', color: '#fff', marginBottom: '8px' }}>
              {polygonPoints.length === 0 && 'Click anywhere on the video frame to place your first point'}
              {polygonPoints.length === 1 && 'Great! Click to place your second point'}
              {polygonPoints.length === 2 && 'Perfect! Click to place your third point, then close the polygon'}
              {polygonPoints.length >= 3 &&
                `${polygonPoints.length} points placed. Click the green first point to close polygon.`}
            </div>
            {polygonPoints.length > 0 && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => {
                    if (polygonPoints.length > 0) {
                      const newPoints = polygonPoints.slice(0, -1);
                      setPolygonPoints(newPoints);
                      if (newPoints.length === 0) {
                        setIsDrawing(false);
                        setPreviewPoint(null);
                      }
                      toast.info('Last point removed');
                    }
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#FF9800',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  ↶ Undo Point
                </button>
                <button
                  onClick={() => {
                    setPolygonPoints([]);
                    setIsDrawing(false);
                    setPreviewPoint(null);
                    toast.info('Polygon cleared');
                  }}
                  style={{
                    padding: '4px 8px',
                    background: '#f44336',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  🗑️ Clear
                </button>
                {polygonPoints.length >= 3 && (
                  <button
                    onClick={completePolygon}
                    style={{
                      padding: '4px 8px',
                      background: '#4CAF50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    ✅ Complete
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowZones(!showZones)}
          >
            {showZones ? '👁️ Hide Zones' : '👁️‍🗨️ Show Zones'}
          </button>
          
          <button
            className="btn btn-warning"
            onClick={clearAllZones}
            disabled={zones.length === 0}
          >
            🗑️ Clear All
          </button>
          
          <button
            className="btn btn-success"
            onClick={exportZones}
            disabled={zones.length === 0}
          >
            📥 Export Zones
          </button>


          
          <span style={{ marginLeft: '16px', fontSize: '14px', opacity: 0.8 }}>
            Zones: {zones.length} | {isEnabled ? 'Click and drag to create zones' : 'Enable drawing to create zones'}
          </span>
        </div>

        {/* Drawing Instructions */}
        {isEnabled && zones.length === 0 && (
          <div style={{
            padding: '12px',
            background: 'rgba(255,210,63,0.2)',
            borderRadius: '6px',
            marginTop: '8px',
            border: '2px dashed #FFD23F'
          }}>
            <div style={{ color: '#FFD23F', fontWeight: 'bold', marginBottom: '4px' }}>
              📝 How to Draw Zones:
            </div>
            <div style={{ fontSize: '14px', opacity: 0.9 }}>
              {drawingMode === 'rectangle' ? (
                <>
                  1. Select zone type above (e.g., "🍅 Sauce Area")<br />
                  2. Click and hold on the video to start drawing<br />
                  3. Drag to create a rectangle<br />
                  4. Release to complete the zone
                </>
              ) : (
                <>
                  1. Select zone type above (e.g., "🍅 Sauce Area")<br />
                  2. Click on the video where you want to start<br />
                  3. Click additional points to create polygon shape<br />
                  4. Click the green first point to close polygon
                </>
              )}
            </div>
          </div>
        )}

        {isDrawing && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(0,212,255,0.3)',
            borderRadius: '6px',
            marginTop: '8px',
            textAlign: 'center',
            border: '2px solid #00D4FF'
          }}>
            <span style={{ color: '#00D4FF', fontWeight: 'bold' }}>
              🎨 Drawing in progress... Drag to set zone size
            </span>
          </div>
        )}
        </div>
      )}

      {/* Video with zone drawing overlay */}
      <div style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        maxWidth: '100%',
        background: '#000',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {/* Background video frame */}
        {currentFrame ? (
          <img
            id="roi-background-image"
            src={`data:image/jpeg;base64,${currentFrame}`}
            alt="Video frame for zone configuration"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              borderRadius: '8px'
            }}
            onLoad={(e) => {
              console.log('🎯 ROI Manager: Video frame loaded');
              const img = e.target;
              const rect = img.getBoundingClientRect();
              console.log('📐 Image dimensions:', {
                natural: `${img.naturalWidth}x${img.naturalHeight}`,
                display: `${rect.width}x${rect.height}`
              });

              // Update canvas size to match image
              const canvas = canvasRef.current;
              if (canvas) {
                canvas.width = rect.width;
                canvas.height = rect.height;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                console.log('🎨 Canvas resized to match image:', `${rect.width}x${rect.height}`);
                console.log('🔧 FRAME SIZE FIX: Using actual image size instead of props');
              }

              // Canvas ready for user interaction
            }}
          />
        ) : (
          <div
            id="roi-background-placeholder"
            style={{
              width: '100%',
              height: '360px',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              border: '2px dashed rgba(255,255,255,0.3)',
              color: '#ccc',
              fontSize: '16px',
              textAlign: 'center',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative'
            }}
          >
            <div style={{ fontSize: '48px' }}>🎥</div>
            <div>Start Video Processing First</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>
              Upload and start processing a video to configure ROI zones
            </div>
          </div>
        )}

        {/* Zone drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: isEnabled ? 'crosshair' : 'default',
            pointerEvents: isEnabled ? 'auto' : 'none',
            zIndex: 20,
            borderRadius: '8px'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={(e) => {
            e.preventDefault();

            if (drawingMode === 'polygon') {
              // Get mouse position for context-sensitive actions
              const canvas = canvasRef.current;
              const rect = canvas.getBoundingClientRect();
              const scaleX = canvas.width / rect.width;
              const scaleY = canvas.height / rect.height;

              const displayCoords = {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
              };

              const snappedCoords = snapToGridIfEnabled(displayCoords);

              // Check if right-clicking on a specific point
              const pointIndex = findPointAtPosition(polygonPoints, snappedCoords);

              if (pointIndex >= 0 && polygonPoints.length > 3) {
                // Delete specific point
                const newPoints = polygonPoints.filter((_, index) => index !== pointIndex);
                setPolygonPoints(newPoints);
                setSelectedPointIndex(-1);

                addPointToHistory('deletePoint', {
                  deletedPoint: polygonPoints[pointIndex],
                  deletedIndex: pointIndex,
                  previousPoints: polygonPoints
                });

                toast.success(`🔺 Point ${pointIndex + 1} deleted`);
              } else if (polygonPoints.length >= 3) {
                // Complete polygon
                completePolygon();
                toast.success('🔺 Polygon completed with right-click!');
              } else if (polygonPoints.length > 0) {
                // Remove last point
                const newPoints = polygonPoints.slice(0, -1);
                setPolygonPoints(newPoints);
                if (newPoints.length === 0) {
                  setIsDrawing(false);
                  setPreviewPoint(null);
                  setEditingPolygon(null);
                }

                addPointToHistory('removeLastPoint', {
                  removedPoint: polygonPoints[polygonPoints.length - 1],
                  previousPoints: polygonPoints
                });

                toast.info('🔺 Last point removed');
              }
            }
          }}
        />


      </div>

      {/* Zone List - Only show in editing mode */}
      {isEnabled && zones.length > 0 && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px'
        }}>
          <h4 style={{ margin: '0 0 12px 0' }}>📋 Active Zones ({zones.length})</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {zones.map((zone, index) => {
              const config = zoneTypes[zone.type];
              return (
                <div
                  key={zone.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    marginBottom: '8px',
                    background: editingZone?.id === zone.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    border: `2px solid ${config.color}`
                  }}
                >
                  <div>
                    <strong>{config.icon} {zone.name}</strong>
                    <br />
                    <small style={{ opacity: 0.8 }}>
                      {config.description} | Scooper: {zone.requiresScooper ? '🥄 Required' : '🚫 Not Required'}
                    </small>
                  </div>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    style={{
                      background: '#FF4757',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}; // Main component closing brace

export default ROIZoneManager;
