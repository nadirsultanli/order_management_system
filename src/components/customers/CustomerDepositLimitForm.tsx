import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, DollarSign, AlertTriangle, Info, Shield, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { useUpdateCustomerDepositLimit, useCustomerDepositAnalysis } from '../../hooks/useCustomers';
import { formatCurrencySync } from '../../utils/pricing';

interface CustomerDepositLimitFormProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  currentLimit?: number | null;
  currentExposure?: number;
  alertsEnabled?: boolean;
}

interface FormData {
  deposit_limit: number | null;
  deposit_limit_alerts_enabled: boolean;
  notes: string;
}

export const CustomerDepositLimitForm: React.FC<CustomerDepositLimitFormProps> = ({
  isOpen,
  onClose,
  customerId,
  currentLimit,
  currentExposure = 0,
  alertsEnabled = true,
}) => {
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const { 
    data: analysisData, 
    isLoading: analysisLoading,
    refetch: refetchAnalysis 
  } = useCustomerDepositAnalysis(customerId);
  
  const updateDepositLimit = useUpdateCustomerDepositLimit();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      deposit_limit: currentLimit,
      deposit_limit_alerts_enabled: alertsEnabled,
      notes: '',
    },
  });

  const watchedLimit = watch('deposit_limit');
  const watchedAlertsEnabled = watch('deposit_limit_alerts_enabled');

  useEffect(() => {
    if (isOpen) {
      reset({
        deposit_limit: currentLimit,
        deposit_limit_alerts_enabled: alertsEnabled,
        notes: '',
      });
      refetchAnalysis();
    }
  }, [isOpen, currentLimit, alertsEnabled, reset, refetchAnalysis]);

  const onSubmit = async (data: FormData) => {
    try {
      await updateDepositLimit.mutateAsync({
        customer_id: customerId,
        deposit_limit: data.deposit_limit,
        deposit_limit_alerts_enabled: data.deposit_limit_alerts_enabled,
        notes: data.notes,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update deposit limit:', error);
    }
  };

  const calculateUtilization = () => {
    if (!watchedLimit || watchedLimit <= 0) return 0;
    return Math.round((currentExposure / watchedLimit) * 100);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 100) return 'text-red-600';
    if (utilization >= 80) return 'text-yellow-600';
    if (utilization >= 60) return 'text-blue-600';
    return 'text-green-600';
  };

  const getRiskLevel = () => {
    const utilization = calculateUtilization();
    if (utilization >= 100) return { level: 'Critical', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200' };
    if (utilization >= 80) return { level: 'High', color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200' };
    if (utilization >= 60) return { level: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200' };
    return { level: 'Low', color: 'text-green-600', bgColor: 'bg-green-50 border-green-200' };
  };

  if (!isOpen) return null;

  const utilization = calculateUtilization();
  const risk = getRiskLevel();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-6 w-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">
                Manage Deposit Limit
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Form */}
            <div className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Current Status Card */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Current Status</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Exposure:</span>
                      <span className="text-sm font-medium">{formatCurrencySync(currentExposure)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Current Limit:</span>
                      <span className="text-sm font-medium">
                        {currentLimit ? formatCurrencySync(currentLimit) : 'No limit set'}
                      </span>
                    </div>
                    {currentLimit && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Utilization:</span>
                        <span className={`text-sm font-medium ${getUtilizationColor(utilization)}`}>
                          {utilization}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk Level Indicator */}
                {watchedLimit && (
                  <div className={`rounded-lg p-4 border ${risk.bgColor}`}>
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className={`h-5 w-5 ${risk.color}`} />
                      <span className={`text-sm font-medium ${risk.color}`}>
                        Risk Level: {risk.level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {utilization >= 100 && 'Customer has exceeded their deposit limit'}
                      {utilization >= 80 && utilization < 100 && 'Customer is approaching their deposit limit'}
                      {utilization >= 60 && utilization < 80 && 'Customer deposit exposure is moderate'}
                      {utilization < 60 && 'Customer deposit exposure is within safe limits'}
                    </p>
                  </div>
                )}

                {/* Deposit Limit Field */}
                <div>
                  <label htmlFor="deposit_limit" className="block text-sm font-medium text-gray-700 mb-2">
                    Deposit Limit (KES)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      id="deposit_limit"
                      min="0"
                      step="100"
                      {...register('deposit_limit', {
                        valueAsNumber: true,
                        validate: (value) => {
                          if (value !== null && value < 0) return 'Deposit limit must be positive';
                          if (value !== null && value < currentExposure) {
                            return `Deposit limit cannot be less than current exposure (${formatCurrencySync(currentExposure)})`;
                          }
                          return true;
                        }
                      })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter limit amount or leave empty for no limit"
                    />
                  </div>
                  {errors.deposit_limit && (
                    <p className="mt-1 text-sm text-red-600">{errors.deposit_limit.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Set to empty for unlimited deposit exposure. Minimum recommended: {formatCurrencySync(currentExposure * 1.5)}
                  </p>
                </div>

                {/* Alerts Toggle */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Info className="h-5 w-5 text-blue-600" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-900">Limit Enforcement</h4>
                      <p className="text-sm text-blue-700">Block orders when limit is exceeded</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('deposit_limit_alerts_enabled')}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Notes Field */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    {...register('notes')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add any notes about this deposit limit change..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateDepositLimit.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {updateDepositLimit.isLoading ? 'Updating...' : 'Update Limit'}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column - Analysis */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Deposit Analysis</h3>
                <button
                  onClick={() => setShowAnalysis(!showAnalysis)}
                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  {showAnalysis ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{showAnalysis ? 'Hide' : 'Show'} Details</span>
                </button>
              </div>

              {showAnalysis && analysisData && (
                <div className="space-y-4">
                  {/* Analysis Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Summary</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Active Credits</p>
                        <p className="text-sm font-medium">{analysisData.analysis.active_good_credits}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Damaged Cylinders</p>
                        <p className="text-sm font-medium text-yellow-600">{analysisData.analysis.damaged_cylinders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Lost Cylinders</p>
                        <p className="text-sm font-medium text-red-600">{analysisData.analysis.lost_cylinders}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Lost Fees</p>
                        <p className="text-sm font-medium">{formatCurrencySync(analysisData.analysis.total_lost_fees || 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Transactions */}
                  {analysisData.recent_transactions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Transactions</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {analysisData.recent_transactions.slice(0, 5).map((tx: any) => (
                          <div key={tx.id} className="flex justify-between items-center py-1">
                            <div>
                              <span className={`text-xs px-2 py-1 rounded ${
                                tx.transaction_type === 'charge' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {tx.transaction_type}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {new Date(tx.transaction_date).toLocaleDateString()}
                              </span>
                            </div>
                            <span className={`text-sm font-medium ${
                              tx.transaction_type === 'charge' ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {tx.transaction_type === 'charge' ? '+' : '-'}{formatCurrencySync(tx.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Credits */}
                  {analysisData.active_credits.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Active Credits</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {analysisData.active_credits.slice(0, 3).map((credit: any) => (
                          <div key={credit.id} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <div className="flex justify-between">
                              <span className="text-xs font-medium">{credit.product.name}</span>
                              <span className="text-xs">{formatCurrencySync(credit.total_credit_amount)}</span>
                            </div>
                            <p className="text-xs text-gray-600">
                              {credit.quantity_remaining} remaining • Due: {new Date(credit.return_deadline).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {analysisLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 