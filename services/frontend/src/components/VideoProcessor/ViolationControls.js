/**
 * ViolationControls - Component for violation detection settings and controls
 */

import React, { useState, useEffect, useRef } from 'react';
import { analyzePizzaStoreViolations, getPizzaStoreViolationStats } from '../ViolationDetector/utils/PizzaStoreViolationAnalysis';
import databaseClient from '../../utils/DatabaseClient';

const ViolationControls = ({ 
  detections, 
  zones, 
  frameWidth, 
  frameHeight, 
  onViolationDetected 
}) => {
  const [sensitivity, setSensitivity] = useState(0.7);
  const [enabledViolationTypes, setEnabledViolationTypes] = useState({
    scooper_missing: true,
    hand_contact: true,
    cross_contamination: true,
    improper_handling: true
  });
  const [autoDetection, setAutoDetection] = useState(true);
  const [detectionInterval, setDetectionInterval] = useState(2000); // ms
  const [usePizzaStoreLogic, setUsePizzaStoreLogic] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [frameCounter, setFrameCounter] = useState(0);

  // Hand tracking for pizza store logic
  const handTrackingRef = useRef(new Map());

  // Auto-detection logic
  useEffect(() => {
    if (!autoDetection || !detections.length || !zones.length) return;

    const interval = setInterval(() => {
      checkForViolations();
    }, detectionInterval);

    return () => clearInterval(interval);
  }, [autoDetection, detections, zones, sensitivity, enabledViolationTypes, detectionInterval]);

  // Point-in-polygon algorithm for polygon zone detection
  const isPointInPolygon = (point, polygon) => {
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

  // Check if detection is in zone (supports both rectangle and polygon)
  const isDetectionInZone = (detection, zone) => {
    const center = detection.center || {
      x: (detection.bbox.x1 + detection.bbox.x2) / 2,
      y: (detection.bbox.y1 + detection.bbox.y2) / 2
    };

    console.log(`🔍 Checking detection ${detection.class_name} in zone ${zone.name}:`, {
      center,
      zoneShape: zone.shape,
      zonePointsCount: zone.points?.length,
      zonePoints: zone.points
    });

    if (zone.shape === 'polygon' && zone.points && zone.points.length >= 3) {
      // For polygon zones, use point-in-polygon algorithm
      const result = isPointInPolygon(center, zone.points);
      console.log(`🔺 Polygon detection result for ${detection.class_name} in ${zone.name}:`, result);
      return result;
    } else if (zone.points && zone.points.length === 2) {
      // For rectangle zones stored as points
      const [p1, p2] = zone.points;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      return (
        center.x >= minX && center.x <= maxX &&
        center.y >= minY && center.y <= maxY
      );
    } else if (zone.x !== undefined && zone.width !== undefined) {
      // Legacy rectangle format
      const scaledX = (center.x / frameWidth) * 100;
      const scaledY = (center.y / frameHeight) * 100;

      return (
        scaledX >= zone.x &&
        scaledX <= zone.x + zone.width &&
        scaledY >= zone.y &&
        scaledY <= zone.y + zone.height
      );
    }

    return false;
  };

  const checkForViolations = () => {
    console.log('🔍 Checking for violations:', {
      zonesCount: zones.length,
      detectionsCount: detections.length,
      usePizzaStoreLogic: usePizzaStoreLogic,
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        shape: z.shape,
        pointsCount: z.points?.length,
        requiresScooper: z.requiresScooper,
        requires_scooper: z.requires_scooper
      }))
    });

    let newViolations = [];

    if (usePizzaStoreLogic) {
      // Use enhanced pizza store violation analysis
      console.log('🍕 Using Pizza Store violation analysis');

      // Create settings object for pizza store analysis
      const analysisSettings = {
        enabled: true,
        sensitivity: sensitivity,
        temporalWindow: 3, // seconds
        movementThreshold: 20, // pixels
        enabledViolationTypes: enabledViolationTypes
      };

      newViolations = analyzePizzaStoreViolations(detections, zones, analysisSettings, handTrackingRef);

      // Save violations to database
      if (currentSessionId && newViolations.length > 0) {
        const currentFrame = frameCounter + 1;
        setFrameCounter(currentFrame);

        newViolations.forEach(async (violation) => {
          try {
            await databaseClient.saveViolation(currentSessionId, {
              ...violation,
              frameNumber: currentFrame
            });
            console.log('📊 Pizza store violation saved to database:', violation.type);
          } catch (error) {
            console.error('❌ Failed to save violation to database:', error);
          }
        });
      }
    } else {
      // Use legacy violation detection
      console.log('🔧 Using legacy violation analysis');
      zones.forEach(zone => {
        if (!zone.requires_scooper && !zone.requiresScooper) {
          console.log(`⏭️ Skipping zone ${zone.name} - no scooper requirement`);
          return;
        }

        console.log(`🎯 Checking zone: ${zone.name} (${zone.shape})`);

        // Find detections in this zone using the enhanced detection method
        const detectionsInZone = detections.filter(detection => {
          const inZone = isDetectionInZone(detection, zone);
          if (inZone) {
            console.log(`✅ Detection ${detection.class_name} found in zone ${zone.name}`);
          }
          return inZone;
        });

        // Legacy violation detection logic
        if (enabledViolationTypes.scooper_missing) {
        const hands = detectionsInZone.filter(d => 
          (d.class_name || d.class)?.toLowerCase().includes('hand') ||
          (d.class_name || d.class)?.toLowerCase().includes('person')
        );
        
        const scoopers = detectionsInZone.filter(d => 
          (d.class_name || d.class)?.toLowerCase().includes('spoon') ||
          (d.class_name || d.class)?.toLowerCase().includes('utensil') ||
          (d.class_name || d.class)?.toLowerCase().includes('scooper')
        );

        if (hands.length > 0 && scoopers.length === 0 && Math.random() > (1 - sensitivity)) {
          onViolationDetected({
            type: 'Scooper Missing',
            description: `Hand detected in ${zone.name} without required scooper`,
            severity: 'high',
            timestamp: new Date().toISOString(),
            location: zone.name,
            zone_id: zone.id,
            confidence: sensitivity,
            worker_id: `W${Math.floor(Math.random() * 100)}`
          });
        }
      }

      // Check for hand contact violations
      if (enabledViolationTypes.hand_contact) {
        const directContact = detectionsInZone.filter(d => {
          const className = (d.class_name || d.class)?.toLowerCase();
          return className?.includes('hand') && d.confidence > sensitivity;
        });

        if (directContact.length > 0 && Math.random() > 0.8) {
          onViolationDetected({
            type: 'Direct Hand Contact',
            description: `Direct hand contact detected with ${zone.ingredient_type}`,
            severity: 'critical',
            timestamp: new Date().toISOString(),
            location: zone.name,
            zone_id: zone.id,
            confidence: directContact[0].confidence,
            worker_id: `W${Math.floor(Math.random() * 100)}`
          });
        }
        }
      });
    }

    // Handle violations (both pizza store and legacy)
    if (newViolations.length > 0) {
      console.log(`🚨 ${newViolations.length} violations detected`);
      newViolations.forEach(violation => {
        if (onViolationDetected) {
          onViolationDetected(violation);
        }
      });
    }
  };

  const getSensitivityLevel = (value) => {
    if (value >= 0.8) return { level: 'Very High', color: '#ef4444', description: 'Maximum detection, may include false positives' };
    if (value >= 0.6) return { level: 'High', color: '#f59e0b', description: 'Strict detection, recommended for compliance' };
    if (value >= 0.4) return { level: 'Medium', color: '#eab308', description: 'Balanced detection, good for training' };
    if (value >= 0.2) return { level: 'Low', color: '#22c55e', description: 'Lenient detection, fewer alerts' };
    return { level: 'Very Low', color: '#6b7280', description: 'Minimal detection, testing only' };
  };

  const sensitivityInfo = getSensitivityLevel(sensitivity);

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">⚙️ Violation Detection Settings</h2>
      </div>
      <div className="card-content">
        
        {/* Auto Detection Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#4a90e2' }}>
              🤖 Automatic Detection
            </label>
            <button
              onClick={() => setAutoDetection(!autoDetection)}
              style={{
                padding: '6px 12px',
                background: autoDetection ? '#00FF88' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {autoDetection ? 'ON' : 'OFF'}
            </button>
          </div>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            Automatically detect violations in real-time during video processing
          </p>
        </div>

        {/* Sensitivity Control */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a90e2' }}>
            🎯 Detection Sensitivity: {(sensitivity * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <div style={{
            padding: '8px 12px',
            background: `${sensitivityInfo.color}20`,
            borderRadius: '6px',
            border: `1px solid ${sensitivityInfo.color}50`
          }}>
            <div style={{ color: sensitivityInfo.color, fontWeight: 'bold', marginBottom: '4px' }}>
              {sensitivityInfo.level} Sensitivity
            </div>
            <div style={{ fontSize: '14px', color: '#ccc' }}>
              {sensitivityInfo.description}
            </div>
          </div>
        </div>

        {/* Detection Interval */}
        {autoDetection && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#4a90e2' }}>
              ⏱️ Detection Interval: {detectionInterval / 1000}s
            </label>
            <input
              type="range"
              min="500"
              max="5000"
              step="500"
              value={detectionInterval}
              onChange={(e) => setDetectionInterval(parseInt(e.target.value))}
              style={{ width: '100%', marginBottom: '8px' }}
            />
            <div style={{ fontSize: '14px', color: '#888' }}>
              How often to check for violations (0.5s - 5s)
            </div>
          </div>
        )}

        {/* Pizza Store Logic Toggle */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ fontWeight: 'bold', color: '#4a90e2' }}>
              🍕 Pizza Store Enhanced Logic
            </label>
            <button
              onClick={() => setUsePizzaStoreLogic(!usePizzaStoreLogic)}
              style={{
                padding: '6px 12px',
                background: usePizzaStoreLogic ? '#FF6B35' : '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {usePizzaStoreLogic ? 'ENHANCED' : 'LEGACY'}
            </button>
          </div>
          <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>
            {usePizzaStoreLogic
              ? 'Advanced pizza store violation detection with movement analysis and cross-contamination detection'
              : 'Basic violation detection using simple zone-based rules'
            }
          </p>
        </div>

        {/* Violation Types */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '12px', color: '#4a90e2' }}>🚨 Violation Types</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            {Object.entries(enabledViolationTypes).map(([type, enabled]) => (
              <div
                key={type}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '6px',
                  border: `1px solid ${enabled ? '#00FF88' : '#666'}`
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', color: enabled ? '#00FF88' : '#888' }}>
                    {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    {type === 'scooper_missing' && 'Detect when hands are in ingredient zones without scoopers'}
                    {type === 'hand_contact' && 'Detect direct hand contact with food ingredients'}
                    {type === 'cross_contamination' && 'Detect potential cross-contamination between zones'}
                    {type === 'improper_handling' && 'Detect improper food handling techniques'}
                  </div>
                </div>
                <button
                  onClick={() => setEnabledViolationTypes(prev => ({
                    ...prev,
                    [type]: !prev[type]
                  }))}
                  style={{
                    padding: '6px 12px',
                    background: enabled ? '#00FF88' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  {enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Manual Detection Button */}
        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={checkForViolations}
            style={{
              width: '100%',
              padding: '12px',
              background: '#4a90e2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            🔍 Check for Violations Now
          </button>
        </div>

        {/* Status Information */}
        <div style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>🎯 Active Zones:</strong> {zones.filter(z => z.requires_scooper).length} of {zones.length}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>🔍 Current Detections:</strong> {detections.length} objects
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>⚙️ Auto Detection:</strong> {autoDetection ? 'Enabled' : 'Disabled'}
          </div>
          <div>
            <strong>🎯 Sensitivity:</strong> {sensitivityInfo.level} ({(sensitivity * 100).toFixed(0)}%)
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViolationControls;
