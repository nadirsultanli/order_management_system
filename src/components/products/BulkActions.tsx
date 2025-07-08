import React, { useState } from 'react';
import { ChevronDown, Download, Upload, Edit3 } from 'lucide-react';
import { useBulkUpdateProductStatus } from '../../hooks/useProducts';

interface BulkActionsProps {
  selectedProducts: string[];
  onClearSelection: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedProducts,
  onClearSelection,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const bulkUpdateStatus = useBulkUpdateProductStatus();

  const handleStatusUpdate = async (status: string) => {
    try {
      await bulkUpdateStatus.mutateAsync({
        productIds: selectedProducts,
        status,
      });
      onClearSelection();
      setShowDropdown(false);
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    console.log('Exporting products:', selectedProducts);
    setShowDropdown(false);
  };

  if (selectedProducts.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear selection
          </button>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
            <span>Bulk Actions</span>
            <ChevronDown className="h-4 w-4" />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  Change Status
                </div>
                <button
                  onClick={() => handleStatusUpdate('active')}
                  disabled={bulkUpdateStatus.isPending}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Set as Active
                </button>
                <button
                  onClick={() => handleStatusUpdate('obsolete')}
                  disabled={bulkUpdateStatus.isPending}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Set as Obsolete
                </button>
                
                <div className="border-t border-gray-100 mt-1">
                  <button
                    onClick={handleExport}
                    className="flex items-center space-x-2 w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export Selected</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};