import React, { useState, useEffect } from 'react';
import realTimeDataService from '../../services/RealTimeDataService';

const ROIConfigModal = ({ isOpen, onClose, selectedCamera }) => {
  const [roiZones, setROIZones] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newZone, setNewZone] = useState({
    name: '',
    type: 'sauce_area',
    requiresScooper: true
  });

  useEffect(() => {
    if (isOpen) {
      loadROIZones();
    }
  }, [isOpen, selectedCamera]);

  const loadROIZones = async () => {
    setIsLoading(true);
    try {
      const zones = await realTimeDataService.getROIZones();
      setROIZones(zones.filter(zone => zone.camera_id === selectedCamera));
    } catch (error) {
      console.error('Failed to load ROI zones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateZone = async () => {
    if (!newZone.name.trim()) return;

    try {
      const zoneData = {
        id: `zone_${Date.now()}`,
        name: newZone.name,
        type: newZone.type,
        camera_id: selectedCamera,
        requires_scooper: newZone.requiresScooper,
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 }
        ]
      };

      // This would normally call the ROI manager service
      console.log('Creating ROI zone:', zoneData);
      
      // Add to local state for demo
      setROIZones(prev => [...prev, zoneData]);
      setNewZone({ name: '', type: 'sauce_area', requiresScooper: true });
    } catch (error) {
      console.error('Failed to create ROI zone:', error);
    }
  };

  const handleDeleteZone = async (zoneId) => {
    try {
      // This would normally call the ROI manager service
      console.log('Deleting ROI zone:', zoneId);
      
      setROIZones(prev => prev.filter(zone => zone.id !== zoneId));
    } catch (error) {
      console.error('Failed to delete ROI zone:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Configure ROI Zones - {selectedCamera}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <i className="ri-close-line text-gray-600"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Create New Zone */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New ROI Zone</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone Name
                </label>
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="e.g., Protein Container"
                  value={newZone.name}
                  onChange={(e) => setNewZone(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zone Type
                </label>
                <select
                  className="input-field w-full"
                  value={newZone.type}
                  onChange={(e) => setNewZone(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="sauce_area">Sauce Area</option>
                  <option value="protein_area">Protein Area</option>
                  <option value="cheese_area">Cheese Area</option>
                  <option value="prep_area">Prep Area</option>
                  <option value="monitoring_area">Monitoring Area</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newZone.requiresScooper}
                    onChange={(e) => setNewZone(prev => ({ ...prev, requiresScooper: e.target.checked }))}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-700">Requires Scooper</span>
                </label>
              </div>
            </div>
            <div className="mt-4">
              <button
                onClick={handleCreateZone}
                disabled={!newZone.name.trim()}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-add-line mr-2"></i>
                Create Zone
              </button>
            </div>
          </div>

          {/* Existing Zones */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Existing ROI Zones</h3>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-gray-600">Loading ROI zones...</p>
              </div>
            ) : roiZones.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <i className="ri-map-2-line text-4xl mb-2"></i>
                <p>No ROI zones configured for this camera</p>
                <p className="text-sm">Create a new zone to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {roiZones.map(zone => (
                  <div key={zone.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-3 h-3 rounded-full ${
                            zone.type === 'sauce_area' ? 'bg-red-500' :
                            zone.type === 'protein_area' ? 'bg-orange-500' :
                            zone.type === 'cheese_area' ? 'bg-yellow-500' :
                            zone.type === 'prep_area' ? 'bg-blue-500' :
                            'bg-gray-500'
                          }`}></div>
                          <div>
                            <h4 className="font-medium text-gray-900">{zone.name}</h4>
                            <p className="text-sm text-gray-600 capitalize">
                              {zone.type.replace('_', ' ')}
                              {zone.requires_scooper && ' • Requires Scooper'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="w-8 h-8 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-colors">
                          <i className="ri-edit-line text-sm"></i>
                        </button>
                        <button 
                          onClick={() => handleDeleteZone(zone.id)}
                          className="w-8 h-8 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-600 rounded-full transition-colors"
                        >
                          <i className="ri-delete-bin-line text-sm"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {roiZones.length} zone{roiZones.length !== 1 ? 's' : ''} configured
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-button hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  console.log('Saving ROI configuration...');
                  onClose();
                }}
                className="btn-primary"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ROIConfigModal;
