import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { Product, CreateProductData } from '../../types/product';
import { CreateAccessoryData, VAT_CODES } from '../../types/accessory';
import { TAX_CATEGORIES } from '../../types/pricing';
import { trpc } from '../../lib/trpc-client';
import CylinderWeightCalculator from './CylinderWeightCalculator';
import { useAccessoryCategories } from '../../hooks/useAccessories';

interface UnifiedItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { item_type: 'product' | 'accessory'; product_data?: CreateProductData; accessory_data?: CreateAccessoryData }) => void;
  loading?: boolean;
  title?: string;
}

type ItemType = 'product' | 'accessory';

export const UnifiedItemForm: React.FC<UnifiedItemFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  title = 'Create Item',
}) => {
  const [itemType, setItemType] = useState<ItemType>('product');
  const [showObsoleteWarning, setShowObsoleteWarning] = useState(false);

  // Get accessory categories for the dropdown
  const { data: categoriesData } = useAccessoryCategories();
  const categories = categoriesData?.categories || [];

  // Product form
  const productForm = useForm<CreateProductData>({
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

  // Accessory form
  const accessoryForm = useForm<CreateAccessoryData>({
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

  const watchedProductStatus = productForm.watch('status');
  const watchedProductTaxCategory = productForm.watch('tax_category');
  const watchedProductGrossWeight = productForm.watch('gross_weight_kg');
  const watchedProductTareWeight = productForm.watch('tare_weight_kg');
  const watchedProductCapacity = productForm.watch('capacity_kg');

  useEffect(() => {
    setShowObsoleteWarning(watchedProductStatus === 'obsolete');
  }, [watchedProductStatus]);

  useEffect(() => {
    // Auto-update tax rate when tax category changes
    if (watchedProductTaxCategory) {
      const selectedCategory = TAX_CATEGORIES.find(cat => cat.id === watchedProductTaxCategory);
      if (selectedCategory) {
        productForm.setValue('tax_rate', selectedCategory.rate);
      }
    }
  }, [watchedProductTaxCategory, productForm]);

  const validateProductSku = trpc.products.validateSku.useMutation();
  const validateProductWeight = trpc.products.validateWeight.useMutation();
  const validateAccessorySku = trpc.accessories.validateSku.useMutation();

  const validateProductData = async (data: CreateProductData) => {
    try {
      const skuResult = await validateProductSku.mutateAsync({ 
        sku: data.sku, 
        exclude_id: undefined 
      });
      
      if (!skuResult.valid) {
        console.error('SKU validation failed:', skuResult.errors);
        return false;
      }
      
      if (skuResult.warnings.length > 0) {
        console.warn('SKU warnings:', skuResult.warnings);
      }
    } catch (error) {
      console.error('SKU validation error:', error);
      return false;
    }

    if (data.capacity_kg || data.tare_weight_kg || data.gross_weight_kg) {
      try {
        const weightResult = await validateProductWeight.mutateAsync({ 
          capacity_kg: data.capacity_kg, 
          tare_weight_kg: data.tare_weight_kg,
          gross_weight_kg: data.gross_weight_kg,
          unit_of_measure: 'cylinder'
        });
        
        if (!weightResult.valid) {
          console.error('Weight validation failed:', weightResult.errors);
          return false;
        }
        
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

  const validateAccessoryData = async (data: CreateAccessoryData) => {
    try {
      const skuResult = await validateAccessorySku.mutateAsync({ 
        sku: data.sku, 
        exclude_id: undefined 
      });
      
      if (!skuResult.valid) {
        console.error('Accessory SKU validation failed:', skuResult.errors);
        return false;
      }
      
      if (skuResult.warnings.length > 0) {
        console.warn('Accessory SKU warnings:', skuResult.warnings);
      }
    } catch (error) {
      console.error('Accessory SKU validation error:', error);
      return false;
    }

    return true;
  };

  const handleFormSubmit = async () => {
    try {
      if (itemType === 'product') {
        const productData = productForm.getValues();
        const processedData = {
          ...productData,
          sku: productData.sku.toUpperCase()
        };

        const cleanedData = { 
          ...processedData,
          unit_of_measure: 'cylinder' as const,
          variant_type: 'cylinder' as const
        };

        const filteredData = Object.fromEntries(
          Object.entries(cleanedData).filter(([key, value]) => {
            if (value === '') return false;
            
            const allowedFields = [
              'sku', 'name', 'description', 'unit_of_measure', 'capacity_kg', 
              'tare_weight_kg', 'gross_weight_kg', 'valve_type', 'status', 
              'barcode_uid', 'requires_tag', 'variant_type', 'variant', 
              'tax_category', 'tax_rate'
            ];
            return allowedFields.includes(key);
          })
        );

        onSubmit({
          item_type: 'product',
          product_data: filteredData as CreateProductData,
        });

        // Run validation in background
        validateProductData(processedData).then(isValid => {
          if (!isValid) {
            console.warn('Background validation found issues');
          }
        });
      } else {
        const accessoryData = accessoryForm.getValues();
        const processedData = {
          ...accessoryData,
          sku: accessoryData.sku.toUpperCase()
        };

        onSubmit({
          item_type: 'accessory',
          accessory_data: processedData,
        });

        // Run validation in background
        validateAccessoryData(processedData).then(isValid => {
          if (!isValid) {
            console.warn('Background validation found issues');
          }
        });
      }
    } catch (error) {
      console.error('Form validation error:', error);
    }
  };

  const resetForms = () => {
    productForm.reset();
    accessoryForm.reset();
    setItemType('product');
  };

  useEffect(() => {
    if (!isOpen) {
      resetForms();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}>
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
                {/* Item Type Selection */}
                <div>
                  <label htmlFor="item_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Item Type *
                  </label>
                  <select
                    id="item_type"
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value as ItemType)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="product">Item (Gas Cylinder)</option>
                    <option value="accessory">Accessory (Equipment/Supplies)</option>
                  </select>
                </div>

                {/* Product Form */}
                {itemType === 'product' && (
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="product_sku" className="block text-sm font-medium text-gray-700">
                            SKU *
                          </label>
                          <input
                            type="text"
                            id="product_sku"
                            {...productForm.register('sku', { 
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
                                e.target.value = e.target.value.toUpperCase();
                              }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="CYL-50KG-S"
                            style={{ textTransform: 'uppercase' }}
                          />
                          {productForm.formState.errors.sku && (
                            <p className="mt-1 text-sm text-red-600">{productForm.formState.errors.sku.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="product_status" className="block text-sm font-medium text-gray-700">
                            Status
                          </label>
                          <select
                            id="product_status"
                            {...productForm.register('status')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="active">Active</option>
                            <option value="obsolete">Obsolete</option>
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="product_name" className="block text-sm font-medium text-gray-700">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            id="product_name"
                            {...productForm.register('name', { required: 'Product name is required' })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="LPG Cylinder 50kg"
                          />
                          {productForm.formState.errors.name && (
                            <p className="mt-1 text-sm text-red-600">{productForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="product_description" className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <textarea
                            id="product_description"
                            rows={3}
                            {...productForm.register('description')}
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

                    {/* Tax Information */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Tax Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="product_tax_category" className="block text-sm font-medium text-gray-700">
                            Tax Category
                          </label>
                          <select
                            id="product_tax_category"
                            {...productForm.register('tax_category')}
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
                          <label htmlFor="product_tax_rate" className="block text-sm font-medium text-gray-700">
                            Tax Rate (%)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            id="product_tax_rate"
                            {...productForm.register('tax_rate', {
                              valueAsNumber: true,
                              min: { value: 0, message: 'Tax rate must be between 0 and 1' },
                              max: { value: 1, message: 'Tax rate must be between 0 and 1' }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                            placeholder="0.16"
                            readOnly
                          />
                          <p className="mt-1 text-sm text-gray-500">
                            Enter as decimal (0.16 = 16%)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Physical Properties */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Physical Properties</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="product_barcode" className="block text-sm font-medium text-gray-700">
                            Barcode/RFID UID
                          </label>
                          <input
                            type="text"
                            id="product_barcode"
                            {...productForm.register('barcode_uid')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Optional unique identifier"
                          />
                        </div>

                        <div>
                          <label htmlFor="product_capacity" className="block text-sm font-medium text-gray-700">
                            Capacity (kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="500"
                            id="product_capacity"
                            {...productForm.register('capacity_kg', {
                              valueAsNumber: true,
                              min: { value: 0.1, message: 'Capacity must be greater than 0' }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="50.0"
                          />
                        </div>

                        <div>
                          <label htmlFor="product_tare_weight" className="block text-sm font-medium text-gray-700">
                            Tare Weight (kg)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="500"
                            id="product_tare_weight"
                            {...productForm.register('tare_weight_kg', {
                              valueAsNumber: true,
                              min: { value: 0.1, message: 'Tare weight must be greater than 0' }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="15.0"
                          />
                        </div>

                        <div>
                          <label htmlFor="product_gross_weight" className="block text-sm font-medium text-gray-700">
                            Gross Weight (kg) *
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="500"
                            id="product_gross_weight"
                            {...productForm.register('gross_weight_kg', {
                              valueAsNumber: true,
                              required: 'Gross weight is required for gas cylinders',
                              min: { value: 0.1, message: 'Gross weight must be greater than 0' },
                              validate: (value) => {
                                const tareWeight = watchedProductTareWeight;
                                if (value && tareWeight && value <= tareWeight) {
                                  return 'Gross weight must be greater than tare weight';
                                }
                                return true;
                              }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="65.0"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Total weight including gas content
                          </p>
                        </div>

                        <div className="sm:col-span-2">
                          <label htmlFor="product_valve_type" className="block text-sm font-medium text-gray-700">
                            Valve Type
                          </label>
                          <input
                            type="text"
                            id="product_valve_type"
                            {...productForm.register('valve_type')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Standard valve specifications"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Weight Calculator */}
                    {(watchedProductGrossWeight || watchedProductTareWeight) && (
                      <CylinderWeightCalculator
                        grossWeight={watchedProductGrossWeight}
                        tareWeight={watchedProductTareWeight}
                        capacityKg={watchedProductCapacity}
                      />
                    )}
                  </div>
                )}

                {/* Accessory Form */}
                {itemType === 'accessory' && (
                  <div className="space-y-6">
                    {/* Basic Information */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="accessory_sku" className="block text-sm font-medium text-gray-700">
                            SKU *
                          </label>
                          <input
                            type="text"
                            id="accessory_sku"
                            {...accessoryForm.register('sku', { 
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
                                e.target.value = e.target.value.toUpperCase();
                              }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="ACC-REG-001"
                            style={{ textTransform: 'uppercase' }}
                          />
                          {accessoryForm.formState.errors.sku && (
                            <p className="mt-1 text-sm text-red-600">{accessoryForm.formState.errors.sku.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="accessory_category" className="block text-sm font-medium text-gray-700">
                            Category
                          </label>
                          <select
                            id="accessory_category"
                            {...accessoryForm.register('category_id')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select Category</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="accessory_name" className="block text-sm font-medium text-gray-700">
                            Accessory Name *
                          </label>
                          <input
                            type="text"
                            id="accessory_name"
                            {...accessoryForm.register('name', { required: 'Accessory name is required' })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Dual-stage Regulator"
                          />
                          {accessoryForm.formState.errors.name && (
                            <p className="mt-1 text-sm text-red-600">{accessoryForm.formState.errors.name.message}</p>
                          )}
                        </div>

                        <div className="sm:col-span-3">
                          <label htmlFor="accessory_description" className="block text-sm font-medium text-gray-700">
                            Description
                          </label>
                          <textarea
                            id="accessory_description"
                            rows={3}
                            {...accessoryForm.register('description')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Accessory description..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Pricing Information */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Pricing Information</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="accessory_price" className="block text-sm font-medium text-gray-700">
                            Price *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            id="accessory_price"
                            {...accessoryForm.register('price', {
                              valueAsNumber: true,
                              required: 'Price is required',
                              min: { value: 0, message: 'Price must be non-negative' }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="45.00"
                          />
                          {accessoryForm.formState.errors.price && (
                            <p className="mt-1 text-sm text-red-600">{accessoryForm.formState.errors.price.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="accessory_deposit" className="block text-sm font-medium text-gray-700">
                            Deposit Amount
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            id="accessory_deposit"
                            {...accessoryForm.register('deposit_amount', {
                              valueAsNumber: true,
                              min: { value: 0, message: 'Deposit must be non-negative' }
                            })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label htmlFor="accessory_vat" className="block text-sm font-medium text-gray-700">
                            VAT Code
                          </label>
                          <select
                            id="accessory_vat"
                            {...accessoryForm.register('vat_code')}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            {VAT_CODES.map((code) => (
                              <option key={code.value} value={code.value}>
                                {code.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Settings */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-4">Settings</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="accessory_serialized"
                            {...accessoryForm.register('is_serialized')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="accessory_serialized" className="ml-2 block text-sm text-gray-900">
                            Serialized Item
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="accessory_saleable"
                            {...accessoryForm.register('saleable')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="accessory_saleable" className="ml-2 block text-sm text-gray-900">
                            Saleable
                          </label>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="accessory_active"
                            {...accessoryForm.register('active')}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="accessory_active" className="ml-2 block text-sm text-gray-900">
                            Active
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  `Create ${itemType === 'product' ? 'Item' : 'Accessory'}`
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