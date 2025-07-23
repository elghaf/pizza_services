/**
 * Mouse Event Handlers for ROI Zone Manager
 * Handles all mouse interactions for zone drawing and editing
 */

import { toast } from 'react-toastify';
import { findZoneAtPoint, snapToGridIfEnabled, getPointDistance, findPointAtPosition, findEdgeAtPosition } from './utils/ZoneUtils';
import { zoneTypes } from './ZoneTypes';

/**
 * Get canvas coordinates from mouse event
 * @param {Event} event - Mouse event
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} frameWidth - Frame width
 * @param {number} frameHeight - Frame height
 * @returns {Object} Natural coordinates { x, y }
 */
export const getCanvasCoordinates = (event, canvas, frameWidth, frameHeight) => {
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

/**
 * Handle mouse down events
 * @param {Event} event - Mouse event
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const handleMouseDown = (event, state, actions) => {
  const {
    isEnabled,
    drawingMode,
    selectedZoneType,
    polygonPoints,
    zones,
    frameWidth,
    frameHeight,
    canvasRef,
    snapToGrid,
    gridSize
  } = state;

  const {
    setSelectedPointIndex,
    setIsDraggingPoint,
    setDragOffset,
    setEditingPolygon,
    setPolygonPoints,
    setIsDrawing,
    setEditingZone,
    addPointToHistory
  } = actions;

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
  const naturalCoords = getCanvasCoordinates(event, canvasRef.current, frameWidth, frameHeight);

  // Also get display coordinates for drawing preview
  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const displayCoords = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };

  const snappedCoords = snapToGridIfEnabled(displayCoords, snapToGrid, gridSize);

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
  const clickedZone = findZoneAtPoint(naturalCoords.x, naturalCoords.y, zones);
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
    return { action: 'handlePolygonClick', coords: { display: snappedCoords, natural: naturalCoords } };
  } else {
    console.log('📦 Entering rectangle mode');
    return { action: 'handleRectangleStart', coords: { display: snappedCoords, natural: naturalCoords } };
  }
};

/**
 * Handle polygon click events
 * @param {Object} displayCoords - Display coordinates
 * @param {Object} naturalCoords - Natural coordinates
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const handlePolygonClick = (displayCoords, naturalCoords, state, actions) => {
  const {
    polygonPoints,
    editingPolygon,
    snapToGrid,
    gridSize
  } = state;

  const {
    setSelectedPointIndex,
    setPolygonPoints,
    setIsDrawing,
    addPointToHistory
  } = actions;

  console.log('🔺 Polygon click:', { displayCoords, naturalCoords, currentPoints: polygonPoints.length });

  const snappedCoords = snapToGridIfEnabled(displayCoords, snapToGrid, gridSize);

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
      return { action: 'completePolygon' };
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

/**
 * Handle rectangle start events
 * @param {Object} displayCoords - Display coordinates
 * @param {Object} naturalCoords - Natural coordinates
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const handleRectangleStart = (displayCoords, naturalCoords, state, actions) => {
  const { selectedZoneType } = state;
  const { setIsDrawing, setCurrentZone } = actions;

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

/**
 * Handle mouse move events
 * @param {Event} event - Mouse event
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const handleMouseMove = (event, state, actions) => {
  const {
    isEnabled,
    drawingMode,
    isDraggingPoint,
    selectedPointIndex,
    dragOffset,
    polygonPoints,
    isDrawing,
    currentZone,
    zones,
    canvasRef,
    snapToGrid,
    gridSize
  } = state;

  const {
    setPolygonPoints,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    setPreviewPoint,
    setCurrentZone,
    drawZones
  } = actions;

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

  const snappedCoords = snapToGridIfEnabled(displayCoords, snapToGrid, gridSize);

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

/**
 * Handle mouse up events
 * @param {Event} event - Mouse event
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const handleMouseUp = (event, state, actions) => {
  const {
    isDraggingPoint,
    selectedPointIndex,
    polygonPoints,
    isDrawing,
    currentZone,
    zones,
    selectedZoneType,
    frameWidth,
    frameHeight,
    canvasRef
  } = state;

  const {
    setIsDraggingPoint,
    addPointToHistory,
    setIsDrawing,
    setCurrentZone,
    setZones,
    onZonesUpdate
  } = actions;

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
};
