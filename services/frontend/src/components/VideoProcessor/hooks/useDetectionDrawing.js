/**
 * useDetectionDrawing - Custom hook for drawing detection overlays on canvas
 */

import { useCallback } from 'react';

const useDetectionDrawing = ({ videoRef, canvasRef, fullScreenCanvasRef }) => {
  // Draw detection bounding boxes and labels
  const drawDetections = useCallback((detections, options = {}) => {
    const {
      canvas = canvasRef.current,
      video = videoRef.current,
      showLabels = true,
      showConfidence = true,
      lineWidth = 2,
      fontSize = 12,
      colors = {
        person: '#00FF88',
        hand: '#FFD23F',
        spoon: '#4a90e2',
        utensil: '#4a90e2',
        default: '#4a90e2'
      }
    } = options;

    if (!canvas || !video || !detections?.length) {
      // Clear canvas if no detections
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

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

    console.log('🎨 Drawing detections:', {
      count: detections.length,
      canvasSize: `${canvas.width}x${canvas.height}`,
      videoSize: `${video.naturalWidth}x${video.naturalHeight}`,
      displaySize: `${rect.width}x${rect.height}`,
      scale: `${scaleX.toFixed(2)}x${scaleY.toFixed(2)}`
    });

    detections.forEach((detection, index) => {
      try {
        const bbox = detection.bbox || detection.bounding_box;
        if (!bbox) {
          console.warn('⚠️ Detection missing bbox:', detection);
          return;
        }

        // Calculate scaled coordinates
        const x = bbox.x1 * scaleX;
        const y = bbox.y1 * scaleY;
        const width = (bbox.x2 - bbox.x1) * scaleX;
        const height = (bbox.y2 - bbox.y1) * scaleY;

        // Get class name and confidence
        const className = detection.class_name || detection.class || 'unknown';
        const confidence = detection.confidence || 0;

        // Choose color based on class
        const color = colors[className.toLowerCase()] || colors.default;

        // Draw bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent fill
        ctx.fillStyle = `${color}20`;
        ctx.fillRect(x, y, width, height);

        // Draw label background and text
        if (showLabels) {
          const label = showConfidence 
            ? `${className} (${(confidence * 100).toFixed(1)}%)`
            : className;

          ctx.font = `bold ${fontSize}px Arial`;
          const textMetrics = ctx.measureText(label);
          const textWidth = textMetrics.width;
          const textHeight = fontSize;

          // Label background
          const labelY = y > textHeight + 4 ? y - textHeight - 4 : y + height + 4;
          ctx.fillStyle = color;
          ctx.fillRect(x, labelY, textWidth + 8, textHeight + 4);

          // Label text
          ctx.fillStyle = 'white';
          ctx.fillText(label, x + 4, labelY + textHeight);
        }

        // Draw center point
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
        ctx.fill();

      } catch (error) {
        console.error('❌ Error drawing detection:', error, detection);
      }
    });

    console.log(`✅ Drew ${detections.length} detections on canvas`);
  }, [videoRef, canvasRef]);

  // Draw ROI zones
  const drawROIZones = useCallback((zones, options = {}) => {
    const {
      canvas = canvasRef.current,
      video = videoRef.current,
      showLabels = true,
      lineWidth = 2,
      fontSize = 14,
      activeColor = '#00FF88',
      inactiveColor = '#666',
      requiresScooperColor = '#FFD23F'
    } = options;

    if (!canvas || !video || !zones?.length) return;

    const ctx = canvas.getContext('2d');
    const rect = video.getBoundingClientRect();

    // Calculate scale factors (zones are in percentage, need to convert to pixels)
    const scaleX = rect.width / 100;
    const scaleY = rect.height / 100;

    zones.forEach((zone, index) => {
      try {
        // Calculate pixel coordinates from percentages
        const x = zone.x * scaleX;
        const y = zone.y * scaleY;
        const width = zone.width * scaleX;
        const height = zone.height * scaleY;

        // Choose color based on zone properties
        let color = zone.requires_scooper ? requiresScooperColor : activeColor;
        if (zone.disabled) color = inactiveColor;

        // Draw zone rectangle
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash([5, 5]); // Dashed line for zones
        ctx.strokeRect(x, y, width, height);

        // Draw semi-transparent fill
        ctx.fillStyle = `${color}15`;
        ctx.fillRect(x, y, width, height);

        // Reset line dash
        ctx.setLineDash([]);

        // Draw zone label
        if (showLabels) {
          const label = zone.name || `Zone ${index + 1}`;
          const subLabel = zone.ingredient_type || '';

          ctx.font = `bold ${fontSize}px Arial`;
          const textMetrics = ctx.measureText(label);
          const textWidth = Math.max(textMetrics.width, ctx.measureText(subLabel).width);

          // Label background
          ctx.fillStyle = `${color}CC`;
          ctx.fillRect(x + 4, y + 4, textWidth + 8, fontSize * 2 + 8);

          // Label text
          ctx.fillStyle = 'white';
          ctx.fillText(label, x + 8, y + fontSize + 4);
          
          if (subLabel) {
            ctx.font = `${fontSize - 2}px Arial`;
            ctx.fillText(subLabel, x + 8, y + fontSize * 2 + 2);
          }

          // Scooper requirement indicator
          if (zone.requires_scooper) {
            ctx.fillStyle = requiresScooperColor;
            ctx.font = `bold ${fontSize - 2}px Arial`;
            ctx.fillText('🥄 Required', x + width - 80, y + fontSize + 4);
          }
        }

      } catch (error) {
        console.error('❌ Error drawing ROI zone:', error, zone);
      }
    });
  }, [videoRef, canvasRef]);

  // Draw violation indicators
  const drawViolations = useCallback((violations, options = {}) => {
    const {
      canvas = canvasRef.current,
      video = videoRef.current,
      showAlerts = true,
      pulseAnimation = true,
      alertColor = '#ef4444',
      warningColor = '#f59e0b'
    } = options;

    if (!canvas || !video || !violations?.length) return;

    const ctx = canvas.getContext('2d');
    const rect = video.getBoundingClientRect();

    violations.forEach((violation, index) => {
      try {
        if (!violation.location_coords) return;

        const x = violation.location_coords.x * rect.width / 100;
        const y = violation.location_coords.y * rect.height / 100;

        const color = violation.severity === 'critical' ? alertColor : warningColor;
        const radius = pulseAnimation ? 15 + Math.sin(Date.now() / 200) * 5 : 15;

        // Draw violation indicator
        ctx.fillStyle = `${color}80`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw violation icon
        ctx.fillStyle = color;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️', x, y + 7);

        // Draw violation label if enabled
        if (showAlerts) {
          const label = violation.type || 'Violation';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'left';
          const textWidth = ctx.measureText(label).width;

          // Label background
          ctx.fillStyle = `${color}CC`;
          ctx.fillRect(x + 20, y - 10, textWidth + 8, 20);

          // Label text
          ctx.fillStyle = 'white';
          ctx.fillText(label, x + 24, y + 4);
        }

      } catch (error) {
        console.error('❌ Error drawing violation:', error, violation);
      }
    });

    // Reset text alignment
    ctx.textAlign = 'left';
  }, [videoRef, canvasRef]);

  // Clear canvas
  const clearCanvas = useCallback((canvas = canvasRef.current) => {
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [canvasRef]);

  // Resize canvas to match video
  const resizeCanvas = useCallback((canvas = canvasRef.current, video = videoRef.current) => {
    if (canvas && video) {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
  }, [videoRef, canvasRef]);

  return {
    drawDetections,
    drawROIZones,
    drawViolations,
    clearCanvas,
    resizeCanvas
  };
};

export default useDetectionDrawing;
