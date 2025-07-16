import React, { useState } from 'react';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Loader2, 
  Package, 
  Cylinder, 
  Weight, 
  Wrench,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Scale,
} from 'lucide-react';
import { Product } from '../../types/product';
import { Accessory } from '../../types/accessory';
import { StatusBadge } from '../ui/StatusBadge';
import { useReactivateProduct } from '../../hooks/useProducts';
import { formatDateSync } from '../../utils/order';

interface GroupedProduct {
  parent: Product;
  variants: Product[];
}

interface UnifiedItem {
  id: string;
  item_type: 'product' | 'accessory';
  sku: string;
  name: string;
  status: string;
  created_at: string;
  // Product-specific fields
  capacity_kg?: number;
  tare_weight_kg?: number;
  gross_weight_kg?: number;
  unit_of_measure?: string;
  // Accessory-specific fields
  price?: number;
  category?: {
    id: string;
    name: string;
  };
  vat_code?: string;
}

interface UnifiedItemsTableProps {
  products: GroupedProduct[];
  accessories: Accessory[];
  loading?: boolean;
  viewMode?: 'products' | 'accessories' | 'all';
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onViewAccessory: (accessory: Accessory) => void;
  onEditAccessory: (accessory: Accessory) => void;
  onDeleteAccessory: (accessory: Accessory) => void;
  selectedItems?: string[];
  onSelectionChange?: (itemIds: string[]) => void;
}

export const UnifiedItemsTable: React.FC<UnifiedItemsTableProps> = ({
  products,
  accessories,
  loading = false,
  viewMode = 'all',
  onViewProduct,
  onEditProduct,
  onDeleteProduct,
  onViewAccessory,
  onEditAccessory,
  onDeleteAccessory,
  selectedItems = [],
  onSelectionChange,
}) => {
  const [selectAll, setSelectAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const reactivateProduct = useReactivateProduct();

  const formatWeight = (weight?: number) => {
    if (!weight) return '-';
    return `${weight} kg`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return '-';
    return `$${price.toFixed(2)}`;
  };

  const getItemIcon = (itemType: 'product' | 'accessory') => {
    return itemType === 'product' ? Cylinder : Wrench;
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

  // Convert products and accessories to unified format
  const unifiedItems: UnifiedItem[] = [
    // Add products
    ...products.flatMap(group => [
      {
        id: group.parent.id,
        item_type: 'product' as const,
        sku: group.parent.sku,
        name: group.parent.name,
        status: group.parent.status,
        created_at: group.parent.created_at,
        capacity_kg: group.parent.capacity_kg,
        tare_weight_kg: group.parent.tare_weight_kg,
        gross_weight_kg: group.parent.gross_weight_kg,
        unit_of_measure: group.parent.unit_of_measure,
      },
      ...group.variants.map(variant => ({
        id: variant.id,
        item_type: 'product' as const,
        sku: variant.sku,
        name: variant.name,
        status: variant.status,
        created_at: variant.created_at,
        capacity_kg: variant.capacity_kg,
        tare_weight_kg: variant.tare_weight_kg,
        gross_weight_kg: variant.gross_weight_kg,
        unit_of_measure: variant.unit_of_measure,
      }))
    ]),
    // Add accessories
    ...accessories.map(accessory => ({
      id: accessory.id,
      item_type: 'accessory' as const,
      sku: accessory.sku,
      name: accessory.name,
      status: accessory.active ? 'active' : 'inactive',
      created_at: accessory.created_at,
      price: accessory.price,
      category: accessory.category,
      vat_code: accessory.vat_code,
    }))
  ];

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (onSelectionChange) {
      const allItemIds = unifiedItems.map(item => item.id);
      onSelectionChange(checked ? allItemIds : []);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedItems, itemId]
        : selectedItems.filter(id => id !== itemId);
      onSelectionChange(newSelection);
      
      const allItemIds = unifiedItems.map(item => item.id);
      setSelectAll(newSelection.length === allItemIds.length);
    }
  };

  const handleReactivate = async (product: Product) => {
    try {
      const isParentProduct = !product.parent_products_id;
      await reactivateProduct.mutateAsync({ 
        id: product.id,
        is_parent_product: isParentProduct
      });
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const toggleRow = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const isRowExpanded = (itemId: string) => expandedRows.has(itemId);

  const renderItemRow = (item: UnifiedItem) => {
    const ItemIcon = getItemIcon(item.item_type);
    const isSelected = selectedItems.includes(item.id);
    const isProduct = item.item_type === 'product';
    const isAccessory = item.item_type === 'accessory';

    return (
      <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
              />
            )}
            
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <ItemIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 truncate">{item.sku}</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    isProduct ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {isProduct ? 'Item' : 'Accessory'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 truncate">{item.name}</div>
                {isAccessory && item.category && (
                  <div className="text-xs text-gray-400">{item.category.name}</div>
                )}
              </div>
            </div>
          </div>
        </td>

                 <td className="px-6 py-4 whitespace-nowrap">
           <StatusBadge 
             status={item.status} 
           />
         </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {isProduct ? formatWeight(item.capacity_kg) : formatPrice(item.price)}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {isProduct ? formatWeight(item.tare_weight_kg) : (item.vat_code || '-')}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {isProduct ? formatWeight(item.gross_weight_kg) : (item.category?.name || '-')}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {formatDateSync(item.created_at)}
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => {
                if (isProduct) {
                  const product = products.flatMap(g => [g.parent, ...g.variants]).find(p => p.id === item.id);
                  if (product) onViewProduct(product);
                } else {
                  const accessory = accessories.find(a => a.id === item.id);
                  if (accessory) onViewAccessory(accessory);
                }
              }}
              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
              title="View item"
            >
              <Eye className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                if (isProduct) {
                  const product = products.flatMap(g => [g.parent, ...g.variants]).find(p => p.id === item.id);
                  if (product) onEditProduct(product);
                } else {
                  const accessory = accessories.find(a => a.id === item.id);
                  if (accessory) onEditAccessory(accessory);
                }
              }}
              className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
              title="Edit item"
            >
              <Edit className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                if (isProduct) {
                  const product = products.flatMap(g => [g.parent, ...g.variants]).find(p => p.id === item.id);
                  if (product) onDeleteProduct(product);
                } else {
                  const accessory = accessories.find(a => a.id === item.id);
                  if (accessory) onDeleteAccessory(accessory);
                }
              }}
              className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
              title="Delete item"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading items...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  {onSelectionChange && (
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                    />
                  )}
                  <span>{viewMode === 'accessories' ? 'ACCESSORY' : viewMode === 'products' ? 'PRODUCT' : 'ITEM'}</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                STATUS
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <Scale className="h-4 w-4 mr-1" />
                  {viewMode === 'accessories' ? 'PRICE' : 'CAPACITY/PRICE'}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <Weight className="h-4 w-4 mr-1" />
                  {viewMode === 'accessories' ? 'VAT CODE' : 'TARE WEIGHT/VAT'}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex items-center">
                  <Weight className="h-4 w-4 mr-1" />
                  {viewMode === 'accessories' ? 'CATEGORY' : 'GROSS WEIGHT'}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                CREATED
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {unifiedItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No {viewMode === 'accessories' ? 'accessories' : viewMode === 'products' ? 'products' : 'items'} found
                </td>
              </tr>
            ) : (
              unifiedItems.map(renderItemRow)
            )}
          </tbody>
        </table>
      </div>
      
      {unifiedItems.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <div>
              Showing {unifiedItems.length} {viewMode === 'accessories' ? 'accessories' : viewMode === 'products' ? 'products' : 'items'}
              {viewMode === 'all' && products.length > 0 && accessories.length > 0 && (
                <span> ({products.length} products, {accessories.length} accessories)</span>
              )}
            </div>
            <div>
              Total {viewMode === 'accessories' ? 'accessories' : viewMode === 'products' ? 'products' : 'items'}: {unifiedItems.length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 