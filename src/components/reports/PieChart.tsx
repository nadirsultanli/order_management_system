import React from 'react';
import { PieChartData } from '../../types/reports';
import { formatCurrencySync } from '../../utils/pricing';

interface PieChartProps {
  data: PieChartData[];
  title: string;
  className?: string;
  size?: number;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  className = '',
  size = 200,
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

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  const center = radius;
  
  // Generate SVG path for each slice
  const generateSlices = () => {
    let cumulativePercentage = 0;
    
    return data.map((item, index) => {
      const percentage = total > 0 ? (item.value / total) * 100 : 0;
      const startAngle = (cumulativePercentage / 100) * 360;
      const endAngle = ((cumulativePercentage + percentage) / 100) * 360;
      
      cumulativePercentage += percentage;
      
      // Convert angles to radians
      const startAngleRad = (startAngle - 90) * (Math.PI / 180);
      const endAngleRad = (endAngle - 90) * (Math.PI / 180);
      
      // Calculate coordinates
      const x1 = center + radius * 0.8 * Math.cos(startAngleRad);
      const y1 = center + radius * 0.8 * Math.sin(startAngleRad);
      const x2 = center + radius * 0.8 * Math.cos(endAngleRad);
      const y2 = center + radius * 0.8 * Math.sin(endAngleRad);
      
      const largeArcFlag = percentage > 50 ? 1 : 0;
      
      const pathData = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius * 0.8} ${radius * 0.8} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
      
      return {
        pathData,
        fill: item.fill,
        percentage: Math.round(percentage),
        item,
      };
    });
  };

  const slices = generateSlices();

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      <div className="flex flex-col lg:flex-row items-center justify-center space-y-6 lg:space-y-0 lg:space-x-8">
        {/* SVG Pie Chart */}
        <div className="relative">
          <svg width={size} height={size} className="transform hover:scale-105 transition-transform">
            {slices.map((slice, index) => (
              <g key={index}>
                <path
                  d={slice.pathData}
                  fill={slice.fill}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
                  }}
                >
                  <title>{`${slice.item.name}: ${slice.percentage}% (${formatCurrencySync(slice.item.value)})`}</title>
                </path>
              </g>
            ))}
            
            {/* Center circle for donut effect */}
            <circle
              cx={center}
              cy={center}
              r={radius * 0.4}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            
            {/* Total value in center */}
            <text
              x={center}
              y={center - 8}
              textAnchor="middle"
              className="text-sm font-semibold fill-gray-900"
            >
              Total
            </text>
            <text
              x={center}
              y={center + 8}
              textAnchor="middle"
              className="text-xs fill-gray-600"
            >
              {formatCurrencySync(total)}
            </text>
          </svg>
        </div>
        
        {/* Legend */}
        <div className="space-y-3">
          {data.map((item, index) => {
            const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
            
            return (
              <div key={index} className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.fill }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrencySync(item.value)} ({percentage}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {data.length}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrencySync(total)}
            </div>
            <div className="text-sm text-gray-600">Total Value</div>
          </div>
        </div>
      </div>
    </div>
  );
};