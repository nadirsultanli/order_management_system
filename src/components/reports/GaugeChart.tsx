import React from 'react';

interface GaugeChartProps {
  value: number;
  target: number;
  title: string;
  unit?: string;
  size?: number;
  className?: string;
  lowerIsBetter?: boolean; // For metrics where lower values are better (e.g., return days)
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  target,
  title,
  unit = '%',
  size = 150,
  className = '',
  lowerIsBetter = false,
}) => {
  // Calculate percentage and angles
  let percentage: number;
  let targetPercentage: number;
  
  if (lowerIsBetter) {
    // For lower-is-better metrics, invert the scale
    // Map value to 0-100 where target = 100%, and 2*target = 0%
    const maxValue = target * 2;
    percentage = Math.min(100, Math.max(0, ((maxValue - value) / maxValue) * 100));
    targetPercentage = Math.min(100, Math.max(0, ((maxValue - target) / maxValue) * 100));
  } else {
    // For higher-is-better metrics, use direct percentage
    const maxValue = Math.max(target * 1.2, value * 1.1, 100);
    percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
    targetPercentage = Math.min(100, Math.max(0, (target / maxValue) * 100));
  }
  
  // Convert to angle (180 degrees for semicircle)
  const angle = (percentage / 100) * 180;
  const targetAngle = (targetPercentage / 100) * 180;
  
  // SVG dimensions
  const radius = size / 2 - 10;
  const center = size / 2;
  const strokeWidth = 12;
  
  // Calculate path for arc
  const getArcPath = (endAngle: number) => {
    const x1 = center + radius * Math.cos(Math.PI);
    const y1 = center + radius * Math.sin(Math.PI);
    const x2 = center + radius * Math.cos(Math.PI - (endAngle * Math.PI) / 180);
    const y2 = center + radius * Math.sin(Math.PI - (endAngle * Math.PI) / 180);
    
    const largeArcFlag = endAngle > 90 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${x2} ${y2}`;
  };
  
  // Determine color based on performance
  const getColor = () => {
    if (lowerIsBetter) {
      // For metrics where lower is better (e.g., return days)
      if (value <= target) return '#10B981'; // green-500
      if (value <= target * 1.2) return '#F59E0B'; // amber-500
      return '#EF4444'; // red-500
    } else {
      // For metrics where higher is better (e.g., return rate, fulfillment)
      if (value >= target) return '#10B981'; // green-500
      if (value >= target * 0.8) return '#F59E0B'; // amber-500
      return '#EF4444'; // red-500
    }
  };
  
  const color = getColor();
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">{title}</h3>
      
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
          <svg width={size} height={size / 2 + 20} className="overflow-visible">
            {/* Background arc */}
            <path
              d={getArcPath(180)}
              fill="none"
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            
            {/* Target indicator line */}
            <line
              x1={center + (radius - strokeWidth/2) * Math.cos(Math.PI - (targetAngle * Math.PI) / 180)}
              y1={center + (radius - strokeWidth/2) * Math.sin(Math.PI - (targetAngle * Math.PI) / 180)}
              x2={center + (radius + strokeWidth/2) * Math.cos(Math.PI - (targetAngle * Math.PI) / 180)}
              y2={center + (radius + strokeWidth/2) * Math.sin(Math.PI - (targetAngle * Math.PI) / 180)}
              stroke="#6B7280"
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/* Value arc */}
            <path
              d={getArcPath(angle)}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            
            {/* Value indicator dot */}
            <circle
              cx={center + radius * Math.cos(Math.PI - (angle * Math.PI) / 180)}
              cy={center + radius * Math.sin(Math.PI - (angle * Math.PI) / 180)}
              r="6"
              fill={color}
              className="drop-shadow-sm"
            />
          </svg>
          
          {/* Center value display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
            <div className="text-2xl font-bold" style={{ color }}>
              {value.toFixed(1)}{unit}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Target: {target}{unit}
            </div>
          </div>
        </div>
        
        {/* Performance status */}
        <div className="mt-4 text-center">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            lowerIsBetter 
              ? (value <= target ? 'bg-green-100 text-green-800' : value <= target * 1.2 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800')
              : (value >= target ? 'bg-green-100 text-green-800' : value >= target * 0.8 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800')
          }`}>
            {lowerIsBetter 
              ? (value <= target ? '✓ On Target' : value <= target * 1.2 ? '⚠ Above Target' : '✗ Critical')
              : (value >= target ? '✓ On Target' : value >= target * 0.8 ? '⚠ Below Target' : '✗ Critical')
            }
          </div>
          
          <div className="text-xs text-gray-500 mt-2">
            {lowerIsBetter 
              ? (value <= target 
                  ? `${(target - value).toFixed(1)}${unit} under target`
                  : `+${(value - target).toFixed(1)}${unit} over target`)
              : (value >= target 
                  ? `+${(value - target).toFixed(1)}${unit} above target`
                  : `${(target - value).toFixed(1)}${unit} below target`)
            }
          </div>
        </div>
      </div>
    </div>
  );
};