/**
 * ViolationStatusOverlay - Professional full-screen violation status display
 */

import React, { useState, useEffect } from 'react';

const ViolationStatusOverlay = ({
  violations = [],
  detections = [],
  roiZones = [],
  isProcessing = false,
  sensitivity = 0.7,
  isFullScreen = false
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [animationClass, setAnimationClass] = useState('');

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animate when violations change
  useEffect(() => {
    if (violations.length > 0) {
      setAnimationClass('violation-alert');
      const timer = setTimeout(() => setAnimationClass(''), 2000);
      return () => clearTimeout(timer);
    }
  }, [violations.length]);

  // Count different types of objects
  const objectCounts = {
    workers: detections.filter(d => 
      d.class_name?.toLowerCase().includes('person') || 
      d.class_name?.toLowerCase().includes('worker')
    ).length,
    hands: detections.filter(d => 
      d.class_name?.toLowerCase().includes('hand')
    ).length,
    scoopers: detections.filter(d => 
      d.class_name?.toLowerCase().includes('spoon') || 
      d.class_name?.toLowerCase().includes('scooper') ||
      d.class_name?.toLowerCase().includes('utensil')
    ).length
  };

  // Get sensitivity level info
  const getSensitivityInfo = (value) => {
    if (value >= 0.8) return { level: 'High', color: '#ef4444', icon: '🔴' };
    if (value >= 0.6) return { level: 'Medium', color: '#f59e0b', icon: '🟡' };
    if (value >= 0.4) return { level: 'Low', color: '#22c55e', icon: '🟢' };
    return { level: 'Very Low', color: '#6b7280', icon: '⚪' };
  };

  const sensitivityInfo = getSensitivityInfo(sensitivity);

  // Get current status
  const getSystemStatus = () => {
    if (!isProcessing) {
      return {
        status: 'STANDBY',
        message: 'System ready for monitoring',
        color: '#6b7280',
        icon: '⏸️'
      };
    }

    if (violations.length > 0) {
      return {
        status: 'VIOLATION DETECTED',
        message: 'Immediate attention required - Food safety protocol breach',
        color: '#ef4444',
        icon: '🚨'
      };
    }

    if (objectCounts.workers > 0 || objectCounts.hands > 0) {
      return {
        status: 'MONITORING ACTIVE',
        message: 'All workers following proper hygiene protocols',
        color: '#22c55e',
        icon: '✅'
      };
    }

    return {
      status: 'SCANNING',
      message: 'Monitoring workspace for activity',
      color: '#3b82f6',
      icon: '🔍'
    };
  };

  const systemStatus = getSystemStatus();

  const overlayStyle = {
    position: isFullScreen ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: violations.length > 0 
      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))'
      : 'linear-gradient(135deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.75))',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    fontFamily: 'Arial, sans-serif',
    padding: '40px',
    textAlign: 'center',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.5s ease'
  };

  return (
    <div style={overlayStyle} className={animationClass}>
      {/* Header with Logo/Title */}
      <div style={{
        position: 'absolute',
        top: '30px',
        left: '30px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div style={{
          fontSize: '32px',
          background: 'linear-gradient(45deg, #ff6b35, #f7931e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 'bold'
        }}>
          🍕
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Pizza Store Monitor</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Food Safety Detection System</div>
        </div>
      </div>

      {/* Time Display */}
      <div style={{
        position: 'absolute',
        top: '30px',
        right: '30px',
        textAlign: 'right'
      }}>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
          {currentTime.toLocaleTimeString()}
        </div>
        <div style={{ fontSize: '14px', opacity: 0.8 }}>
          {currentTime.toLocaleDateString()}
        </div>
      </div>

      {/* Main Status Display */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px'
      }}>
        {/* Status Icon */}
        <div style={{
          fontSize: '120px',
          marginBottom: '20px',
          animation: violations.length > 0 ? 'pulse 1s infinite' : 'none'
        }}>
          {systemStatus.icon}
        </div>

        {/* Status Title */}
        <h1 style={{
          fontSize: '48px',
          fontWeight: 'bold',
          margin: '0 0 16px 0',
          color: systemStatus.color,
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          letterSpacing: '2px'
        }}>
          {systemStatus.status}
        </h1>

        {/* Status Message */}
        <p style={{
          fontSize: '24px',
          margin: '0 0 32px 0',
          opacity: 0.9,
          maxWidth: '800px',
          lineHeight: '1.4'
        }}>
          {systemStatus.message}
        </p>

        {/* Violation Count (if any) */}
        {violations.length > 0 && (
          <div style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#fff',
            background: 'rgba(255, 255, 255, 0.2)',
            padding: '16px 32px',
            borderRadius: '16px',
            marginBottom: '32px',
            border: '2px solid rgba(255, 255, 255, 0.3)'
          }}>
            {violations.length} ACTIVE VIOLATION{violations.length > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* System Information Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '24px',
        width: '100%',
        maxWidth: '1000px',
        marginBottom: '40px'
      }}>
        {/* Detection Status */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            🔍 Detection Status
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            {isProcessing ? 'Active Monitoring' : 'Standby Mode'}
          </div>
        </div>

        {/* Sensitivity Level */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            {sensitivityInfo.icon} Sensitivity
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            {sensitivityInfo.level} ({(sensitivity * 100).toFixed(0)}%)
          </div>
        </div>

        {/* ROI Zones */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            🎯 Monitoring Zones
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            {roiZones.length} Zone{roiZones.length !== 1 ? 's' : ''} Configured
          </div>
        </div>

        {/* Current Activity */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
            👥 Current Activity
          </div>
          <div style={{ fontSize: '14px', opacity: 0.9 }}>
            {objectCounts.workers} Worker{objectCounts.workers !== 1 ? 's' : ''}, {objectCounts.hands} Hand{objectCounts.hands !== 1 ? 's' : ''}, {objectCounts.scoopers} Scooper{objectCounts.scoopers !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Active Violations List */}
      {violations.length > 0 && (
        <div style={{
          width: '100%',
          maxWidth: '800px',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '24px',
          borderRadius: '12px',
          border: '2px solid rgba(255, 255, 255, 0.3)'
        }}>
          <h3 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            marginBottom: '16px',
            color: '#fff'
          }}>
            🚨 Active Violations
          </h3>
          {violations.slice(0, 3).map((violation, index) => (
            <div key={index} style={{
              background: 'rgba(255, 255, 255, 0.1)',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '12px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>
                {violation.type || 'Hygiene Protocol Violation'}
              </div>
              <div style={{ fontSize: '14px', opacity: 0.9 }}>
                {violation.description || 'Food safety protocol breach detected'}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '8px' }}>
                Location: {violation.location || 'Ingredient Zone'} | 
                Time: {new Date(violation.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
          {violations.length > 3 && (
            <div style={{ fontSize: '14px', opacity: 0.8, textAlign: 'center' }}>
              ... and {violations.length - 3} more violation{violations.length - 3 !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Footer Instructions */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '14px',
        opacity: 0.7,
        textAlign: 'center'
      }}>
        {violations.length > 0 
          ? '⚠️ Please address violations immediately to ensure food safety compliance'
          : '✅ System operating normally - Continue monitoring'
        }
      </div>

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        .violation-alert {
          animation: shake 0.5s ease-in-out;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default ViolationStatusOverlay;
