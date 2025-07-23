/**
 * ViolationDetector - Main Component
 * Orchestrates all violation detection functionality with modular architecture
 */

import React, { useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import './ViolationDetector.css';

// Import modular components and hooks
import { useViolationDetection } from './hooks/useViolationDetection';
import ViolationSettings from './components/ViolationSettings';
import ViolationDisplay from './components/ViolationDisplay';
import ViolationHistory from './components/ViolationHistory';

const ViolationDetector = ({
  detections = [],
  zones = [],
  frameWidth = 640,
  frameHeight = 480,
  onViolationDetected,
  hideControls = false,
  className = '',
  style = {}
}) => {
  // Use custom hook for violation detection logic
  const {
    violations,
    violationHistory,
    settings,
    processDetections,
    updateSettings,
    clearViolations,
    clearViolationHistory,
    acknowledgeViolation,
    getStats,
    exportViolations
  } = useViolationDetection();

  // Process detections when they change
  useEffect(() => {
    processDetections(detections, zones, onViolationDetected);
  }, [detections, zones, processDetections, onViolationDetected]);

  // Handle settings changes
  const handleSettingsChange = useCallback((newSettings) => {
    updateSettings(newSettings);
    
    // Show feedback for important setting changes
    if (newSettings.hasOwnProperty('enabled')) {
      if (newSettings.enabled) {
        toast.success('🚨 Violation detection enabled');
      } else {
        toast.info('⏸️ Violation detection disabled');
        clearViolations();
      }
    }
  }, [updateSettings, clearViolations]);

  // Handle violation acknowledgment
  const handleAcknowledgeViolation = useCallback((violationId, acknowledgedBy) => {
    acknowledgeViolation(violationId, acknowledgedBy);
  }, [acknowledgeViolation]);

  // Handle violation export
  const handleExportViolations = useCallback((format, criteria) => {
    try {
      const exportData = exportViolations(format, criteria);
      
      // Create and download file
      const blob = new Blob([exportData], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `violations_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Violations exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export violations');
    }
  }, [exportViolations]);

  // Handle clear history
  const handleClearHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all violation history? This action cannot be undone.')) {
      clearViolationHistory();
      toast.success('Violation history cleared');
    }
  }, [clearViolationHistory]);

  // Get current statistics
  const stats = getStats();

  // If controls are hidden, only render the violation overlay
  if (hideControls) {
    return (
      <ViolationDisplay
        violations={violations}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        showOverlay={settings.enabled}
        className={className}
      />
    );
  }

  return (
    <div className={`violation-detector ${className}`} style={style}>
      {/* Violation Settings */}
      <ViolationSettings
        settings={settings}
        onSettingsChange={handleSettingsChange}
        stats={stats}
      />

      {/* Current Violations Display */}
      {violations.length > 0 && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '2px solid #ef4444'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            color: '#ef4444',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🚨 Active Violations ({violations.length})
          </h4>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '12px'
          }}>
            {violations.map((violation, index) => (
              <div
                key={violation.id}
                style={{
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderRadius: '6px',
                  border: '1px solid #ef4444'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>🚨</span>
                  <span style={{
                    fontWeight: 'bold',
                    color: '#ef4444'
                  }}>
                    {violation.title}
                  </span>
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {violation.severity.toUpperCase()}
                  </span>
                </div>
                
                <div style={{
                  fontSize: '13px',
                  color: '#e2e8f0',
                  marginBottom: '8px'
                }}>
                  {violation.description}
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#94a3b8'
                }}>
                  <span>
                    Confidence: {(violation.confidence * 100).toFixed(0)}%
                  </span>
                  <span>
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Violation Statistics */}
      {stats.total > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <h4 style={{
            margin: '0 0 12px 0',
            color: '#FFD700',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📈 Violation Statistics
          </h4>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {stats.current}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Current
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                {stats.last24h}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Last 24h
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Total
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                {(stats.averageConfidence * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Avg Confidence
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Violation History */}
      <ViolationHistory
        violationHistory={violationHistory}
        onAcknowledgeViolation={handleAcknowledgeViolation}
        onExportViolations={handleExportViolations}
        onClearHistory={handleClearHistory}
      />

      {/* Violation Overlay Canvas */}
      <ViolationDisplay
        violations={violations}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        showOverlay={settings.enabled}
        className="violation-overlay-canvas"
      />
    </div>
  );
};

export default ViolationDetector;
