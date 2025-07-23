import React, { useState, useEffect } from 'react';

const Header = ({ systemHealth = {} }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getSystemStatus = () => {
    if (!systemHealth || Object.keys(systemHealth).length === 0) {
      return { status: 'System Online', isOnline: true };
    }

    const services = systemHealth.services || {};
    const healthyServices = Object.values(services).filter(
      service => service.status === 'healthy'
    ).length;
    const totalServices = Object.keys(services).length;

    if (totalServices === 0 || healthyServices === totalServices) {
      return { status: 'System Online', isOnline: true };
    } else if (healthyServices > totalServices / 2) {
      return { status: 'System Degraded', isOnline: true };
    } else {
      return { status: 'System Offline', isOnline: false };
    }
  };

  const systemStatus = getSystemStatus();

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-gray-900">
            Pizza Store Scooper Violation Detection
          </h1>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              systemStatus.isOnline ? 'bg-secondary animate-pulse' : 'bg-red-500'
            }`}></div>
            <span className={`text-sm font-medium ${
              systemStatus.isOnline ? 'text-secondary' : 'text-red-500'
            }`}>
              {systemStatus.status}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
          <div className="text-sm text-gray-600">
            <span>{formatDate(currentTime)}</span>
            <span className="ml-4 font-mono">{formatTime(currentTime)}</span>
          </div>
          <button className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-button transition-colors">
            <i className="ri-settings-3-line text-gray-600"></i>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
