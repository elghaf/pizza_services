/**
 * Zone Utility Functions for ROI Zone Manager
 * Contains helper functions for zone manipulation, geometry calculations, and coordinate transformations
 */

/**
 * Find zone at a specific point
 * @param {number} x - X coordinate in natural coordinates
 * @param {number} y - Y coordinate in natural coordinates
 * @param {Array} zones - Array of zones to search
 * @returns {Object|null} Zone at the point or null if none found
 */
export const findZoneAtPoint = (x, y, zones) => {
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

/**
 * Check if a point is inside a polygon using ray casting algorithm
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array} polygon - Array of points defining the polygon
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInPolygon = (x, y, polygon) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (((polygon[i].y > y) !== (polygon[j].y > y)) &&
        (x < (polygon[j].x - polygon[i].x) * (y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Snap point to grid if grid snapping is enabled
 * @param {Object} point - Point with x, y coordinates
 * @param {boolean} snapToGrid - Whether grid snapping is enabled
 * @param {number} gridSize - Size of the grid
 * @returns {Object} Snapped point
 */
export const snapToGridIfEnabled = (point, snapToGrid, gridSize) => {
  if (!snapToGrid) return point;
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize
  };
};

/**
 * Calculate distance between two points
 * @param {Object} p1 - First point with x, y coordinates
 * @param {Object} p2 - Second point with x, y coordinates
 * @returns {number} Distance between points
 */
export const getPointDistance = (p1, p2) => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

/**
 * Find point at a specific position within threshold
 * @param {Array} points - Array of points to search
 * @param {Object} position - Position to search at
 * @param {number} threshold - Distance threshold (default: 8)
 * @returns {number} Index of point found or -1 if none
 */
export const findPointAtPosition = (points, position, threshold = 8) => {
  for (let i = 0; i < points.length; i++) {
    if (getPointDistance(points[i], position) <= threshold) {
      return i;
    }
  }
  return -1;
};

/**
 * Find edge at a specific position within threshold
 * @param {Array} points - Array of points defining the polygon
 * @param {Object} position - Position to search at
 * @param {number} threshold - Distance threshold (default: 5)
 * @returns {number} Index of edge found or -1 if none
 */
export const findEdgeAtPosition = (points, position, threshold = 5) => {
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

/**
 * Calculate distance from a point to a line segment
 * @param {Object} point - Point with x, y coordinates
 * @param {Object} lineStart - Start point of line
 * @param {Object} lineEnd - End point of line
 * @returns {number} Distance from point to line
 */
export const distancePointToLine = (point, lineStart, lineEnd) => {
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

/**
 * Calculate scaling factors from natural to display coordinates
 * @param {number} naturalWidth - Natural width of the frame
 * @param {number} naturalHeight - Natural height of the frame
 * @param {number} displayWidth - Display width of the canvas
 * @param {number} displayHeight - Display height of the canvas
 * @returns {Object} Scaling factors { scaleX, scaleY }
 */
export const calculateScalingFactors = (naturalWidth, naturalHeight, displayWidth, displayHeight) => {
  return {
    scaleX: displayWidth / naturalWidth,
    scaleY: displayHeight / naturalHeight
  };
};

/**
 * Convert coordinates from display to natural coordinate system
 * @param {Object} displayCoords - Display coordinates { x, y }
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 * @returns {Object} Natural coordinates { x, y }
 */
export const displayToNaturalCoords = (displayCoords, scaleX, scaleY) => {
  return {
    x: displayCoords.x / scaleX,
    y: displayCoords.y / scaleY
  };
};

/**
 * Convert coordinates from natural to display coordinate system
 * @param {Object} naturalCoords - Natural coordinates { x, y }
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 * @returns {Object} Display coordinates { x, y }
 */
export const naturalToDisplayCoords = (naturalCoords, scaleX, scaleY) => {
  return {
    x: naturalCoords.x * scaleX,
    y: naturalCoords.y * scaleY
  };
};

/**
 * Validate zone data
 * @param {Object} zone - Zone object to validate
 * @returns {boolean} True if zone is valid
 */
export const validateZone = (zone) => {
  if (!zone || !zone.points || !Array.isArray(zone.points)) {
    return false;
  }

  if (zone.shape === 'polygon') {
    return zone.points.length >= 3;
  } else {
    return zone.points.length >= 2;
  }
};

/**
 * Calculate center point of a zone
 * @param {Object} zone - Zone object
 * @returns {Object} Center point { x, y }
 */
export const getZoneCenter = (zone) => {
  if (!zone || !zone.points || zone.points.length === 0) {
    return { x: 0, y: 0 };
  }

  const sumX = zone.points.reduce((sum, point) => sum + point.x, 0);
  const sumY = zone.points.reduce((sum, point) => sum + point.y, 0);

  return {
    x: sumX / zone.points.length,
    y: sumY / zone.points.length
  };
};

/**
 * Calculate bounding box of a zone
 * @param {Object} zone - Zone object
 * @returns {Object} Bounding box { minX, minY, maxX, maxY, width, height }
 */
export const getZoneBoundingBox = (zone) => {
  if (!zone || !zone.points || zone.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const xs = zone.points.map(p => p.x);
  const ys = zone.points.map(p => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
};
