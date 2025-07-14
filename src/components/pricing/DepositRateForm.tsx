import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { DepositRate, CreateDepositRateData } from '../../types/deposits';
import { CurrencySelect } from '../ui/CurrencySelect';

interface DepositRateFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDepositRateData) => Promise<void>;
  depositRate?: DepositRate;
  title: string;
}

export const DepositRateForm: React.FC<DepositRateFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  depositRate,
  title,
}) => {
  const [formData, setFormData] = useState<CreateDepositRateData>({
    capacity_l: 0,
    deposit_amount: 0,
    currency_code: 'KES',
    effective_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (depositRate) {
      setFormData({
        capacity_l: depositRate.capacity_l,
        deposit_amount: depositRate.deposit_amount,
        currency_code: depositRate.currency_code,
        effective_date: depositRate.effective_date.split('T')[0],
        end_date: depositRate.end_date ? depositRate.end_date.split('T')[0] : '',
        notes: depositRate.notes || '',
      });
    } else {
      setFormData({
        capacity_l: 0,
        deposit_amount: 0,
        currency_code: 'KES',
        effective_date: new Date().toISOString().split('T')[0],
        end_date: '',
        notes: '',
      });
    }
    setErrors({});
  }, [depositRate, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.capacity_l || formData.capacity_l <= 0) {
      newErrors.capacity_l = 'Capacity must be greater than 0';
    }

    if (!formData.deposit_amount || formData.deposit_amount < 0) {
      newErrors.deposit_amount = 'Deposit amount must be 0 or greater';
    }

    if (!formData.currency_code) {
      newErrors.currency_code = 'Currency code is required';
    }

    if (!formData.effective_date) {
      newErrors.effective_date = 'Effective date is required';
    }

    if (formData.end_date && formData.end_date <= formData.effective_date) {
      newErrors.end_date = 'End date must be after effective date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submitData = {
        ...formData,
        end_date: formData.end_date || undefined,
        notes: formData.notes || undefined,
      };
      
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CreateDepositRateData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const commonCapacities = [5, 10, 15, 20, 25, 30, 45, 50, 60];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cylinder Capacity (Liters) *
            </label>
            <div className="space-y-2">
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.capacity_l || ''}
                onChange={(e) => handleInputChange('capacity_l', parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                  errors.capacity_l ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Enter capacity in liters"
              />
              {errors.capacity_l && (
                <p className="text-red-600 text-sm flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {errors.capacity_l}
                </p>
              )}
              {/* Quick selection buttons */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Common sizes:</span>
                {commonCapacities.map((capacity) => (
                  <button
                    key={capacity}
                    type="button"
                    onClick={() => handleInputChange('capacity_l', capacity)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      formData.capacity_l === capacity
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {capacity}L
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Deposit Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deposit Amount *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit_amount || ''}
              onChange={(e) => handleInputChange('deposit_amount', parseFloat(e.target.value) || 0)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.deposit_amount ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="0.00"
            />
            {errors.deposit_amount && (
              <p className="text-red-600 text-sm flex items-center mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.deposit_amount}
              </p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency *
            </label>
            <CurrencySelect
              value={formData.currency_code}
              onChange={(value) => handleInputChange('currency_code', value)}
              className={`w-full ${
                errors.currency_code ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Select currency"
            />
            {errors.currency_code && (
              <p className="text-red-600 text-sm flex items-center mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.currency_code}
              </p>
            )}
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Effective Date *
            </label>
            <input
              type="date"
              value={formData.effective_date}
              onChange={(e) => handleInputChange('effective_date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.effective_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.effective_date && (
              <p className="text-red-600 text-sm flex items-center mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.effective_date}
              </p>
            )}
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => handleInputChange('end_date', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                errors.end_date ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.end_date && (
              <p className="text-red-600 text-sm flex items-center mt-1">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.end_date}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Any additional notes about this deposit rate..."
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSubmitting ? 'Saving...' : (depositRate ? 'Update Rate' : 'Create Rate')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};