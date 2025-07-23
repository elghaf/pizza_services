import React, { useState, useEffect } from 'react';
import VideoProcessor from '../VideoProcessor';
import StatsSidebar from './StatsSidebar';
import AlertsPanel from './AlertsPanel';
import ROIConfigModal from './ROIConfigModal';
import realTimeDataService from '../../services/RealTimeDataService';

const MainDashboard = () => {
  const [systemData, setSystemData] = useState({
    violations: 0,
    complianceRate: 0,
    activeWorkers: 0,
    totalInteractions: 0,
    workers: [],
    alerts: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const [selectedCamera, setSelectedCamera] = useState('camera_1');
  const [detectionSensitivity, setDetectionSensitivity] = useState(true);
  const [autoRecording, setAutoRecording] = useState(true);
  const [cameras, setCameras] = useState([]);
  const [showROIModal, setShowROIModal] = useState(false);
  const [currentSession, setCurrentSession] = useState(null);
  const [realTimeDetections, setRealTimeDetections] = useState([]);
  const [realTimeViolations, setRealTimeViolations] = useState([]);

  // Subscribe to real-time data updates
  useEffect(() => {
    console.log('🔄 Setting up real-time data subscriptions...');
    setConnectionStatus('connecting');

    // Subscribe to system health updates
    const unsubscribeHealth = realTimeDataService.subscribe('systemHealth', (health) => {
      setConnectionStatus(health.overall_status === 'healthy' ? 'connected' : 'degraded');
      setIsLoading(false);
    });

    // Subscribe to statistics updates
    const unsubscribeStats = realTimeDataService.subscribe('statistics', (stats) => {
      setSystemData(prev => ({
        ...prev,
        violations: stats.violations,
        complianceRate: stats.complianceRate,
        activeWorkers: stats.activeWorkers,
        totalInteractions: stats.totalInteractions
      }));
      setIsLoading(false);
    });

    // Subscribe to workers updates
    const unsubscribeWorkers = realTimeDataService.subscribe('workers', (workers) => {
      setSystemData(prev => ({
        ...prev,
        workers
      }));
    });

    // Subscribe to alerts updates
    const unsubscribeAlerts = realTimeDataService.subscribe('alerts', (alerts) => {
      setSystemData(prev => ({
        ...prev,
        alerts: Array.isArray(alerts) ? alerts : [alerts, ...prev.alerts.slice(0, 4)]
      }));
    });

    // Load cameras
    realTimeDataService.getCameras().then(setCameras);

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeHealth();
      unsubscribeStats();
      unsubscribeWorkers();
      unsubscribeAlerts();
    };
  }, []);

  const handleCameraChange = (cameraId) => {
    setSelectedCamera(cameraId);
  };

  const handleSensitivityToggle = async () => {
    const success = await realTimeDataService.toggleDetectionSensitivity();
    if (success) {
      setDetectionSensitivity(!detectionSensitivity);
    }
  };

  const handleRecordingToggle = async () => {
    const success = await realTimeDataService.toggleAutoRecording();
    if (success) {
      setAutoRecording(!autoRecording);
    }
  };

  // Video processing callbacks
  const handleSessionUpdate = (session) => {
    setCurrentSession(session);
    console.log('📊 Session updated:', session);
  };

  const handleDetectionUpdate = (detections) => {
    setRealTimeDetections(detections);
    // Update system data with real detection count
    setSystemData(prev => ({
      ...prev,
      totalInteractions: prev.totalInteractions + detections.length
    }));
  };

  const handleViolationUpdate = (violations) => {
    setRealTimeViolations(violations);
    // Update system data with real violation count
    setSystemData(prev => ({
      ...prev,
      violations: prev.violations + violations.length,
      alerts: [...violations.map(v => ({
        id: `violation_${Date.now()}_${Math.random()}`,
        type: 'violation',
        title: 'Scooper violation detected',
        description: v.description || 'Worker grabbed protein without scooper',
        time: new Date().toLocaleTimeString('en-US', { hour12: false }),
        severity: 'high'
      })), ...prev.alerts.slice(0, 4)]
    }));
  };

  const handleROIConfiguration = () => {
    setShowROIModal(true);
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard...</h2>
          <p className="text-gray-600">Connecting to backend services...</p>
          <div className="mt-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
              connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                'bg-red-500'
              }`}></div>
              {connectionStatus === 'connected' ? 'Connected' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               'Connection Issues'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Main Video Processing Area */}
      <div className="flex-1 p-6 pr-3">
        <VideoProcessor
          onSessionUpdate={handleSessionUpdate}
          onDetectionUpdate={handleDetectionUpdate}
          onViolationUpdate={handleViolationUpdate}
          currentSession={currentSession}
        />
      </div>

      {/* Right Sidebar */}
      <div className="w-96 p-6 pl-3">
        <StatsSidebar
          statistics={{
            violations: systemData.violations,
            complianceRate: systemData.complianceRate,
            activeWorkers: systemData.activeWorkers,
            totalInteractions: systemData.totalInteractions
          }}
          workers={systemData.workers}
          detectionSensitivity={detectionSensitivity}
          autoRecording={autoRecording}
          onSensitivityToggle={handleSensitivityToggle}
          onRecordingToggle={handleRecordingToggle}
        />
      </div>

      {/* Bottom Alerts Panel */}
      <AlertsPanel
        alerts={systemData.alerts}
        onViewAllAlerts={() => console.log('View all alerts')}
      />

      {/* ROI Configuration Modal */}
      <ROIConfigModal
        isOpen={showROIModal}
        onClose={() => setShowROIModal(false)}
        selectedCamera={selectedCamera}
      />
    </div>
  );
};

export default MainDashboard;
