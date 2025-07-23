import React from 'react';

const AlertsPanel = ({ alerts = [], onViewAllAlerts }) => {
  const getAlertStyles = (type, severity) => {
    switch (type) {
      case 'violation':
        return {
          container: 'bg-red-50 border border-red-200',
          dot: 'bg-red-500',
          icon: 'ri-alert-line text-red-500'
        };
      case 'warning':
        return {
          container: 'bg-yellow-50 border border-yellow-200',
          dot: 'bg-yellow-500',
          icon: 'ri-information-line text-yellow-500'
        };
      case 'success':
        return {
          container: 'bg-green-50 border border-green-200',
          dot: 'bg-secondary',
          icon: 'ri-check-line text-secondary'
        };
      default:
        return {
          container: 'bg-gray-50 border border-gray-200',
          dot: 'bg-gray-500',
          icon: 'ri-information-line text-gray-500'
        };
    }
  };

  const newAlertsCount = alerts.filter(alert => 
    alert.type === 'violation' || alert.severity === 'high'
  ).length;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h4 className="font-medium text-gray-900">Recent Alerts</h4>
          {newAlertsCount > 0 && (
            <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
              {newAlertsCount} New
            </span>
          )}
        </div>
        <button 
          className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
          onClick={onViewAllAlerts}
        >
          View All Alerts
        </button>
      </div>
      
      {/* Alerts List */}
      <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <i className="ri-notification-line text-2xl mb-2"></i>
            <p className="text-sm">No recent alerts</p>
          </div>
        ) : (
          alerts.map(alert => {
            const styles = getAlertStyles(alert.type, alert.severity);
            
            return (
              <div 
                key={alert.id} 
                className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 hover:shadow-sm ${styles.container}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 ${styles.dot} rounded-full flex-shrink-0`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {alert.title}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {alert.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  <i className={`${styles.icon} text-sm`}></i>
                  <div className="text-xs text-gray-500 font-mono">
                    {alert.time}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Quick Actions */}
      {alerts.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {alerts.filter(a => a.type === 'violation').length} violations, {' '}
              {alerts.filter(a => a.type === 'success').length} confirmations
            </span>
            <div className="flex items-center space-x-3">
              <button className="hover:text-primary transition-colors">
                <i className="ri-filter-line mr-1"></i>
                Filter
              </button>
              <button className="hover:text-primary transition-colors">
                <i className="ri-download-line mr-1"></i>
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;
