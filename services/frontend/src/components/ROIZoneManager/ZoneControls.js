/**
 * Zone Controls Component for ROI Zone Manager
 * Provides UI controls for zone management, drawing modes, and settings
 */

import React from 'react';
import { zoneTypes, getZoneTypeKeys } from './ZoneTypes';

const ZoneControls = ({
  // Zone management
  zones,
  selectedZoneType,
  onZoneTypeChange,
  onDeleteZone,
  onClearAllZones,
  
  // Drawing controls
  drawingMode,
  onDrawingModeChange,
  isEnabled,
  onToggleEnabled,
  
  // Drawing state
  isDrawing,
  canCompletePolygon,
  onCompletePolygon,
  onCancelDrawing,
  
  // Grid and snapping
  snapToGrid,
  onToggleSnapToGrid,
  gridSize,
  onGridSizeChange,
  
  // History
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  
  // Templates
  onSaveTemplate,
  onLoadTemplate,
  availableTemplates = []
}) => {
  return (
    <div className="zone-controls">
      {/* Main Controls Header */}
      <div className="controls-header">
        <h3>🎯 ROI Zone Manager</h3>
        <div className="main-toggle">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={onToggleEnabled}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              {isEnabled ? '✅ Enabled' : '❌ Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Zone Type Selection */}
      <div className="control-section">
        <h4>🏷️ Zone Type</h4>
        <div className="zone-type-grid">
          {getZoneTypeKeys().map(zoneKey => {
            const config = zoneTypes[zoneKey];
            return (
              <button
                key={zoneKey}
                className={`zone-type-btn ${selectedZoneType === zoneKey ? 'selected' : ''}`}
                onClick={() => onZoneTypeChange(zoneKey)}
                style={{
                  borderColor: config.color,
                  backgroundColor: selectedZoneType === zoneKey ? config.fillColor : 'transparent'
                }}
                title={config.description}
              >
                <span className="zone-icon">{config.icon}</span>
                <span className="zone-name">{config.name}</span>
                {config.requiresScooper && (
                  <span className="scooper-indicator" title="Scooper Required">🥄</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drawing Mode Selection */}
      <div className="control-section">
        <h4>✏️ Drawing Mode</h4>
        <div className="drawing-mode-buttons">
          <button
            className={`mode-btn ${drawingMode === 'polygon' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('polygon')}
            title="Draw custom polygon shapes (Ctrl+P)"
          >
            🔺 Polygon
          </button>
          <button
            className={`mode-btn ${drawingMode === 'rectangle' ? 'active' : ''}`}
            onClick={() => onDrawingModeChange('rectangle')}
            title="Draw rectangular zones (Ctrl+R)"
          >
            📦 Rectangle
          </button>
        </div>
      </div>

      {/* Drawing Actions */}
      {isDrawing && (
        <div className="control-section drawing-actions">
          <h4>🎨 Drawing Actions</h4>
          <div className="action-buttons">
            {canCompletePolygon && (
              <button
                className="action-btn complete"
                onClick={onCompletePolygon}
                title="Complete polygon (Enter)"
              >
                ✅ Complete
              </button>
            )}
            <button
              className="action-btn cancel"
              onClick={onCancelDrawing}
              title="Cancel drawing (Escape)"
            >
              ❌ Cancel
            </button>
          </div>
        </div>
      )}

      {/* Grid and Snapping */}
      <div className="control-section">
        <h4>📐 Grid & Snapping</h4>
        <div className="grid-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={onToggleSnapToGrid}
            />
            <span>Enable Grid Snapping (Ctrl+G)</span>
          </label>
          
          {snapToGrid && (
            <div className="grid-size-control">
              <label>Grid Size:</label>
              <input
                type="range"
                min="5"
                max="50"
                value={gridSize}
                onChange={(e) => onGridSizeChange(parseInt(e.target.value))}
                className="grid-size-slider"
              />
              <span className="grid-size-value">{gridSize}px</span>
            </div>
          )}
        </div>
      </div>

      {/* History Controls */}
      <div className="control-section">
        <h4>↶ History</h4>
        <div className="history-buttons">
          <button
            className={`history-btn ${!canUndo ? 'disabled' : ''}`}
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo last action (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button
            className={`history-btn ${!canRedo ? 'disabled' : ''}`}
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo last action (Ctrl+Y)"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      {/* Zone List */}
      <div className="control-section">
        <h4>📋 Current Zones ({zones.length})</h4>
        <div className="zone-list">
          {zones.length === 0 ? (
            <p className="no-zones">No zones created yet</p>
          ) : (
            zones.map((zone, index) => {
              const config = zoneTypes[zone.type];
              return (
                <div key={zone.id} className="zone-item">
                  <div className="zone-info">
                    <span className="zone-icon">{config.icon}</span>
                    <span className="zone-name">{zone.name}</span>
                    <span className="zone-type">({config.name})</span>
                    {zone.requiresScooper && (
                      <span className="scooper-indicator" title="Scooper Required">🥄</span>
                    )}
                  </div>
                  <div className="zone-actions">
                    <button
                      className="zone-action-btn edit"
                      onClick={() => {/* Edit functionality would be handled by parent */}}
                      title="Edit zone"
                    >
                      ✏️
                    </button>
                    <button
                      className="zone-action-btn delete"
                      onClick={() => onDeleteZone(zone.id)}
                      title="Delete zone"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {zones.length > 0 && (
          <button
            className="clear-all-btn"
            onClick={onClearAllZones}
            title="Clear all zones"
          >
            🗑️ Clear All Zones
          </button>
        )}
      </div>

      {/* Template Management */}
      <div className="control-section">
        <h4>💾 Templates</h4>
        <div className="template-controls">
          <button
            className="template-btn save"
            onClick={onSaveTemplate}
            disabled={zones.length === 0}
            title="Save current zones as template"
          >
            💾 Save Template
          </button>
          
          {availableTemplates.length > 0 && (
            <div className="template-list">
              <label>Load Template:</label>
              <select
                onChange={(e) => e.target.value && onLoadTemplate(e.target.value)}
                defaultValue=""
              >
                <option value="">Select template...</option>
                {availableTemplates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.zoneCount} zones)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="control-section">
        <h4>⌨️ Keyboard Shortcuts</h4>
        <div className="shortcuts-list">
          <div className="shortcut-item">
            <kbd>Ctrl+P</kbd> <span>Polygon mode</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+R</kbd> <span>Rectangle mode</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+G</kbd> <span>Toggle grid</span>
          </div>
          <div className="shortcut-item">
            <kbd>Enter</kbd> <span>Complete polygon</span>
          </div>
          <div className="shortcut-item">
            <kbd>Escape</kbd> <span>Cancel drawing</span>
          </div>
          <div className="shortcut-item">
            <kbd>Delete</kbd> <span>Delete selected point</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+Z</kbd> <span>Undo</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl+Y</kbd> <span>Redo</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoneControls;
