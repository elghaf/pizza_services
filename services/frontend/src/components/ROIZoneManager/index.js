/**
 * ROI Zone Manager - Main Component
 * Orchestrates all zone management functionality with modular architecture
 */

import React, { useRef, useEffect, useCallback, useState, useImperativeHandle } from 'react';
import { toast } from 'react-toastify';
import './ROIZoneManager.css';
import databaseClient from '../../utils/DatabaseClient';

// Import modular components and hooks
import { useZoneDrawing } from './hooks/useZoneDrawing';
import { useZoneHistory } from './hooks/useZoneHistory';
import ZoneControls from './ZoneControls';
import { drawZones } from './DrawingEngine';
import { 
  handleMouseDown, 
  handleMouseMove, 
  handleMouseUp,
  handlePolygonClick,
  handleRectangleStart 
} from './MouseHandlers';
import { 
  completePolygon, 
  cancelPolygonDrawing,
  deletePolygonPoint,
  validatePolygon 
} from './PolygonDrawing';

const ROIZoneManager = React.forwardRef(({
  zones = [],
  onZonesUpdate,
  frameSize = { width: 640, height: 480 },
  backgroundImage = null,
  isEnabled = true,
  showZones = true,
  className = '',
  style = {}
}, ref) => {
  const canvasRef = useRef(null);

  // Use custom hooks for state management
  const drawingState = useZoneDrawing();
  const historyState = useZoneHistory();

  // Database session tracking
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // Enhanced zones update with database saving
  const handleZonesUpdate = useCallback(async (newZones) => {
    // Update parent component
    if (onZonesUpdate) {
      onZonesUpdate(newZones);
    }

    // Save to database if session is active
    if (currentSessionId && newZones.length > 0) {
      try {
        await databaseClient.saveROIZones(currentSessionId, newZones);
        console.log('📊 ROI zones saved to database:', newZones.length, 'zones');
      } catch (error) {
        console.error('❌ Failed to save ROI zones to database:', error);
      }
    }
  }, [onZonesUpdate, currentSessionId]);

  // Function to set session tracking
  const setSessionTracking = useCallback((sessionId) => {
    setCurrentSessionId(sessionId);
    console.log('📊 ROI Zone Manager session tracking set:', sessionId);
  }, []);

  // Expose functions to parent component
  useImperativeHandle(ref, () => ({
    setSessionTracking
  }), [setSessionTracking]);

  // Destructure drawing state for easier access
  const {
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
    toggleGridSnapping,
    updateGridSize,
    canCompletePolygon,
    getDrawingState,
    handleKeyboardShortcut
  } = drawingState;

  // Destructure history state
  const {
    addPointToHistory,
    undo,
    redo,
    getHistoryStats
  } = historyState;

  // Get history statistics
  const { canUndo, canRedo } = getHistoryStats();

  /**
   * Main drawing function wrapper
   */
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentDrawingState = getDrawingState();

    drawZones(
      canvas,
      zones,
      frameSize,
      showZones,
      drawingMode,
      polygonPoints,
      previewPoint,
      drawingState.selectedZoneType || 'sauce_area',
      currentZone,
      currentDrawingState
    );
  }, [
    zones,
    frameSize,
    showZones,
    drawingMode,
    polygonPoints,
    previewPoint,
    currentZone,
    getDrawingState
  ]);

  /**
   * Handle mouse down events
   */
  const onMouseDown = useCallback((event) => {
    const state = {
      isEnabled,
      drawingMode,
      selectedZoneType: drawingState.selectedZoneType || 'sauce_area',
      polygonPoints,
      zones,
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      canvasRef,
      snapToGrid,
      gridSize
    };

    const actions = {
      setSelectedPointIndex,
      setIsDraggingPoint,
      setDragOffset,
      setEditingPolygon,
      setPolygonPoints,
      setIsDrawing,
      setEditingZone,
      addPointToHistory
    };

    const result = handleMouseDown(event, state, actions);
    
    if (result?.action === 'handlePolygonClick') {
      handlePolygonClick(result.coords.display, result.coords.natural, state, actions);
    } else if (result?.action === 'handleRectangleStart') {
      handleRectangleStart(result.coords.display, result.coords.natural, state, actions);
    }

    redrawCanvas();
  }, [
    isEnabled,
    drawingMode,
    polygonPoints,
    zones,
    frameSize,
    snapToGrid,
    gridSize,
    setSelectedPointIndex,
    setIsDraggingPoint,
    setDragOffset,
    setEditingPolygon,
    setPolygonPoints,
    setIsDrawing,
    setEditingZone,
    addPointToHistory,
    redrawCanvas
  ]);

  /**
   * Handle mouse move events
   */
  const onMouseMove = useCallback((event) => {
    const state = {
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
    };

    const actions = {
      setPolygonPoints,
      setHoveredPointIndex,
      setHoveredEdgeIndex,
      setPreviewPoint,
      setCurrentZone,
      drawZones: redrawCanvas
    };

    handleMouseMove(event, state, actions);
  }, [
    isEnabled,
    drawingMode,
    isDraggingPoint,
    selectedPointIndex,
    dragOffset,
    polygonPoints,
    isDrawing,
    currentZone,
    zones,
    snapToGrid,
    gridSize,
    setPolygonPoints,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    setPreviewPoint,
    setCurrentZone,
    redrawCanvas
  ]);

  /**
   * Handle mouse up events
   */
  const onMouseUp = useCallback((event) => {
    const state = {
      isDraggingPoint,
      selectedPointIndex,
      polygonPoints,
      isDrawing,
      currentZone,
      zones,
      selectedZoneType: drawingState.selectedZoneType || 'sauce_area',
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      canvasRef
    };

    const actions = {
      setIsDraggingPoint,
      addPointToHistory,
      setIsDrawing,
      setCurrentZone,
      setZones: (newZones) => handleZonesUpdate(newZones),
      onZonesUpdate: handleZonesUpdate
    };

    handleMouseUp(event, state, actions);
    redrawCanvas();
  }, [
    isDraggingPoint,
    selectedPointIndex,
    polygonPoints,
    isDrawing,
    currentZone,
    zones,
    frameSize,
    setIsDraggingPoint,
    addPointToHistory,
    setIsDrawing,
    setCurrentZone,
    handleZonesUpdate,
    redrawCanvas
  ]);

  /**
   * Complete polygon drawing
   */
  const onCompletePolygon = useCallback(() => {
    const state = {
      polygonPoints,
      editingPolygon,
      selectedZoneType: drawingState.selectedZoneType || 'sauce_area',
      zones,
      frameWidth: frameSize.width,
      frameHeight: frameSize.height,
      canvasRef
    };

    const actions = {
      setZones: (newZones) => handleZonesUpdate(newZones),
      onZonesUpdate: handleZonesUpdate,
      addPointToHistory,
      setEditingPolygon,
      setPolygonPoints,
      setIsDrawing,
      setPreviewPoint,
      setSelectedPointIndex,
      setHoveredPointIndex,
      setHoveredEdgeIndex,
      drawZones: redrawCanvas
    };

    completePolygon(state, actions);
  }, [
    polygonPoints,
    editingPolygon,
    zones,
    frameSize,
    handleZonesUpdate,
    addPointToHistory,
    setEditingPolygon,
    setPolygonPoints,
    setIsDrawing,
    setPreviewPoint,
    setSelectedPointIndex,
    setHoveredPointIndex,
    setHoveredEdgeIndex,
    redrawCanvas
  ]);

  /**
   * Handle keyboard events
   */
  const onKeyDown = useCallback((event) => {
    const result = handleKeyboardShortcut(event);
    
    if (result?.action === 'completePolygon') {
      onCompletePolygon();
    } else if (result?.action === 'deletePoint') {
      deletePolygonPoint(result.pointIndex, { polygonPoints }, {
        setPolygonPoints,
        addPointToHistory,
        drawZones: redrawCanvas
      });
    }
  }, [handleKeyboardShortcut, onCompletePolygon, polygonPoints, setPolygonPoints, addPointToHistory, redrawCanvas]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  // Redraw canvas when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  return (
    <div className={`roi-zone-manager ${className}`} style={style}>
      <div className="zone-manager-content">
        {/* Canvas for zone drawing */}
        <div className="canvas-container">
          {backgroundImage && (
            <img
              id="roi-background-image"
              src={backgroundImage}
              alt="ROI Background"
              className="roi-background-image"
              style={{ display: 'none' }}
            />
          )}
          <canvas
            ref={canvasRef}
            className="roi-canvas"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{
              cursor: isDrawing ? 'crosshair' : 'default',
              border: '2px solid #ddd',
              borderRadius: '8px'
            }}
          />
        </div>

        {/* Zone Controls */}
        <ZoneControls
          zones={zones}
          selectedZoneType={drawingState.selectedZoneType || 'sauce_area'}
          onZoneTypeChange={(type) => drawingState.setSelectedZoneType?.(type)}
          onDeleteZone={(zoneId) => {
            const newZones = zones.filter(zone => zone.id !== zoneId);
            handleZonesUpdate(newZones);
            toast.success('Zone deleted successfully');
          }}
          onClearAllZones={() => {
            handleZonesUpdate([]);
            toast.success('All zones cleared');
          }}
          drawingMode={drawingMode}
          onDrawingModeChange={switchDrawingMode}
          isEnabled={isEnabled}
          onToggleEnabled={() => {/* This would be handled by parent component */}}
          isDrawing={isDrawing}
          canCompletePolygon={canCompletePolygon()}
          onCompletePolygon={onCompletePolygon}
          onCancelDrawing={cancelCurrentDrawing}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={toggleGridSnapping}
          gridSize={gridSize}
          onGridSizeChange={updateGridSize}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => undo(setPolygonPoints, handleZonesUpdate)}
          onRedo={() => redo(setPolygonPoints, handleZonesUpdate)}
          onSaveTemplate={() => toast.info('Template saving not implemented yet')}
          onLoadTemplate={() => toast.info('Template loading not implemented yet')}
        />
      </div>
    </div>
  );
});

ROIZoneManager.displayName = 'ROIZoneManager';

export default ROIZoneManager;
