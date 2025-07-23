/**
 * ViolationHistory - Component for displaying violation history and analytics
 */

import React, { useState, useMemo } from 'react';

const ViolationHistory = ({ violations }) => {
  const [sortBy, setSortBy] = useState('timestamp');
  const [filterBy, setFilterBy] = useState('all');
  const [showDetails, setShowDetails] = useState({});

  // Process violations data
  const processedViolations = useMemo(() => {
    let filtered = [...violations];

    // Apply filters
    if (filterBy !== 'all') {
      filtered = filtered.filter(v => v.severity?.toLowerCase() === filterBy);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'timestamp':
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        case 'severity':
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return (severityOrder[b.severity?.toLowerCase()] || 0) - (severityOrder[a.severity?.toLowerCase()] || 0);
        case 'type':
          return (a.type || '').localeCompare(b.type || '');
        case 'location':
          return (a.location || '').localeCompare(b.location || '');
        default:
          return 0;
      }
    });

    return filtered;
  }, [violations, sortBy, filterBy]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const total = violations.length;
    const bySeverity = violations.reduce((acc, v) => {
      const severity = v.severity?.toLowerCase() || 'unknown';
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    }, {});

    const byType = violations.reduce((acc, v) => {
      const type = v.type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const byLocation = violations.reduce((acc, v) => {
      const location = v.location || 'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});

    const byHour = violations.reduce((acc, v) => {
      if (v.timestamp) {
        const hour = new Date(v.timestamp).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
      }
      return acc;
    }, {});

    return { total, bySeverity, byType, byLocation, byHour };
  }, [violations]);

  const toggleDetails = (index) => {
    setShowDetails(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#dc2626';
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#eab308';
      default: return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const exportData = () => {
    const csvContent = [
      ['Timestamp', 'Type', 'Severity', 'Location', 'Description', 'Worker ID', 'Confidence'],
      ...violations.map(v => [
        v.timestamp || '',
        v.type || '',
        v.severity || '',
        v.location || '',
        v.description || '',
        v.worker_id || '',
        v.confidence || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `violations_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="card-title">📊 Violation History & Analytics</h2>
        <button
          onClick={exportData}
          style={{
            padding: '6px 12px',
            background: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          📥 Export CSV
        </button>
      </div>
      <div className="card-content">
        
        {/* Analytics Summary */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '16px', color: '#4a90e2' }}>📈 Summary Analytics</h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '20px'
          }}>
            {/* Total Violations */}
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
                {analytics.total}
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Total Violations</div>
            </div>

            {/* Most Common Type */}
            <div style={{
              padding: '16px',
              background: 'rgba(74, 144, 226, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(74, 144, 226, 0.3)'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4a90e2' }}>
                {Object.entries(analytics.byType).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Most Common Type</div>
            </div>

            {/* Most Problematic Location */}
            <div style={{
              padding: '16px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f59e0b' }}>
                {Object.entries(analytics.byLocation).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None'}
              </div>
              <div style={{ fontSize: '14px', color: '#ccc' }}>Most Violations</div>
            </div>
          </div>

          {/* Severity Breakdown */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ marginBottom: '8px', color: '#4a90e2' }}>Severity Breakdown</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.entries(analytics.bySeverity).map(([severity, count]) => (
                <div
                  key={severity}
                  style={{
                    padding: '6px 12px',
                    background: `${getSeverityColor(severity)}20`,
                    borderRadius: '16px',
                    border: `1px solid ${getSeverityColor(severity)}50`,
                    fontSize: '14px'
                  }}
                >
                  <span style={{ color: getSeverityColor(severity), fontWeight: 'bold' }}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </span>
                  <span style={{ marginLeft: '6px', color: '#ccc' }}>({count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#ccc' }}>
              Sort by:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 12px',
                background: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px'
              }}
            >
              <option value="timestamp">Time</option>
              <option value="severity">Severity</option>
              <option value="type">Type</option>
              <option value="location">Location</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#ccc' }}>
              Filter by severity:
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              style={{
                padding: '6px 12px',
                background: '#333',
                color: 'white',
                border: '1px solid #555',
                borderRadius: '4px'
              }}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Violations List */}
        <div>
          <h3 style={{ marginBottom: '12px', color: '#4a90e2' }}>
            📋 Violation Records ({processedViolations.length} of {violations.length})
          </h3>
          
          {processedViolations.length > 0 ? (
            <div style={{ 
              maxHeight: '500px', 
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px'
            }}>
              {processedViolations.map((violation, index) => (
                <div
                  key={index}
                  style={{
                    padding: '16px',
                    borderBottom: index < processedViolations.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => toggleDetails(index)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{
                          padding: '4px 8px',
                          background: getSeverityColor(violation.severity),
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: 'white'
                        }}>
                          {violation.severity?.toUpperCase() || 'UNKNOWN'}
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#4a90e2' }}>
                          {violation.type || 'Unknown Violation'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#888' }}>
                          {formatTimestamp(violation.timestamp)}
                        </div>
                      </div>
                      
                      <div style={{ color: '#ccc', fontSize: '14px', marginBottom: '8px' }}>
                        {violation.description || 'No description available'}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#888' }}>
                        {violation.location && <span>📍 {violation.location}</span>}
                        {violation.worker_id && <span>👤 {violation.worker_id}</span>}
                        {violation.confidence && <span>🎯 {(violation.confidence * 100).toFixed(1)}%</span>}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '16px', color: '#888' }}>
                      {showDetails[index] ? '▼' : '▶'}
                    </div>
                  </div>

                  {showDetails[index] && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                        <div><strong>Zone ID:</strong> {violation.zone_id || 'N/A'}</div>
                        <div><strong>Timestamp:</strong> {formatTimestamp(violation.timestamp)}</div>
                        <div><strong>Confidence:</strong> {violation.confidence ? `${(violation.confidence * 100).toFixed(1)}%` : 'N/A'}</div>
                        <div><strong>Worker:</strong> {violation.worker_id || 'Unknown'}</div>
                      </div>
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
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
              <p>No violations match the current filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViolationHistory;
