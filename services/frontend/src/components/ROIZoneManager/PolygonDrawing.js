/**
 * Polygon Drawing Logic for ROI Zone Manager
 * Handles polygon creation, editing, and completion
 */

import { toast } from 'react-toastify';
import { zoneTypes } from './ZoneTypes';

/**
 * Complete polygon creation or editing
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const completePolygon = (state, actions) => {
  const {
    polygonPoints,
    editingPolygon,
    selectedZoneType,
    zones,
    frameWidth,
    frameHeight,
    canvasRef
  } = state;

  const {
    setZones,
    onZonesUpdate,
    addPointToHistory,
    setEditingPolygon,
    setPolygonPoints,
    setIsDrawing,
    setPreviewPoint,
    setSelectedPointIndex,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    drawZones
  } = actions;

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

/**
 * Cancel polygon drawing
 * @param {Object} actions - State update functions
 */
export const cancelPolygonDrawing = (actions) => {
  const {
    setPolygonPoints,
    setIsDrawing,
    setPreviewPoint,
    setSelectedPointIndex,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    setEditingPolygon,
    drawZones
  } = actions;

  setPolygonPoints([]);
  setIsDrawing(false);
  setPreviewPoint(null);
  setSelectedPointIndex(-1);
  setHoveredPointIndex(-1);
  setHoveredEdgeIndex(-1);
  setEditingPolygon(null);

  drawZones();
  toast.info('🔺 Polygon drawing cancelled');
};

/**
 * Delete a point from the current polygon
 * @param {number} pointIndex - Index of point to delete
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const deletePolygonPoint = (pointIndex, state, actions) => {
  const { polygonPoints } = state;
  const { setPolygonPoints, addPointToHistory, drawZones } = actions;

  if (pointIndex < 0 || pointIndex >= polygonPoints.length) {
    toast.error('Invalid point index');
    return;
  }

  if (polygonPoints.length <= 3) {
    toast.warning('Cannot delete point - polygon must have at least 3 points');
    return;
  }

  const deletedPoint = polygonPoints[pointIndex];
  const newPoints = polygonPoints.filter((_, index) => index !== pointIndex);

  setPolygonPoints(newPoints);

  addPointToHistory('deletePoint', {
    pointIndex,
    deletedPoint,
    previousPoints: polygonPoints,
    newPoints
  });

  drawZones();
  toast.success(`🔺 Point ${pointIndex + 1} deleted`);
};

/**
 * Insert a point into the polygon at a specific edge
 * @param {number} edgeIndex - Index of edge to insert point after
 * @param {Object} point - Point to insert
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const insertPolygonPoint = (edgeIndex, point, state, actions) => {
  const { polygonPoints } = state;
  const { setPolygonPoints, setSelectedPointIndex, addPointToHistory, drawZones } = actions;

  if (edgeIndex < 0 || edgeIndex >= polygonPoints.length) {
    toast.error('Invalid edge index');
    return;
  }

  const newPoints = [...polygonPoints];
  newPoints.splice(edgeIndex + 1, 0, point);

  setPolygonPoints(newPoints);
  setSelectedPointIndex(edgeIndex + 1);

  addPointToHistory('insertPoint', {
    previousPoints: polygonPoints,
    newPoints,
    insertIndex: edgeIndex + 1,
    insertedPoint: point
  });

  drawZones();
  toast.success(`🔺 Point inserted at position ${edgeIndex + 2}`);
};

/**
 * Move a polygon point to a new position
 * @param {number} pointIndex - Index of point to move
 * @param {Object} newPosition - New position for the point
 * @param {Object} state - Current component state
 * @param {Object} actions - State update functions
 */
export const movePolygonPoint = (pointIndex, newPosition, state, actions) => {
  const { polygonPoints } = state;
  const { setPolygonPoints, addPointToHistory, drawZones } = actions;

  if (pointIndex < 0 || pointIndex >= polygonPoints.length) {
    toast.error('Invalid point index');
    return;
  }

  const oldPosition = polygonPoints[pointIndex];
  const newPoints = [...polygonPoints];
  newPoints[pointIndex] = newPosition;

  setPolygonPoints(newPoints);

  addPointToHistory('movePoint', {
    pointIndex,
    originalPosition: oldPosition,
    newPosition,
    previousPoints: polygonPoints,
    newPoints
  });

  drawZones();
};

/**
 * Validate polygon before completion
 * @param {Array} points - Polygon points
 * @returns {Object} Validation result { isValid, message }
 */
export const validatePolygon = (points) => {
  if (!points || !Array.isArray(points)) {
    return { isValid: false, message: 'Invalid points array' };
  }

  if (points.length < 3) {
    return { isValid: false, message: 'Polygon must have at least 3 points' };
  }

  // Check for duplicate points
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const distance = Math.sqrt(
        Math.pow(points[i].x - points[j].x, 2) + 
        Math.pow(points[i].y - points[j].y, 2)
      );
      if (distance < 5) { // Points too close together
        return { 
          isValid: false, 
          message: `Points ${i + 1} and ${j + 1} are too close together` 
        };
      }
    }
  }

  // Check for self-intersecting polygon (basic check)
  if (points.length > 3) {
    // This is a simplified check - a full implementation would be more complex
    for (let i = 0; i < points.length; i++) {
      const line1Start = points[i];
      const line1End = points[(i + 1) % points.length];
      
      for (let j = i + 2; j < points.length; j++) {
        if (j === points.length - 1 && i === 0) continue; // Skip adjacent edges
        
        const line2Start = points[j];
        const line2End = points[(j + 1) % points.length];
        
        if (linesIntersect(line1Start, line1End, line2Start, line2End)) {
          return { 
            isValid: false, 
            message: 'Polygon cannot intersect itself' 
          };
        }
      }
    }
  }

  return { isValid: true, message: 'Polygon is valid' };
};

/**
 * Check if two line segments intersect
 * @param {Object} p1 - Start of first line
 * @param {Object} q1 - End of first line
 * @param {Object} p2 - Start of second line
 * @param {Object} q2 - End of second line
 * @returns {boolean} True if lines intersect
 */
const linesIntersect = (p1, q1, p2, q2) => {
  const orientation = (p, q, r) => {
    const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (val === 0) return 0; // Collinear
    return val > 0 ? 1 : 2; // Clockwise or Counterclockwise
  };

  const onSegment = (p, q, r) => {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x) &&
           q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  };

  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  // General case
  if (o1 !== o2 && o3 !== o4) return true;

  // Special cases
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;

  return false;
};
