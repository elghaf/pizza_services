/**
 * Violation Display Component
 * Handles the visual display of violations on canvas with overlays
 */

import React, { useRef, useEffect } from 'react';
import { drawViolationOverlay, updateViolationCanvasSize } from '../utils/ViolationRendering';

const ViolationDisplay = ({
  violations = [],
  frameWidth,
  frameHeight,
  showOverlay = true,
  className = ''
}) => {
  const canvasRef = useRef(null);

  // Update canvas and draw violations when violations change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Update canvas size to match video
    updateViolationCanvasSize(canvas, frameWidth, frameHeight);

    // Draw violations if overlay is enabled
    if (showOverlay) {
      drawViolationOverlay(canvas, violations, frameWidth, frameHeight);
    } else {
      // Clear canvas if overlay is disabled
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [violations, frameWidth, frameHeight, showOverlay]);

  return (
    <canvas
      ref={canvasRef}
      className={`violation-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 30,
        borderRadius: '8px'
      }}
    />
  );
};

export default ViolationDisplay;
