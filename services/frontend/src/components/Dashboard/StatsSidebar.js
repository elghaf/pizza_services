import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

const StatsSidebar = ({ 
  statistics, 
  workers, 
  detectionSensitivity, 
  autoRecording, 
  onSensitivityToggle, 
  onRecordingToggle 
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  // Initialize chart
  useEffect(() => {
    if (chartRef.current) {
      chartInstance.current = echarts.init(chartRef.current);
      
      const option = {
        animation: false,
        grid: {
          top: 10,
          left: 30,
          right: 10,
          bottom: 30,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00'],
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#6B7280', fontSize: 10 }
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#6B7280', fontSize: 10 },
          splitLine: { lineStyle: { color: '#F3F4F6' } }
        },
        series: [
          {
            name: 'Violations',
            type: 'line',
            data: [0, 1, 0, 2, 1, 3],
            smooth: true,
            lineStyle: { color: '#EF4444', width: 2 },
            itemStyle: { color: '#EF4444' },
            areaStyle: { color: 'rgba(239, 68, 68, 0.1)' }
          },
          {
            name: 'Interactions',
            type: 'line',
            data: [15, 23, 18, 28, 22, 35],
            smooth: true,
            lineStyle: { color: '#3B82F6', width: 2 },
            itemStyle: { color: '#3B82F6' },
            areaStyle: { color: 'rgba(59, 130, 246, 0.1)' }
          }
        ]
      };
      
      chartInstance.current.setOption(option);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
      }
    };
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-6 h-full">
      {/* Real-time Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Real-time Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{statistics.violations}</div>
            <div className="text-sm text-gray-600">Violations Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">{statistics.complianceRate}%</div>
            <div className="text-sm text-gray-600">Compliance Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{statistics.activeWorkers}</div>
            <div className="text-sm text-gray-600">Active Workers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-700">{statistics.totalInteractions}</div>
            <div className="text-sm text-gray-600">Total Interactions</div>
          </div>
        </div>
      </div>

      {/* Active Workers */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Workers</h3>
        <div className="space-y-3">
          {workers.map(worker => (
            <div key={worker.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 ${
                  worker.color === 'secondary' ? 'bg-secondary' : 'bg-primary'
                } rounded-full flex items-center justify-center`}>
                  <span className="text-white text-sm font-medium">{worker.initials}</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">{worker.name}</div>
                  <div className="text-sm text-gray-600">{worker.station}</div>
                </div>
              </div>
              <div className={`w-2 h-2 ${
                worker.color === 'secondary' ? 'bg-secondary' : 'bg-primary'
              } rounded-full ${worker.status === 'active' ? 'animate-pulse' : ''}`}></div>
            </div>
          ))}
        </div>
      </div>

      {/* Detection Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6 flex-1">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Detection Chart</h3>
        <div ref={chartRef} className="h-48"></div>
      </div>

      {/* System Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Controls</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Detection Sensitivity</span>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500">Low</span>
              <div 
                className="relative w-12 h-6 bg-gray-200 rounded-full cursor-pointer"
                onClick={onSensitivityToggle}
              >
                <div className={`absolute top-1 w-4 h-4 bg-primary rounded-full transition-transform duration-200 ${
                  detectionSensitivity ? 'translate-x-7' : 'translate-x-1'
                }`}></div>
              </div>
              <span className="text-xs text-gray-500">High</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Auto Recording</span>
            <div 
              className={`relative w-12 h-6 rounded-full cursor-pointer ${
                autoRecording ? 'bg-secondary' : 'bg-gray-200'
              }`}
              onClick={onRecordingToggle}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                autoRecording ? 'translate-x-7' : 'translate-x-1'
              }`}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSidebar;
