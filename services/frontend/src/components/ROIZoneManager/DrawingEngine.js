/**
 * Drawing Engine for ROI Zone Manager
 * Handles all canvas drawing operations for zones, polygons, and previews
 */

import { zoneTypes } from './ZoneTypes';

/**
 * Main drawing function for all zones
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} zonesToDraw - Array of zones to draw
 * @param {Object} frameSize - Frame dimensions { width, height }
 * @param {boolean} showZones - Whether to show zones
 * @param {string} drawingMode - Current drawing mode
 * @param {Array} polygonPoints - Current polygon points
 * @param {Object} previewPoint - Preview point for polygon
 * @param {string} selectedZoneType - Selected zone type
 * @param {Object} currentZone - Current zone being drawn
 * @param {Object} drawingState - Drawing state object
 */
export const drawZones = (
  canvas,
  zonesToDraw = [],
  frameSize,
  showZones,
  drawingMode,
  polygonPoints,
  previewPoint,
  selectedZoneType,
  currentZone,
  drawingState
) => {
  if (!canvas) {
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
    naturalWidth = backgroundImg.naturalWidth || frameSize.width;
    naturalHeight = backgroundImg.naturalHeight || frameSize.height;

    canvas.width = displayWidth;
    canvas.height = displayHeight;
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
  } else {
    // Fallback to provided dimensions
    displayWidth = frameSize.width;
    displayHeight = frameSize.height;
    naturalWidth = frameSize.width;
    naturalHeight = frameSize.height;
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  // Calculate scaling factors from natural to display size
  const scaleX = displayWidth / naturalWidth;
  const scaleY = displayHeight / naturalHeight;

  console.log('🎨 Drawing zones on canvas:', {
    canvasSize: `${canvas.width}x${canvas.height}`,
    frameSize: `${frameSize.width}x${frameSize.height}`,
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
    drawPolygonPreview(ctx, polygonPoints, previewPoint, zoneTypes[selectedZoneType], drawingState);
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

/**
 * Draw a polygon zone
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} zone - Zone object
 * @param {Object} zoneConfig - Zone configuration
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 */
export const drawPolygonZone = (ctx, zone, zoneConfig, scaleX, scaleY) => {
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

/**
 * Draw a rectangle zone
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} zone - Zone object
 * @param {Object} zoneConfig - Zone configuration
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 */
export const drawRectangleZone = (ctx, zone, zoneConfig, scaleX, scaleY) => {
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

/**
 * Draw polygon preview while drawing
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array} points - Current polygon points
 * @param {Object} previewPoint - Preview point
 * @param {Object} zoneConfig - Zone configuration
 * @param {Object} drawingState - Drawing state object
 */
export const drawPolygonPreview = (ctx, points, previewPoint, zoneConfig, drawingState) => {
  console.log('🔺 drawPolygonPreview called with', points.length, 'points', points);
  if (points.length === 0) return;

  const {
    snapToGrid,
    gridSize,
    selectedPointIndex,
    hoveredPointIndex,
    hoveredEdgeIndex
  } = drawingState || {};

  ctx.save();

  // Draw grid if enabled
  if (snapToGrid) {
    drawGrid(ctx, gridSize);
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

/**
 * Draw grid for snapping
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} gridSize - Size of grid squares
 */
export const drawGrid = (ctx, gridSize) => {
  const canvas = ctx.canvas;
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
