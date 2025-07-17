import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, RotateCcw, AlertTriangle, CheckCircle, Package, DollarSign, Camera, RefreshCw } from 'lucide-react';
import { DamageAssessmentForm } from './DamageAssessmentForm';
import { LostCylinderFeeCalculator } from './LostCylinderFeeCalculator';
import { BrandSelector } from '../brands/BrandSelector';
import { RETURN_STATUS_OPTIONS } from '../../types/deposits';
import { calculateExchangeFee, getBrandReconciliationStatus, getBrandByCode } from '../../types/brands';

interface EmptyReturnCredit {
  id: string;
  order_id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  quantity_returned: number;
  quantity_remaining: number;
  unit_credit_amount: number;
  total_credit_amount: number;
  expected_return_date: string;
  return_deadline: string;
  status: 'pending' | 'partial_returned' | 'fully_returned' | 'expired' | 'cancelled' | 'grace_period';
  remaining_credit_amount: number;
  original_brand?: string;
  accepted_brand?: string;
  brand_reconciliation_status?: 'pending' | 'matched' | 'generic_accepted';
}

interface ReturnProcessingData {
  credit_id: string;
  quantity_returned: number;
  return_reason: string;
  notes?: string;
  condition_at_return: 'good' | 'damaged' | 'unusable';
  cylinder_status: 'good' | 'damaged' | 'lost';
  original_brand?: string;
  accepted_brand?: string;
  brand_reconciliation_status?: 'pending' | 'matched' | 'generic_accepted';
  brand_exchange_fee?: number;
  damage_assessment?: {
    damage_type: string;
    severity: 'minor' | 'moderate' | 'severe';
    repair_cost_estimate?: number;
    photos?: File[];
    description: string;
  };
  lost_cylinder_fee?: {
    base_fee: number;
    replacement_cost: number;
    administrative_fee: number;
    total_fee: number;
    currency_code: string;
  };
  photo_urls?: string[];
}

interface ReturnProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ReturnProcessingData) => void;
  emptyReturnCredit: EmptyReturnCredit | null;
  loading?: boolean;
}

const RETURN_REASONS = [
  { value: 'normal_return', label: 'Normal Return - Customer Exchange' },
  { value: 'customer_cancellation', label: 'Customer Cancellation' },
  { value: 'damaged_cylinder', label: 'Damaged Cylinder' },
  { value: 'wrong_product', label: 'Wrong Product Delivered' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'expired_gas', label: 'Expired Gas' },
  { value: 'other', label: 'Other (specify in notes)' },
];

const CONDITIONS = [
  { value: 'good', label: 'Good Condition', color: 'text-green-600', icon: CheckCircle },
  { value: 'damaged', label: 'Damaged', color: 'text-yellow-600', icon: AlertTriangle },
  { value: 'unusable', label: 'Unusable', color: 'text-red-600', icon: X },
];

const CYLINDER_STATUS_OPTIONS = [
  { value: 'good', label: 'Good', color: 'text-green-600', icon: CheckCircle, description: 'No damage, ready for reuse' },
  { value: 'damaged', label: 'Damaged', color: 'text-yellow-600', icon: AlertTriangle, description: 'Has damage but repairable' },
  { value: 'lost', label: 'Lost/Missing', color: 'text-red-600', icon: X, description: 'Cylinder not returned' },
];

export const ReturnProcessingModal: React.FC<ReturnProcessingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  emptyReturnCredit,
  loading = false,
}) => {
  const [previewCredit, setPreviewCredit] = useState<number>(0);
  const [damageAssessment, setDamageAssessment] = useState<any>(null);
  const [lostCylinderFee, setLostCylinderFee] = useState<any>(null);
  const [brandExchangeFee, setBrandExchangeFee] = useState<number>(0);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ReturnProcessingData>({
    defaultValues: {
      quantity_returned: 1,
      return_reason: 'normal_return',
      condition_at_return: 'good',
      cylinder_status: 'good',
      notes: '',
      original_brand: '',
      accepted_brand: '',
      brand_reconciliation_status: 'pending',
      brand_exchange_fee: 0,
    },
  });

  const watchQuantity = watch('quantity_returned');
  const watchReason = watch('return_reason');
  const watchCylinderStatus = watch('cylinder_status');
  const watchOriginalBrand = watch('original_brand');
  const watchAcceptedBrand = watch('accepted_brand');

  // Calculate brand exchange fee
  React.useEffect(() => {
    if (watchOriginalBrand && watchAcceptedBrand && watchQuantity) {
      const fee = calculateExchangeFee(watchOriginalBrand, watchAcceptedBrand, watchQuantity);
      setBrandExchangeFee(fee);
      setValue('brand_exchange_fee', fee);
      
      const reconciliationStatus = getBrandReconciliationStatus(watchOriginalBrand, watchAcceptedBrand);
      setValue('brand_reconciliation_status', reconciliationStatus);
    }
  }, [watchOriginalBrand, watchAcceptedBrand, watchQuantity, setValue]);

  // Calculate preview credit amount
  React.useEffect(() => {
    if (emptyReturnCredit && watchQuantity) {
      let creditPerUnit = emptyReturnCredit.unit_credit_amount;
      
      // Adjust credit based on cylinder status and damage assessment
      if (watchCylinderStatus === 'damaged' && damageAssessment?.severity) {
        const severityMultiplier = {
          'minor': 0.85,
          'moderate': 0.60,
          'severe': 0.25
        }[damageAssessment.severity] || 1;
        creditPerUnit = creditPerUnit * severityMultiplier;
      } else if (watchCylinderStatus === 'lost') {
        creditPerUnit = 0; // No credit for lost cylinders
      }
      
      setPreviewCredit(creditPerUnit * watchQuantity);
    }
  }, [emptyReturnCredit, watchQuantity, watchCylinderStatus, damageAssessment]);

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen && emptyReturnCredit) {
      reset({
        credit_id: emptyReturnCredit.id,
        quantity_returned: Math.min(1, emptyReturnCredit.quantity_remaining),
        return_reason: 'normal_return',
        condition_at_return: 'good',
        cylinder_status: 'good',
        notes: '',
        original_brand: emptyReturnCredit.original_brand || '',
        accepted_brand: emptyReturnCredit.original_brand || '',
        brand_reconciliation_status: 'matched',
        brand_exchange_fee: 0,
      });
      setDamageAssessment(null);
      setLostCylinderFee(null);
      setBrandExchangeFee(0);
    }
  }, [isOpen, emptyReturnCredit, reset]);

  const handleFormSubmit = (data: ReturnProcessingData) => {
    onSubmit({
      ...data,
      credit_id: emptyReturnCredit?.id || '',
      damage_assessment: damageAssessment,
      lost_cylinder_fee: lostCylinderFee,
      brand_exchange_fee: brandExchangeFee,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilDeadline = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (!isOpen || !emptyReturnCredit) return null;

  const daysUntilDeadline = getDaysUntilDeadline(emptyReturnCredit.return_deadline);
  const isOverdue = daysUntilDeadline < 0;
  const isExpiringSoon = daysUntilDeadline <= 7 && daysUntilDeadline >= 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <RotateCcw className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Process Empty Return</h2>
              <p className="text-sm text-gray-600">
                {emptyReturnCredit.product_name} ({emptyReturnCredit.product_sku})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col max-h-[calc(90vh-200px)]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Current Status */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Current Return Status</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600">Original Quantity:</label>
                  <div className="font-medium text-gray-900">{emptyReturnCredit.quantity}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Already Returned:</label>
                  <div className="font-medium text-gray-900">{emptyReturnCredit.quantity_returned}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Remaining:</label>
                  <div className="font-medium text-blue-600">{emptyReturnCredit.quantity_remaining}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-600">Credit per Unit:</label>
                  <div className="font-medium text-green-600">
                    {formatCurrency(emptyReturnCredit.unit_credit_amount)}
                  </div>
                </div>
              </div>
              
              {/* Deadline Warning */}
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className={`flex items-center space-x-2 ${
                  isOverdue ? 'text-red-600' : isExpiringSoon ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">
                    {isOverdue 
                      ? `Overdue by ${Math.abs(daysUntilDeadline)} days (Deadline: ${formatDate(emptyReturnCredit.return_deadline)})`
                      : isExpiringSoon
                      ? `${daysUntilDeadline} days until deadline (${formatDate(emptyReturnCredit.return_deadline)})`
                      : `Deadline: ${formatDate(emptyReturnCredit.return_deadline)} (${daysUntilDeadline} days)`
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Return Processing Form */}
            <div className="space-y-4">
              {/* Quantity to Return */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity to Return *
                </label>
                <input
                  type="number"
                  min="1"
                  max={emptyReturnCredit.quantity_remaining}
                  {...register('quantity_returned', {
                    required: 'Quantity is required',
                    min: { value: 1, message: 'Minimum quantity is 1' },
                    max: { 
                      value: emptyReturnCredit.quantity_remaining, 
                      message: `Maximum quantity is ${emptyReturnCredit.quantity_remaining}` 
                    },
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.quantity_returned && (
                  <p className="mt-1 text-sm text-red-600">{errors.quantity_returned.message}</p>
                )}
              </div>

              {/* Return Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Return Reason *
                </label>
                <select
                  {...register('return_reason', { required: 'Return reason is required' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  {RETURN_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                {errors.return_reason && (
                  <p className="mt-1 text-sm text-red-600">{errors.return_reason.message}</p>
                )}
              </div>

              {/* Brand Information Section */}
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-5 w-5 text-blue-600" />
                  <h3 className="text-sm font-medium text-gray-900">Brand Information</h3>
                </div>

                {/* Original Brand */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Original Brand (Provided to Customer) *
                  </label>
                  <input
                    type="text"
                    {...register('original_brand', { required: 'Original brand is required' })}
                    placeholder="e.g., TOTAL, SHELL, GENERIC"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.original_brand && (
                    <p className="mt-1 text-sm text-red-600">{errors.original_brand.message}</p>
                  )}
                </div>

                {/* Accepted Brand */}
                <div>
                  <BrandSelector
                    selectedBrand={watchAcceptedBrand}
                    onBrandSelect={(brandCode) => setValue('accepted_brand', brandCode)}
                    originalBrand={watchOriginalBrand}
                    showExchangeFees={true}
                    showGeneric={true}
                    required={true}
                    label="Brand of Returned Cylinder *"
                    quantity={watchQuantity}
                    error={errors.accepted_brand?.message}
                  />
                </div>

                {/* Brand Exchange Summary */}
                {watchOriginalBrand && watchAcceptedBrand && watchOriginalBrand !== watchAcceptedBrand && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Cross-Brand Exchange Detected</span>
                    </div>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>Original: {getBrandByCode(watchOriginalBrand)?.name || watchOriginalBrand}</p>
                      <p>Returned: {getBrandByCode(watchAcceptedBrand)?.name || watchAcceptedBrand}</p>
                      <p className="font-medium">
                        Exchange Fee: {formatCurrency(brandExchangeFee)}
                        {watchQuantity > 1 && (
                          <span className="text-gray-600">
                            {' '}({formatCurrency(brandExchangeFee / watchQuantity)} per cylinder)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cylinder Status Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cylinder Status *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {CYLINDER_STATUS_OPTIONS.map((status) => {
                    const IconComponent = status.icon;
                    return (
                      <label
                        key={status.value}
                        className={`relative flex items-center justify-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                          watchCylinderStatus === status.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          value={status.value}
                          {...register('cylinder_status', { required: 'Cylinder status is required' })}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <IconComponent className={`h-6 w-6 mx-auto mb-1 ${status.color}`} />
                          <span className="text-sm font-medium text-gray-900">{status.label}</span>
                          <p className="text-xs text-gray-500 mt-1">{status.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {errors.cylinder_status && (
                  <p className="mt-1 text-sm text-red-600">{errors.cylinder_status.message}</p>
                )}
              </div>

              {/* Condition at Return */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Condition at Return *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {CONDITIONS.map((condition) => {
                    const IconComponent = condition.icon;
                    return (
                      <label
                        key={condition.value}
                        className="relative flex items-center justify-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="radio"
                          value={condition.value}
                          {...register('condition_at_return', { required: 'Condition is required' })}
                          className="sr-only"
                        />
                        <div className="text-center">
                          <IconComponent className={`h-6 w-6 mx-auto mb-1 ${condition.color}`} />
                          <span className="text-sm font-medium text-gray-900">{condition.label}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {errors.condition_at_return && (
                  <p className="mt-1 text-sm text-red-600">{errors.condition_at_return.message}</p>
                )}
              </div>

              {/* Notes */}
              {(watchReason === 'other' || watchReason === 'damaged_cylinder') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes {watchReason === 'other' ? '*' : '(Optional)'}
                  </label>
                  <textarea
                    rows={3}
                    {...register('notes', {
                      required: watchReason === 'other' ? 'Notes are required for other reasons' : false,
                    })}
                    placeholder={
                      watchReason === 'damaged_cylinder'
                        ? 'Describe the damage...'
                        : 'Please specify the reason...'
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  {errors.notes && (
                    <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
                  )}
                </div>
              )}

              {/* Conditional Forms */}
              {watchCylinderStatus === 'damaged' && (
                <DamageAssessmentForm
                  onAssessmentChange={setDamageAssessment}
                  disabled={loading}
                />
              )}

              {watchCylinderStatus === 'lost' && emptyReturnCredit && (
                <LostCylinderFeeCalculator
                  cylinderInfo={{
                    capacity_l: emptyReturnCredit.product?.capacity_l || 0,
                    product_name: emptyReturnCredit.product_name,
                    unit_deposit: emptyReturnCredit.unit_credit_amount,
                    quantity: watchQuantity,
                  }}
                  onFeeCalculated={setLostCylinderFee}
                  currencyCode={emptyReturnCredit.currency_code}
                />
              )}

              {/* Credit Preview */}
              <div className={`${
                watchCylinderStatus === 'lost' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
              } border rounded-lg p-4`}>
                <div className="space-y-3">
                  {/* Main Credit/Fee Amount */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <DollarSign className={`h-5 w-5 ${
                        watchCylinderStatus === 'lost' ? 'text-red-600' : 'text-green-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        watchCylinderStatus === 'lost' ? 'text-red-900' : 'text-green-900'
                      }`}>
                        {watchCylinderStatus === 'lost' ? 'Fee to Charge:' : 'Credit to Apply:'}
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${
                      watchCylinderStatus === 'lost' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {watchCylinderStatus === 'lost' ? '-' : '+'}
                      {formatCurrency(watchCylinderStatus === 'lost' && lostCylinderFee ? 
                        lostCylinderFee.total_fee * watchQuantity : previewCredit)}
                    </span>
                  </div>

                  {/* Brand Exchange Fee */}
                  {brandExchangeFee > 0 && watchCylinderStatus !== 'lost' && (
                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium text-yellow-900">
                            Brand Exchange Fee:
                          </span>
                        </div>
                        <span className="text-sm font-bold text-yellow-600">
                          -{formatCurrency(brandExchangeFee)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Net Amount */}
                  {brandExchangeFee > 0 && watchCylinderStatus !== 'lost' && (
                    <div className="pt-2 border-t border-gray-300">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">
                          Net Amount:
                        </span>
                        <span className="text-lg font-bold text-blue-600">
                          {formatCurrency(Math.max(0, previewCredit - brandExchangeFee))}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p className={`text-xs ${
                    watchCylinderStatus === 'lost' ? 'text-red-700' : 'text-green-700'
                  }`}>
                    {watchCylinderStatus === 'lost' 
                      ? 'This fee will be charged to the customer\'s account for lost cylinders.'
                      : watchCylinderStatus === 'damaged' && damageAssessment
                      ? `Credit adjusted based on ${damageAssessment.severity} damage assessment.`
                      : brandExchangeFee > 0
                      ? 'Credit amount minus brand exchange fee will be applied to customer account.'
                      : 'This credit will be applied to the customer\'s account and can be used on future orders.'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              Processing {watchQuantity} of {emptyReturnCredit.quantity_remaining} remaining cylinders
            </div>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <Package className="h-4 w-4" />
                <span>{loading ? 'Processing...' : 'Process Return'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};