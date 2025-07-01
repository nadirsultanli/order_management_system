import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Plus, Trash2, Package, Tag, AlertCircle } from 'lucide-react';
import { Product, CreateProductData, CreateVariantData } from '../../types/product';
import { STANDARD_CYLINDER_VARIANTS, generateVariantSKU, createVariantProduct } from '../../utils/product-variants';

interface ProductVariantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: CreateProductData, variants?: CreateVariantData[]) => void;
  product?: Product;
  loading?: boolean;
  title: string;
}

interface VariantFormData {
  name: string;
  description?: string;
  status: 'active' | 'end_of_sale' | 'obsolete';
}

export const ProductVariantForm: React.FC<ProductVariantFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  product,
  loading = false,
  title,
}) => {
  const [createVariants, setCreateVariants] = useState(false);
  const [variants, setVariants] = useState<VariantFormData[]>([]);

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
      capacity_kg: 0,
      tare_weight_kg: 0,
      valve_type: '',
      status: 'active',
      barcode_uid: '',
      requires_tag: false,
      variant_type: 'cylinder',
      parent_product_id: undefined,
      variant_name: undefined,
      is_variant: false,
    },
  });

  const watchedVariantType = watch('variant_type');
  const watchedSKU = watch('sku');

  useEffect(() => {
    if (product) {
      reset({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        unit_of_measure: product.unit_of_measure,
        capacity_kg: product.capacity_kg || 0,
        tare_weight_kg: product.tare_weight_kg || 0,
        valve_type: product.valve_type || '',
        status: product.status,
        barcode_uid: product.barcode_uid || '',
        requires_tag: product.requires_tag,
        variant_type: product.variant_type,
        parent_product_id: product.parent_product_id,
        variant_name: product.variant_name,
        is_variant: product.is_variant,
      });
    }
  }, [product, reset]);

  // Initialize with standard cylinder variants when variant type is cylinder
  useEffect(() => {
    if (watchedVariantType === 'cylinder' && variants.length === 0 && createVariants) {
      setVariants(STANDARD_CYLINDER_VARIANTS.map(v => ({
        name: v.name,
        description: v.description,
        status: 'active' as const,
      })));
    }
  }, [watchedVariantType, createVariants, variants.length]);

  const addVariant = () => {
    setVariants([...variants, { name: '', description: '', status: 'active' }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantFormData, value: string) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };
    setVariants(updated);
  };

  const handleFormSubmit = (data: CreateProductData) => {
    // Set parent product properties
    const productData: CreateProductData = {
      ...data,
      is_variant: false, // This is a parent product
      parent_product_id: undefined,
      variant_name: undefined,
    };

    // Create variant data if variants are specified
    let variantData: CreateVariantData[] | undefined;
    if (createVariants && variants.length > 0) {
      variantData = variants.map(variant => ({
        parent_product_id: '', // Will be set after parent creation
        variant_name: variant.name,
        sku: generateVariantSKU(data.sku, variant.name),
        name: `${data.name} (${variant.name})`,
        description: variant.description || `${variant.name} variant of ${data.name}`,
        status: variant.status,
        barcode_uid: undefined,
      }));
    }

    onSubmit(productData, variantData);
  };

  const loadStandardVariants = () => {
    setVariants(STANDARD_CYLINDER_VARIANTS.map(v => ({
      name: v.name,
      description: v.description,
      status: 'active' as const,
    })));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Parent Product Details */}
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-gray-900 flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Product Information</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="sku" className="block text-sm font-medium text-gray-700">
                        SKU *
                      </label>
                      <input
                        type="text"
                        id="sku"
                        {...register('sku', { required: 'SKU is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., PROGAS-13KG"
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
                        placeholder="e.g., ProGas 13kg Cylinder"
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
                      placeholder="Product description..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="variant_type" className="block text-sm font-medium text-gray-700">
                        Variant Type *
                      </label>
                      <select
                        id="variant_type"
                        {...register('variant_type')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="cylinder">Cylinder</option>
                        <option value="refillable">Refillable</option>
                        <option value="disposable">Disposable</option>
                      </select>
                    </div>

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
                        <option value="kg">Kilogram</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="capacity_kg" className="block text-sm font-medium text-gray-700">
                        Capacity (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        id="capacity_kg"
                        {...register('capacity_kg', { min: 0 })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="tare_weight_kg" className="block text-sm font-medium text-gray-700">
                        Tare Weight (kg)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        id="tare_weight_kg"
                        {...register('tare_weight_kg', { min: 0 })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="valve_type" className="block text-sm font-medium text-gray-700">
                        Valve Type
                      </label>
                      <input
                        type="text"
                        id="valve_type"
                        {...register('valve_type')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., POL, ACME"
                      />
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
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="requires_tag"
                        {...register('requires_tag')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="requires_tag" className="ml-2 block text-sm text-gray-700">
                        Requires Tag
                      </label>
                    </div>
                  </div>
                </div>

                {/* Product Variants */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold text-gray-900 flex items-center space-x-2">
                      <Tag className="h-5 w-5" />
                      <span>Product Variants</span>
                    </h4>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="create_variants"
                        checked={createVariants}
                        onChange={(e) => setCreateVariants(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="create_variants" className="block text-sm text-gray-700">
                        Create Variants
                      </label>
                    </div>
                  </div>

                  {createVariants && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <p className="text-sm text-blue-800">
                              <strong>Product Variants:</strong> Create different variants of this product (e.g., full vs empty cylinders).
                              Each variant will have its own SKU and inventory tracking.
                            </p>
                          </div>
                        </div>
                      </div>

                      {watchedVariantType === 'cylinder' && variants.length === 0 && (
                        <div className="text-center py-4">
                          <button
                            type="button"
                            onClick={loadStandardVariants}
                            className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Add Standard Cylinder Variants</span>
                          </button>
                        </div>
                      )}

                      {variants.map((variant, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="text-sm font-medium text-gray-900">
                              Variant {index + 1}
                            </h5>
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Variant Name *
                              </label>
                              <input
                                type="text"
                                value={variant.name}
                                onChange={(e) => updateVariant(index, 'name', e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g., full, empty"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                Description
                              </label>
                              <input
                                type="text"
                                value={variant.description || ''}
                                onChange={(e) => updateVariant(index, 'description', e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="Variant description"
                              />
                            </div>

                            <div className="text-sm text-gray-600">
                              <strong>Generated SKU:</strong> {watchedSKU ? generateVariantSKU(watchedSKU, variant.name) : 'Enter parent SKU first'}
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={addVariant}
                        className="w-full flex items-center justify-center space-x-2 border border-gray-300 rounded-lg px-4 py-3 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Another Variant</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Product'}
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