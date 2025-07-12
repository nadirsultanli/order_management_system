import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Product, CreateProductData } from '../../types/product';
import { TAX_CATEGORIES } from '../../types/pricing';
import { trpc } from '../../lib/trpc-client';
import PricingMethodSelector from './PricingMethodSelector';
import CylinderWeightCalculator from './CylinderWeightCalculator';
import WeightBasedPricingPreview from './WeightBasedPricingPreview';

interface ProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProductData) => void;
  product?: Product;
  loading?: boolean;
  title: string;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  product,
  loading = false,
  title,
}) => {
  const [showObsoleteWarning, setShowObsoleteWarning] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateProductData>({
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      unit_of_measure: 'cylinder',
      capacity_kg: undefined,
      tare_weight_kg: undefined,
      gross_weight_kg: undefined,
      valve_type: '',
      status: 'active',
      barcode_uid: '',
      requires_tag: false,
      is_variant: false,
      tax_category: 'standard',
      tax_rate: 0.16,
      variant: 'outright',
      pricing_method: 'per_unit',
    },
  });

  const watchedStatus = watch('status');
  const watchedTaxCategory = watch('tax_category');
  const watchedGrossWeight = watch('gross_weight_kg');
  const watchedTareWeight = watch('tare_weight_kg');
  const watchedCapacity = watch('capacity_kg');
  const watchedPricingMethod = watch('pricing_method');

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        unit_of_measure: 'cylinder',
        capacity_kg: product.capacity_kg,
        tare_weight_kg: product.tare_weight_kg,
        gross_weight_kg: product.gross_weight_kg,
        valve_type: product.valve_type || '',
        status: product.status,
        barcode_uid: product.barcode_uid || '',
        requires_tag: product.requires_tag,
        is_variant: product.is_variant,
        tax_category: product.tax_category || 'standard',
        tax_rate: product.tax_rate || 0.16,
        variant: product.variant || 'outright',
        pricing_method: product.pricing_method || 'per_unit',
      });
    } else {
              reset({
          sku: '',
          name: '',
          description: '',
          unit_of_measure: 'cylinder',
          capacity_kg: undefined,
          tare_weight_kg: undefined,
          gross_weight_kg: undefined,
          valve_type: '',
          status: 'active',
          barcode_uid: '',
          requires_tag: false,
          is_variant: false,
          tax_category: 'standard',
          tax_rate: 0.16,
          variant: 'outright',
          pricing_method: 'per_unit',
        });
    }
  }, [product, reset]);

  useEffect(() => {
    setShowObsoleteWarning(watchedStatus === 'obsolete');
  }, [watchedStatus]);

  useEffect(() => {
    // Auto-update tax rate when tax category changes
    if (watchedTaxCategory) {
      const selectedCategory = TAX_CATEGORIES.find(cat => cat.id === watchedTaxCategory);
      if (selectedCategory) {
        setValue('tax_rate', selectedCategory.rate);
      }
    }
  }, [watchedTaxCategory, setValue]);

  const validateSKU = trpc.products.validateSku.useMutation();
  const validateWeight = trpc.products.validateWeight.useMutation();

  const validateSKUAndWeight = async (data: CreateProductData) => {
    // Validate SKU using backend
    try {
      const skuResult = await validateSKU.mutateAsync({ 
        sku: data.sku, 
        exclude_id: product?.id 
      });
      
      if (!skuResult.valid) {
        console.error('SKU validation failed:', skuResult.errors);
        return false;
      }
      
      // Show warnings
      if (skuResult.warnings.length > 0) {
        console.warn('SKU warnings:', skuResult.warnings);
      }
    } catch (error) {
      console.error('SKU validation error:', error);
      return false;
    }

    // Validate weights (all products are cylinders)
    if (data.capacity_kg || data.tare_weight_kg || data.gross_weight_kg) {
      try {
        const weightResult = await validateWeight.mutateAsync({ 
          capacity_kg: data.capacity_kg, 
          tare_weight_kg: data.tare_weight_kg,
          gross_weight_kg: data.gross_weight_kg,
          unit_of_measure: 'cylinder'
        });
        
        if (!weightResult.valid) {
          console.error('Weight validation failed:', weightResult.errors);
          return false;
        }
        
        // Show warnings
        if (weightResult.warnings.length > 0) {
          console.warn('Weight warnings:', weightResult.warnings);
        }
      } catch (error) {
        console.error('Weight validation error:', error);
        return false;
      }
    }

    return true;
  };

  const handleFormSubmit = async (data: CreateProductData) => {
    try {
      // Ensure SKU is uppercase before validation and submission
      const processedData = {
        ...data,
        sku: data.sku.toUpperCase()
      };

      // Validate using backend
      const isValid = await validateSKUAndWeight(processedData);
      if (!isValid) {
        return; // Validation failed, errors logged to console
      }

      // Clean up data - all products are cylinders by default
      const cleanedData = { 
        ...processedData,
        unit_of_measure: 'cylinder',
        variant_type: 'cylinder'
      };

      // Remove empty strings
      Object.keys(cleanedData).forEach(key => {
        const typedKey = key as keyof CreateProductData;
        if (cleanedData[typedKey] === '') {
          delete cleanedData[typedKey];
        }
      });

      onSubmit(cleanedData);
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                        SKU *
                      </label>
                      <input
                        type="text"
                        id="sku"
                        {...register('sku', { 
                          required: 'SKU is required',
                          pattern: {
                            value: /^[A-Z0-9-]+$/,
                            message: 'SKU must contain only uppercase letters, numbers, and hyphens'
                          },
                          minLength: {
                            value: 3,
                            message: 'SKU must be at least 3 characters long'
                          },
                          maxLength: {
                            value: 50,
                            message: 'SKU must be 50 characters or less'
                          },
                          onChange: (e) => {
                            // Transform to uppercase as user types
                            e.target.value = e.target.value.toUpperCase();
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="CYL-50KG-S"
                        style={{ textTransform: 'uppercase' }}
                      />
                      {errors.sku && (
                        <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <select
                        id="status"
                        {...register('status')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="obsolete">Obsolete</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="variant" className="block text-sm font-medium text-gray-700">
                        Variant
                      </label>
                      <select
                        id="variant"
                        {...register('variant')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="outright">Outright</option>
                        <option value="refill">Refill</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        {...register('name', { required: 'Product name is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="LPG Cylinder 50kg"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        rows={3}
                        {...register('description')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Detailed product description..."
                      />
                    </div>
                  </div>

                  {/* Tax Information */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-4">Tax Information</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tax_category" className="block text-sm font-medium text-gray-700">
                          Tax Category
                        </label>
                        <select
                          id="tax_category"
                          {...register('tax_category')}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {TAX_CATEGORIES.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="tax_rate" className="block text-sm font-medium text-gray-700">
                          Tax Rate (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          id="tax_rate"
                          {...register('tax_rate', {
                            valueAsNumber: true,
                            min: {
                              value: 0,
                              message: 'Tax rate must be between 0 and 1'
                            },
                            max: {
                              value: 1,
                              message: 'Tax rate must be between 0 and 1'
                            }
                          })}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                          placeholder="0.16"
                          readOnly
                        />
                        {errors.tax_rate && (
                          <p className="mt-1 text-sm text-red-600">{errors.tax_rate.message}</p>
                        )}
                        <p className="mt-1 text-sm text-gray-500">
                          Enter as decimal (0.16 = 16%)
                        </p>
                      </div>
                    </div>
                  </div>

                  {showObsoleteWarning && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-800">
                          Warning: Setting status to "Obsolete" will make this product unavailable for future orders.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Physical Properties */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Physical Properties</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div>
                      <label htmlFor="barcode_uid" className="block text-sm font-medium text-gray-700">
                        Barcode/RFID UID
                      </label>
                      <input
                        type="text"
                        id="barcode_uid"
                        {...register('barcode_uid')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Optional unique identifier"
                      />
                    </div>

                    <div>
                      <label htmlFor="capacity_kg" className="block text-sm font-medium text-gray-700">
                        Capacity (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="500"
                        id="capacity_kg"
                        {...register('capacity_kg', {
                          valueAsNumber: true,
                          min: {
                            value: 0.1,
                            message: 'Capacity must be greater than 0'
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="50.0"
                      />
                      {errors.capacity_kg && (
                        <p className="mt-1 text-sm text-red-600">{errors.capacity_kg.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="tare_weight_kg" className="block text-sm font-medium text-gray-700">
                        Tare Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="500"
                        id="tare_weight_kg"
                        {...register('tare_weight_kg', {
                          valueAsNumber: true,
                          min: {
                            value: 0.1,
                            message: 'Tare weight must be greater than 0'
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="15.0"
                      />
                      {errors.tare_weight_kg && (
                        <p className="mt-1 text-sm text-red-600">{errors.tare_weight_kg.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="gross_weight_kg" className="block text-sm font-medium text-gray-700">
                        Gross Weight (kg) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="500"
                        id="gross_weight_kg"
                        {...register('gross_weight_kg', {
                          valueAsNumber: true,
                          required: 'Gross weight is required for gas cylinders',
                          min: {
                            value: 0.1,
                            message: 'Gross weight must be greater than 0'
                          },
                          validate: (value) => {
                            const tareWeight = watchedTareWeight;
                            if (value && tareWeight && value <= tareWeight) {
                              return 'Gross weight must be greater than tare weight';
                            }
                            return true;
                          }
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="65.0"
                      />
                      {errors.gross_weight_kg && (
                        <p className="mt-1 text-sm text-red-600">{errors.gross_weight_kg.message}</p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Total weight including gas content
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="valve_type" className="block text-sm font-medium text-gray-700">
                        Valve Type
                      </label>
                      <input
                        type="text"
                        id="valve_type"
                        {...register('valve_type')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Standard valve specifications"
                      />
                    </div>
                  </div>
                </div>

                {/* Weight Calculator */}
                {(watchedGrossWeight || watchedTareWeight) && (
                  <CylinderWeightCalculator
                    grossWeight={watchedGrossWeight}
                    tareWeight={watchedTareWeight}
                    capacityKg={watchedCapacity}
                  />
                )}

                {/* Pricing Method */}
                <PricingMethodSelector
                  value={watchedPricingMethod}
                  onChange={(value) => setValue('pricing_method', value)}
                />

                {/* Pricing Preview */}
                {watchedPricingMethod && watchedGrossWeight && watchedTareWeight && (
                  <WeightBasedPricingPreview
                    pricingMethod={watchedPricingMethod}
                    netGasWeight={watchedGrossWeight - watchedTareWeight}
                    capacityKg={watchedCapacity}
                  />
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Product'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};