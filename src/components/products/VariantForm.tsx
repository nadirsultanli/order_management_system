import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Package, Tag, AlertCircle, Eye } from 'lucide-react';
import { useProducts, useCreateVariant } from '../../hooks/useProducts';
import { Product, CreateVariantData } from '../../types/product';

interface VariantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateVariantData) => void;
  loading?: boolean;
  title?: string;
  parentProduct?: Product;
}

interface VariantFormData {
  parent_products_id: string;
  sku_variant: string;
  name: string;
  description?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
}

export const VariantForm: React.FC<VariantFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  title = 'Create Product Variant',
  parentProduct,
}) => {
  const [selectedParent, setSelectedParent] = useState<Product | null>(parentProduct || null);
  const [generatedSKU, setGeneratedSKU] = useState('');
  const [isGeneratingSKU, setIsGeneratingSKU] = useState(false);
  const [skuError, setSkuError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VariantFormData>({
    defaultValues: {
      parent_products_id: parentProduct?.id || '',
      sku_variant: '',
      name: '',
      description: '',
      status: 'active',
      barcode_uid: '',
    },
  });

  const watchedParentId = watch('parent_products_id');
  const watchedSkuVariant = watch('sku_variant');

  // Fetch parent products (non-variants only)
  const { 
    data: parentProductsData, 
    isLoading: isLoadingParents 
  } = useProducts({ 
    show_variants: false,
    status: 'active',
    limit: 1000 
  });

  const parentProducts = parentProductsData?.products || [];

  // Update selected parent when parent ID changes
  useEffect(() => {
    if (watchedParentId) {
      const parent = parentProducts.find(p => p.id === watchedParentId);
      setSelectedParent(parent || null);
    }
  }, [watchedParentId, parentProducts]);

  // Generate SKU preview when parent or variant changes
  useEffect(() => {
    if (selectedParent && watchedSkuVariant) {
      generateSKUPreview();
    } else {
      setGeneratedSKU('');
    }
  }, [selectedParent, watchedSkuVariant]);

  const generateSKUPreview = async () => {
    if (!selectedParent || !watchedSkuVariant) return;

    setIsGeneratingSKU(true);
    setSkuError('');

    try {
      // In a real implementation, this would be a tRPC call to generate SKU
      // For now, we'll create a simple preview
      const preview = `${selectedParent.sku}-${watchedSkuVariant.toUpperCase()}`;
      setGeneratedSKU(preview);
    } catch (error) {
      console.error('Failed to generate SKU:', error);
      setSkuError('Failed to generate SKU preview');
    } finally {
      setIsGeneratingSKU(false);
    }
  };

  const validateSKUVariant = (value: string) => {
    if (!value) return 'SKU variant is required';
    if (value.length < 2) return 'SKU variant must be at least 2 characters';
    if (value.length > 20) return 'SKU variant must be 20 characters or less';
    if (!/^[A-Z0-9-]+$/.test(value.toUpperCase())) {
      return 'SKU variant must contain only uppercase letters, numbers, and hyphens';
    }
    return true;
  };

  const handleFormSubmit = async (data: VariantFormData) => {
    try {
      const cleanedData: CreateVariantData = {
        parent_products_id: data.parent_products_id,
        sku_variant: data.sku_variant.toUpperCase(),
        name: data.name,
        description: data.description || undefined,
        status: data.status,
        barcode_uid: data.barcode_uid || undefined,
      };

      onSubmit(cleanedData);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedParent(parentProduct || null);
    setGeneratedSKU('');
    setSkuError('');
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
                {/* Parent Product Selection */}
                <div>
                  <label htmlFor="parent_products_id" className="block text-sm font-medium text-gray-700 mb-2">
                    <Package className="inline h-4 w-4 mr-1" />
                    Parent Product *
                  </label>
                  <select
                    id="parent_products_id"
                    {...register('parent_products_id', { required: 'Parent product is required' })}
                    disabled={!!parentProduct || isLoadingParents}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">
                      {isLoadingParents ? 'Loading parent products...' : 'Select parent product...'}
                    </option>
                    {parentProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (SKU: {product.sku})
                      </option>
                    ))}
                  </select>
                  {errors.parent_products_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.parent_products_id.message}</p>
                  )}
                </div>

                {/* SKU Variant */}
                <div>
                  <label htmlFor="sku_variant" className="block text-sm font-medium text-gray-700 mb-2">
                    <Tag className="inline h-4 w-4 mr-1" />
                    SKU Variant *
                  </label>
                  <input
                    type="text"
                    id="sku_variant"
                    {...register('sku_variant', { 
                      required: 'SKU variant is required',
                      validate: validateSKUVariant,
                      onChange: (e) => {
                        e.target.value = e.target.value.toUpperCase();
                      }
                    })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., FULL, EMPTY, 50KG"
                    style={{ textTransform: 'uppercase' }}
                  />
                  {errors.sku_variant && (
                    <p className="mt-1 text-sm text-red-600">{errors.sku_variant.message}</p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Variant identifier (e.g., FULL for full cylinders, EMPTY for empty cylinders)
                  </p>
                </div>

                {/* Auto-generated SKU Preview */}
                {generatedSKU && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Eye className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-medium text-blue-900">Auto-generated SKU Preview</h4>
                    </div>
                    <div className="font-mono text-lg text-blue-900 bg-white rounded px-3 py-2 border">
                      {isGeneratingSKU ? (
                        <span className="flex items-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </span>
                      ) : (
                        generatedSKU
                      )}
                    </div>
                    {skuError && (
                      <p className="mt-2 text-sm text-red-600">{skuError}</p>
                    )}
                  </div>
                )}

                {/* Variant Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Variant Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    {...register('name', { required: 'Variant name is required' })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g., Full Cylinder, Empty Cylinder"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    {...register('description')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional description of this variant..."
                  />
                </div>

                {/* Status */}
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

                {/* Barcode UID */}
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

                {/* Validation Rules Info */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 mb-1">Validation Rules</h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        <li>• SKU variant must be unique within the parent product</li>
                        <li>• SKU variant will be combined with parent SKU automatically</li>
                        <li>• Only uppercase letters, numbers, and hyphens allowed</li>
                        <li>• Variant inherits physical properties from parent product</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || isGeneratingSKU}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create Variant'
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:mr-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
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