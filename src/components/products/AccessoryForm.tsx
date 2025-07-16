import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { CreateAccessoryData, VAT_CODES } from '../../types/accessory';
import { useAccessoryCategories } from '../../hooks/useAccessories';

interface AccessoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAccessoryData) => void;
  loading?: boolean;
  title?: string;
}

export const AccessoryForm: React.FC<AccessoryFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  title = 'Create New Accessory',
}) => {
  // Get accessory categories for the dropdown
  const { data: categoriesData } = useAccessoryCategories();
  const categories = categoriesData?.categories || [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAccessoryData>({
    defaultValues: {
      name: '',
      sku: '',
      category_id: undefined,
      price: 0,
      vat_code: 'standard',
      deposit_amount: 0,
      is_serialized: false,
      saleable: true,
      active: true,
      description: '',
    },
  });

  const [currencyCode, setCurrencyCode] = useState('KES');

  const handleFormSubmit = (data: CreateAccessoryData) => {
    console.log('Accessory form submit:', data);
    
    // Clean up data
    const cleanedData = {
      ...data,
      description: data.description || undefined,
      category_id: data.category_id || undefined,
    };
    
    onSubmit(cleanedData);
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      reset({
        name: '',
        sku: '',
        category_id: undefined,
        price: 0,
        vat_code: 'standard',
        deposit_amount: 0,
        is_serialized: false,
        saleable: true,
        active: true,
        description: '',
      });
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Accessory Name *
                </label>
                <input
                  type="text"
                  id="name"
                  {...register('name', { required: 'Accessory name is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Regulator, Hose, Valve..."
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                  SKU *
                </label>
                <input
                  type="text"
                  id="sku"
                  {...register('sku', { required: 'SKU is required' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="ACC-REG-001"
                />
                {errors.sku && (
                  <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
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
                placeholder="Detailed description of the accessory..."
              />
            </div>

            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <select
                id="category_id"
                {...register('category_id')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                                 <option value="">Select a category</option>
                 {categories.map((category: any) => (
                   <option key={category.id} value={category.id}>
                     {category.name}
                   </option>
                 ))}
              </select>
            </div>
          </div>

          {/* Pricing Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Pricing Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                  Price *
                </label>
                <input
                  type="number"
                  id="price"
                  min="0"
                  step="0.01"
                  {...register('price', { 
                    required: 'Price is required',
                    min: { value: 0, message: 'Price must be positive' },
                    valueAsNumber: true,
                  })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0.00"
                />
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                )}
              </div>

                             <div>
                 <label className="block text-sm font-medium text-gray-700">
                   Currency: {currencyCode}
                 </label>
                 <p className="text-sm text-gray-500 mt-1">Currency is set to Kenyan Shilling (KES)</p>
               </div>
            </div>

            <div>
              <label htmlFor="vat_code" className="block text-sm font-medium text-gray-700">
                VAT Code *
              </label>
              <select
                id="vat_code"
                {...register('vat_code', { required: 'VAT code is required' })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {VAT_CODES.map((vatCode) => (
                  <option key={vatCode.value} value={vatCode.value}>
                    {vatCode.label}
                  </option>
                ))}
              </select>
              {errors.vat_code && (
                <p className="mt-1 text-sm text-red-600">{errors.vat_code.message}</p>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Settings</h3>
            
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="saleable"
                  {...register('saleable')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="saleable" className="ml-2 block text-sm text-gray-700">
                  Saleable
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="active"
                  {...register('active')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="active" className="ml-2 block text-sm text-gray-700">
                  Active
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
              Create Accessory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 