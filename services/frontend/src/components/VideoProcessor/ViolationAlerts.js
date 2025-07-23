/**
 * ViolationAlerts - Component for displaying real-time violation alerts
 */

import React, { useState, useEffect } from 'react';

const ViolationAlerts = ({ violations, stats = {} }) => {
  const [recentViolations, setRecentViolations] = useState([]);
  const [alertSound, setAlertSound] = useState(true);

  // Keep track of recent violations (last 10)
  useEffect(() => {
    setRecentViolations(violations.slice(-10).reverse());
  }, [violations]);

  // Play alert sound for new violations
  useEffect(() => {
    if (violations.length > 0 && alertSound) {
      const lastViolation = violations[violations.length - 1];
      // You could add actual sound playing here
      console.log('🚨 Violation alert sound:', lastViolation.description);
    }
  }, [violations.length, alertSound]);

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return '#ef4444';
      case 'medium':
      case 'moderate':
        return '#f59e0b';
      case 'low':
      case 'minor':
        return '#eab308';
      default:
        return '#ef4444';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
      case 'critical':
        return '🚨';
      case 'medium':
      case 'moderate':
        return '⚠️';
      case 'low':
      case 'minor':
        return '⚡';
      default:
        return '🚨';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getViolationStats = () => {
    // Use passed stats if available, otherwise calculate from violations
    if (stats.total_violations !== undefined) {
      return {
        total: stats.total_violations || 0,
        high: stats.violations_by_severity?.high || 0,
        medium: stats.violations_by_severity?.medium || 0,
        low: stats.violations_by_severity?.low || 0
      };
    }

    // Fallback to calculating from violations array
    const calculatedStats = {
      total: violations.length,
      high: violations.filter(v => v.severity?.toLowerCase() === 'high' || v.severity?.toLowerCase() === 'critical').length,
      medium: violations.filter(v => v.severity?.toLowerCase() === 'medium' || v.severity?.toLowerCase() === 'moderate').length,
      low: violations.filter(v => v.severity?.toLowerCase() === 'low' || v.severity?.toLowerCase() === 'minor').length
    };
    return calculatedStats;
  };

  const violationStats = getViolationStats();

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">🚨 Violation Alerts</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setAlertSound(!alertSound)}
            style={{
              padding: '6px 12px',
              background: alertSound ? '#00FF88' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {alertSound ? '🔊 Sound ON' : '🔇 Sound OFF'}
          </button>
        </div>
      </div>
      <div className="card-content">
        
        {/* Violation Statistics */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px'
          }}>
            <div style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {violationStats.total}
              </div>
              <div style={{ fontSize: '12px', color: '#ccc' }}>Total Violations</div>
            </div>
            
            <div style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {violationStats.high}
              </div>
              <div style={{ fontSize: '12px', color: '#ccc' }}>High Severity</div>
            </div>

            <div style={{
              padding: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>
                {violationStats.medium}
              </div>
              <div style={{ fontSize: '12px', color: '#ccc' }}>Medium Severity</div>
            </div>

            <div style={{
              padding: '12px',
              background: 'rgba(234, 179, 8, 0.1)',
              borderRadius: '6px',
              textAlign: 'center',
              border: '1px solid rgba(234, 179, 8, 0.3)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#eab308' }}>
                {violationStats.low}
              </div>
              <div style={{ fontSize: '12px', color: '#ccc' }}>Low Severity</div>
            </div>
          </div>
        </div>

        {/* Recent Violations List */}
        <div>
          <h3 style={{ marginBottom: '12px', color: '#ef4444' }}>📋 Recent Violations</h3>
          
          {recentViolations.length > 0 ? (
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px'
            }}>
              {recentViolations.map((violation, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < recentViolations.length - 1 ? '1px solid rgba(239, 68, 68, 0.2)' : 'none',
                    background: index === 0 ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    animation: index === 0 ? 'pulse 2s infinite' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '20px' }}>
                        {getSeverityIcon(violation.severity)}
                      </span>
                      <div>
                        <div style={{ 
                          fontWeight: 'bold', 
                          color: getSeverityColor(violation.severity),
                          fontSize: '16px'
                        }}>
                          {violation.type || 'Hygiene Violation'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {formatTimestamp(violation.timestamp)}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{
                      padding: '4px 8px',
                      background: getSeverityColor(violation.severity),
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: 'white'
                    }}>
                      {violation.severity?.toUpperCase() || 'HIGH'}
                    </div>
                  </div>
                  
                  <div style={{ 
                    color: '#ccc', 
                    fontSize: '14px',
                    marginBottom: '8px',
                    lineHeight: '1.4'
                  }}>
                    {violation.description || 'Hygiene protocol violation detected'}
                  </div>
                  
                  {violation.location && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#888',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'inline-block'
                    }}>
                      📍 {violation.location}
                    </div>
                  )}
                  
                  {violation.worker_id && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#888',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      display: 'inline-block',
                      marginLeft: '8px'
                    }}>
                      👤 Worker {violation.worker_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#888',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <p>No violations detected</p>
              <p style={{ fontSize: '14px' }}>All hygiene protocols are being followed</p>
            </div>
          )}
        </div>

        {/* Alert Settings */}
        <div style={{ 
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '14px', color: '#ccc' }}>
            <strong>🔔 Alert Settings:</strong><br />
            • Sound alerts: {alertSound ? 'Enabled' : 'Disabled'}<br />
            • Showing last 10 violations<br />
            • Real-time monitoring active
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes pulse {
          0% { background-color: rgba(239, 68, 68, 0.1); }
          50% { background-color: rgba(239, 68, 68, 0.2); }
          100% { background-color: rgba(239, 68, 68, 0.1); }
        }
      `}</style>
    </div>
  );
};

export default ViolationAlerts;
