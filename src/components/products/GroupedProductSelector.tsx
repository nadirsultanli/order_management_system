import React, { useState, useEffect } from 'react';
import { ChevronDown, Package, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { Product } from '../../types/product';

interface GroupedProductSelectorProps {
  selectedParentId?: string;
  selectedVariantId?: string;
  onParentChange: (parentId: string, parent: Product) => void;
  onVariantChange: (variantId: string, variant: Product) => void;
  onSelectionComplete?: (parent: Product, variant: Product) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

interface ParentProduct extends Product {
  variant_count: number;
  variants: Product[];
}

export const GroupedProductSelector: React.FC<GroupedProductSelectorProps> = ({
  selectedParentId,
  selectedVariantId,
  onParentChange,
  onVariantChange,
  onSelectionComplete,
  disabled = false,
  placeholder = 'Select a product...',
  className = '',
}) => {
  const [isParentOpen, setIsParentOpen] = useState(false);
  const [isVariantOpen, setIsVariantOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState<ParentProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Product | null>(null);
  const [availableVariants, setAvailableVariants] = useState<Product[]>([]);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  // Fetch parent products (non-variants)
  const { 
    data: parentProductsData, 
    isLoading: isLoadingParents, 
    error: parentError 
  } = useProducts({ 
    is_variant: false, // Only show parent products
    status: 'active',
    limit: 1000 
  });

  const parentProducts = parentProductsData?.products || [];

  // Load variants when parent is selected
  useEffect(() => {
    if (selectedParentId && selectedParentId !== selectedParent?.id) {
      const parent = parentProducts.find((p: Product) => p.id === selectedParentId);
      if (parent) {
        setSelectedParent(parent as ParentProduct);
        loadVariants(selectedParentId);
      }
    }
  }, [selectedParentId, parentProducts]);

  // Set selected variant when variant ID changes
  useEffect(() => {
    if (selectedVariantId && availableVariants.length > 0) {
      const variant = availableVariants.find(v => v.id === selectedVariantId);
      if (variant) {
        setSelectedVariant(variant);
      }
    }
  }, [selectedVariantId, availableVariants]);

  const loadVariants = async (parentId: string) => {
    setIsLoadingVariants(true);
    try {
      // In a real implementation, this would be a tRPC call to get variants
      // For now, we'll use the existing products hook with variant filters
      const variantQuery = useProducts({ 
        parent_products_id: parentId, 
        is_variant: true, // Only show variants
        status: 'active',
        limit: 1000 
      });
      
      // This is a simplified approach - in reality you'd need a proper variants endpoint
      setAvailableVariants(variantQuery.data?.products || []);
    } catch (error) {
      console.error('Failed to load variants:', error);
      setAvailableVariants([]);
    } finally {
      setIsLoadingVariants(false);
    }
  };

  const handleParentSelect = (parent: ParentProduct) => {
    setSelectedParent(parent);
    setSelectedVariant(null);
    setIsParentOpen(false);
    setAvailableVariants([]);
    
    onParentChange(parent.id, parent);
    loadVariants(parent.id);
  };

  const handleVariantSelect = (variant: Product) => {
    setSelectedVariant(variant);
    setIsVariantOpen(false);
    
    onVariantChange(variant.id, variant);
    
    if (selectedParent && onSelectionComplete) {
      onSelectionComplete(selectedParent, variant);
    }
  };

  const generateAutoSKU = (parent: ParentProduct, variant: Product) => {
    return `${parent.sku}-${variant.sku_variant || 'VAR'}`;
  };

  if (parentError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center space-x-2 text-red-800">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">Failed to load products. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Parent Product Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Package className="inline h-4 w-4 mr-1" />
          Parent Product
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsParentOpen(!isParentOpen)}
            disabled={disabled || isLoadingParents}
            className={`w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              disabled ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="block truncate">
                {isLoadingParents ? (
                  <span className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading products...
                  </span>
                ) : selectedParent ? (
                  <span>
                    {selectedParent.name}
                    <span className="text-gray-500 text-sm ml-2">
                      ({selectedParent.variant_count || 0} variants)
                    </span>
                  </span>
                ) : (
                  placeholder
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </button>

          {isParentOpen && !isLoadingParents && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {parentProducts.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Package className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No parent products found</p>
                </div>
              ) : (
                parentProducts.map((parent: Product) => (
                  <button
                    key={parent.id}
                    onClick={() => handleParentSelect(parent as ParentProduct)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:outline-none focus:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{parent.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {parent.sku}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {(parent as ParentProduct).variant_count || 0} variants
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Variant Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Tag className="inline h-4 w-4 mr-1" />
          Product Variant
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsVariantOpen(!isVariantOpen)}
            disabled={disabled || !selectedParent || isLoadingVariants}
            className={`w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              disabled || !selectedParent ? 'bg-gray-50 text-gray-400' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="block truncate">
                {isLoadingVariants ? (
                  <span className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading variants...
                  </span>
                ) : selectedVariant ? (
                  <span>
                    {selectedVariant.name}
                    <span className="text-gray-500 text-sm ml-2">
                      ({selectedVariant.sku_variant})
                    </span>
                  </span>
                ) : !selectedParent ? (
                  'Select parent product first'
                ) : (
                  'Select variant...'
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
          </button>

          {isVariantOpen && selectedParent && !isLoadingVariants && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {availableVariants.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Tag className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No variants available for this product</p>
                </div>
              ) : (
                availableVariants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => handleVariantSelect(variant)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 focus:outline-none focus:bg-blue-50 border-b border-gray-100 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{variant.name}</div>
                        <div className="text-sm text-gray-500">
                          SKU: {generateAutoSKU(selectedParent, variant)}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {variant.sku_variant}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selection Summary */}
      {selectedParent && selectedVariant && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Selected Product</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Parent:</span>
              <span className="font-medium text-blue-900">{selectedParent.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Variant:</span>
              <span className="font-medium text-blue-900">{selectedVariant.sku_variant}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Auto SKU:</span>
              <span className="font-mono text-blue-900">{generateAutoSKU(selectedParent, selectedVariant)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};