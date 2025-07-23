/**
 * useZoneHistory - Custom hook for managing undo/redo functionality
 * Handles history tracking for zone operations
 */

import { useState } from 'react';
import { toast } from 'react-toastify';

export const useZoneHistory = () => {
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  /**
   * Add an action to the history stack
   * @param {string} action - Type of action performed
   * @param {Object} data - Data associated with the action
   */
  const addPointToHistory = (action, data) => {
    const historyEntry = {
      action,
      data: JSON.parse(JSON.stringify(data)),
      timestamp: Date.now()
    };

    setUndoStack(prev => [...prev.slice(-19), historyEntry]); // Keep last 20 actions
    setRedoStack([]); // Clear redo stack when new action is performed
  };

  /**
   * Undo the last action
   * @param {Function} setPolygonPoints - Function to update polygon points
   * @param {Function} setZones - Function to update zones
   */
  const undo = (setPolygonPoints, setZones) => {
    if (undoStack.length === 0) {
      toast.warning('Nothing to undo');
      return;
    }

    const lastAction = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, lastAction]);
    setUndoStack(prev => prev.slice(0, -1));

    // Apply undo logic based on action type
    switch (lastAction.action) {
      case 'addPoint':
        if (setPolygonPoints && lastAction.data.previousPoints) {
          setPolygonPoints(lastAction.data.previousPoints);
        }
        break;
      case 'movePoint':
        if (setPolygonPoints && lastAction.data.originalPosition) {
          // Restore previous point position
          setPolygonPoints(prev => {
            const newPoints = [...prev];
            if (lastAction.data.pointIndex >= 0 && lastAction.data.pointIndex < newPoints.length) {
              newPoints[lastAction.data.pointIndex] = lastAction.data.originalPosition;
            }
            return newPoints;
          });
        }
        break;
      case 'deletePoint':
        if (setPolygonPoints && lastAction.data.deletedPoint && lastAction.data.pointIndex >= 0) {
          // Restore deleted point
          setPolygonPoints(prev => {
            const newPoints = [...prev];
            newPoints.splice(lastAction.data.pointIndex, 0, lastAction.data.deletedPoint);
            return newPoints;
          });
        }
        break;
      case 'addZone':
        if (setZones && lastAction.data.zoneId) {
          // Remove the added zone
          setZones(prev => prev.filter(zone => zone.id !== lastAction.data.zoneId));
        }
        break;
      case 'deleteZone':
        if (setZones && lastAction.data.deletedZone) {
          // Restore deleted zone
          setZones(prev => [...prev, lastAction.data.deletedZone]);
        }
        break;
      case 'updatePolygon':
        if (setZones && lastAction.data.zoneId && lastAction.data.previousPoints) {
          // Restore previous polygon points
          setZones(prev => prev.map(zone =>
            zone.id === lastAction.data.zoneId
              ? { ...zone, points: lastAction.data.previousPoints }
              : zone
          ));
        }
        break;
      default:
        console.warn('Unknown action type for undo:', lastAction.action);
        break;
    }

    toast.info('↶ Undone');
  };

  /**
   * Redo the last undone action
   * @param {Function} setPolygonPoints - Function to update polygon points
   * @param {Function} setZones - Function to update zones
   */
  const redo = (setPolygonPoints, setZones) => {
    if (redoStack.length === 0) {
      toast.warning('Nothing to redo');
      return;
    }

    const actionToRedo = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, actionToRedo]);
    setRedoStack(prev => prev.slice(0, -1));

    // Apply redo logic based on action type
    switch (actionToRedo.action) {
      case 'addPoint':
        if (setPolygonPoints && actionToRedo.data.newPoints) {
          setPolygonPoints(actionToRedo.data.newPoints);
        }
        break;
      case 'movePoint':
        if (setPolygonPoints && actionToRedo.data.newPosition) {
          // Apply the point move
          setPolygonPoints(prev => {
            const newPoints = [...prev];
            if (actionToRedo.data.pointIndex >= 0 && actionToRedo.data.pointIndex < newPoints.length) {
              newPoints[actionToRedo.data.pointIndex] = actionToRedo.data.newPosition;
            }
            return newPoints;
          });
        }
        break;
      case 'deletePoint':
        if (setPolygonPoints && actionToRedo.data.pointIndex >= 0) {
          // Remove the point again
          setPolygonPoints(prev => {
            const newPoints = [...prev];
            newPoints.splice(actionToRedo.data.pointIndex, 1);
            return newPoints;
          });
        }
        break;
      case 'addZone':
        if (setZones && actionToRedo.data.zone) {
          // Add the zone again
          setZones(prev => [...prev, actionToRedo.data.zone]);
        }
        break;
      case 'deleteZone':
        if (setZones && actionToRedo.data.zoneId) {
          // Delete the zone again
          setZones(prev => prev.filter(zone => zone.id !== actionToRedo.data.zoneId));
        }
        break;
      case 'updatePolygon':
        if (setZones && actionToRedo.data.zoneId && actionToRedo.data.newPoints) {
          // Apply the polygon update again
          setZones(prev => prev.map(zone =>
            zone.id === actionToRedo.data.zoneId
              ? { ...zone, points: actionToRedo.data.newPoints }
              : zone
          ));
        }
        break;
      default:
        console.warn('Unknown action type for redo:', actionToRedo.action);
        break;
    }

    toast.info('↷ Redone');
  };

  /**
   * Clear all history
   */
  const clearHistory = () => {
    setUndoStack([]);
    setRedoStack([]);
  };

  /**
   * Get history statistics
   * @returns {Object} History statistics
   */
  const getHistoryStats = () => {
    return {
      undoCount: undoStack.length,
      redoCount: redoStack.length,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
    };
  };

  return {
    addPointToHistory,
    undo,
    redo,
    clearHistory,
    getHistoryStats,
    undoStack,
    redoStack
  };
};
