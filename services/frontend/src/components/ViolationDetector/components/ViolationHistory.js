/**
 * Violation History Component
 * Displays historical violation data with filtering and export capabilities
 */

import React, { useState } from 'react';
import { violationTypes } from '../ViolationTypes';

const ViolationHistory = ({
  violationHistory = [],
  onAcknowledgeViolation,
  onExportViolations,
  onClearHistory
}) => {
  const [filter, setFilter] = useState({
    severity: '',
    type: '',
    timeRange: 24, // hours
    resolved: ''
  });
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filter violations based on current filter settings
  const filteredViolations = violationHistory.filter(violation => {
    if (filter.severity && violation.severity !== filter.severity) return false;
    if (filter.type && violation.type !== filter.type) return false;
    if (filter.resolved !== '' && violation.resolved !== (filter.resolved === 'true')) return false;
    
    if (filter.timeRange) {
      const now = Date.now();
      const timeLimit = now - (filter.timeRange * 60 * 60 * 1000);
      const violationTime = new Date(violation.timestamp).getTime();
      if (violationTime < timeLimit) return false;
    }
    
    return true;
  });

  // Sort violations
  const sortedViolations = [...filteredViolations].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];
    
    if (sortBy === 'timestamp') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (duration) => {
    return duration ? `${duration.toFixed(1)}s` : 'N/A';
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h4 style={{
          margin: 0,
          color: '#FFD700',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          📊 Violation History ({filteredViolations.length})
        </h4>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onExportViolations('json', filter)}
            style={{
              padding: '6px 12px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📄 Export JSON
          </button>
          <button
            onClick={() => onExportViolations('csv', filter)}
            style={{
              padding: '6px 12px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            📊 Export CSV
          </button>
          <button
            onClick={onClearHistory}
            style={{
              padding: '6px 12px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '6px'
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Severity
          </label>
          <select
            value={filter.severity}
            onChange={(e) => setFilter(prev => ({ ...prev, severity: e.target.value }))}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px'
            }}
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Type
          </label>
          <select
            value={filter.type}
            onChange={(e) => setFilter(prev => ({ ...prev, type: e.target.value }))}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px'
            }}
          >
            <option value="">All Types</option>
            {Object.keys(violationTypes).map(type => (
              <option key={type} value={type}>
                {violationTypes[type].title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Time Range
          </label>
          <select
            value={filter.timeRange}
            onChange={(e) => setFilter(prev => ({ ...prev, timeRange: parseInt(e.target.value) }))}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px'
            }}
          >
            <option value={1}>Last Hour</option>
            <option value={24}>Last 24 Hours</option>
            <option value={168}>Last Week</option>
            <option value={720}>Last Month</option>
            <option value={0}>All Time</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
            Status
          </label>
          <select
            value={filter.resolved}
            onChange={(e) => setFilter(prev => ({ ...prev, resolved: e.target.value }))}
            style={{
              width: '100%',
              padding: '4px 8px',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '12px'
            }}
          >
            <option value="">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>
      </div>

      {/* Violation List */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px'
      }}>
        {sortedViolations.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: '#94a3b8'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div>No violations found matching the current filters</div>
          </div>
        ) : (
          sortedViolations.map((violation, index) => {
            const config = violationTypes[violation.type];
            return (
              <div
                key={violation.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: index < sortedViolations.length - 1 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                  background: violation.resolved ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '4px'
                    }}>
                      <span style={{ fontSize: '16px' }}>{config.icon}</span>
                      <span style={{
                        fontWeight: 'bold',
                        color: config.color
                      }}>
                        {config.title}
                      </span>
                      <span style={{
                        background: config.color,
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        {violation.severity.toUpperCase()}
                      </span>
                      <span style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px'
                      }}>
                        {(violation.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div style={{
                      fontSize: '12px',
                      color: '#94a3b8',
                      marginBottom: '4px'
                    }}>
                      {formatTimestamp(violation.timestamp)}
                      {violation.details.duration && (
                        <span> • Duration: {formatDuration(violation.details.duration)}</span>
                      )}
                    </div>
                    
                    <div style={{
                      fontSize: '13px',
                      color: '#e2e8f0'
                    }}>
                      {violation.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    {!violation.resolved && (
                      <button
                        onClick={() => onAcknowledgeViolation(violation.id, 'User')}
                        style={{
                          padding: '4px 8px',
                          background: '#10b981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        ✓ Acknowledge
                      </button>
                    )}
                    
                    {violation.resolved && (
                      <span style={{
                        padding: '4px 8px',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px'
                      }}>
                        ✓ Resolved
                      </span>
                    )}
                  </div>
                </div>

                {violation.resolved && violation.acknowledgedBy && (
                  <div style={{
                    fontSize: '11px',
                    color: '#10b981',
                    fontStyle: 'italic'
                  }}>
                    Acknowledged by {violation.acknowledgedBy} at {formatTimestamp(violation.acknowledgedAt)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ViolationHistory;
