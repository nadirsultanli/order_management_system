import React, { useState } from 'react';
import { Gauge, AlertTriangle, Info } from 'lucide-react';

interface FillPercentageSelectorProps {
  value: number;
  onChange: (percentage: number, notes?: string) => void;
  disabled?: boolean;
  showSurcharge?: boolean;
  onNotesChange?: (notes: string) => void;
  notes?: string;
}

export const FillPercentageSelector: React.FC<FillPercentageSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showSurcharge = false,
  onNotesChange,
  notes = ''
}) => {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [localNotes, setLocalNotes] = useState(notes);

  const presetPercentages = [25, 33, 50, 67, 75, 90, 100];
  const isPartialFill = value < 100;
  const isMinimumFill = value < 25;

  const handlePercentageChange = (percentage: number) => {
    if (disabled) return;
    
    // Ensure minimum 25% fill
    const validatedPercentage = Math.max(25, Math.min(100, percentage));
    onChange(validatedPercentage, localNotes);
    
    // Show notes input for partial fills
    if (validatedPercentage < 100 && !showNotesInput) {
      setShowNotesInput(true);
    } else if (validatedPercentage === 100) {
      setShowNotesInput(false);
      setLocalNotes('');
      onNotesChange?.('');
    }
  };

  const handleNotesChange = (newNotes: string) => {
    setLocalNotes(newNotes);
    onNotesChange?.(newNotes);
    onChange(value, newNotes);
  };

  const getFillColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 75) return 'text-blue-600';
    if (percentage >= 50) return 'text-yellow-600';
    if (percentage >= 25) return 'text-orange-600';
    return 'text-red-600';
  };

  const getFillBgColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-green-50 border-green-200';
    if (percentage >= 75) return 'bg-blue-50 border-blue-200';
    if (percentage >= 50) return 'bg-yellow-50 border-yellow-200';
    if (percentage >= 25) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className={`space-y-3 p-3 border rounded-lg ${getFillBgColor(value)}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Gauge className={`h-4 w-4 ${getFillColor(value)}`} />
          <span className="text-sm font-medium text-gray-700">Fill Percentage</span>
          {isPartialFill && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              Partial Fill
            </span>
          )}
        </div>
        <div className={`text-lg font-bold ${getFillColor(value)}`}>
          {value}%
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="grid grid-cols-4 gap-2">
        {presetPercentages.map((percentage) => (
          <button
            key={percentage}
            type="button"
            onClick={() => handlePercentageChange(percentage)}
            disabled={disabled}
            className={`px-3 py-2 text-sm rounded-md border transition-colors ${
              value === percentage
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {percentage}%
          </button>
        ))}
      </div>

      {/* Custom Input */}
      <div className="flex items-center space-x-2">
        <label className="text-sm text-gray-600 whitespace-nowrap">Custom:</label>
        <input
          type="number"
          min="25"
          max="100"
          step="1"
          value={value}
          onChange={(e) => handlePercentageChange(parseInt(e.target.value) || 25)}
          disabled={disabled}
          className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-500">%</span>
      </div>

      {/* Minimum Fill Warning */}
      {isMinimumFill && (
        <div className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded">
          <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
          <div className="text-sm text-red-700">
            <div className="font-medium">Minimum fill requirement</div>
            <div>Gas cylinders must be filled to at least 25% capacity.</div>
          </div>
        </div>
      )}

      {/* Partial Fill Information */}
      {isPartialFill && value >= 25 && (
        <div className="flex items-start space-x-2 p-2 bg-blue-50 border border-blue-200 rounded">
          <Info className="h-4 w-4 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-700">
            <div className="font-medium">Partial Fill Pricing</div>
            <div>Gas pricing will be pro-rated to {value}%. Cylinder deposit remains at full price.</div>
            {showSurcharge && (
              <div className="mt-1 text-blue-600">A partial fill surcharge may apply.</div>
            )}
          </div>
        </div>
      )}

      {/* Notes Input for Partial Fills */}
      {(showNotesInput || notes) && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Partial Fill Notes
          </label>
          <textarea
            value={localNotes}
            onChange={(e) => handleNotesChange(e.target.value)}
            disabled={disabled}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Reason for partial fill (e.g., customer request, cylinder condition, etc.)"
          />
        </div>
      )}

      {/* Visual Fill Indicator */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              value >= 100 ? 'bg-green-500' :
              value >= 75 ? 'bg-blue-500' :
              value >= 50 ? 'bg-yellow-500' :
              value >= 25 ? 'bg-orange-500' :
              'bg-red-500'
            }`}
            style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          />
        </div>
      </div>
    </div>
  );
};