import React, { useState } from 'react';
import { useCreateParentProduct } from '../../hooks/useProducts';
import { CreateParentProductData } from '../../types/product';

interface ParentProductFormProps {
  onSuccess?: (parentProduct: any) => void;
  onCancel?: () => void;
}

export const ParentProductForm: React.FC<ParentProductFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState<CreateParentProductData>({
    sku: '',
    name: '',
    description: '',
    unit_of_measure: 'cylinder',
    capacity_kg: undefined,
    tare_weight_kg: undefined,
    valve_type: '',
    status: 'active',
    variant_type: 'cylinder',
    requires_tag: false,
    tax_category: '',
    tax_rate: undefined,
  });

  const createParentProduct = useCreateParentProduct();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked,
      }));
    } else if (type === 'number') {
      setFormData(prev => ({
        ...prev,
        [name]: value ? parseFloat(value) : undefined,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createParentProduct.mutateAsync(formData);
      console.log('Parent product created:', result);
      if (onSuccess) {
        onSuccess(result);
      }
      // Reset form
      setFormData({
        sku: '',
        name: '',
        description: '',
        unit_of_measure: 'cylinder',
        capacity_kg: undefined,
        tare_weight_kg: undefined,
        valve_type: '',
        status: 'active',
        variant_type: 'cylinder',
        requires_tag: false,
        tax_category: '',
        tax_rate: undefined,
      });
    } catch (error) {
      console.error('Error creating parent product:', error);
    }
  };

  const isLoading = createParentProduct.isLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SKU */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SKU *
          </label>
          <input
            type="text"
            name="sku"
            value={formData.sku}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
            placeholder="e.g., TEST-CYL-001"
          />
          <p className="mt-1 text-xs text-gray-500">
            Master SKU for this product family
          </p>
        </div>

        {/* Name */}
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
            placeholder="e.g., 13kg Propane Cylinder"
          />
        </div>
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
          placeholder="Optional description for this parent product"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Unit of Measure */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit of Measure *
          </label>
          <select
            name="unit_of_measure"
            value={formData.unit_of_measure}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          >
            <option value="cylinder">Cylinder</option>
            <option value="kg">Kg</option>
          </select>
        </div>

        {/* Variant Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Variant Type *
          </label>
          <select
            name="variant_type"
            value={formData.variant_type}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
            disabled={isLoading}
          >
            <option value="cylinder">Cylinder</option>
            <option value="refillable">Refillable</option>
            <option value="disposable">Disposable</option>
          </select>
        </div>
      </div>

      {formData.unit_of_measure === 'cylinder' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (kg)
            </label>
            <input
              type="number"
              name="capacity_kg"
              value={formData.capacity_kg || ''}
              onChange={handleInputChange}
              step="0.1"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              placeholder="e.g., 13.0"
            />
          </div>

          {/* Tare Weight */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tare Weight (kg)
            </label>
            <input
              type="number"
              name="tare_weight_kg"
              value={formData.tare_weight_kg || ''}
              onChange={handleInputChange}
              step="0.1"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              placeholder="e.g., 12.5"
            />
          </div>

          {/* Valve Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valve Type
            </label>
            <input
              type="text"
              name="valve_type"
              value={formData.valve_type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
              placeholder="e.g., POL"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Tax Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tax Rate (%)
          </label>
          <input
            type="number"
            name="tax_rate"
            value={formData.tax_rate ? formData.tax_rate * 100 : ''}
            onChange={(e) => {
              const value = e.target.value;
              setFormData(prev => ({
                ...prev,
                tax_rate: value ? parseFloat(value) / 100 : undefined,
              }));
            }}
            step="0.1"
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
            placeholder="e.g., 16.0"
          />
        </div>
      </div>

      {/* Tax Category */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tax Category
        </label>
        <input
          type="text"
          name="tax_category"
          value={formData.tax_category}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
          placeholder="e.g., standard"
        />
      </div>

      {/* Requires Tag */}
      <div className="flex items-center">
        <input
          type="checkbox"
          name="requires_tag"
          checked={formData.requires_tag}
          onChange={handleInputChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={isLoading}
        />
        <label className="ml-2 block text-sm text-gray-900">
          Requires Tag/Barcode
        </label>
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
          disabled={isLoading || !formData.sku || !formData.name}
        >
          {isLoading ? 'Creating...' : 'Create Parent Product'}
        </button>
      </div>

      {/* Error Message */}
      {createParentProduct.error && (
        <div className="mt-4 p-3 bg-red-50 rounded-md">
          <p className="text-sm text-red-700">
            Error: {createParentProduct.error.message}
          </p>
        </div>
      )}
    </form>
  );
};

export default ParentProductForm;