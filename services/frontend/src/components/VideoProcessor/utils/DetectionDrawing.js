/**
 * Detection Drawing Utilities
 * Handles drawing bounding boxes and detection overlays on canvas
 */

/**
 * Professional bounding box drawing with accurate coordinate transformation
 * @param {Array} detectionList - Array of detection objects
 * @param {HTMLCanvasElement} canvas - Canvas element to draw on
 * @param {HTMLImageElement} img - Image element for size reference
 * @param {boolean} useFullScreenCanvas - Whether using full-screen canvas
 */
export const drawDetections = (detectionList, canvas, img, useFullScreenCanvas = false) => {
  if (!canvas || !img || !detectionList) {
    console.log('🚫 Cannot draw detections: missing canvas, image, or detections');
    return;
  }

  const ctx = canvas.getContext('2d');

  // Get actual displayed image dimensions
  const imgRect = img.getBoundingClientRect();
  const displayWidth = imgRect.width;
  const displayHeight = imgRect.height;

  // Get natural image dimensions (original frame size)
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;

  // Set canvas size to match displayed image exactly
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';

  // Calculate scaling factors
  const scaleX = displayWidth / naturalWidth;
  const scaleY = displayHeight / naturalHeight;

  console.log('📐 Drawing detections:', {
    detections: detectionList.length,
    naturalSize: `${naturalWidth}x${naturalHeight}`,
    displaySize: `${displayWidth}x${displayHeight}`,
    scale: `${scaleX.toFixed(3)}x${scaleY.toFixed(3)}`
  });

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set high-quality rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw bounding boxes with proper scaling
  detectionList.forEach((detection, index) => {
    drawSingleDetection(ctx, detection, index, scaleX, scaleY, detectionList.length);
  });

  console.log(`✅ Drew ${detectionList.length} bounding boxes successfully`);
};

/**
 * Draw a single detection bounding box
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} detection - Detection object
 * @param {number} index - Detection index
 * @param {number} scaleX - X scaling factor
 * @param {number} scaleY - Y scaling factor
 * @param {number} totalDetections - Total number of detections
 */
export const drawSingleDetection = (ctx, detection, index, scaleX, scaleY, totalDetections) => {
  const { bbox, class_name, confidence } = detection;

  // Transform coordinates from original frame to display coordinates
  const x1 = bbox.x1 * scaleX;
  const y1 = bbox.y1 * scaleY;
  const x2 = bbox.x2 * scaleX;
  const y2 = bbox.y2 * scaleY;

  const width = x2 - x1;
  const height = y2 - y1;

  // Get color scheme for this detection type
  const colorScheme = getDetectionColorScheme(class_name);

  // Draw filled background (optional, for better visibility)
  ctx.fillStyle = colorScheme.fill;
  ctx.fillRect(x1, y1, width, height);

  // Draw main bounding box
  ctx.strokeStyle = colorScheme.stroke;
  ctx.lineWidth = Math.max(2, Math.min(4, width / 50)); // Adaptive line width
  ctx.setLineDash([]);
  ctx.strokeRect(x1, y1, width, height);

  // Draw corner markers for better visibility
  drawCornerMarkers(ctx, x1, y1, x2, y2, width, height, colorScheme.stroke);

  // Draw professional label
  drawDetectionLabel(ctx, x1, y1, x2, y2, class_name, confidence, colorScheme, width);

  // Add detection index for debugging (if multiple detections)
  if (totalDetections > 1) {
    drawDetectionIndex(ctx, x2, y1, index + 1);
  }

  console.log(`📦 Drew ${class_name} box:`, {
    original: `(${bbox.x1}, ${bbox.y1}) -> (${bbox.x2}, ${bbox.y2})`,
    scaled: `(${x1.toFixed(1)}, ${y1.toFixed(1)}) -> (${x2.toFixed(1)}, ${y2.toFixed(1)})`,
    size: `${width.toFixed(1)}x${height.toFixed(1)}`,
    confidence: `${(confidence * 100).toFixed(1)}%`
  });
};

/**
 * Get color scheme for detection type
 * @param {string} className - Detection class name
 * @returns {Object} Color scheme with stroke and fill colors
 */
export const getDetectionColorScheme = (className) => {
  const colors = {
    'hand': { stroke: '#00D4FF', fill: 'rgba(0, 212, 255, 0.2)' },      // Bright cyan
    'person': { stroke: '#FF6B9D', fill: 'rgba(255, 107, 157, 0.2)' },   // Pink
    'scooper': { stroke: '#00FF88', fill: 'rgba(0, 255, 136, 0.2)' },    // Bright green
    'pizza': { stroke: '#FFB800', fill: 'rgba(255, 184, 0, 0.2)' },      // Orange
    'violation': { stroke: '#FF3333', fill: 'rgba(255, 51, 51, 0.3)' }   // Red
  };

  return colors[className] || colors['hand'];
};

/**
 * Draw corner markers for better bounding box visibility
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x1 - Top-left X coordinate
 * @param {number} y1 - Top-left Y coordinate
 * @param {number} x2 - Bottom-right X coordinate
 * @param {number} y2 - Bottom-right Y coordinate
 * @param {number} width - Box width
 * @param {number} height - Box height
 * @param {string} strokeColor - Stroke color
 */
export const drawCornerMarkers = (ctx, x1, y1, x2, y2, width, height, strokeColor) => {
  const cornerSize = Math.min(15, width / 8, height / 8);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = Math.max(2, cornerSize / 4);

  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(x1, y1 + cornerSize);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + cornerSize, y1);
  ctx.stroke();

  // Top-right corner
  ctx.beginPath();
  ctx.moveTo(x2 - cornerSize, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y1 + cornerSize);
  ctx.stroke();

  // Bottom-left corner
  ctx.beginPath();
  ctx.moveTo(x1, y2 - cornerSize);
  ctx.lineTo(x1, y2);
  ctx.lineTo(x1 + cornerSize, y2);
  ctx.stroke();

  // Bottom-right corner
  ctx.beginPath();
  ctx.moveTo(x2 - cornerSize, y2);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y2 - cornerSize);
  ctx.stroke();
};

/**
 * Draw detection label with background
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x1 - Top-left X coordinate
 * @param {number} y1 - Top-left Y coordinate
 * @param {number} x2 - Bottom-right X coordinate
 * @param {number} y2 - Bottom-right Y coordinate
 * @param {string} className - Detection class name
 * @param {number} confidence - Detection confidence
 * @param {Object} colorScheme - Color scheme object
 * @param {number} width - Box width
 */
export const drawDetectionLabel = (ctx, x1, y1, x2, y2, className, confidence, colorScheme, width) => {
  const label = `${className.toUpperCase()}: ${(confidence * 100).toFixed(1)}%`;
  const fontSize = Math.max(12, Math.min(16, width / 10));
  ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;

  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width;
  const textHeight = fontSize;

  const labelPadding = 6;
  const labelX = x1;
  const labelY = y1 - textHeight - labelPadding;

  // Ensure label stays within canvas
  const finalLabelY = labelY < 0 ? y1 + textHeight + labelPadding : labelY;

  // Label background with rounded corners effect
  ctx.fillStyle = colorScheme.stroke;
  ctx.fillRect(labelX - 2, finalLabelY - 2, textWidth + labelPadding + 4, textHeight + labelPadding + 4);

  // Label text
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(label, labelX + labelPadding/2, finalLabelY + textHeight);
};

/**
 * Draw detection index number
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x2 - Bottom-right X coordinate
 * @param {number} y1 - Top-left Y coordinate
 * @param {number} index - Detection index (1-based)
 */
export const drawDetectionIndex = (ctx, x2, y1, index) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x2 - 20, y1, 20, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(index.toString(), x2 - 10, y1 + 14);
  ctx.textAlign = 'left';
};

/**
 * Clear detection canvas
 * @param {HTMLCanvasElement} canvas - Canvas to clear
 */
export const clearDetectionCanvas = (canvas) => {
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

/**
 * Update canvas size to match image
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {HTMLImageElement} img - Image element
 */
export const updateCanvasSize = (canvas, img) => {
  if (!canvas || !img) return;

  const imgRect = img.getBoundingClientRect();
  canvas.width = imgRect.width;
  canvas.height = imgRect.height;
  canvas.style.width = imgRect.width + 'px';
  canvas.style.height = imgRect.height + 'px';
};

/**
 * Get detection statistics
 * @param {Array} detections - Array of detection objects
 * @returns {Object} Detection statistics
 */
export const getDetectionStats = (detections) => {
  const stats = {
    total: detections.length,
    byClass: {},
    averageConfidence: 0,
    highConfidence: 0 // Count of detections with >80% confidence
  };

  if (detections.length === 0) return stats;

  let totalConfidence = 0;

  detections.forEach(detection => {
    const className = detection.class_name;
    
    // Count by class
    stats.byClass[className] = (stats.byClass[className] || 0) + 1;
    
    // Sum confidence
    totalConfidence += detection.confidence;
    
    // Count high confidence detections
    if (detection.confidence > 0.8) {
      stats.highConfidence++;
    }
  });

  stats.averageConfidence = totalConfidence / detections.length;

  return stats;
};
