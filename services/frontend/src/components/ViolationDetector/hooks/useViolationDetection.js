/**
 * useViolationDetection - Custom hook for violation detection logic
 * Manages violation state, analysis, and notifications
 */

import { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { analyzeViolations, getViolationStats } from '../utils/ViolationAnalysis';
import databaseClient from '../../../utils/DatabaseClient';
import { violationTypes } from '../ViolationTypes';

export const useViolationDetection = () => {
  // Violation state
  const [violations, setViolations] = useState([]);
  const [violationHistory, setViolationHistory] = useState([]);
  const [settings, setSettings] = useState({
    enabled: true,
    sensitivity: 0.7, // Confidence threshold for violations
    temporalWindow: 3, // Seconds to track violations
    movementThreshold: 20, // Pixels of movement to consider "handling"
  });

  // Database session tracking
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentFrameNumber, setCurrentFrameNumber] = useState(0);

  // Hand tracking reference
  const handTrackingRef = useRef(new Map());

  /**
   * Process detections and analyze for violations
   * @param {Array} detections - Current frame detections
   * @param {Array} zones - ROI zones configuration
   * @param {Function} onViolationDetected - Callback for new violations
   */
  const processDetections = useCallback((detections, zones, onViolationDetected) => {
    console.log('🚨 ViolationDetection processDetections:', {
      enabled: settings.enabled,
      detections: detections.length,
      zones: zones.length
    });

    if (!settings.enabled || detections.length === 0 || zones.length === 0) {
      console.log('⏸️ Violation analysis skipped:', {
        enabled: settings.enabled,
        hasDetections: detections.length > 0,
        hasZones: zones.length > 0
      });
      setViolations([]);
      return;
    }

    console.log('🔍 Starting violation analysis...');
    const newViolations = analyzeViolations(detections, zones, settings, handTrackingRef);

    // Update violations
    if (newViolations.length > 0) {
      setViolations(newViolations);
      setViolationHistory(prev => [...prev, ...newViolations].slice(-50)); // Keep last 50

      // Save violations to database
      if (currentSessionId) {
        newViolations.forEach(async (violation) => {
          try {
            const violationData = {
              session_id: currentSessionId,
              frame_number: currentFrameNumber,
              violation_type: violation.type,
              confidence: violation.confidence,
              severity: violation.severity,
              description: violation.description,
              hand_position: violation.handPosition,
              scooper_present: violation.scooperPresent || false,
              scooper_distance: violation.scooperDistance,
              movement_pattern: violation.movementPattern,
              bounding_boxes: violation.boundingBoxes || [],
              roi_zone_id: violation.zoneId
            };

            await databaseClient.saveViolation(currentSessionId, violationData);
            console.log('📊 Violation saved to database:', violation.type);
          } catch (error) {
            console.error('❌ Failed to save violation to database:', error);
          }
        });
      }

      // Notify parent component and show toasts
      newViolations.forEach(violation => {
        if (onViolationDetected) {
          onViolationDetected(violation);
        }

        showViolationNotification(violation);
      });
    } else {
      setViolations([]);
    }
  }, [settings]);

  /**
   * Show violation notification
   * @param {object} violation - Violation object
   */
  const showViolationNotification = useCallback((violation) => {
    const config = violationTypes[violation.type];
    
    const toastOptions = {
      position: "top-center",
      autoClose: config.severity === 'high' ? 8000 : 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    };

    if (config.severity === 'high') {
      toast.error(`${config.icon} ${config.title}`, toastOptions);
    } else {
      toast.warning(`${config.icon} ${config.title}`, toastOptions);
    }
  }, []);

  /**
   * Update detection settings
   * @param {object} newSettings - New settings object
   */
  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  /**
   * Clear all violations
   */
  const clearViolations = useCallback(() => {
    setViolations([]);
    handTrackingRef.current.clear();
  }, []);

  /**
   * Clear violation history
   */
  const clearViolationHistory = useCallback(() => {
    setViolationHistory([]);
  }, []);

  /**
   * Acknowledge a violation
   * @param {string} violationId - Violation ID to acknowledge
   * @param {string} acknowledgedBy - User who acknowledged the violation
   */
  const acknowledgeViolation = useCallback((violationId, acknowledgedBy) => {
    setViolationHistory(prev => 
      prev.map(violation => 
        violation.id === violationId 
          ? { 
              ...violation, 
              resolved: true, 
              acknowledgedBy, 
              acknowledgedAt: new Date().toISOString() 
            }
          : violation
      )
    );

    // Remove from active violations
    setViolations(prev => prev.filter(v => v.id !== violationId));
    
    toast.success('Violation acknowledged and resolved');
  }, []);

  /**
   * Get violation statistics
   * @returns {object} Violation statistics
   */
  const getStats = useCallback(() => {
    const stats = getViolationStats(violationHistory);
    return {
      ...stats,
      current: violations.length
    };
  }, [violations, violationHistory]);

  /**
   * Filter violations by criteria
   * @param {object} criteria - Filter criteria
   * @returns {Array} Filtered violations
   */
  const filterViolations = useCallback((criteria = {}) => {
    let filtered = [...violationHistory];

    if (criteria.severity) {
      filtered = filtered.filter(v => v.severity === criteria.severity);
    }

    if (criteria.type) {
      filtered = filtered.filter(v => v.type === criteria.type);
    }

    if (criteria.timeRange) {
      const now = Date.now();
      const timeLimit = now - (criteria.timeRange * 1000);
      filtered = filtered.filter(v => new Date(v.timestamp).getTime() >= timeLimit);
    }

    if (criteria.resolved !== undefined) {
      filtered = filtered.filter(v => v.resolved === criteria.resolved);
    }

    return filtered;
  }, [violationHistory]);

  /**
   * Export violation data
   * @param {string} format - Export format ('json' or 'csv')
   * @param {object} criteria - Filter criteria
   * @returns {string} Exported data
   */
  const exportViolations = useCallback((format = 'json', criteria = {}) => {
    const filtered = filterViolations(criteria);
    
    if (format === 'csv') {
      const headers = ['ID', 'Type', 'Severity', 'Timestamp', 'Confidence', 'Description', 'Resolved'];
      const rows = filtered.map(v => [
        v.id,
        v.type,
        v.severity,
        v.timestamp,
        v.confidence,
        v.description,
        v.resolved
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(filtered, null, 2);
  }, [filterViolations]);

  /**
   * Get violation trends over time
   * @param {number} days - Number of days to analyze (default: 7)
   * @returns {Array} Trend data
   */
  const getViolationTrends = useCallback((days = 7) => {
    const now = new Date();
    const trends = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayViolations = violationHistory.filter(v => {
        const vDate = new Date(v.timestamp);
        return vDate >= date && vDate < nextDate;
      });

      trends.push({
        date: date.toISOString().split('T')[0],
        total: dayViolations.length,
        high: dayViolations.filter(v => v.severity === 'high').length,
        medium: dayViolations.filter(v => v.severity === 'medium').length,
        low: dayViolations.filter(v => v.severity === 'low').length
      });
    }

    return trends;
  }, [violationHistory]);

  /**
   * Reset hand tracking data
   */
  const resetHandTracking = useCallback(() => {
    handTrackingRef.current.clear();
  }, []);

  /**
   * Set current session for database tracking
   */
  const setSessionTracking = useCallback((sessionId, frameNumber = 0) => {
    setCurrentSessionId(sessionId);
    setCurrentFrameNumber(frameNumber);
    console.log('📊 ViolationDetector session tracking set:', sessionId, frameNumber);
  }, []);

  /**
   * Update frame number for database tracking
   */
  const updateFrameNumber = useCallback((frameNumber) => {
    setCurrentFrameNumber(frameNumber);
  }, []);

  return {
    // State
    violations,
    violationHistory,
    settings,

    // Actions
    processDetections,
    updateSettings,
    clearViolations,
    clearViolationHistory,
    acknowledgeViolation,
    resetHandTracking,
    setSessionTracking,
    updateFrameNumber,

    // Computed
    getStats,
    filterViolations,
    exportViolations,
    getViolationTrends,

    // Refs
    handTrackingRef
  };
};
