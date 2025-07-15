import React, { useState, useEffect } from 'react';
import { useParentProducts, useSkuVariants, useCreateVariant } from '../../hooks/useProducts';
import { CreateVariantData, SkuVariant, SkuVariantOption } from '../../types/product';

interface VariantFormProps {
  onSuccess?: (variant: any) => void;
  onCancel?: () => void;
  parentProductId?: string;
}

export const VariantForm: React.FC<VariantFormProps> = ({
  onSuccess,
  onCancel,
  parentProductId,
}) => {
  const [formData, setFormData] = useState<CreateVariantData>({
    name: '',
    description: '',
    status: 'active',
    parent_products_id: parentProductId || '',
    sku_variant: 'EMPTY',
  });

  const [previewSku, setPreviewSku] = useState<string>('');

  const { data: parentProductsData, isLoading: loadingParents } = useParentProducts();
  const { data: skuVariantsData, isLoading: loadingVariants } = useSkuVariants();
  const createVariant = useCreateVariant();

  const parentProducts = parentProductsData?.parent_products || [];
  const skuVariants = skuVariantsData?.sku_variants || [];

  // Update preview SKU when parent or variant changes
  useEffect(() => {
    if (formData.parent_products_id && formData.sku_variant) {
      const parent = parentProducts.find(p => p.id === formData.parent_products_id);
      if (parent) {
        setPreviewSku(`${parent.sku}-${formData.sku_variant}`);
      }
    } else {
      setPreviewSku('');
    }
  }, [formData.parent_products_id, formData.sku_variant, parentProducts]);

  // Auto-generate name when parent and variant are selected
  useEffect(() => {
    if (formData.parent_products_id && formData.sku_variant && !formData.name) {
      const parent = parentProducts.find(p => p.id === formData.parent_products_id);
      const variant = skuVariants.find(v => v.value === formData.sku_variant);
      if (parent && variant) {
        setFormData(prev => ({
          ...prev,
          name: `${parent.name} ${variant.label}`,
        }));
      }
    }
  }, [formData.parent_products_id, formData.sku_variant, parentProducts, skuVariants, formData.name]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createVariant.mutateAsync(formData);
      console.log('Variant created:', result);
      if (onSuccess) {
        onSuccess(result);
      }
      // Reset form
      setFormData({
        name: '',
        description: '',
        status: 'active',
        parent_products_id: parentProductId || '',
        sku_variant: 'EMPTY',
      });
    } catch (error) {
      console.error('Error creating variant:', error);
    }
  };

  const isLoading = loadingParents || loadingVariants || createVariant.isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Parent Product Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Parent Product *
          </label>
          <select
            name="parent_products_id"
            value={formData.parent_products_id}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          >
            <option value="">Select Parent Product</option>
            {parentProducts.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.name} ({parent.sku})
              </option>
            ))}
          </select>
        </div>

        {/* SKU Variant Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU Variant *
          </label>
          <select
            name="sku_variant"
            value={formData.sku_variant}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          >
            {skuVariants.map(variant => (
              <option key={variant.value} value={variant.value}>
                {variant.label} - {variant.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Auto-generated SKU Preview */}
      {previewSku && (
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Auto-generated SKU:</strong> <code className="font-mono">{previewSku}</code>
          </p>
        </div>
      )}

      {/* Product Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
          disabled={isLoading}
          placeholder="e.g., 13kg Propane FULL-XCH"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
          placeholder="Optional description for this variant"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Status
        </label>
        <select
          name="status"
          value={formData.status}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          <option value="active">Active</option>
          <option value="obsolete">Obsolete</option>
        </select>
      </div>

      {/* Barcode UID */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Barcode UID
        </label>
        <input
          type="text"
          name="barcode_uid"
          value={formData.barcode_uid || ''}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
          placeholder="Optional barcode identifier"
        />
      </div>

      {/* Submit Buttons */}
      <div className="flex justify-end space-x-3 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            disabled={isLoading}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || !formData.parent_products_id || !formData.sku_variant || !formData.name}
        >
          {isLoading ? 'Creating...' : 'Create Variant'}
        </button>
      </div>

      {/* Error Message */}
      {createVariant.error && (
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-700">
            Error: {createVariant.error.message}
          </p>
        </div>
      )}
    </form>
  );
};

export default VariantForm;