import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Product, CreateProductData } from '../../types/product';
import { TAX_CATEGORIES } from '../../types/pricing';
import CylinderWeightCalculator from './CylinderWeightCalculator';

interface SimpleProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProductData) => void;
  product?: Product;
  loading?: boolean;
  title?: string;
}

export const SimpleProductForm: React.FC<SimpleProductFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  product,
  loading = false,
  title = 'Create New Product',
}) => {
  const [showObsoleteWarning, setShowObsoleteWarning] = React.useState(false);

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
    },
  });

  const watchedStatus = watch('status');
  const watchedTaxCategory = watch('tax_category');
  const watchedGrossWeight = watch('gross_weight_kg');
  const watchedTareWeight = watch('tare_weight_kg');
  const watchedCapacity = watch('capacity_kg');

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

  // Reset form when modal opens/closes or product changes
  useEffect(() => {
    if (isOpen) {
      if (product) {
        reset({
          sku: product.sku,
          name: product.name,
          description: product.description || '',
          unit_of_measure: product.unit_of_measure,
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
        });
      }
    }
  }, [isOpen, product, reset]);

  const handleFormSubmit = (data: CreateProductData) => {
    console.log('Product form submit:', data);
    
    // Clean up data
    const cleanedData = {
      ...data,
      description: data.description || undefined,
      capacity_kg: data.capacity_kg || undefined,
      tare_weight_kg: data.tare_weight_kg || undefined,
      gross_weight_kg: data.gross_weight_kg || undefined,
      valve_type: data.valve_type || undefined,
      barcode_uid: data.barcode_uid || undefined,
    };
    
    onSubmit(cleanedData);
  };



  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Basic Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                  SKU *
                </label>
                <input
                  type="text"
                  id="sku"
                  {...register('sku', { required: 'SKU is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="PROPAN-12KG"
                />
                {errors.sku && (
                  <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Product Name *
                </label>
                <input
                  type="text"
                  id="name"
                  {...register('name', { required: 'Product name is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Propane Gas 12KG"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Detailed description of the product..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="unit_of_measure" className="block text-sm font-medium text-gray-700">
                  Unit of Measure *
                </label>
                <select
                  id="unit_of_measure"
                  {...register('unit_of_measure', { required: 'Unit of measure is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="cylinder">Cylinder</option>
                  <option value="kg">Kilogram</option>
                </select>
                {errors.unit_of_measure && (
                  <p className="mt-1 text-sm text-red-600">{errors.unit_of_measure.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                  Status *
                </label>
                <select
                  id="status"
                  {...register('status', { required: 'Status is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="obsolete">Obsolete</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                )}
              </div>
            </div>

            {showObsoleteWarning && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
                  <p className="text-sm text-yellow-800">
                    Marking this product as obsolete will hide it from new orders but keep existing data intact.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Physical Specifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Physical Specifications</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="capacity_kg" className="block text-sm font-medium text-gray-700">
                  Capacity (kg)
                </label>
                <input
                  type="number"
                  id="capacity_kg"
                  min="0"
                  step="0.1"
                  {...register('capacity_kg', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="12.0"
                />
              </div>

              <div>
                <label htmlFor="tare_weight_kg" className="block text-sm font-medium text-gray-700">
                  Tare Weight (kg)
                </label>
                <input
                  type="number"
                  id="tare_weight_kg"
                  min="0"
                  step="0.1"
                  {...register('tare_weight_kg', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="14.0"
                />
              </div>

              <div>
                <label htmlFor="gross_weight_kg" className="block text-sm font-medium text-gray-700">
                  Gross Weight (kg)
                </label>
                <input
                  type="number"
                  id="gross_weight_kg"
                  min="0"
                  step="0.1"
                  {...register('gross_weight_kg', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="26.0"
                />
              </div>
            </div>

            <CylinderWeightCalculator
              grossWeight={watchedGrossWeight}
              tareWeight={watchedTareWeight}
              capacityKg={watchedCapacity}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="valve_type" className="block text-sm font-medium text-gray-700">
                  Valve Type
                </label>
                <input
                  type="text"
                  id="valve_type"
                  {...register('valve_type')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Standard valve"
                />
              </div>

              <div>
                <label htmlFor="barcode_uid" className="block text-sm font-medium text-gray-700">
                  Barcode/UID
                </label>
                <input
                  type="text"
                  id="barcode_uid"
                  {...register('barcode_uid')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="123456789"
                />
              </div>
            </div>
          </div>

          {/* Tax Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Tax Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tax_category" className="block text-sm font-medium text-gray-700">
                  Tax Category *
                </label>
                <select
                  id="tax_category"
                  {...register('tax_category', { required: 'Tax category is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TAX_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.tax_category && (
                  <p className="mt-1 text-sm text-red-600">{errors.tax_category.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="tax_rate" className="block text-sm font-medium text-gray-700">
                  Tax Rate
                </label>
                <input
                  type="number"
                  id="tax_rate"
                  min="0"
                  max="1"
                  step="0.01"
                  {...register('tax_rate', { valueAsNumber: true })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-500">Automatically set based on tax category</p>
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_tag"
                  {...register('requires_tag')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_tag" className="ml-2 block text-sm text-gray-700">
                  Requires Tagging
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 