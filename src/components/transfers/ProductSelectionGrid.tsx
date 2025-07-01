import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, AlertCircle, CheckCircle2, Filter } from 'lucide-react';
import { Product } from '../../types/product';
import { WarehouseStockInfo, ProductSelectionFilters } from '../../types/transfer';
import { useProductSelection, useWarehouseStock } from '../../hooks/useMultiSkuTransfers';

interface ProductSelectionGridProps {
  warehouseId: string;
  onProductSelect: (product: Product, quantity: number, stockInfo: WarehouseStockInfo) => void;
  selectedProductIds: string[]; // To show which products are already selected
  disabled?: boolean;
}

export const ProductSelectionGrid: React.FC<ProductSelectionGridProps> = ({
  warehouseId,
  onProductSelect,
  selectedProductIds,
  disabled = false
}) => {
  const [filters, setFilters] = useState<ProductSelectionFilters>({
    warehouse_id: warehouseId,
    has_stock: true,
    search_text: '',
    variant_type: undefined,
    variant_name: undefined
  });

  const [showFilters, setShowFilters] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { products, loading: productsLoading, searchProducts } = useProductSelection();
  const { stockInfo, loading: stockLoading, fetchStockInfo } = useWarehouseStock(warehouseId);

  // Fetch products and stock info when filters change
  useEffect(() => {
    if (filters.warehouse_id) {
      searchProducts(filters);
      fetchStockInfo(filters);
    }
  }, [filters, searchProducts, fetchStockInfo]);

  const handleSearch = (searchText: string) => {
    setFilters(prev => ({ ...prev, search_text: searchText }));
  };

  const handleFilterChange = (key: keyof ProductSelectionFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleQuantityChange = (productKey: string, quantity: number) => {
    setQuantities(prev => ({ ...prev, [productKey]: quantity }));
  };

  const handleAddProduct = (product: Product) => {
    const productKey = `${product.id}-${product.variant_name || 'default'}`;
    const quantity = quantities[productKey] || 1;
    
    const stockForProduct = stockInfo.find(
      stock => stock.product_id === product.id && stock.variant_name === product.variant_name
    );

    if (!stockForProduct) {
      alert('Stock information not found for this product');
      return;
    }

    if (quantity > stockForProduct.qty_available) {
      alert(`Quantity exceeds available stock (${stockForProduct.qty_available})`);
      return;
    }

    onProductSelect(product, quantity, stockForProduct);
    // Reset quantity after adding
    setQuantities(prev => ({ ...prev, [productKey]: 1 }));
  };

  const getStockInfo = (productId: string, variantName?: string) => {
    return stockInfo.find(
      stock => stock.product_id === productId && stock.variant_name === variantName
    );
  };

  const isProductSelected = (productId: string, variantName?: string) => {
    const productKey = `${productId}-${variantName || 'default'}`;
    return selectedProductIds.includes(productKey);
  };

  const getStockStatus = (stock?: WarehouseStockInfo) => {
    if (!stock || stock.qty_available === 0) {
      return { status: 'out-of-stock', color: 'text-red-600 bg-red-100', text: 'Out of Stock' };
    }
    if (stock.qty_available <= (stock.reorder_level || 0)) {
      return { status: 'low-stock', color: 'text-yellow-600 bg-yellow-100', text: 'Low Stock' };
    }
    return { status: 'in-stock', color: 'text-green-600 bg-green-100', text: 'In Stock' };
  };

  const loading = productsLoading || stockLoading;

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header with Search and Filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Products</h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={filters.search_text || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Variant Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Type
                </label>
                <select
                  value={filters.variant_type || ''}
                  onChange={(e) => handleFilterChange('variant_type', e.target.value || undefined)}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
                >
                  <option value="">All Types</option>
                  <option value="cylinder">Cylinders</option>
                  <option value="refillable">Refillable</option>
                  <option value="disposable">Disposable</option>
                </select>
              </div>

              {/* Variant Name Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variant
                </label>
                <select
                  value={filters.variant_name || ''}
                  onChange={(e) => handleFilterChange('variant_name', e.target.value || undefined)}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
                >
                  <option value="">All Variants</option>
                  <option value="full">Full</option>
                  <option value="empty">Empty</option>
                </select>
              </div>

              {/* Stock Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Status
                </label>
                <select
                  value={filters.has_stock ? 'in-stock' : 'all'}
                  onChange={(e) => handleFilterChange('has_stock', e.target.value === 'in-stock')}
                  className="block w-full border border-gray-300 rounded-md py-2 px-3 text-sm"
                >
                  <option value="all">All Products</option>
                  <option value="in-stock">In Stock Only</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Product Grid */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="ml-2 text-gray-600">Loading products...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No products found</p>
            <p className="text-sm text-gray-500">
              Try adjusting your search criteria or filters
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => {
              const stock = getStockInfo(product.id, product.variant_name);
              const stockStatus = getStockStatus(stock);
              const productKey = `${product.id}-${product.variant_name || 'default'}`;
              const isSelected = isProductSelected(product.id, product.variant_name);
              const currentQuantity = quantities[productKey] || 1;

              return (
                <div
                  key={productKey}
                  className={`border rounded-lg p-4 transition-all duration-200 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : disabled || stockStatus.status === 'out-of-stock'
                      ? 'border-gray-200 bg-gray-50 opacity-75'
                      : 'border-gray-300 hover:border-blue-300 hover:shadow-sm'
                  }`}
                >
                  {/* Product Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {product.name}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1">
                        SKU: {product.sku}
                      </p>
                      {product.variant_name && (
                        <span className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mt-1">
                          {product.variant_name}
                        </span>
                      )}
                    </div>
                    
                    {/* Status Badge */}
                    <span className={`text-xs px-2 py-1 rounded-full ${stockStatus.color}`}>
                      {stockStatus.text}
                    </span>
                  </div>

                  {/* Stock Information */}
                  {stock && (
                    <div className="mb-3 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Available:</span>
                        <span className="font-medium">{stock.qty_available}</span>
                      </div>
                      {stock.qty_reserved > 0 && (
                        <div className="flex justify-between">
                          <span>Reserved:</span>
                          <span>{stock.qty_reserved}</span>
                        </div>
                      )}
                      {product.capacity_kg && (
                        <div className="flex justify-between">
                          <span>Weight:</span>
                          <span>{product.capacity_kg}kg</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quantity Selection */}
                  {stockStatus.status !== 'out-of-stock' && !disabled && (
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="1"
                          max={stock?.qty_available || 999}
                          value={currentQuantity}
                          onChange={(e) => handleQuantityChange(productKey, parseInt(e.target.value) || 1)}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <span className="text-xs text-gray-500">
                          max {stock?.qty_available || 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Action Button */}
                  <div>
                    {isSelected ? (
                      <div className="flex items-center justify-center py-2 text-sm text-blue-600">
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Selected
                      </div>
                    ) : stockStatus.status === 'out-of-stock' ? (
                      <div className="flex items-center justify-center py-2 text-sm text-gray-500">
                        <AlertCircle className="h-4 w-4 mr-1" />
                        Out of Stock
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddProduct(product)}
                        disabled={disabled || currentQuantity > (stock?.qty_available || 0)}
                        className={`w-full flex items-center justify-center py-2 px-3 text-sm font-medium rounded-md ${
                          disabled || currentQuantity > (stock?.qty_available || 0)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add to Transfer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {products.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>
              Showing {products.length} product{products.length !== 1 ? 's' : ''}
            </span>
            <span>
              {selectedProductIds.length} selected for transfer
            </span>
          </div>
        </div>
      )}
    </div>
  );
}; 