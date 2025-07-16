import React from 'react';
import { Package, Edit, Search, Loader2, AlertTriangle, CheckCircle, XCircle, Clock, Wrench } from 'lucide-react';

// Types for cylinder assets (based on our database schema)
interface CylinderAsset {
  id: string;
  serial_number: string;
  product_name: string;
  product_sku: string;
  warehouse_name: string;
  current_condition: 'full' | 'empty' | 'damaged' | 'quarantine' | 'under_maintenance';
  regulatory_status: 'compliant' | 'due_inspection' | 'due_pressure_test' | 'expired' | 'failed';
  last_pressure_test_date?: string;
  next_pressure_test_due?: string;
  last_inspection_date?: string;
  next_inspection_due?: string;
  total_fill_cycles: number;
  is_active: boolean;
  customer_name?: string;
  updated_at: string;
}

interface CylinderAssetsTableProps {
  assets: CylinderAsset[];
  loading?: boolean;
  onEditAsset?: (asset: CylinderAsset) => void;
  onViewHistory?: (asset: CylinderAsset) => void;
}

interface StatusBadgeProps {
  status: string;
  type: 'condition' | 'regulatory';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type }) => {
  const getStatusConfig = () => {
    if (type === 'condition') {
      switch (status) {
        case 'full':
          return { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Full' };
        case 'empty':
          return { color: 'bg-gray-100 text-gray-800', icon: <Package className="h-3 w-3" />, label: 'Empty' };
        case 'damaged':
          return { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Damaged' };
        case 'quarantine':
          return { color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="h-3 w-3" />, label: 'Quarantine' };
        case 'under_maintenance':
          return { color: 'bg-orange-100 text-orange-800', icon: <Wrench className="h-3 w-3" />, label: 'Maintenance' };
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: <Package className="h-3 w-3" />, label: status };
      }
    } else {
      switch (status) {
        case 'compliant':
          return { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="h-3 w-3" />, label: 'Compliant' };
        case 'due_inspection':
          return { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="h-3 w-3" />, label: 'Inspection Due' };
        case 'due_pressure_test':
          return { color: 'bg-orange-100 text-orange-800', icon: <Clock className="h-3 w-3" />, label: 'Pressure Test Due' };
        case 'expired':
          return { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Expired' };
        case 'failed':
          return { color: 'bg-red-100 text-red-800', icon: <XCircle className="h-3 w-3" />, label: 'Failed' };
        default:
          return { color: 'bg-gray-100 text-gray-800', icon: <AlertTriangle className="h-3 w-3" />, label: status };
      }
    }
  };

  const config = getStatusConfig();
  
  return (
    <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

const getDaysUntil = (dateString?: string) => {
  if (!dateString) return null;
  try {
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
};

export const CylinderAssetsTable: React.FC<CylinderAssetsTableProps> = ({
  assets,
  loading = false,
  onEditAsset,
  onViewHistory,
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading cylinder assets...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <Package className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cylinder assets found</h3>
          <p className="text-gray-500">
            No cylinder assets found matching your search criteria.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cylinder Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Condition
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Compliance Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Next Due Dates
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fill Cycles
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assets.map((asset) => {
              const pressureTestDays = getDaysUntil(asset.next_pressure_test_due);
              const inspectionDays = getDaysUntil(asset.next_inspection_due);
              
              return (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {asset.serial_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {asset.product_name} ({asset.product_sku})
                      </div>
                      {asset.customer_name && (
                        <div className="text-xs text-blue-600">
                          Sold to: {asset.customer_name}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {asset.warehouse_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge status={asset.current_condition} type="condition" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <StatusBadge status={asset.regulatory_status} type="regulatory" />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Pressure Test:</span>
                        <span className={`text-xs ${pressureTestDays !== null && pressureTestDays < 30 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {formatDate(asset.next_pressure_test_due)}
                          {pressureTestDays !== null && (
                            <span className="ml-1">
                              ({pressureTestDays > 0 ? `${pressureTestDays}d` : `${Math.abs(pressureTestDays)}d overdue`})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Inspection:</span>
                        <span className={`text-xs ${inspectionDays !== null && inspectionDays < 30 ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                          {formatDate(asset.next_inspection_due)}
                          {inspectionDays !== null && (
                            <span className="ml-1">
                              ({inspectionDays > 0 ? `${inspectionDays}d` : `${Math.abs(inspectionDays)}d overdue`})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-medium text-gray-900">
                      {asset.total_fill_cycles.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {onViewHistory && (
                        <button
                          onClick={() => onViewHistory(asset)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="View history"
                        >
                          <Search className="h-4 w-4" />
                        </button>
                      )}
                      {onEditAsset && (
                        <button
                          onClick={() => onEditAsset(asset)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 transition-colors"
                          title="Edit asset"
                        >
                          <Edit className="h-4 w-4" />
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