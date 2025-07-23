/**
 * Violation Analysis Utilities
 * Core logic for detecting and analyzing food safety violations
 */

import { createViolation } from '../ViolationTypes';

/**
 * Analyze detections for potential violations
 * @param {Array} detections - Current frame detections
 * @param {Array} zones - ROI zones configuration
 * @param {object} settings - Detection settings
 * @param {Map} handTrackingRef - Hand tracking reference
 * @returns {Array} Array of detected violations
 */
export const analyzeViolations = (detections, zones, settings, handTrackingRef) => {
  const currentTime = Date.now();
  const newViolations = [];

  // Get current hands and scoopers
  const hands = detections.filter(d => d.class_name === 'hand');
  const scoopers = detections.filter(d => d.class_name === 'scooper');
  const persons = detections.filter(d => d.class_name === 'person');

  console.log('🔍 Analyzing violations:', {
    hands: hands.length,
    scoopers: scoopers.length,
    persons: persons.length,
    zones: zones.length
  });

  // Analyze each hand
  hands.forEach((hand, handIndex) => {
    const handId = `hand_${handIndex}`;
    const handCenter = {
      x: (hand.bbox.x1 + hand.bbox.x2) / 2,
      y: (hand.bbox.y1 + hand.bbox.y2) / 2
    };

    // Update hand tracking
    updateHandTracking(handId, handCenter, hand.confidence, currentTime, settings, handTrackingRef);

    const handTracking = handTrackingRef.current.get(handId);

    // Check which zone the hand is in
    const currentZone = findZoneContainingPoint(handCenter.x, handCenter.y, zones);
    
    if (currentZone && currentZone.requiresScooper) {
      // Check for scooper presence near this hand
      const nearbyScoopers = findNearbyScoopers(handCenter, scoopers);

      // Check for movement (indicates handling, not just cleaning)
      const isHandling = checkHandMovement(handTracking.positions, settings);

      // VIOLATION: Hand in ingredient area without scooper
      if (nearbyScoopers.length === 0 && isHandling) {
        const violation = createViolation(
          'HAND_IN_INGREDIENT_NO_SCOOPER',
          {
            handId,
            hand,
            zone: currentZone,
            confidence: hand.confidence,
            position: handCenter,
            duration: (currentTime - handTracking.firstDetected) / 1000
          }
        );
        newViolations.push(violation);
      }

      // VIOLATION: Cross contamination check
      if (handTracking.lastZone && 
          handTracking.lastZone.id !== currentZone.id && 
          handTracking.lastZone.requiresScooper) {
        const violation = createViolation(
          'CROSS_CONTAMINATION',
          {
            handId,
            hand,
            fromZone: handTracking.lastZone,
            toZone: currentZone,
            confidence: hand.confidence * 0.8, // Slightly lower confidence
            position: handCenter
          }
        );
        newViolations.push(violation);
      }

      // VIOLATION: Extended contact
      const contactDuration = (currentTime - handTracking.firstDetected) / 1000;
      if (contactDuration > 5 && nearbyScoopers.length === 0) { // 5 seconds
        const violation = createViolation(
          'EXTENDED_CONTACT',
          {
            handId,
            hand,
            zone: currentZone,
            confidence: Math.min(hand.confidence + 0.1, 1.0),
            position: handCenter,
            duration: contactDuration
          }
        );
        newViolations.push(violation);
      }

      handTracking.lastZone = currentZone;
    }
  });

  // Clean up old hand tracking data
  cleanupHandTracking(hands, currentTime, handTrackingRef);

  return newViolations;
};

/**
 * Update hand tracking information
 * @param {string} handId - Unique hand identifier
 * @param {object} handCenter - Hand center coordinates
 * @param {number} confidence - Detection confidence
 * @param {number} currentTime - Current timestamp
 * @param {object} settings - Detection settings
 * @param {Map} handTrackingRef - Hand tracking reference
 */
export const updateHandTracking = (handId, handCenter, confidence, currentTime, settings, handTrackingRef) => {
  if (!handTrackingRef.current.has(handId)) {
    handTrackingRef.current.set(handId, {
      positions: [],
      lastZone: null,
      firstDetected: currentTime
    });
  }

  const handTracking = handTrackingRef.current.get(handId);
  handTracking.positions.push({
    ...handCenter,
    timestamp: currentTime,
    confidence: confidence
  });

  // Keep only recent positions (temporal window)
  const windowMs = settings.temporalWindow * 1000;
  handTracking.positions = handTracking.positions.filter(
    pos => currentTime - pos.timestamp < windowMs
  );
};

/**
 * Find nearby scoopers within detection range
 * @param {object} handCenter - Hand center coordinates
 * @param {Array} scoopers - Array of scooper detections
 * @param {number} maxDistance - Maximum distance in pixels (default: 100)
 * @returns {Array} Array of nearby scoopers
 */
export const findNearbyScoopers = (handCenter, scoopers, maxDistance = 100) => {
  return scoopers.filter(scooper => {
    const scooperCenter = {
      x: (scooper.bbox.x1 + scooper.bbox.x2) / 2,
      y: (scooper.bbox.y1 + scooper.bbox.y2) / 2
    };
    const distance = Math.sqrt(
      Math.pow(handCenter.x - scooperCenter.x, 2) + 
      Math.pow(handCenter.y - scooperCenter.y, 2)
    );
    return distance < maxDistance;
  });
};

/**
 * Check if hand is showing handling movement patterns
 * @param {Array} positions - Array of hand positions over time
 * @param {object} settings - Detection settings
 * @returns {boolean} True if hand is handling ingredients
 */
export const checkHandMovement = (positions, settings) => {
  if (positions.length < 2) return false;
  
  let totalMovement = 0;
  for (let i = 1; i < positions.length; i++) {
    const distance = Math.sqrt(
      Math.pow(positions[i].x - positions[i-1].x, 2) + 
      Math.pow(positions[i].y - positions[i-1].y, 2)
    );
    totalMovement += distance;
  }
  
  return totalMovement > settings.movementThreshold;
};

/**
 * Find zone containing a specific point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {Array} zones - Array of ROI zones
 * @returns {object|null} Zone containing the point or null
 */
export const findZoneContainingPoint = (x, y, zones) => {
  const foundZone = zones.find(zone => {
    if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
      // Handle polygon zones
      const inZone = isPointInPolygon({ x, y }, zone.points);

      if (inZone) {
        console.log(`🔺 Point (${x.toFixed(1)}, ${y.toFixed(1)}) is in polygon zone ${zone.name}:`, {
          point: { x, y },
          polygonPoints: zone.points.length,
          zoneName: zone.name
        });
      }

      return inZone;
    } else if (zone.points && zone.points.length === 2) {
      // Handle rectangle zones (legacy format)
      const [p1, p2] = zone.points;
      const inZone = x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x) &&
                    y >= Math.min(p1.y, p2.y) && y <= Math.max(p1.y, p2.y);

      if (inZone) {
        console.log(`📦 Point (${x.toFixed(1)}, ${y.toFixed(1)}) is in rectangle zone ${zone.name}:`, {
          point: { x, y },
          zone: { p1, p2 },
          zoneName: zone.name
        });
      }

      return inZone;
    }
    return false;
  });

  return foundZone;
};

/**
 * Point-in-polygon algorithm for polygon zone detection
 * @param {object} point - Point with x, y coordinates
 * @param {Array} polygon - Array of polygon points
 * @returns {boolean} True if point is inside polygon
 */
export const isPointInPolygon = (point, polygon) => {
  const x = point.x;
  const y = point.y;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
};

/**
 * Clean up old hand tracking data
 * @param {Array} hands - Current hand detections
 * @param {number} currentTime - Current timestamp
 * @param {Map} handTrackingRef - Hand tracking reference
 */
export const cleanupHandTracking = (hands, currentTime, handTrackingRef) => {
  const activeHandIds = hands.map((_, index) => `hand_${index}`);
  for (const [handId, tracking] of handTrackingRef.current.entries()) {
    if (!activeHandIds.includes(handId) && 
        currentTime - tracking.positions[tracking.positions.length - 1]?.timestamp > 2000) {
      handTrackingRef.current.delete(handId);
    }
  }
};

/**
 * Calculate violation statistics
 * @param {Array} violationHistory - Historical violations
 * @returns {object} Violation statistics
 */
export const getViolationStats = (violationHistory) => {
  const now = new Date();
  const last24h = violationHistory.filter(v => {
    const violationTime = new Date(v.timestamp);
    const hoursDiff = (now - violationTime) / (1000 * 60 * 60);
    return hoursDiff < 24;
  });
  
  const byType = {};
  last24h.forEach(v => {
    byType[v.type] = (byType[v.type] || 0) + 1;
  });

  const bySeverity = {};
  last24h.forEach(v => {
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
  });

  return {
    total: violationHistory.length,
    last24h: last24h.length,
    byType,
    bySeverity,
    averageConfidence: last24h.length > 0 
      ? last24h.reduce((sum, v) => sum + v.confidence, 0) / last24h.length 
      : 0
  };
};

/**
 * Filter violations by criteria
 * @param {Array} violations - Array of violations
 * @param {object} criteria - Filter criteria
 * @returns {Array} Filtered violations
 */
export const filterViolations = (violations, criteria = {}) => {
  let filtered = [...violations];

  if (criteria.severity) {
    filtered = filtered.filter(v => v.severity === criteria.severity);
  }

  if (criteria.type) {
    filtered = filtered.filter(v => v.type === criteria.type);
  }

  if (criteria.minConfidence) {
    filtered = filtered.filter(v => v.confidence >= criteria.minConfidence);
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
};
