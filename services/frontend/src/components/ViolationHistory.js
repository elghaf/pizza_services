import React, { useState, useEffect } from 'react';
import moment from 'moment';
import ReactJson from 'react-json-view';
import Modal from 'react-modal';

const ViolationHistory = ({ violationData }) => {
  const [filteredViolations, setFilteredViolations] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [modalIsOpen, setModalIsOpen] = useState(false);

  useEffect(() => {
    filterAndSortViolations();
  }, [violationData, filterType, filterSeverity, sortBy, sortOrder]);

  const filterAndSortViolations = () => {
    let filtered = [...violationData];

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(v => v.violation_type === filterType);
    }

    // Apply severity filter
    if (filterSeverity !== 'all') {
      filtered = filtered.filter(v => v.severity === filterSeverity);
    }

    // Sort violations
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'timestamp') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredViolations(filtered);
  };

  const getViolationTypes = () => {
    const types = [...new Set(violationData.map(v => v.violation_type))];
    return types;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getViolationTypeIcon = (type) => {
    if (type?.includes('hand')) return '✋';
    if (type?.includes('scooper')) return '🥄';
    if (type?.includes('ingredient')) return '🍕';
    return '⚠️';
  };

  const openViolationDetails = (violation) => {
    setSelectedViolation(violation);
    setModalIsOpen(true);
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setSelectedViolation(null);
  };

  const exportViolations = () => {
    const dataStr = JSON.stringify(filteredViolations, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `violations_${moment().format('YYYY-MM-DD_HH-mm-ss')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div>
      {/* Header with Stats */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Violation History</h2>
          <button className="btn btn-primary" onClick={exportViolations}>
            📥 Export Data
          </button>
        </div>
        
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#ef4444' }}>
              {violationData.length}
            </div>
            <div className="stat-label">Total Violations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {violationData.filter(v => v.severity === 'high').length}
            </div>
            <div className="stat-label">High Severity</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#10b981' }}>
              {violationData.filter(v => v.severity === 'medium').length}
            </div>
            <div className="stat-label">Medium Severity</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#06b6d4' }}>
              {violationData.filter(v => v.severity === 'low').length}
            </div>
            <div className="stat-label">Low Severity</div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🔍 Filters & Sorting</h3>
        </div>
        
        <div className="grid grid-auto">
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Violation Type:
            </label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            >
              <option value="all">All Types</option>
              {getViolationTypes().map(type => (
                <option key={type} value={type}>
                  {type?.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Severity:
            </label>
            <select 
              value={filterSeverity} 
              onChange={(e) => setFilterSeverity(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            >
              <option value="all">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Sort By:
            </label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            >
              <option value="timestamp">Timestamp</option>
              <option value="confidence">Confidence</option>
              <option value="severity">Severity</option>
              <option value="violation_type">Type</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Order:
            </label>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white'
              }}
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Violations List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            📊 Violations ({filteredViolations.length})
          </h3>
        </div>
        
        {filteredViolations.length > 0 ? (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {filteredViolations.map((violation, index) => (
              <div 
                key={violation.violation_id || index}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `2px solid ${getSeverityColor(violation.severity)}`,
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => openViolationDetails(violation)}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.1)';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>
                      {getViolationTypeIcon(violation.violation_type)}
                    </span>
                    <div>
                      <h4 style={{ margin: 0, color: getSeverityColor(violation.severity) }}>
                        {violation.violation_type?.replace(/_/g, ' ').toUpperCase()}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
                        {violation.description}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ 
                      background: getSeverityColor(violation.severity),
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      marginBottom: '4px'
                    }}>
                      {violation.severity?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      {moment(violation.timestamp).format('MMM DD, HH:mm:ss')}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                    <span>
                      <strong>Confidence:</strong> {(violation.confidence * 100).toFixed(1)}%
                    </span>
                    {violation.roi_name && (
                      <span>
                        <strong>ROI:</strong> {violation.roi_name}
                      </span>
                    )}
                    {violation.worker_id && (
                      <span>
                        <strong>Worker:</strong> {violation.worker_id}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', opacity: 0.6 }}>
                    Click for details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px', opacity: 0.6 }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
            <h3>No violations found</h3>
            <p>
              {violationData.length === 0 
                ? "No violations have been detected yet."
                : "No violations match the current filters."
              }
            </p>
          </div>
        )}
      </div>

      {/* Violation Details Modal */}
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 1000
          },
          content: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '800px',
            margin: '50px auto',
            maxHeight: '80vh',
            overflow: 'auto'
          }
        }}
      >
        {selectedViolation && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: 'white' }}>
                🚨 Violation Details
              </h2>
              <button 
                onClick={closeModal}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                ✕ Close
              </button>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '20px' }}>
              <ReactJson
                src={selectedViolation}
                theme="monokai"
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
                collapsed={1}
                style={{ background: 'transparent' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ViolationHistory;
