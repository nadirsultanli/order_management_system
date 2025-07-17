import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { SearchableWarehouseSelector } from '../components/warehouses/SearchableWarehouseSelector';
import { SearchableProductSelector } from '../components/products/SearchableProductSelector';
import { useAdjustStockNew, useTransferStockNew, useCreateInventoryNew } from '../hooks/useInventory';
import { useInventoryWithClientSearch } from '../hooks/useInventoryWithClientSearch';
import { useProducts } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import { InventoryTable } from '../components/inventory/InventoryTable';
import { InventoryFilters } from '../components/inventory/InventoryFilters';
import { InventoryStats } from '../components/inventory/InventoryStats';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { StockTransferModal } from '../components/inventory/StockTransferModal';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { InventoryBalance, InventoryFilters as FilterType, StockAdjustmentData, StockTransferData, CreateInventoryBalanceData } from '../types/inventory';

export const InventoryPage: React.FC = () => {
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [adjustingInventory, setAdjustingInventory] = useState<InventoryBalance | null>(null);
  const [transferringInventory, setTransferringInventory] = useState<InventoryBalance | null>(null);
  const [showAddStockModal, setShowAddStockModal] = useState(false);

  const { data, isLoading, error, refetch } = useInventoryWithClientSearch(filters);
  const { data: productsData } = useProducts({ limit: 1000 });
  const { data: warehousesData } = useWarehouses({ limit: 1000 });
  const adjustStock = useAdjustStockNew();
  const transferStock = useTransferStockNew();
  const createInventoryBalance = useCreateInventoryNew();

  const products = productsData?.products || [];
  const warehouses = warehousesData?.warehouses || [];

  // Debug logging
  useEffect(() => {
    console.log('InventoryPage state:', {
      filters,
      data,
      isLoading,
      error,
      adjustingInventory,
      transferringInventory,
    });
  }, [filters, data, isLoading, error, adjustingInventory, transferringInventory]);

  const handleAdjustStock = (inventory: InventoryBalance) => {
    console.log('Adjusting stock for:', inventory);
    setAdjustingInventory(inventory);
  };

  const handleTransferStock = (inventory: InventoryBalance) => {
    console.log('Transferring stock for:', inventory);
    setTransferringInventory(inventory);
  };

  const handleAddStock = () => {
    console.log('Adding new stock');
    setShowAddStockModal(true);
  };

  const handleAdjustmentSubmit = async (data: StockAdjustmentData) => {
    console.log('Adjustment submit:', data);
    try {
      await adjustStock.mutateAsync(data);
      setAdjustingInventory(null);
      refetch(); // Refresh inventory data
    } catch (error) {
      console.error('Adjustment error:', error);
      // Error handling is done in the hook
    }
  };

  const handleTransferSubmit = async (data: StockTransferData) => {
    console.log('Transfer submit:', data);
    try {
      await transferStock.mutateAsync(data);
      setTransferringInventory(null);
      refetch(); // Refresh inventory data
    } catch (error) {
      console.error('Transfer error:', error);
      // Error handling is done in the hook
    }
  };

  const handleAddStockSubmit = async (data: CreateInventoryBalanceData) => {
    console.log('Add stock submit:', data);
    try {
      await createInventoryBalance.mutateAsync(data);
      setShowAddStockModal(false);
      refetch(); // Refresh inventory data
    } catch (error) {
      console.error('Add stock error:', error);
      // Error handling is done in the hook
    }
  };

  const handlePageChange = (page: number) => {
    console.log('Page change:', page);
    setFilters(prev => ({ ...prev, page }));
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600">Track stock levels across all warehouses</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddStock}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            title="Add stock to inventory"
          >
            <Plus className="h-4 w-4" />
            <span>Add Stock</span>
          </button>
        </div>
      </div>

      <InventoryStats />

      <InventoryFilters filters={filters} onFiltersChange={setFilters} />

      <InventoryTable
        inventory={data?.inventory || []}
        loading={isLoading}
        onAdjustStock={handleAdjustStock}
        onTransferStock={handleTransferStock}
      />

      {data && data.totalPages > 1 && (
        <CustomerPagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          onPageChange={handlePageChange}
          itemsPerPage={15}
        />
      )}

      {/* Stock Adjustment Modal */}
      {adjustingInventory && (
        <StockAdjustmentModal
          isOpen={!!adjustingInventory}
          onClose={() => setAdjustingInventory(null)}
          onSubmit={handleAdjustmentSubmit}
          inventory={adjustingInventory}
          loading={adjustStock.isPending}
        />
      )}

      {/* Stock Transfer Modal */}
      {transferringInventory && (
        <StockTransferModal
          isOpen={!!transferringInventory}
          onClose={() => setTransferringInventory(null)}
          onSubmit={handleTransferSubmit}
          inventory={transferringInventory}
          loading={transferStock.isPending}
        />
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <AddStockModal
          isOpen={showAddStockModal}
          onClose={() => setShowAddStockModal(false)}
          onSubmit={handleAddStockSubmit}
          products={products}
          warehouses={warehouses}
          loading={createInventoryBalance.isPending}
        />
      )}
    </div>
  );
};

// Enhanced Add Stock Modal Component with Receive Inventory functionality
interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateInventoryBalanceData) => void;
  products: any[];
  warehouses: any[];
  loading?: boolean;
}

interface ReceiveStockFormData extends CreateInventoryBalanceData {
  supplier_dn_number?: string;
  truck_registration?: string;
  driver_name?: string;
  receipt_date?: string;
  notes?: string;
  qty_received_good: number;
  qty_received_damaged: number;
  condition_flag: 'good' | 'damaged';
}

const AddStockModal: React.FC<AddStockModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  products,
  warehouses,
  loading = false,
}) => {
  const [formData, setFormData] = useState<ReceiveStockFormData>({
    warehouse_id: '',
    product_id: '',
    qty_full: 0,
    qty_empty: 0,
    qty_reserved: 0,
    supplier_dn_number: '',
    truck_registration: '',
    driver_name: '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
    qty_received_good: 0,
    qty_received_damaged: 0,
    condition_flag: 'good',
  });

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        warehouse_id: '',
        product_id: '',
        qty_full: 0,
        qty_empty: 0,
        qty_reserved: 0,
        supplier_dn_number: '',
        truck_registration: '',
        driver_name: '',
        receipt_date: new Date().toISOString().split('T')[0],
        notes: '',
        qty_received_good: 0,
        qty_received_damaged: 0,
        condition_flag: 'good',
      });
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.warehouse_id && formData.product_id) {
      // Check if this is a receipt (has receipt information) or just a stock addition
      const hasReceiptInfo = formData.supplier_dn_number || formData.truck_registration || formData.driver_name;
      
      const inventoryData: CreateInventoryBalanceData = {
        warehouse_id: formData.warehouse_id,
        product_id: formData.product_id,
        qty_full: formData.qty_received_good || formData.qty_full,
        qty_empty: formData.qty_empty,
        qty_reserved: formData.qty_reserved,
      };
      
      if (hasReceiptInfo) {
        console.log('Creating stock with receipt information:', {
          inventory: inventoryData,
          receipt: {
            supplier_dn_number: formData.supplier_dn_number,
            truck_registration: formData.truck_registration,
            driver_name: formData.driver_name,
            receipt_date: formData.receipt_date,
            notes: formData.notes,
            qty_received_good: formData.qty_received_good,
            qty_received_damaged: formData.qty_received_damaged,
          }
        });
      }
      
      onSubmit(inventoryData);
    }
  };

  const handleChange = (field: keyof ReceiveStockFormData, value: string | number) => {
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value,
      };
      
      // Auto-calculate condition flag based on damaged vs good quantities
      if (field === 'qty_received_damaged' || field === 'qty_received_good') {
        const damaged = field === 'qty_received_damaged' ? (value as number) : prev.qty_received_damaged;
        const good = field === 'qty_received_good' ? (value as number) : prev.qty_received_good;
        
        if (damaged > 0 && good === 0) {
          newData.condition_flag = 'damaged';
        } else {
          newData.condition_flag = 'good';
        }
      }
      
      return newData;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Add Stock / Receive Inventory
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Plus className="h-6 w-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Warehouse *
                    </label>
                    <SearchableWarehouseSelector
                      value={formData.warehouse_id}
                      onChange={(id) => handleChange('warehouse_id', id)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product *
                    </label>
                    <SearchableProductSelector
                      products={products.filter((p:any)=>p.status==='active')}
                      value={formData.product_id}
                      onChange={(id) => handleChange('product_id', id)}
                      required
                    />
                  </div>
                </div>

                {/* Receipt Information (Optional) */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Receipt Information (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Supplier DN Number
                      </label>
                      <input
                        type="text"
                        value={formData.supplier_dn_number || ''}
                        onChange={(e) => handleChange('supplier_dn_number', e.target.value)}
                        placeholder="e.g., DN-12345"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Truck Registration
                      </label>
                      <input
                        type="text"
                        value={formData.truck_registration || ''}
                        onChange={(e) => handleChange('truck_registration', e.target.value)}
                        placeholder="e.g., ABC-123"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Driver Name
                      </label>
                      <input
                        type="text"
                        value={formData.driver_name || ''}
                        onChange={(e) => handleChange('driver_name', e.target.value)}
                        placeholder="Driver name"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Receipt Date
                      </label>
                      <input
                        type="date"
                        value={formData.receipt_date || ''}
                        onChange={(e) => handleChange('receipt_date', e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes || ''}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        placeholder="Additional notes about this stock addition/receipt"
                        rows={2}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Stock Quantities */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Stock Quantities</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Good Condition (Full)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.qty_received_good || formData.qty_full}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          handleChange('qty_received_good', value);
                          handleChange('qty_full', value);
                        }}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Empty Cylinders
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.qty_empty}
                        onChange={(e) => handleChange('qty_empty', parseInt(e.target.value) || 0)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Damaged (to Quarantine)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.qty_received_damaged}
                        onChange={(e) => handleChange('qty_received_damaged', parseInt(e.target.value) || 0)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Damaged items will be placed in quarantine
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reserved/Allocated
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formData.qty_received_good || formData.qty_full}
                        value={formData.qty_reserved}
                        onChange={(e) => handleChange('qty_reserved', parseInt(e.target.value) || 0)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Cannot exceed good condition quantity
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={loading || !formData.warehouse_id || !formData.product_id}
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Add Stock / Create Receipt'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};