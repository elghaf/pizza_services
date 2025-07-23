/**
 * Pizza Store Specific Violation Analysis
 * Enhanced violation detection logic for pizza store hygiene compliance
 */

import { findZoneContainingPoint, isPointInPolygon } from './ViolationAnalysis';

// Pizza store specific violation types
export const PIZZA_STORE_VIOLATIONS = {
  HAND_WITHOUT_SCOOPER: {
    type: 'HAND_WITHOUT_SCOOPER',
    severity: 'high',
    description: 'Hand detected in ingredient area without scooper',
    requiresScooper: true
  },
  CROSS_CONTAMINATION: {
    type: 'CROSS_CONTAMINATION',
    severity: 'high',
    description: 'Hand moved between different ingredient areas without cleaning',
    requiresScooper: false
  },
  IMPROPER_HANDLING: {
    type: 'IMPROPER_HANDLING',
    severity: 'medium',
    description: 'Improper ingredient handling detected',
    requiresScooper: true
  },
  CLEANING_DETECTED: {
    type: 'CLEANING_DETECTED',
    severity: 'info',
    description: 'Cleaning activity detected - not a violation',
    requiresScooper: false
  }
};

// Movement patterns for analysis
export const MOVEMENT_PATTERNS = {
  GRABBING: 'grabbing',
  CLEANING: 'cleaning',
  REACHING: 'reaching',
  UNKNOWN: 'unknown'
};

// Zone types that require scoopers
export const SCOOPER_REQUIRED_ZONES = [
  'sauce_area',
  'protein_area',
  'cheese_area'
];

/**
 * Analyze hand movement pattern to distinguish between grabbing and cleaning
 * @param {Object} handTracking - Hand tracking data
 * @param {Array} recentPositions - Recent hand positions
 * @returns {string} Movement pattern
 */
export const analyzeMovementPattern = (handTracking, recentPositions) => {
  if (!recentPositions || recentPositions.length < 3) {
    return MOVEMENT_PATTERNS.UNKNOWN;
  }

  // Calculate movement characteristics
  const movements = [];
  for (let i = 1; i < recentPositions.length; i++) {
    const prev = recentPositions[i - 1];
    const curr = recentPositions[i];
    const distance = Math.sqrt(
      Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
    );
    movements.push(distance);
  }

  const avgMovement = movements.reduce((a, b) => a + b, 0) / movements.length;
  const maxMovement = Math.max(...movements);

  // Analyze movement pattern
  if (avgMovement > 15 && maxMovement > 30) {
    // Large, varied movements suggest cleaning
    return MOVEMENT_PATTERNS.CLEANING;
  } else if (avgMovement < 10 && maxMovement < 20) {
    // Small, precise movements suggest grabbing
    return MOVEMENT_PATTERNS.GRABBING;
  } else if (avgMovement > 20) {
    // Medium movements suggest reaching
    return MOVEMENT_PATTERNS.REACHING;
  }

  return MOVEMENT_PATTERNS.UNKNOWN;
};

/**
 * Find nearest scooper to a hand position
 * @param {Object} handPosition - Hand center position {x, y}
 * @param {Array} scoopers - Array of scooper detections
 * @returns {Object|null} Nearest scooper with distance
 */
export const findNearestScooper = (handPosition, scoopers) => {
  if (!scoopers || scoopers.length === 0) {
    return null;
  }

  let nearestScooper = null;
  let minDistance = Infinity;

  scoopers.forEach(scooper => {
    const scooperCenter = scooper.center || {
      x: (scooper.bbox.x1 + scooper.bbox.x2) / 2,
      y: (scooper.bbox.y1 + scooper.bbox.y2) / 2
    };

    const distance = Math.sqrt(
      Math.pow(handPosition.x - scooperCenter.x, 2) +
      Math.pow(handPosition.y - scooperCenter.y, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestScooper = { scooper, distance };
    }
  });

  return nearestScooper;
};

/**
 * Check if scooper is being used (close enough to hand)
 * @param {Object} handPosition - Hand center position
 * @param {Array} scoopers - Array of scooper detections
 * @param {number} threshold - Distance threshold for "using" scooper
 * @returns {boolean} True if scooper is being used
 */
export const isScooperBeingUsed = (handPosition, scoopers, threshold = 50) => {
  const nearestScooper = findNearestScooper(handPosition, scoopers);
  return nearestScooper && nearestScooper.distance <= threshold;
};

/**
 * Track worker movements between zones for cross-contamination detection
 * @param {string} workerId - Worker identifier
 * @param {Object} currentZone - Current zone the worker is in
 * @param {Map} workerZoneHistory - Map of worker zone histories
 * @returns {boolean} True if cross-contamination detected
 */
export const detectCrossContamination = (workerId, currentZone, workerZoneHistory) => {
  if (!currentZone || !workerZoneHistory.has(workerId)) {
    return false;
  }

  const history = workerZoneHistory.get(workerId);
  const lastZone = history[history.length - 1];

  // Check if worker moved from one ingredient area to another without cleaning
  if (lastZone && 
      lastZone.zone_type !== currentZone.zone_type &&
      SCOOPER_REQUIRED_ZONES.includes(lastZone.zone_type) &&
      SCOOPER_REQUIRED_ZONES.includes(currentZone.zone_type)) {
    
    // Check if enough time passed for cleaning (simple heuristic)
    const timeDiff = Date.now() - lastZone.timestamp;
    if (timeDiff < 5000) { // Less than 5 seconds
      return true;
    }
  }

  return false;
};

/**
 * Enhanced pizza store violation analysis
 * @param {Array} detections - Current frame detections
 * @param {Array} zones - ROI zones configuration
 * @param {Object} settings - Violation detection settings
 * @param {Object} handTrackingRef - Hand tracking reference
 * @returns {Array} Array of detected violations
 */
export const analyzePizzaStoreViolations = (detections, zones, settings, handTrackingRef) => {
  const violations = [];
  const currentTime = Date.now();

  // Separate detections by type
  const hands = detections.filter(d => d.class_name === 'hand');
  const scoopers = detections.filter(d => d.class_name === 'scooper');
  const persons = detections.filter(d => d.class_name === 'person');

  console.log('🍕 Pizza Store Violation Analysis:', {
    hands: hands.length,
    scoopers: scoopers.length,
    persons: persons.length,
    zones: zones.length
  });

  // Analyze each hand detection
  hands.forEach((hand, handIndex) => {
    const handId = `hand_${handIndex}`;
    const handCenter = hand.center || {
      x: (hand.bbox.x1 + hand.bbox.x2) / 2,
      y: (hand.bbox.y1 + hand.bbox.y2) / 2
    };

    // Update hand tracking
    if (!handTrackingRef.current.has(handId)) {
      handTrackingRef.current.set(handId, {
        positions: [],
        zoneHistory: [],
        lastSeen: currentTime,
        violations: []
      });
    }

    const handTracking = handTrackingRef.current.get(handId);
    handTracking.positions.push({ ...handCenter, timestamp: currentTime });
    handTracking.lastSeen = currentTime;

    // Keep only recent positions (last 2 seconds)
    handTracking.positions = handTracking.positions.filter(
      pos => currentTime - pos.timestamp < 2000
    );

    // Find which zone the hand is in
    const currentZone = findZoneContainingPoint(handCenter.x, handCenter.y, zones);

    if (currentZone && currentZone.requiresScooper) {
      console.log(`🎯 Hand in scooper-required zone: ${currentZone.name}`);

      // Analyze movement pattern
      const movementPattern = analyzeMovementPattern(handTracking, handTracking.positions);
      
      // Skip violation if cleaning detected
      if (movementPattern === MOVEMENT_PATTERNS.CLEANING) {
        console.log('🧽 Cleaning activity detected - no violation');
        return;
      }

      // Check for scooper usage
      const scooperUsed = isScooperBeingUsed(handCenter, scoopers);
      const nearestScooper = findNearestScooper(handCenter, scoopers);

      if (!scooperUsed && movementPattern === MOVEMENT_PATTERNS.GRABBING) {
        // Create violation for hand without scooper
        const violation = {
          id: `violation_${Date.now()}_${handIndex}`,
          type: PIZZA_STORE_VIOLATIONS.HAND_WITHOUT_SCOOPER.type,
          severity: PIZZA_STORE_VIOLATIONS.HAND_WITHOUT_SCOOPER.severity,
          description: `Hand detected in ${currentZone.name} without scooper`,
          confidence: hand.confidence,
          timestamp: new Date().toISOString(),
          handPosition: handCenter,
          zoneId: currentZone.id,
          zoneName: currentZone.name,
          scooperPresent: scoopers.length > 0,
          scooperDistance: nearestScooper ? nearestScooper.distance : null,
          movementPattern: movementPattern,
          boundingBoxes: [hand],
          frameData: {
            totalHands: hands.length,
            totalScoopers: scoopers.length,
            totalPersons: persons.length
          }
        };

        violations.push(violation);
        handTracking.violations.push(violation);

        console.log('🚨 VIOLATION DETECTED:', violation.type, 'in', currentZone.name);
      }

      // Update zone history
      handTracking.zoneHistory.push({
        zone: currentZone,
        timestamp: currentTime,
        movementPattern: movementPattern
      });

      // Keep only recent zone history
      handTracking.zoneHistory = handTracking.zoneHistory.filter(
        entry => currentTime - entry.timestamp < 10000 // Last 10 seconds
      );
    }
  });

  // Clean up old hand tracking data
  for (const [handId, tracking] of handTrackingRef.current.entries()) {
    if (currentTime - tracking.lastSeen > 5000) { // 5 seconds
      handTrackingRef.current.delete(handId);
    }
  }

  console.log(`🍕 Pizza Store Analysis Complete: ${violations.length} violations detected`);
  return violations;
};

/**
 * Get violation statistics for pizza store
 * @param {Array} violations - Array of violations
 * @returns {Object} Violation statistics
 */
export const getPizzaStoreViolationStats = (violations) => {
  const stats = {
    total: violations.length,
    byType: {},
    bySeverity: {},
    byZone: {},
    recentViolations: violations.filter(v => 
      Date.now() - new Date(v.timestamp).getTime() < 60000 // Last minute
    ).length
  };

  violations.forEach(violation => {
    // By type
    stats.byType[violation.type] = (stats.byType[violation.type] || 0) + 1;
    
    // By severity
    stats.bySeverity[violation.severity] = (stats.bySeverity[violation.severity] || 0) + 1;
    
    // By zone
    if (violation.zoneName) {
      stats.byZone[violation.zoneName] = (stats.byZone[violation.zoneName] || 0) + 1;
    }
  });

  return stats;
};
