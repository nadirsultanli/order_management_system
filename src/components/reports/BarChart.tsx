import React from 'react';
import { BarChartData } from '../../types/reports';
import { formatCurrencySync } from '../../utils/pricing';

interface BarChartProps {
  data: BarChartData[];
  title: string;
  className?: string;
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  className = '',
  height = 300,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.total_value));
  const barWidth = Math.max(60, Math.min(120, (100 / data.length) - 10));

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="flex items-end justify-center space-x-2 mb-4" style={{ height: `${height}px` }}>
        {data.map((item, index) => {
          const fullHeight = maxValue > 0 ? (item.full_value / maxValue) * (height - 40) : 0;
          const emptyHeight = maxValue > 0 ? (item.empty_value / maxValue) * (height - 40) : 0;
          
          return (
            <div key={index} className="flex flex-col items-center">
              {/* Bar container */}
              <div className="relative flex flex-col justify-end" style={{ height: `${height - 40}px`, width: `${barWidth}px` }}>
                {/* Empty cylinders bar (bottom) */}
                {item.empty_value > 0 && (
                  <div
                    className="bg-gray-400 rounded-t-sm"
                    style={{ height: `${emptyHeight}px` }}
                    title={`Empty: ${formatCurrencySync(item.empty_value)}`}
                  />
                )}
                
                {/* Full cylinders bar (top) */}
                {item.full_value > 0 && (
                  <div
                    className="bg-blue-500 rounded-t-sm"
                    style={{ height: `${fullHeight}px` }}
                    title={`Full: ${formatCurrencySync(item.full_value)}`}
                  />
                )}
                
                {/* Value label on hover */}
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {formatCurrencySync(item.total_value)}
                </div>
              </div>
              
              {/* Warehouse name */}
              <div className="mt-2 text-xs text-gray-600 text-center font-medium" style={{ width: `${barWidth}px` }}>
                <div className="truncate" title={item.warehouse_name}>
                  {item.warehouse_name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600">Full Cylinders</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-gray-400 rounded"></div>
          <span className="text-sm text-gray-600">Empty Cylinders</span>
        </div>
      </div>
      
      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {data.length}
            </div>
            <div className="text-sm text-gray-600">Warehouses</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-blue-600">
              {formatCurrencySync(data.reduce((sum, item) => sum + item.full_value, 0))}
            </div>
            <div className="text-sm text-gray-600">Full Value</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-600">
              {formatCurrencySync(data.reduce((sum, item) => sum + item.empty_value, 0))}
            </div>
            <div className="text-sm text-gray-600">Empty Value</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-600">
              {formatCurrencySync(data.reduce((sum, item) => sum + item.total_value, 0))}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>
      </div>
    </div>
  );
};