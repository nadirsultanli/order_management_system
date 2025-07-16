import React from 'react';
import { Package, Edit, ArrowRightLeft, Loader2, AlertTriangle, Eye, Truck, AlertCircle, Wrench, XCircle } from 'lucide-react';
import { InventoryBalance } from '../../types/inventory';
import { formatDateSync } from '../../utils/order';

interface InventoryTableProps {
  inventory: InventoryBalance[];
  loading?: boolean;
  onAdjustStock: (item: InventoryBalance) => void;
  onTransferStock: (item: InventoryBalance) => void;
}

interface StockStatusBadgeProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
}

const StockStatusBadge: React.FC<StockStatusBadgeProps> = ({ label, count, icon, colorClass }) => {
  if (count === 0) return null;
  
  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {icon}
      <span>{label}: {count}</span>
    </div>
  );
};

export const InventoryTable: React.FC<InventoryTableProps> = ({
  inventory,
  loading = false,
  onAdjustStock,
  onTransferStock,
}) => {

  const getAvailabilityColor = (available: number) => {
    if (available === 0) return 'text-red-600 bg-red-50';
    if (available <= 10) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  const getAvailabilityIcon = (available: number) => {
    if (available === 0) return <AlertTriangle className="h-4 w-4" />;
    if (available <= 10) return <AlertTriangle className="h-4 w-4" />;
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading inventory...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <Package className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory found</h3>
          <p className="text-gray-500">
            No inventory records found for the selected filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header removed as per design update */}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                On Hand
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Available
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock Status Breakdown
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Updated
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {inventory.map((item) => {
              const onHandQty = item.qty_full + item.qty_empty;
              const available = item.qty_full - item.qty_reserved;
              const availabilityColor = getAvailabilityColor(available);
              const availabilityIcon = getAvailabilityIcon(available);

              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {item.product?.name || 'Unknown Product'}
                      </div>
                      <div className="text-sm text-gray-500">
                        SKU: {item.product?.sku || 'N/A'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {item.warehouse?.name || 'Unknown Warehouse'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{onHandQty}</div>
                      <div className="text-xs space-y-1">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {item.qty_full} FULL
                          </span>
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {item.qty_empty} EMPTY
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-sm font-medium ${availabilityColor}`}>
                      {availabilityIcon}
                      <span>{available}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      <StockStatusBadge 
                        label="Allocated" 
                        count={item.qty_reserved} 
                        icon={<Eye className="h-3 w-3" />}
                        colorClass="text-blue-700 bg-blue-50"
                      />
                      <StockStatusBadge 
                        label="Quarantine" 
                        count={item.qty_quarantine || 0} 
                        icon={<AlertCircle className="h-3 w-3" />}
                        colorClass="text-yellow-700 bg-yellow-50"
                      />
                      <StockStatusBadge 
                        label="Damaged" 
                        count={item.qty_damaged || 0} 
                        icon={<XCircle className="h-3 w-3" />}
                        colorClass="text-red-700 bg-red-50"
                      />
                      <StockStatusBadge 
                        label="Maintenance" 
                        count={item.qty_under_maintenance || 0} 
                        icon={<Wrench className="h-3 w-3" />}
                        colorClass="text-orange-700 bg-orange-50"
                      />
                      <StockStatusBadge 
                        label="In Transit" 
                        count={item.qty_in_transit || 0} 
                        icon={<Truck className="h-3 w-3" />}
                        colorClass="text-purple-700 bg-purple-50"
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateSync(item.updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => onAdjustStock(item)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="Adjust stock"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onTransferStock(item)}
                        className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 transition-colors"
                        title="Transfer stock"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
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