import React, { useState } from 'react';
import { Eye, Edit, Trash2, Loader2, Package, Cylinder, Weight, RotateCcw } from 'lucide-react';
import { Product } from '../../types/product';
import { StatusBadge } from '../ui/StatusBadge';
import { useReactivateProduct } from '../../hooks/useProducts';
import { formatDateSync } from '../../utils/order';

interface ProductTableProps {
  products: Product[];
  loading?: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  selectedProducts?: string[];
  onSelectionChange?: (productIds: string[]) => void;
}

export const ProductTable: React.FC<ProductTableProps> = ({
  products,
  loading = false,
  onView,
  onEdit,
  onDelete,
  selectedProducts = [],
  onSelectionChange,
}) => {
  const [selectAll, setSelectAll] = useState(false);
  const reactivateProduct = useReactivateProduct();


  const formatWeight = (weight?: number) => {
    if (!weight) return '-';
    return `${weight} kg`;
  };

  const getUnitIcon = (unit: string) => {
    return unit === 'cylinder' ? Cylinder : Weight;
  };

  const getStatusBadgeType = (status: string) => {
    switch (status) {
      case 'active':
        return 'active';
      case 'end_of_sale':
        return 'credit_hold'; // Using yellow color
      case 'obsolete':
        return 'closed'; // Using red color
      default:
        return 'active';
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (onSelectionChange) {
      onSelectionChange(checked ? products.map(p => p.id) : []);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedProducts, productId]
        : selectedProducts.filter(id => id !== productId);
      onSelectionChange(newSelection);
      setSelectAll(newSelection.length === products.length);
    }
  };

  const handleReactivate = async (product: Product) => {
    try {
      await reactivateProduct.mutateAsync(product.id);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  console.log('ProductTable render:', { products, loading });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading products...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <Package className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500">
            {products === null ? 'Failed to load products. Please check your connection.' : 'Get started by adding your first product.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Products ({products.length})
        </h3>
        {selectedProducts.length > 0 && (
          <span className="text-sm text-blue-600">
            {selectedProducts.length} selected
          </span>
        )}
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {onSelectionChange && (
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type & Specs
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((product) => {
              const UnitIcon = getUnitIcon(product.unit_of_measure);
              const isObsolete = product.status === 'obsolete';
              
              return (
                <tr key={product.id} className={`hover:bg-gray-50 ${isObsolete ? 'opacity-60' : ''}`}>
                  {onSelectionChange && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {product.name}
                        {isObsolete && (
                          <span className="ml-2 text-xs text-red-600">(Obsolete)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        SKU: {product.sku}
                      </div>
                      {product.description && (
                        <div className="text-xs text-gray-400 mt-1 max-w-xs truncate">
                          {product.description}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <UnitIcon className="h-4 w-4 text-gray-400" />
                      <div className="text-sm text-gray-900">
                        <div className="capitalize">{product.unit_of_measure}</div>
                        {product.unit_of_measure === 'cylinder' && (
                          <div className="text-xs text-gray-500">
                            {product.capacity_kg && `${product.capacity_kg} kg capacity`}
                            {product.tare_weight_kg && ` • ${product.tare_weight_kg} kg tare`}
                          </div>
                        )}
                        {product.valve_type && (
                          <div className="text-xs text-gray-500">
                            Valve: {product.valve_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge 
                      status={getStatusBadgeType(product.status) as any}
                      className="capitalize"
                    >
                      {product.status.replace('_', ' ')}
                    </StatusBadge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateSync(product.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onView(product)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="View product"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {!isObsolete && (
                        <button
                          onClick={() => onEdit(product)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                          title="Edit product"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {isObsolete ? (
                        <button
                          onClick={() => handleReactivate(product)}
                          disabled={reactivateProduct.isPending}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                          title="Reactivate product"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onDelete(product)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Mark as obsolete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};