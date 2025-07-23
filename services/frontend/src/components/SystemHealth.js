import React, { useState, useEffect } from 'react';
import moment from 'moment';

const SystemHealth = ({ systemHealth, onRefresh }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    setLastRefresh(new Date());
  }, [systemHealth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const getServiceStatus = (service) => {
    if (!service || typeof service !== 'object') {
      return { status: 'unknown', color: '#6b7280', icon: '❓' };
    }

    switch (service.status) {
      case 'healthy':
        return { status: 'healthy', color: '#10b981', icon: '✅' };
      case 'degraded':
        return { status: 'degraded', color: '#f59e0b', icon: '⚠️' };
      case 'unhealthy':
        return { status: 'unhealthy', color: '#ef4444', icon: '❌' };
      default:
        return { status: 'unknown', color: '#6b7280', icon: '❓' };
    }
  };

  const getOverallSystemHealth = () => {
    if (!systemHealth || Object.keys(systemHealth).length === 0) {
      return { status: 'unknown', color: '#6b7280', icon: '❓' };
    }

    const services = Object.values(systemHealth).filter(service => 
      service && typeof service === 'object' && service.status
    );

    const healthyCount = services.filter(service => service.status === 'healthy').length;
    const total = services.length;

    if (healthyCount === total && total > 0) {
      return { status: 'All Systems Operational', color: '#10b981', icon: '✅' };
    } else if (healthyCount > total / 2) {
      return { status: 'Degraded Performance', color: '#f59e0b', icon: '⚠️' };
    } else {
      return { status: 'System Issues', color: '#ef4444', icon: '❌' };
    }
  };

  const overallHealth = getOverallSystemHealth();

  const serviceDetails = [
    {
      name: 'API Gateway',
      key: 'gateway',
      description: 'Main entry point and request routing',
      port: 8000
    },
    {
      name: 'Frame Reader',
      key: 'frame_reader',
      description: 'Video ingestion and frame extraction',
      port: 8001
    },
    {
      name: 'Detection Service',
      key: 'detection',
      description: 'YOLO-based object detection',
      port: 8002
    },
    {
      name: 'Violation Detector',
      key: 'violation_detector',
      description: 'Business logic for violation analysis',
      port: 8003
    },
    {
      name: 'ROI Manager',
      key: 'roi_manager',
      description: 'Region of Interest configuration',
      port: 8004
    }
  ];

  return (
    <div>
      {/* Overall System Status */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">🔧 System Health Overview</h2>
          <button 
            className={`btn btn-primary ${refreshing ? 'disabled' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? '🔄 Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
        
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
            {overallHealth.icon}
          </div>
          <h2 style={{ color: overallHealth.color, marginBottom: '8px' }}>
            {overallHealth.status}
          </h2>
          <p style={{ opacity: 0.7 }}>
            Last updated: {moment(lastRefresh).format('YYYY-MM-DD HH:mm:ss')}
          </p>
        </div>
      </div>

      {/* Service Details */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">📊 Service Status Details</h3>
        </div>
        
        <div className="grid grid-auto">
          {serviceDetails.map(service => {
            const serviceData = systemHealth[service.key];
            const status = getServiceStatus(serviceData);
            
            return (
              <div 
                key={service.key}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: `2px solid ${status.color}`,
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  {status.icon}
                </div>
                <h4 style={{ margin: '0 0 8px 0', color: status.color }}>
                  {service.name}
                </h4>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', opacity: 0.8 }}>
                  {service.description}
                </p>
                <div style={{ fontSize: '12px', opacity: 0.6 }}>
                  Port: {service.port}
                </div>
                <div style={{ 
                  marginTop: '12px',
                  padding: '6px 12px',
                  background: status.color,
                  color: 'white',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {status.status.toUpperCase()}
                </div>
                
                {/* Service-specific details */}
                {serviceData && serviceData.data && (
                  <div style={{ marginTop: '12px', fontSize: '12px', textAlign: 'left' }}>
                    {serviceData.data.version && (
                      <div>Version: {serviceData.data.version}</div>
                    )}
                    {serviceData.data.model_loaded !== undefined && (
                      <div>Model: {serviceData.data.model_loaded ? '✅ Loaded' : '❌ Not Loaded'}</div>
                    )}
                    {serviceData.data.total_rois !== undefined && (
                      <div>ROIs: {serviceData.data.total_rois}</div>
                    )}
                    {serviceData.data.active_sessions !== undefined && (
                      <div>Sessions: {serviceData.data.active_sessions}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* System Metrics */}
      {systemHealth.system && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📈 System Metrics</h3>
          </div>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#10b981' }}>
                {Object.values(systemHealth).filter(s => s && s.status === 'healthy').length}
              </div>
              <div className="stat-label">Healthy Services</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#f59e0b' }}>
                {Object.values(systemHealth).filter(s => s && s.status === 'degraded').length}
              </div>
              <div className="stat-label">Degraded Services</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#ef4444' }}>
                {Object.values(systemHealth).filter(s => s && s.status === 'unhealthy').length}
              </div>
              <div className="stat-label">Unhealthy Services</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#06b6d4' }}>
                {Object.keys(systemHealth).length}
              </div>
              <div className="stat-label">Total Services</div>
            </div>
          </div>
        </div>
      )}

      {/* Service URLs */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🔗 Service URLs</h3>
        </div>
        
        <div style={{ display: 'grid', gap: '12px' }}>
          {serviceDetails.map(service => (
            <div 
              key={service.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.05)',
                padding: '12px 16px',
                borderRadius: '8px'
              }}
            >
              <div>
                <strong>{service.name}</strong>
                <br />
                <span style={{ fontSize: '14px', opacity: 0.7 }}>
                  {service.description}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <a 
                  href={`http://localhost:${service.port}/health`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#06b6d4',
                    textDecoration: 'none',
                    fontFamily: 'monospace',
                    fontSize: '14px'
                  }}
                >
                  localhost:{service.port}/health ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🛠️ Troubleshooting</h3>
        </div>
        
        <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
          <h4 style={{ color: '#f59e0b', marginBottom: '12px' }}>Common Issues:</h4>
          <ul style={{ paddingLeft: '20px', marginBottom: '20px' }}>
            <li><strong>Service Unreachable:</strong> Check if the service is running and the port is not blocked</li>
            <li><strong>Model Not Loaded:</strong> Ensure YOLO model file exists in the models directory</li>
            <li><strong>WebSocket Errors:</strong> Verify frame reader service is running and accessible</li>
            <li><strong>Detection Issues:</strong> Check if required dependencies are installed</li>
          </ul>
          
          <h4 style={{ color: '#10b981', marginBottom: '12px' }}>Quick Fixes:</h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Restart services: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>python start_system.py</code></li>
            <li>Check logs in service directories for detailed error messages</li>
            <li>Verify all dependencies are installed: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>pip install -r requirements.txt</code></li>
            <li>Ensure model file is present: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>models/yolo12m-v2.pt</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SystemHealth;
