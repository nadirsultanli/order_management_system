import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Product, CreateProductData } from '../../types/product';

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
    formState: { errors },
  } = useForm<CreateProductData>({
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      unit_of_measure: 'cylinder',
      capacity_kg: undefined,
      tare_weight_kg: undefined,
      valve_type: '',
      status: 'active',
      barcode_uid: '',
    },
  });

  const watchedUnitOfMeasure = watch('unit_of_measure');
  const watchedStatus = watch('status');

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        unit_of_measure: product.unit_of_measure,
        capacity_kg: product.capacity_kg,
        tare_weight_kg: product.tare_weight_kg,
        valve_type: product.valve_type || '',
        status: product.status,
        barcode_uid: product.barcode_uid || '',
      });
    } else {
      reset({
        sku: '',
        name: '',
        description: '',
        unit_of_measure: 'cylinder',
        capacity_kg: undefined,
        tare_weight_kg: undefined,
        valve_type: '',
        status: 'active',
        barcode_uid: '',
      });
    }
  }, [product, reset]);

  useEffect(() => {
    setShowObsoleteWarning(watchedStatus === 'obsolete');
  }, [watchedStatus]);

  const validateSKU = (sku: string) => {
    const skuPattern = /^[A-Z0-9-]+$/;
    if (!skuPattern.test(sku)) {
      return 'SKU must contain only uppercase letters, numbers, and hyphens';
    }
    return true;
  };

  const validateWeight = (weight: number | undefined, fieldName: string) => {
    if (weight !== undefined) {
      if (weight <= 0) {
        return `${fieldName} must be greater than 0`;
      }
      if (weight > 500) {
        return `${fieldName} must be 500 kg or less`;
      }
    }
    return true;
  };

  const handleFormSubmit = (data: CreateProductData) => {
    // Clean up data based on unit of measure
    const cleanedData = { ...data };
    
    if (data.unit_of_measure !== 'cylinder') {
      cleanedData.capacity_kg = undefined;
      cleanedData.tare_weight_kg = undefined;
      cleanedData.valve_type = undefined;
    }

    // Remove empty strings
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key as keyof CreateProductData] === '') {
        cleanedData[key as keyof CreateProductData] = undefined as any;
      }
    });

    onSubmit(cleanedData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                        SKU *
                      </label>
                      <input
                        type="text"
                        id="sku"
                        {...register('sku', { 
                          required: 'SKU is required',
                          validate: validateSKU
                        })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                        placeholder="CYL-50KG-S"
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
                        <option value="end_of_sale">End of Sale</option>
                        <option value="obsolete">Obsolete</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
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

                    <div className="sm:col-span-2">
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
                      <label htmlFor="unit_of_measure" className="block text-sm font-medium text-gray-700">
                        Unit of Measure
                      </label>
                      <select
                        id="unit_of_measure"
                        {...register('unit_of_measure')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="cylinder">Cylinder</option>
                        <option value="kg">By Weight (kg)</option>
                      </select>
                    </div>

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

                    {watchedUnitOfMeasure === 'cylinder' && (
                      <>
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
                              validate: (value) => validateWeight(value, 'Capacity')
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
                              validate: (value) => validateWeight(value, 'Tare weight')
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="15.0"
                          />
                          {errors.tare_weight_kg && (
                            <p className="mt-1 text-sm text-red-600">{errors.tare_weight_kg.message}</p>
                          )}
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
                      </>
                    )}
                  </div>
                </div>
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