import React from 'react';
import { Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { TripLoadingProgress } from '../../types/trip';

interface LoadingProgressDisplayProps {
  progress: TripLoadingProgress;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingProgressDisplay: React.FC<LoadingProgressDisplayProps> = ({
  progress,
  showDetails = true,
  size = 'md'
}) => {
  const {
    total_orders,
    orders_loaded,
    orders_short_loaded,
    orders_not_loaded,
    total_weight_required,
    total_weight_loaded,
    total_cylinders_required,
    total_cylinders_loaded,
    completion_percentage,
    loading_status
  } = progress;

  const getStatusColor = () => {
    switch (loading_status) {
      case 'not_started':
        return 'bg-gray-400';
      case 'in_progress':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'completed_with_shorts':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (loading_status) {
      case 'not_started':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <Package className="h-4 w-4 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'completed_with_shorts':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (loading_status) {
      case 'not_started':
        return 'Not Started';
      case 'in_progress':
        return 'Loading in Progress';
      case 'completed':
        return 'Loading Completed';
      case 'completed_with_shorts':
        return 'Completed with Short Loads';
      default:
        return 'Unknown Status';
    }
  };

  const progressBarHeight = size === 'sm' ? 'h-2' : size === 'lg' ? 'h-4' : 'h-3';
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-lg' : 'text-base';
  const detailTextSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-3">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-1 rounded-full ${getStatusColor()}`}>
            <div className="text-white">
              {getStatusIcon()}
            </div>
          </div>
          <span className={`font-medium ${textSize}`}>
            {getStatusText()}
          </span>
        </div>
        <span className={`font-bold ${textSize}`}>
          {completion_percentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className={`w-full bg-gray-200 rounded-full ${progressBarHeight}`}>
        <div
          className={`${progressBarHeight} rounded-full transition-all duration-300 ${getStatusColor()}`}
          style={{ width: `${Math.min(completion_percentage, 100)}%` }}
        />
      </div>

      {showDetails && (
        <div className="space-y-3">
          {/* Orders Progress */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className={`font-medium text-gray-700 ${detailTextSize}`}>Orders Progress</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className={`text-green-600 ${detailTextSize}`}>Loaded:</span>
                  <span className={`font-medium ${detailTextSize}`}>{orders_loaded}</span>
                </div>
                {orders_short_loaded > 0 && (
                  <div className="flex justify-between">
                    <span className={`text-yellow-600 ${detailTextSize}`}>Short Loaded:</span>
                    <span className={`font-medium ${detailTextSize}`}>{orders_short_loaded}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className={`text-gray-600 ${detailTextSize}`}>Pending:</span>
                  <span className={`font-medium ${detailTextSize}`}>{orders_not_loaded}</span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className={`font-medium ${detailTextSize}`}>Total:</span>
                  <span className={`font-bold ${detailTextSize}`}>{total_orders}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className={`font-medium text-gray-700 ${detailTextSize}`}>Capacity Utilization</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className={`text-gray-600 ${detailTextSize}`}>Weight:</span>
                  <span className={`font-medium ${detailTextSize}`}>
                    {total_weight_loaded.toFixed(1)} / {total_weight_required.toFixed(1)} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={`text-gray-600 ${detailTextSize}`}>Cylinders:</span>
                  <span className={`font-medium ${detailTextSize}`}>
                    {total_cylinders_loaded} / {total_cylinders_required}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1">
                  <span className={`font-medium ${detailTextSize}`}>Efficiency:</span>
                  <span className={`font-bold ${detailTextSize}`}>
                    {total_weight_required && total_weight_required > 0 
                      ? ((total_weight_loaded / total_weight_required) * 100).toFixed(1)
                      : '0.0'
                    }%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Messages */}
          {orders_short_loaded > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className={`text-yellow-800 font-medium ${detailTextSize}`}>
                  {orders_short_loaded} order{orders_short_loaded !== 1 ? 's' : ''} short loaded
                </span>
              </div>
            </div>
          )}

          {loading_status === 'not_started' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className={`text-blue-800 ${detailTextSize}`}>
                  Ready to start loading {total_orders} orders
                </span>
              </div>
            </div>
          )}

          {loading_status === 'completed' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className={`text-green-800 ${detailTextSize}`}>
                  All orders loaded successfully
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};