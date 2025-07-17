import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '../hooks/useWarehouses';
import { WarehouseTable } from '../components/warehouses/WarehouseTable';
import { WarehouseFilters } from '../components/warehouses/WarehouseFilters';
import { WarehouseForm } from '../components/warehouses/WarehouseForm';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Warehouse, WarehouseFilters as FilterType, CreateWarehouseData } from '../types/warehouse';

export const WarehousesPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<Warehouse | null>(null);

  const { data, isLoading, error, refetch } = useWarehouses(filters);
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const deleteWarehouse = useDeleteWarehouse();

  // Debug logging
  useEffect(() => {
    console.log('WarehousesPage state:', {
      filters,
      data,
      isLoading,
      error,
      isFormOpen,
      editingWarehouse,
    });
  }, [filters, data, isLoading, error, isFormOpen, editingWarehouse]);

  const handleAddWarehouse = () => {
    console.log('Adding new warehouse');
    setEditingWarehouse(null);
    setIsFormOpen(true);
  };

  const handleEditWarehouse = (warehouse: Warehouse) => {
    console.log('Editing warehouse:', warehouse);
    setEditingWarehouse(warehouse);
    setIsFormOpen(true);
  };

  const handleViewWarehouse = (warehouse: Warehouse) => {
    console.log('Viewing warehouse:', warehouse);
    navigate(`/warehouses/${warehouse.id}`);
  };

  const handleDeleteWarehouse = (warehouse: Warehouse) => {
    console.log('Deleting warehouse:', warehouse);
    setDeletingWarehouse(warehouse);
  };

  const handleFormSubmit = async (data: CreateWarehouseData) => {
    console.log('Form submit:', data);
    try {
      if (editingWarehouse) {
        await updateWarehouse.mutateAsync({ id: editingWarehouse.id, ...data });
      } else {
        await createWarehouse.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingWarehouse(null);
    } catch (error) {
      console.error('Form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingWarehouse) {
      console.log('Confirming delete:', deletingWarehouse);
      try {
        await deleteWarehouse.mutateAsync(deletingWarehouse.id);
        setDeletingWarehouse(null);
      } catch (error) {
        console.error('Delete error:', error);
        // Error handling is done in the hooks
      }
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
          <h1 className="text-2xl font-bold text-gray-900">Warehouses</h1>
          <p className="text-gray-600">Manage storage facilities and inventory locations</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddWarehouse}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Warehouse</span>
          </button>
        </div>
      </div>

      <WarehouseFilters filters={filters} onFiltersChange={setFilters} />

      <WarehouseTable
        warehouses={data?.warehouses || []}
        loading={isLoading}
        onView={handleViewWarehouse}
        onEdit={handleEditWarehouse}
        onDelete={handleDeleteWarehouse}
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

      <WarehouseForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingWarehouse(null);
        }}
        onSubmit={handleFormSubmit}
        warehouse={editingWarehouse}
        loading={createWarehouse.isPending || updateWarehouse.isPending}
      />

      <ConfirmDialog
        isOpen={!!deletingWarehouse}
        onClose={() => setDeletingWarehouse(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Warehouse"
        message={`Are you sure you want to delete "${deletingWarehouse?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deleteWarehouse.isPending}
      />
    </div>
  );
};