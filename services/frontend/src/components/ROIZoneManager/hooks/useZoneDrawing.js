/**
 * useZoneDrawing - Custom hook for managing zone drawing state
 * Handles drawing modes, polygon points, and drawing interactions
 */

import { useState, useCallback } from 'react';
import { toast } from 'react-toastify';

export const useZoneDrawing = () => {
  // Drawing state
  const [drawingMode, setDrawingMode] = useState('polygon');
  const [isDrawing, setIsDrawing] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState([]);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [currentZone, setCurrentZone] = useState(null);

  // Interaction state
  const [selectedPointIndex, setSelectedPointIndex] = useState(-1);
  const [hoveredPointIndex, setHoveredPointIndex] = useState(-1);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState(-1);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Editing state
  const [editingZone, setEditingZone] = useState(null);
  const [editingPolygon, setEditingPolygon] = useState(null);

  // Grid and snapping
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);

  /**
   * Switch drawing mode between polygon and rectangle
   * @param {string} mode - Drawing mode ('polygon' or 'rectangle')
   */
  const switchDrawingMode = useCallback((mode) => {
    if (mode === drawingMode) return;

    // Cancel current drawing if switching modes
    if (isDrawing) {
      cancelCurrentDrawing();
    }

    setDrawingMode(mode);
    toast.info(`🎨 Switched to ${mode} drawing mode`);
  }, [drawingMode, isDrawing]);

  /**
   * Cancel current drawing operation
   */
  const cancelCurrentDrawing = useCallback(() => {
    setIsDrawing(false);
    setPolygonPoints([]);
    setPreviewPoint(null);
    setCurrentZone(null);
    setSelectedPointIndex(-1);
    setHoveredPointIndex(-1);
    setHoveredEdgeIndex(-1);
    setIsDraggingPoint(false);
    setEditingZone(null);
    setEditingPolygon(null);
    
    toast.info('🚫 Drawing cancelled');
  }, []);

  /**
   * Start new drawing operation
   * @param {string} zoneType - Type of zone to draw
   */
  const startDrawing = useCallback((zoneType) => {
    if (!zoneType) {
      toast.error('Please select a zone type first');
      return;
    }

    // Cancel any existing drawing
    cancelCurrentDrawing();

    toast.info(`🎨 Started drawing ${drawingMode} zone of type: ${zoneType}`);
  }, [drawingMode, cancelCurrentDrawing]);

  /**
   * Toggle grid snapping
   */
  const toggleGridSnapping = useCallback(() => {
    setSnapToGrid(prev => {
      const newValue = !prev;
      toast.info(`📐 Grid snapping ${newValue ? 'enabled' : 'disabled'}`);
      return newValue;
    });
  }, []);

  /**
   * Update grid size
   * @param {number} size - New grid size
   */
  const updateGridSize = useCallback((size) => {
    if (size < 5 || size > 100) {
      toast.error('Grid size must be between 5 and 100 pixels');
      return;
    }

    setGridSize(size);
    toast.info(`📐 Grid size set to ${size}px`);
  }, []);

  /**
   * Check if currently drawing
   * @returns {boolean} True if drawing is in progress
   */
  const isCurrentlyDrawing = useCallback(() => {
    return isDrawing || polygonPoints.length > 0;
  }, [isDrawing, polygonPoints.length]);

  /**
   * Check if polygon can be completed
   * @returns {boolean} True if polygon can be completed
   */
  const canCompletePolygon = useCallback(() => {
    return drawingMode === 'polygon' && polygonPoints.length >= 3;
  }, [drawingMode, polygonPoints.length]);

  /**
   * Get current drawing state summary
   * @returns {Object} Drawing state summary
   */
  const getDrawingState = useCallback(() => {
    return {
      mode: drawingMode,
      isDrawing,
      pointCount: polygonPoints.length,
      hasPreview: !!previewPoint,
      hasCurrentZone: !!currentZone,
      isEditing: !!(editingZone || editingPolygon),
      canComplete: canCompletePolygon(),
      snapToGrid,
      gridSize,
      selectedPointIndex,
      hoveredPointIndex,
      hoveredEdgeIndex,
      isDraggingPoint
    };
  }, [
    drawingMode,
    isDrawing,
    polygonPoints.length,
    previewPoint,
    currentZone,
    editingZone,
    editingPolygon,
    canCompletePolygon,
    snapToGrid,
    gridSize,
    selectedPointIndex,
    hoveredPointIndex,
    hoveredEdgeIndex,
    isDraggingPoint
  ]);

  /**
   * Reset all drawing state
   */
  const resetDrawingState = useCallback(() => {
    setDrawingMode('polygon');
    setIsDrawing(false);
    setPolygonPoints([]);
    setPreviewPoint(null);
    setCurrentZone(null);
    setSelectedPointIndex(-1);
    setHoveredPointIndex(-1);
    setHoveredEdgeIndex(-1);
    setIsDraggingPoint(false);
    setDragOffset({ x: 0, y: 0 });
    setEditingZone(null);
    setEditingPolygon(null);
    setSnapToGrid(false);
    setGridSize(20);
  }, []);

  /**
   * Handle keyboard shortcuts for drawing
   * @param {KeyboardEvent} event - Keyboard event
   */
  const handleKeyboardShortcut = useCallback((event) => {
    if (!event) return;

    switch (event.key.toLowerCase()) {
      case 'escape':
        event.preventDefault();
        cancelCurrentDrawing();
        break;
      case 'enter':
        if (canCompletePolygon()) {
          event.preventDefault();
          // This would trigger polygon completion in the parent component
          return { action: 'completePolygon' };
        }
        break;
      case 'p':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          switchDrawingMode('polygon');
        }
        break;
      case 'r':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          switchDrawingMode('rectangle');
        }
        break;
      case 'g':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          toggleGridSnapping();
        }
        break;
      case 'delete':
      case 'backspace':
        if (selectedPointIndex >= 0) {
          event.preventDefault();
          return { action: 'deletePoint', pointIndex: selectedPointIndex };
        }
        break;
      default:
        break;
    }

    return null;
  }, [canCompletePolygon, selectedPointIndex, switchDrawingMode, toggleGridSnapping, cancelCurrentDrawing]);

  return {
    // State
    drawingMode,
    isDrawing,
    polygonPoints,
    previewPoint,
    currentZone,
    selectedPointIndex,
    hoveredPointIndex,
    hoveredEdgeIndex,
    isDraggingPoint,
    dragOffset,
    editingZone,
    editingPolygon,
    snapToGrid,
    gridSize,

    // Setters
    setDrawingMode,
    setIsDrawing,
    setPolygonPoints,
    setPreviewPoint,
    setCurrentZone,
    setSelectedPointIndex,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    setIsDraggingPoint,
    setDragOffset,
    setEditingZone,
    setEditingPolygon,
    setSnapToGrid,
    setGridSize,

    // Actions
    switchDrawingMode,
    cancelCurrentDrawing,
    startDrawing,
    toggleGridSnapping,
    updateGridSize,
    resetDrawingState,
    handleKeyboardShortcut,

    // Computed
    isCurrentlyDrawing,
    canCompletePolygon,
    getDrawingState
  };
};
