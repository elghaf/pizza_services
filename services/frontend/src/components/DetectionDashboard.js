import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import moment from 'moment';

const DetectionDashboard = ({ detectionData, violationData, currentSession }) => {
  const [stats, setStats] = useState({
    totalDetections: 0,
    handsDetected: 0,
    scoopersDetected: 0,
    personsDetected: 0,
    violationsFound: 0,
    processingTime: 0
  });

  const [chartData, setChartData] = useState([]);
  const [violationTypes, setViolationTypes] = useState([]);

  useEffect(() => {
    calculateStats();
    prepareChartData();
  }, [detectionData, violationData]);

  const calculateStats = () => {
    const totalDetections = detectionData.length;
    const handsDetected = detectionData.filter(d => 
      d.detections && d.detections.some(det => det.class_name === 'hand')
    ).length;
    const scoopersDetected = detectionData.filter(d => 
      d.detections && d.detections.some(det => det.class_name === 'scooper')
    ).length;
    const personsDetected = detectionData.filter(d => 
      d.detections && d.detections.some(det => det.class_name === 'person')
    ).length;
    const violationsFound = violationData.length;
    
    const avgProcessingTime = detectionData.length > 0 
      ? detectionData.reduce((sum, d) => sum + (d.processing_time_ms || 0), 0) / detectionData.length
      : 0;

    setStats({
      totalDetections,
      handsDetected,
      scoopersDetected,
      personsDetected,
      violationsFound,
      processingTime: avgProcessingTime
    });
  };

  const prepareChartData = () => {
    // Prepare time series data for detections
    const timeData = detectionData.slice(-20).map((data, index) => ({
      time: moment(data.timestamp).format('HH:mm:ss'),
      detections: data.detections ? data.detections.length : 0,
      hands: data.detections ? data.detections.filter(d => d.class_name === 'hand').length : 0,
      scoopers: data.detections ? data.detections.filter(d => d.class_name === 'scooper').length : 0,
      persons: data.detections ? data.detections.filter(d => d.class_name === 'person').length : 0
    }));
    setChartData(timeData);

    // Prepare violation types data
    const violationTypeCounts = violationData.reduce((acc, violation) => {
      const type = violation.violation_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const violationTypeData = Object.entries(violationTypeCounts).map(([type, count]) => ({
      name: type.replace(/_/g, ' ').toUpperCase(),
      value: count,
      color: type.includes('hand') ? '#ef4444' : type.includes('scooper') ? '#f59e0b' : '#8b5cf6'
    }));
    setViolationTypes(violationTypeData);
  };

  const getLatestDetections = () => {
    return detectionData.slice(-10).reverse();
  };

  const getRecentViolations = () => {
    return violationData.slice(-5).reverse();
  };

  return (
    <div>
      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#06b6d4' }}>{stats.totalDetections}</div>
          <div className="stat-label">Total Detections</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#10b981' }}>{stats.handsDetected}</div>
          <div className="stat-label">Hands Detected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.scoopersDetected}</div>
          <div className="stat-label">Scoopers Detected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.personsDetected}</div>
          <div className="stat-label">Persons Detected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#ef4444' }}>{stats.violationsFound}</div>
          <div className="stat-label">Violations Found</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#06b6d4' }}>{stats.processingTime.toFixed(1)}ms</div>
          <div className="stat-label">Avg Processing Time</div>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Detection Timeline Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📈 Detection Timeline</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="time" stroke="#ffffff" />
              <YAxis stroke="#ffffff" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(0,0,0,0.8)', 
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="hands" stroke="#06b6d4" strokeWidth={2} name="Hands" />
              <Line type="monotone" dataKey="scoopers" stroke="#10b981" strokeWidth={2} name="Scoopers" />
              <Line type="monotone" dataKey="persons" stroke="#8b5cf6" strokeWidth={2} name="Persons" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Violation Types Chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚨 Violation Types</h2>
          </div>
          {violationTypes.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={violationTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {violationTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '300px',
              color: 'rgba(255,255,255,0.6)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                <p>No violations detected yet</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        {/* Latest Detections */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🔍 Latest Detections</h2>
          </div>
          <div className="detection-list">
            {getLatestDetections().length > 0 ? (
              getLatestDetections().map((data, index) => (
                <div key={index} style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  marginBottom: '8px' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>Frame {data.frame_id}</strong>
                    <span style={{ fontSize: '12px', opacity: 0.7 }}>
                      {moment(data.timestamp).format('HH:mm:ss')}
                    </span>
                  </div>
                  {data.detections && data.detections.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {data.detections.map((detection, detIndex) => (
                        <span 
                          key={detIndex}
                          style={{
                            background: detection.class_name === 'hand' ? '#06b6d4' :
                                      detection.class_name === 'scooper' ? '#10b981' :
                                      detection.class_name === 'person' ? '#8b5cf6' : '#6b7280',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}
                        >
                          {detection.class_name} ({(detection.confidence * 100).toFixed(1)}%)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ opacity: 0.6 }}>No objects detected</span>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔍</div>
                <p>No detection data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Violations */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">🚨 Recent Violations</h2>
          </div>
          <div className="detection-list">
            {getRecentViolations().length > 0 ? (
              getRecentViolations().map((violation, index) => (
                <div key={index} className="violation-alert" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{violation.violation_type?.replace(/_/g, ' ').toUpperCase()}</strong>
                    <span style={{ fontSize: '12px' }}>
                      {moment(violation.timestamp).format('HH:mm:ss')}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                    {violation.description}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', opacity: 0.8 }}>
                    <span>Confidence: {(violation.confidence * 100).toFixed(1)}%</span>
                    <span>Severity: {violation.severity}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>✅</div>
                <p>No violations detected</p>
                <small>Great job maintaining hygiene standards!</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Session Information */}
      {currentSession && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">📊 Current Session</h2>
          </div>
          <div className="grid grid-3">
            <div>
              <strong>Session ID:</strong>
              <br />
              <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                {currentSession.session_id}
              </span>
            </div>
            <div>
              <strong>Status:</strong>
              <br />
              <span style={{ 
                color: currentSession.status === 'running' ? '#10b981' : 
                      currentSession.status === 'completed' ? '#06b6d4' : '#ef4444'
              }}>
                {currentSession.status?.toUpperCase()}
              </span>
            </div>
            <div>
              <strong>Started:</strong>
              <br />
              <span style={{ fontSize: '14px' }}>
                {moment(currentSession.started_at).format('YYYY-MM-DD HH:mm:ss')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetectionDashboard;
