import React, { useState, useRef, useEffect } from 'react';

const VideoFeedPanel = ({
  selectedCamera,
  onCameraChange,
  onROIConfiguration,
  workers = [],
  alerts = [],
  cameras = []
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(852); // 14:32 in seconds
  const [totalTime] = useState(1335); // 22:15 in seconds
  const [roiZones, setROIZones] = useState([
    {
      id: 'protein_container',
      name: 'Protein Container',
      type: 'violation',
      style: { top: '16px', left: '16px', width: '128px', height: '96px' },
      color: 'red'
    },
    {
      id: 'cheese_station',
      name: 'Cheese Station',
      type: 'monitoring',
      style: { top: '16px', right: '16px', width: '112px', height: '80px' },
      color: 'blue'
    }
  ]);
  const videoRef = useRef(null);

  // Default cameras if none provided
  const defaultCameras = [
    { id: 'camera_1', name: 'Camera 1 - Main Counter' },
    { id: 'camera_2', name: 'Camera 2 - Prep Station' },
    { id: 'camera_3', name: 'Camera 3 - Storage Area' }
  ];

  const availableCameras = cameras.length > 0 ? cameras : defaultCameras;

  // Worker positions for demonstration
  const workerPositions = [
    {
      id: 'worker_1',
      name: 'Sarah Johnson',
      style: { bottom: '80px', left: '33.33%' },
      color: 'secondary'
    }
  ];

  // Violation alerts for demonstration
  const violationAlerts = [
    {
      id: 'violation_1',
      message: 'VIOLATION DETECTED',
      style: { top: '50%', right: '25%' },
      animate: true
    }
  ];

  useEffect(() => {
    // Simulate video time progression
    const interval = setInterval(() => {
      if (isPlaying && currentTime < totalTime) {
        setCurrentTime(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, totalTime]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.floor((clickX / rect.width) * totalTime);
    setCurrentTime(newTime);
  };

  const progressPercentage = (currentTime / totalTime) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Live Video Feed</h2>
          <div className="flex items-center space-x-3">
            <select
              className="input-field"
              value={selectedCamera}
              onChange={(e) => onCameraChange(e.target.value)}
            >
              {availableCameras.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
            <button 
              className="btn-primary whitespace-nowrap"
              onClick={onROIConfiguration}
            >
              Configure ROI
            </button>
          </div>
        </div>
      </div>
      
      {/* Video Container */}
      <div className="flex-1 p-4">
        <div className="relative w-full h-full bg-gray-900 rounded-lg overflow-hidden">
          {/* Placeholder Video/Image */}
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="text-white text-center">
              <i className="ri-video-line text-6xl mb-4 opacity-50"></i>
              <p className="text-lg opacity-75">Live Video Feed</p>
              <p className="text-sm opacity-50">{availableCameras.find(c => c.id === selectedCamera)?.name}</p>
            </div>
          </div>
          
          {/* ROI Zone Overlays */}
          {roiZones.map(zone => (
            <div
              key={zone.id}
              className={`absolute border-2 border-dashed rounded ${
                zone.color === 'red' 
                  ? 'border-red-500 bg-red-500 bg-opacity-20' 
                  : 'border-blue-500 bg-blue-500 bg-opacity-20'
              }`}
              style={zone.style}
            >
              <div className={`absolute -top-6 ${zone.style.right ? 'right-0' : 'left-0'} ${
                zone.color === 'red' ? 'bg-red-500' : 'bg-blue-500'
              } text-white px-2 py-1 rounded text-xs font-medium`}>
                {zone.name}
              </div>
            </div>
          ))}
          
          {/* Worker Name Tags */}
          {workerPositions.map(worker => (
            <div
              key={worker.id}
              className={`absolute ${
                worker.color === 'secondary' ? 'bg-secondary' : 'bg-primary'
              } bg-opacity-90 text-white px-3 py-2 rounded-lg`}
              style={worker.style}
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <span className="text-sm font-medium">Worker #1 - {worker.name}</span>
              </div>
            </div>
          ))}
          
          {/* Violation Alerts */}
          {violationAlerts.map(alert => (
            <div
              key={alert.id}
              className={`absolute bg-red-500 bg-opacity-90 text-white px-3 py-2 rounded-lg ${
                alert.animate ? 'animate-pulse' : ''
              }`}
              style={alert.style}
            >
              <div className="flex items-center space-x-2">
                <i className="ri-alert-line"></i>
                <span className="text-sm font-medium">{alert.message}</span>
              </div>
            </div>
          ))}
          
          {/* Video Controls */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="bg-black bg-opacity-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <button 
                  className="w-8 h-8 flex items-center justify-center bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full transition-colors"
                  onClick={handlePlayPause}
                >
                  <i className={`${isPlaying ? 'ri-pause-fill' : 'ri-play-fill'} text-white`}></i>
                </button>
                <div className="flex-1 mx-4">
                  <div 
                    className="w-full bg-gray-600 rounded-full h-1 cursor-pointer"
                    onClick={handleProgressChange}
                  >
                    <div 
                      className="bg-primary h-1 rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
                <span className="text-white text-xs font-mono">
                  {formatTime(currentTime)} / {formatTime(totalTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoFeedPanel;
