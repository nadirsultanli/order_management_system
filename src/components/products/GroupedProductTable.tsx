import React, { useState } from 'react';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Loader2, 
  Package, 
  Cylinder, 
  Weight, 
  RotateCcw, 
  Scale,
  ChevronDown,
  ChevronRight,
  Users,
  Tag
} from 'lucide-react';
import { Product } from '../../types/product';
import { StatusBadge } from '../ui/StatusBadge';
import { useReactivateProduct } from '../../hooks/useProducts';
import { formatDateSync } from '../../utils/order';

interface GroupedProduct {
  parent: Product;
  variants: Product[];
}

interface GroupedProductTableProps {
  products: GroupedProduct[];
  loading?: boolean;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  selectedProducts?: string[];
  onSelectionChange?: (productIds: string[]) => void;
}

export const GroupedProductTable: React.FC<GroupedProductTableProps> = ({
  products,
  loading = false,
  onView,
  onEdit,
  onDelete,
  selectedProducts = [],
  onSelectionChange,
}) => {
  const [selectAll, setSelectAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
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
      case 'obsolete':
        return 'obsolete';
      default:
        return 'active';
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (onSelectionChange) {
      const allProductIds = products.flatMap(group => [group.parent.id, ...group.variants.map(v => v.id)]);
      onSelectionChange(checked ? allProductIds : []);
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedProducts, productId]
        : selectedProducts.filter(id => id !== productId);
      onSelectionChange(newSelection);
      
      const allProductIds = products.flatMap(group => [group.parent.id, ...group.variants.map(v => v.id)]);
      setSelectAll(newSelection.length === allProductIds.length);
    }
  };

  const handleReactivate = async (product: Product) => {
    try {
      await reactivateProduct.mutateAsync({ id: product.id });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const toggleRow = (productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  };

  const isRowExpanded = (productId: string) => expandedRows.has(productId);

  const renderProductRow = (product: Product, isVariant: boolean = false, hasVariants: boolean = false) => {
    const UnitIcon = getUnitIcon(product.unit_of_measure);
    const isSelected = selectedProducts.includes(product.id);
    const canExpand = !isVariant && hasVariants;

    return (
      <tr key={product.id} className={`border-b border-gray-200 hover:bg-gray-50 ${isVariant ? 'bg-gray-50' : ''}`}>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
              />
            )}
            
            {canExpand && (
              <button
                onClick={() => toggleRow(product.id)}
                className="mr-2 p-1 rounded hover:bg-gray-200 transition-colors"
              >
                {isRowExpanded(product.id) ? (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
            
            {isVariant && (
              <div className="mr-4 ml-6">
                <Tag className="h-4 w-4 text-gray-400" />
              </div>
            )}
            
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <UnitIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 truncate">{product.sku}</span>
                  {isVariant && product.sku_variant && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {product.sku_variant}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 truncate">{product.name}</div>
              </div>
            </div>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <StatusBadge 
            status={product.status} 
            type={getStatusBadgeType(product.status)}
          />
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatWeight(product.capacity_kg)}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatWeight(product.tare_weight_kg)}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {formatWeight(product.gross_weight_kg)}
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

            <button
              onClick={() => onEdit(product)}
              className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
              title="Edit product"
            >
              <Edit className="h-4 w-4" />
            </button>

            {product.status === 'active' ? (
              <button
                onClick={() => onDelete(product)}
                className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                title="Mark as obsolete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(product)}
                disabled={reactivateProduct.isPending}
                className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors disabled:opacity-50"
                title="Reactivate product"
              >
                {reactivateProduct.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

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
            Get started by adding your first product.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-2">
                  {onSelectionChange && (
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  )}
                  <span>Product</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <Scale className="h-4 w-4" />
                  <span>Capacity</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <Weight className="h-4 w-4" />
                  <span>Tare Weight</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center space-x-1">
                  <Weight className="h-4 w-4" />
                  <span>Gross Weight</span>
                </div>
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
            {products.map((group) => {
              const hasVariants = group.variants.length > 0;
              const isExpanded = isRowExpanded(group.parent.id);
              
              return (
                <React.Fragment key={group.parent.id}>
                  {renderProductRow(group.parent, false, hasVariants)}
                  
                  {isExpanded && group.variants.map((variant) => 
                    renderProductRow(variant, true, false)
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {products.length > 0 && (
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div>
              Showing {products.length} parent products with {products.reduce((total, group) => total + group.variants.length, 0)} variants
            </div>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span>Total products: {products.length + products.reduce((total, group) => total + group.variants.length, 0)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};