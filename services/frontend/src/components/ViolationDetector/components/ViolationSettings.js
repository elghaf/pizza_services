/**
 * Violation Settings Component
 * Provides UI controls for configuring violation detection parameters
 */

import React from 'react';

const ViolationSettings = ({
  settings,
  onSettingsChange,
  stats = {}
}) => {
  const handleSettingChange = (key, value) => {
    onSettingsChange({ [key]: value });
  };

  const getSensitivityDescription = (sensitivity) => {
    if (sensitivity <= 0.4) return 'Low - Detects obvious violations only';
    if (sensitivity <= 0.7) return 'Medium - Balanced detection (recommended)';
    return 'High - Detects potential violations aggressively';
  };

  const getSensitivityColor = (sensitivity) => {
    if (sensitivity <= 0.4) return '#10b981';
    if (sensitivity <= 0.7) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <h4 style={{
        margin: '0 0 16px 0',
        color: '#FFD700',
        fontSize: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🚨 Violation Detection Settings
      </h4>

      {/* Main Enable/Disable Toggle */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '6px',
          background: settings.enabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          border: `2px solid ${settings.enabled ? '#22c55e' : '#ef4444'}`,
          transition: 'all 0.3s ease'
        }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleSettingChange('enabled', e.target.checked)}
            style={{ transform: 'scale(1.2)' }}
          />
          <span style={{ 
            fontWeight: '600', 
            fontSize: '16px',
            color: settings.enabled ? '#22c55e' : '#ef4444'
          }}>
            {settings.enabled ? '✅ Detection Active' : '❌ Detection Disabled'}
          </span>
        </label>
      </div>

      {/* Settings Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '16px',
        marginBottom: '16px'
      }}>
        {/* Sensitivity Control */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#fff'
          }}>
            Detection Sensitivity
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={settings.sensitivity}
              onChange={(e) => handleSettingChange('sensitivity', parseFloat(e.target.value))}
              style={{ 
                flex: 1,
                height: '6px',
                background: `linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)`,
                borderRadius: '3px'
              }}
              disabled={!settings.enabled}
            />
            <span style={{
              minWidth: '40px',
              fontWeight: 'bold',
              fontSize: '16px',
              color: getSensitivityColor(settings.sensitivity)
            }}>
              {settings.sensitivity}
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: getSensitivityColor(settings.sensitivity),
            fontWeight: '500'
          }}>
            {getSensitivityDescription(settings.sensitivity)}
          </div>
        </div>

        {/* Temporal Window Control */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#fff'
          }}>
            Tracking Window
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.temporalWindow}
              onChange={(e) => handleSettingChange('temporalWindow', parseInt(e.target.value))}
              style={{ flex: 1 }}
              disabled={!settings.enabled}
            />
            <span style={{
              minWidth: '40px',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#3b82f6'
            }}>
              {settings.temporalWindow}s
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            How long to track hand movements
          </div>
        </div>

        {/* Movement Threshold Control */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <label style={{
            display: 'block',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#fff'
          }}>
            Movement Sensitivity
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.movementThreshold}
              onChange={(e) => handleSettingChange('movementThreshold', parseInt(e.target.value))}
              style={{ flex: 1 }}
              disabled={!settings.enabled}
            />
            <span style={{
              minWidth: '50px',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#8b5cf6'
            }}>
              {settings.movementThreshold}px
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: '#94a3b8'
          }}>
            Minimum movement to detect handling
          </div>
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <details style={{ marginBottom: '16px' }}>
        <summary style={{
          cursor: 'pointer',
          fontWeight: '500',
          color: '#94a3b8',
          padding: '8px 0',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          ⚙️ Advanced Settings
        </summary>
        
        <div style={{
          padding: '12px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {/* Extended Contact Threshold */}
          <div>
            <label style={{
              display: 'block',
              fontWeight: '500',
              marginBottom: '4px',
              color: '#fff',
              fontSize: '14px'
            }}>
              Extended Contact Threshold
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="2"
                max="15"
                step="1"
                value={settings.extendedContactThreshold || 5}
                onChange={(e) => handleSettingChange('extendedContactThreshold', parseInt(e.target.value))}
                style={{ flex: 1 }}
                disabled={!settings.enabled}
              />
              <span style={{ minWidth: '30px', fontSize: '14px', color: '#94a3b8' }}>
                {settings.extendedContactThreshold || 5}s
              </span>
            </div>
          </div>

          {/* Scooper Detection Range */}
          <div>
            <label style={{
              display: 'block',
              fontWeight: '500',
              marginBottom: '4px',
              color: '#fff',
              fontSize: '14px'
            }}>
              Scooper Detection Range
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={settings.scoopeDetectionRange || 100}
                onChange={(e) => handleSettingChange('scoopeDetectionRange', parseInt(e.target.value))}
                style={{ flex: 1 }}
                disabled={!settings.enabled}
              />
              <span style={{ minWidth: '40px', fontSize: '14px', color: '#94a3b8' }}>
                {settings.scoopeDetectionRange || 100}px
              </span>
            </div>
          </div>
        </div>
      </details>

      {/* Help Information */}
      <div style={{
        fontSize: '12px',
        color: '#94a3b8',
        lineHeight: '1.5',
        background: 'rgba(0, 0, 0, 0.3)',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ fontWeight: '600', marginBottom: '8px', color: '#fff' }}>
          💡 How Violation Detection Works:
        </div>
        <div style={{ marginBottom: '6px' }}>
          <strong>Sensitivity:</strong> Controls how strict the detection is. Higher values detect more potential violations but may increase false positives.
        </div>
        <div style={{ marginBottom: '6px' }}>
          <strong>Tracking Window:</strong> How long the system remembers hand positions to detect movement patterns.
        </div>
        <div style={{ marginBottom: '6px' }}>
          <strong>Movement Sensitivity:</strong> Minimum hand movement required to consider it "handling" vs. just cleaning.
        </div>
        <div style={{ fontStyle: 'italic', color: '#f59e0b' }}>
          Recommended: Medium sensitivity (0.5-0.7) for balanced detection with minimal false positives.
        </div>
      </div>

      {/* Current Status */}
      {settings.enabled && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '6px',
          border: '1px solid #22c55e',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '16px' }}>✅</span>
          <span style={{ color: '#22c55e', fontWeight: '500' }}>
            Violation detection is active and monitoring
          </span>
          {stats.current > 0 && (
            <span style={{
              marginLeft: 'auto',
              background: '#ef4444',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>
              {stats.current} active violation{stats.current !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default ViolationSettings;
