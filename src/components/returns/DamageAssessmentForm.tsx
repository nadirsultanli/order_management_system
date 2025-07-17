import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Camera, Upload, X, AlertTriangle, DollarSign } from 'lucide-react';
import { DAMAGE_TYPES, DAMAGE_SEVERITY_OPTIONS } from '../../types/deposits';

interface DamageAssessment {
  damage_type: string;
  severity: 'minor' | 'moderate' | 'severe';
  repair_cost_estimate?: number;
  photos?: File[];
  description: string;
}

interface DamageAssessmentFormProps {
  onAssessmentChange: (assessment: DamageAssessment | null) => void;
  initialData?: DamageAssessment;
  disabled?: boolean;
}

export const DamageAssessmentForm: React.FC<DamageAssessmentFormProps> = ({
  onAssessmentChange,
  initialData,
  disabled = false,
}) => {
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>(initialData?.photos || []);
  const [photoPreview, setPhotoPreview] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<DamageAssessment>({
    defaultValues: {
      damage_type: initialData?.damage_type || '',
      severity: initialData?.severity || 'minor',
      repair_cost_estimate: initialData?.repair_cost_estimate || undefined,
      description: initialData?.description || '',
      photos: initialData?.photos || [],
    },
  });

  const watchSeverity = watch('severity');
  const watchDamageType = watch('damage_type');

  // Generate preview URLs for selected photos
  React.useEffect(() => {
    const urls = selectedPhotos.map(file => URL.createObjectURL(file));
    setPhotoPreview(urls);
    
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [selectedPhotos]);

  // Update parent when form data changes
  React.useEffect(() => {
    const subscription = watch((data) => {
      if (data.damage_type && data.severity && data.description) {
        onAssessmentChange({
          damage_type: data.damage_type,
          severity: data.severity as 'minor' | 'moderate' | 'severe',
          repair_cost_estimate: data.repair_cost_estimate,
          description: data.description,
          photos: selectedPhotos,
        });
      } else {
        onAssessmentChange(null);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [watch, selectedPhotos, onAssessmentChange]);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const newPhotos = [...selectedPhotos, ...files].slice(0, 5); // Limit to 5 photos
      setSelectedPhotos(newPhotos);
      setValue('photos', newPhotos);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = selectedPhotos.filter((_, i) => i !== index);
    setSelectedPhotos(newPhotos);
    setValue('photos', newPhotos);
  };

  const getSeverityConfig = (severity: string) => {
    const config = DAMAGE_SEVERITY_OPTIONS.find(option => option.value === severity);
    return config || DAMAGE_SEVERITY_OPTIONS[0];
  };

  const severityConfig = getSeverityConfig(watchSeverity);

  return (
    <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <h3 className="text-lg font-medium text-yellow-900">Damage Assessment</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Damage Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Damage Type *
          </label>
          <select
            {...register('damage_type', { required: 'Damage type is required' })}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 disabled:bg-gray-100"
          >
            <option value="">Select damage type...</option>
            {DAMAGE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.damage_type && (
            <p className="mt-1 text-sm text-red-600">{errors.damage_type.message}</p>
          )}
        </div>

        {/* Severity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Damage Severity *
          </label>
          <div className="space-y-2">
            {DAMAGE_SEVERITY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register('severity', { required: 'Severity is required' })}
                  disabled={disabled}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{option.label}</span>
                    <span className="text-sm text-green-600 font-medium">
                      {option.refund_percentage}% refund
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
          {errors.severity && (
            <p className="mt-1 text-sm text-red-600">{errors.severity.message}</p>
          )}
        </div>
      </div>

      {/* Repair Cost Estimate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Repair Cost Estimate (Optional)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            {...register('repair_cost_estimate', {
              min: { value: 0, message: 'Cost must be positive' },
            })}
            disabled={disabled}
            placeholder="0.00"
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 disabled:bg-gray-100"
          />
        </div>
        {errors.repair_cost_estimate && (
          <p className="mt-1 text-sm text-red-600">{errors.repair_cost_estimate.message}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Damage Description *
        </label>
        <textarea
          rows={3}
          {...register('description', {
            required: 'Description is required',
            minLength: { value: 10, message: 'Description must be at least 10 characters' },
          })}
          disabled={disabled}
          placeholder="Describe the damage in detail..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500 disabled:bg-gray-100"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Damage Photos (Up to 5 photos)
        </label>
        
        {!disabled && (
          <div className="mb-3">
            <label className="flex items-center justify-center px-4 py-2 border border-dashed border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
              <Upload className="h-5 w-5 text-gray-400 mr-2" />
              <span className="text-sm text-gray-600">Upload Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={selectedPhotos.length >= 5}
              />
            </label>
          </div>
        )}

        {/* Photo Preview */}
        {selectedPhotos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photoPreview.map((url, index) => (
              <div key={index} className="relative">
                <img
                  src={url}
                  alt={`Damage ${index + 1}`}
                  className="w-full h-24 object-cover rounded-md"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Impact Summary */}
      <div className="bg-white border border-yellow-300 rounded-lg p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Assessment Impact</h4>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Refund Percentage:</span>
            <span className="font-medium text-green-600">{severityConfig.refund_percentage}%</span>
          </div>
          <div className="text-xs text-gray-500">{severityConfig.description}</div>
        </div>
      </div>
    </div>
  );
};