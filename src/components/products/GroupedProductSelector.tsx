import React, { useState, useEffect } from 'react';
import { useGroupedProducts } from '../../hooks/useProducts';
import { Product, GroupedProduct } from '../../types/product';

interface GroupedProductSelectorProps {
  onSelect: (product: Product) => void;
  selectedProductId?: string;
  className?: string;
  placeholder?: string;
  includeInactive?: boolean;
}

export const GroupedProductSelector: React.FC<GroupedProductSelectorProps> = ({
  onSelect,
  selectedProductId,
  className = '',
  placeholder = 'Select a product',
  includeInactive = false,
}) => {
  const [selectedParent, setSelectedParent] = useState<GroupedProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);

  const { data: groupedProductsData, isLoading, error } = useGroupedProducts({
    include_inactive: includeInactive,
    include_variants_only: false,
  });

  const groupedProducts = groupedProductsData?.grouped_products || [];

  // Reset selections when selectedProductId changes
  useEffect(() => {
    if (selectedProductId) {
      // Find the product in grouped products
      for (const group of groupedProducts) {
        const variant = group.variants.find(v => v.id === selectedProductId);
        if (variant) {
          setSelectedParent(group);
          setSelectedVariant(variant);
          return;
        }
      }
    } else {
      setSelectedParent(null);
      setSelectedVariant(null);
    }
  }, [selectedProductId, groupedProducts]);

  const handleParentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const parentId = e.target.value;
    const parent = groupedProducts.find(g => g.parent.id === parentId);
    setSelectedParent(parent || null);
    setSelectedVariant(null);
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const variantId = e.target.value;
    const variant = selectedParent?.variants.find(v => v.id === variantId);
    if (variant) {
      setSelectedVariant(variant);
      onSelect(variant);
    }
  };

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
        <div className="h-10 bg-gray-200 rounded animate-pulse opacity-50" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-red-600 text-sm ${className}`}>
        Error loading products: {error.message}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Parent Product Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Parent Product
        </label>
        <select
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={selectedParent?.parent.id || ''}
          onChange={handleParentChange}
        >
          <option value="">Select Parent Product</option>
          {groupedProducts.map(group => (
            <option key={group.parent.id} value={group.parent.id}>
              {group.parent.name} ({group.parent.sku}) - {group.variants.length} variants
            </option>
          ))}
        </select>
      </div>

      {/* Variant Dropdown */}
      {selectedParent && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product Variant
          </label>
          <select
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedVariant?.id || ''}
            onChange={handleVariantChange}
          >
            <option value="">Select Variant</option>
            {selectedParent.variants.map(variant => (
              <option key={variant.id} value={variant.id}>
                {variant.name} ({variant.sku_variant}) - {variant.sku}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected Product Info */}
      {selectedVariant && (
        <div className="mt-3 p-3 bg-blue-50 rounded-md">
          <h4 className="font-medium text-blue-900">Selected Product:</h4>
          <p className="text-sm text-blue-700">
            <strong>Name:</strong> {selectedVariant.name}
          </p>
          <p className="text-sm text-blue-700">
            <strong>SKU:</strong> {selectedVariant.sku}
          </p>
          <p className="text-sm text-blue-700">
            <strong>Variant:</strong> {selectedVariant.sku_variant}
          </p>
          {selectedVariant.capacity_kg && (
            <p className="text-sm text-blue-700">
              <strong>Capacity:</strong> {selectedVariant.capacity_kg} kg
            </p>
          )}
        </div>
      )}

      {/* Summary Statistics */}
      {groupedProductsData?.summary && (
        <div className="mt-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
          <p>
            {groupedProductsData.summary.total_parent_products} parent products, {' '}
            {groupedProductsData.summary.total_variants} variants
          </p>
        </div>
      )}
    </div>
  );
};

export default GroupedProductSelector;