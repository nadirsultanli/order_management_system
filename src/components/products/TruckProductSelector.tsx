import React, { useState } from 'react';
import { Search, X, Package, AlertTriangle, Truck } from 'lucide-react';
import { trpc } from '../../lib/trpc-client';

interface ProductWithStock {
  id: string;
  name: string;
  sku: string;
  unit_of_measure: string;
  qty_full: number;
  qty_empty: number;
}

interface TruckProductSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: ProductWithStock) => void;
  truckId: string;
  selectedProductIds?: string[];
}

export const TruckProductSelector: React.FC<TruckProductSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  truckId,
  selectedProductIds = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { data: truckData, isLoading, error } = trpc.trucks.get.useQuery({ id: truckId }, {
    enabled: Boolean(truckId) && isOpen,
  });

  if (!isOpen) return null;

  const truckInventory = truckData?.inventory || [];

  // Filter inventory based on search term and availability
  const filteredProducts = truckInventory
    .filter((item: any) => {
      const hasStock = (item.qty_full > 0 || item.qty_empty > 0);
      const matchesSearch = !searchTerm || 
        item.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return hasStock && matchesSearch;
    })
    .map((item: any) => ({
      id: item.product_id,
      name: item.product?.name || 'Unknown Product',
      sku: item.product?.sku || 'Unknown SKU',
      unit_of_measure: item.product?.unit_of_measure || 'units',
      qty_full: item.qty_full || 0,
      qty_empty: item.qty_empty || 0,
    }))
    .filter((product: ProductWithStock) => !selectedProductIds.includes(product.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Truck className="h-5 w-5 mr-2 text-blue-600" />
            Select Product from Truck Inventory
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or SKU..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-gray-600">Loading truck inventory...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600">Failed to load truck inventory</p>
              <p className="text-sm text-gray-500 mt-1">{(error as Error).message}</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No products found matching your search' : 'No products available in this truck'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Products must have inventory on the truck to appear here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((product: ProductWithStock) => (
                <button
                  key={product.id}
                  onClick={() => {
                    onSelect(product);
                    onClose();
                  }}
                  className="w-full text-left p-4 hover:bg-blue-50 rounded-lg transition-colors border border-gray-200"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        SKU: {product.sku} • {product.unit_of_measure}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">
                        Available on Truck
                      </div>
                      <div className="text-sm text-gray-600">
                        <span className="inline-block mr-3">
                          <span className="font-medium text-green-600">{product.qty_full}</span> full
                        </span>
                        <span className="inline-block">
                          <span className="font-medium text-gray-600">{product.qty_empty}</span> empty
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <p>• Only products with inventory on the truck are shown</p>
            <p>• Stock levels are updated in real-time</p>
            <p>• Already selected products are hidden from this list</p>
          </div>
        </div>
      </div>
    </div>
  );
}; 