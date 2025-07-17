import React, { useState } from 'react';
import { AlertTriangle, Shield, Clock, CheckCircle, Eye, RefreshCw, AlertCircle } from 'lucide-react';
import { useComplianceDashboard, useComplianceAlerts } from '../../hooks/useCompliance';
import { formatCurrencySync } from '../../utils/pricing';

interface ComplianceAlertsWidgetProps {
  warehouseId?: string;
  className?: string;
  showDetailsLink?: boolean;
  onViewDetails?: () => void;
}

export const ComplianceAlertsWidget: React.FC<ComplianceAlertsWidgetProps> = ({
  warehouseId,
  className = '',
  showDetailsLink = true,
  onViewDetails,
}) => {
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    refetch: refetchDashboard 
  } = useComplianceDashboard(warehouseId);
  
  const { 
    data: alertsData, 
    isLoading: alertsLoading 
  } = useComplianceAlerts({
    warehouse_id: warehouseId,
    status: showActiveOnly ? 'active' : undefined,
    limit: 5,
  });

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'inspection_due':
        return <Clock className="h-4 w-4" />;
      case 'pressure_test_due':
        return <AlertTriangle className="h-4 w-4" />;
      case 'certification_expired':
        return <AlertCircle className="h-4 w-4" />;
      case 'regulatory_violation':
        return <Shield className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getAlertColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getComplianceStatus = () => {
    if (!dashboardData) return { level: 'Unknown', color: 'text-gray-600', percentage: 0 };
    
    const percentage = dashboardData.compliance_percentage;
    if (percentage >= 95) return { level: 'Excellent', color: 'text-green-600', percentage };
    if (percentage >= 85) return { level: 'Good', color: 'text-blue-600', percentage };
    if (percentage >= 70) return { level: 'Fair', color: 'text-yellow-600', percentage };
    return { level: 'Poor', color: 'text-red-600', percentage };
  };

  const complianceStatus = getComplianceStatus();

  if (dashboardLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">Compliance Status</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => refetchDashboard()}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {showDetailsLink && (
              <button
                onClick={onViewDetails}
                className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-800"
              >
                <Eye className="h-4 w-4" />
                <span>View All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-600">Overall Compliance</p>
            <div className="flex items-center space-x-2">
              <span className={`text-2xl font-bold ${complianceStatus.color}`}>
                {complianceStatus.percentage}%
              </span>
              <span className={`text-sm font-medium ${complianceStatus.color}`}>
                {complianceStatus.level}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Cylinders</p>
            <p className="text-lg font-semibold text-gray-900">
              {dashboardData?.summary.total_cylinders || 0}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              complianceStatus.percentage >= 85 ? 'bg-green-500' :
              complianceStatus.percentage >= 70 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${complianceStatus.percentage}%` }}
          ></div>
        </div>

        {/* Compliance Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm text-green-600 font-medium">Compliant</p>
            <p className="text-lg font-bold text-green-700">
              {dashboardData?.summary.compliant_cylinders || 0}
            </p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center mb-1">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <p className="text-sm text-red-600 font-medium">Overdue</p>
            <p className="text-lg font-bold text-red-700">
              {(dashboardData?.summary.overdue_inspections || 0) + (dashboardData?.summary.overdue_pressure_tests || 0)}
            </p>
          </div>
        </div>

        {/* Due Soon Alerts */}
        {(dashboardData?.summary.due_soon_inspections || 0) + (dashboardData?.summary.due_soon_pressure_tests || 0) > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">Due Soon</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              {dashboardData.summary.due_soon_inspections} inspections, {dashboardData.summary.due_soon_pressure_tests} pressure tests
            </p>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      {alertsData && alertsData.alerts.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-900">Recent Alerts</h4>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600">Active only</span>
            </label>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alertsData.alerts.slice(0, 5).map((alert: any) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${getAlertColor(alert.alert_priority)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {getAlertIcon(alert.alert_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wide">
                        {alert.alert_type.replace('_', ' ')}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        alert.status === 'active' ? 'bg-red-100 text-red-800' :
                        alert.status === 'resolved' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm mt-1 truncate">
                      {alert.cylinder_asset?.product?.name} - {alert.cylinder_asset?.serial_number}
                    </p>
                    {alert.due_date && (
                      <p className="text-xs text-gray-600 mt-1">
                        Due: {new Date(alert.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts State */}
      {(!alertsData || alertsData.alerts.length === 0) && !alertsLoading && (
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="text-center py-4">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-2" />
            <p className="text-sm text-gray-600">No active compliance alerts</p>
          </div>
        </div>
      )}
    </div>
  );
}; 