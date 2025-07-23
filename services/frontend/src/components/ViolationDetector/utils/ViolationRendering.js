/**
 * Violation Rendering Utilities
 * Handles drawing violation overlays and visual indicators on canvas
 */

import { violationTypes } from '../ViolationTypes';

/**
 * Draw violation overlay on canvas
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {Array} violations - Array of violations to render
 * @param {number} frameWidth - Natural frame width
 * @param {number} frameHeight - Natural frame height
 */
export const drawViolationOverlay = (canvas, violations, frameWidth, frameHeight) => {
  if (!canvas || violations.length === 0) return;

  const ctx = canvas.getContext('2d');

  // Get the video element to match its display size
  const videoElement = document.querySelector('img[alt="Current frame"]');
  if (videoElement) {
    const rect = videoElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  } else {
    canvas.width = frameWidth;
    canvas.height = frameHeight;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate scaling from natural to display coordinates
  const naturalWidth = frameWidth;
  const naturalHeight = frameHeight;
  const displayWidth = canvas.width;
  const displayHeight = canvas.height;
  const scaleX = displayWidth / naturalWidth;
  const scaleY = displayHeight / naturalHeight;

  console.log('🚨 Drawing violations:', {
    violations: violations.length,
    naturalSize: `${naturalWidth}x${naturalHeight}`,
    displaySize: `${displayWidth}x${displayHeight}`,
    scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
  });

  // Draw violation indicators
  violations.forEach((violation, index) => {
    drawViolationIndicator(ctx, violation, index, scaleX, scaleY);
  });
};

/**
 * Draw a single violation indicator
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {object} violation - Violation object
 * @param {number} index - Violation index
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 */
export const drawViolationIndicator = (ctx, violation, index, scaleX, scaleY) => {
  const config = violationTypes[violation.type];
  const position = violation.details.position;

  if (!position || !config) return;

  // Scale position from natural to display coordinates
  const displayX = position.x * scaleX;
  const displayY = position.y * scaleY;

  // Pulsing violation indicator
  const pulseScale = 1 + 0.3 * Math.sin(Date.now() / 200);
  const baseRadius = getSeverityRadius(violation.severity);
  const radius = baseRadius * pulseScale;
  
  // Draw violation indicator with professional styling
  drawViolationCircle(ctx, displayX, displayY, radius, config, violation);
  
  // Draw violation label
  drawViolationLabel(ctx, displayX, displayY, radius, violation, config);

  console.log(`🚨 Drew violation at:`, {
    natural: `(${position.x.toFixed(1)}, ${position.y.toFixed(1)})`,
    display: `(${displayX.toFixed(1)}, ${displayY.toFixed(1)})`,
    type: violation.type
  });
};

/**
 * Draw violation circle with glow effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Circle radius
 * @param {object} config - Violation type configuration
 * @param {object} violation - Violation object
 */
export const drawViolationCircle = (ctx, x, y, radius, config, violation) => {
  // Outer glow effect
  const glowRadius = radius + 15;
  const gradient = ctx.createRadialGradient(x, y, radius, x, y, glowRadius);
  gradient.addColorStop(0, config.color + '60'); // 38% opacity
  gradient.addColorStop(0.7, config.color + '30'); // 19% opacity
  gradient.addColorStop(1, config.color + '00'); // 0% opacity

  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, 2 * Math.PI);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Main circle with severity-based styling
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  
  // Fill with semi-transparent color
  ctx.fillStyle = config.color + 'AA'; // 67% opacity
  ctx.fill();
  
  // Border with full color
  ctx.strokeStyle = config.color;
  ctx.lineWidth = getSeverityLineWidth(violation.severity);
  ctx.stroke();

  // Inner highlight for depth
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.7, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFFFFF30'; // 19% white overlay
  ctx.fill();

  // Icon in center
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.max(16, radius * 0.6)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(config.icon, x, y);
};

/**
 * Draw violation label with background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} radius - Circle radius
 * @param {object} violation - Violation object
 * @param {object} config - Violation type configuration
 */
export const drawViolationLabel = (ctx, x, y, radius, violation, config) => {
  const labelText = violation.type.replace(/_/g, ' ');
  const confidenceText = `${(violation.confidence * 100).toFixed(0)}%`;
  
  const fontSize = Math.max(10, radius * 0.4);
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Measure text for background
  const labelMetrics = ctx.measureText(labelText);
  const confidenceMetrics = ctx.measureText(confidenceText);
  const maxWidth = Math.max(labelMetrics.width, confidenceMetrics.width);
  
  const labelY = y - radius - 15;
  const padding = 6;
  const lineHeight = fontSize + 2;
  const backgroundHeight = (lineHeight * 2) + padding;

  // Draw background with rounded corners effect
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(
    x - (maxWidth / 2) - padding,
    labelY - padding,
    maxWidth + (padding * 2),
    backgroundHeight
  );

  // Draw border
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(
    x - (maxWidth / 2) - padding,
    labelY - padding,
    maxWidth + (padding * 2),
    backgroundHeight
  );

  // Draw violation type text
  ctx.fillStyle = config.color;
  ctx.fillText(labelText, x, labelY);

  // Draw confidence text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${fontSize * 0.8}px Arial`;
  ctx.fillText(confidenceText, x, labelY + lineHeight);
};

/**
 * Get radius based on violation severity
 * @param {string} severity - Violation severity
 * @returns {number} Circle radius
 */
export const getSeverityRadius = (severity) => {
  const radii = {
    'high': 35,
    'medium': 28,
    'low': 22
  };
  return radii[severity] || radii['medium'];
};

/**
 * Get line width based on violation severity
 * @param {string} severity - Violation severity
 * @returns {number} Line width
 */
export const getSeverityLineWidth = (severity) => {
  const widths = {
    'high': 4,
    'medium': 3,
    'low': 2
  };
  return widths[severity] || widths['medium'];
};

/**
 * Draw violation heatmap overlay
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Array} violationHistory - Historical violations
 * @param {number} frameWidth - Frame width
 * @param {number} frameHeight - Frame height
 * @param {number} timeWindow - Time window in hours (default: 24)
 */
export const drawViolationHeatmap = (canvas, violationHistory, frameWidth, frameHeight, timeWindow = 24) => {
  if (!canvas || violationHistory.length === 0) return;

  const ctx = canvas.getContext('2d');
  const now = Date.now();
  const timeLimit = now - (timeWindow * 60 * 60 * 1000);

  // Filter recent violations
  const recentViolations = violationHistory.filter(v => 
    new Date(v.timestamp).getTime() >= timeLimit && v.details.position
  );

  if (recentViolations.length === 0) return;

  // Create heatmap grid
  const gridSize = 20;
  const cols = Math.ceil(frameWidth / gridSize);
  const rows = Math.ceil(frameHeight / gridSize);
  const heatGrid = Array(rows).fill().map(() => Array(cols).fill(0));

  // Populate grid with violation counts
  recentViolations.forEach(violation => {
    const pos = violation.details.position;
    const gridX = Math.floor(pos.x / gridSize);
    const gridY = Math.floor(pos.y / gridSize);
    
    if (gridX >= 0 && gridX < cols && gridY >= 0 && gridY < rows) {
      heatGrid[gridY][gridX]++;
    }
  });

  // Find max count for normalization
  const maxCount = Math.max(...heatGrid.flat());
  if (maxCount === 0) return;

  // Draw heatmap
  const scaleX = canvas.width / frameWidth;
  const scaleY = canvas.height / frameHeight;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const count = heatGrid[row][col];
      if (count > 0) {
        const intensity = count / maxCount;
        const alpha = Math.min(intensity * 0.6, 0.6); // Max 60% opacity
        
        ctx.fillStyle = `rgba(255, 51, 51, ${alpha})`;
        ctx.fillRect(
          col * gridSize * scaleX,
          row * gridSize * scaleY,
          gridSize * scaleX,
          gridSize * scaleY
        );
      }
    }
  }
};

/**
 * Clear violation canvas
 * @param {HTMLCanvasElement} canvas - Canvas to clear
 */
export const clearViolationCanvas = (canvas) => {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

/**
 * Update canvas size to match video element
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {number} frameWidth - Frame width
 * @param {number} frameHeight - Frame height
 */
export const updateViolationCanvasSize = (canvas, frameWidth, frameHeight) => {
  if (!canvas) return;

  const videoElement = document.querySelector('img[alt="Current frame"]');
  if (videoElement) {
    const rect = videoElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  } else {
    canvas.width = frameWidth;
    canvas.height = frameHeight;
  }
};
