import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { usePriceListsNew, useCreatePriceListNew, useUpdatePriceListNew, useDeletePriceListNew, useSetDefaultPriceListNew } from '../hooks/usePricing';
import { PriceListTable } from '../components/pricing/PriceListTable';
import { PriceListFilters } from '../components/pricing/PriceListFilters';
import { PriceListForm } from '../components/pricing/PriceListForm';
import { PricingStats } from '../components/pricing/PricingStats';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PriceList, PriceListFilters as FilterType, CreatePriceListData } from '../types/pricing';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [deletingPriceList, setDeletingPriceList] = useState<PriceList | null>(null);

  const { data, isLoading, error, refetch } = usePriceListsNew(filters);
  const createPriceList = useCreatePriceListNew();
  const updatePriceList = useUpdatePriceListNew();
  const deletePriceList = useDeletePriceListNew();
  const setDefaultPriceList = useSetDefaultPriceListNew();

  // Debug logging
  useEffect(() => {
    console.log('PricingPage state:', {
      filters,
      data,
      isLoading,
      error,
      isFormOpen,
      editingPriceList,
    });
  }, [filters, data, isLoading, error, isFormOpen, editingPriceList]);

  const handleAddPriceList = () => {
    console.log('Adding new price list');
    setEditingPriceList(null);
    setIsFormOpen(true);
  };

  const handleEditPriceList = (priceList: PriceList) => {
    console.log('Editing price list:', priceList);
    setEditingPriceList(priceList);
    setIsFormOpen(true);
  };

  const handleViewPriceList = (priceList: PriceList) => {
    console.log('Viewing price list:', priceList);
    navigate(`/pricing/${priceList.id}`);
  };

  const handleDuplicatePriceList = (priceList: PriceList) => {
    console.log('Duplicating price list:', priceList);
    // Create a new price list with the same data but a different name
    setEditingPriceList({
      ...priceList,
      id: '', // Clear ID to create a new one
      name: `Copy of ${priceList.name}`,
      is_default: false, // Never copy default status
    });
    setIsFormOpen(true);
  };

  const handleSetDefault = async (priceList: PriceList) => {
    console.log('Setting default price list:', priceList);
    try {
      await setDefaultPriceList.mutateAsync({ id: priceList.id });
    } catch (error) {
      console.error('Set default error:', error);
      // Error handling is done in the hook
    }
  };

  const handleDeletePriceList = (priceList: PriceList) => {
    console.log('Deleting price list:', priceList);
    setDeletingPriceList(priceList);
  };

  const handleFormSubmit = async (data: CreatePriceListData) => {
    console.log('Form submit:', data);
    try {
      if (editingPriceList?.id) {
        await updatePriceList.mutateAsync({ id: editingPriceList.id, ...data });
      } else {
        await createPriceList.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingPriceList(null);
    } catch (error) {
      console.error('Form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingPriceList) {
      console.log('Confirming delete:', deletingPriceList);
      try {
        await deletePriceList.mutateAsync({ id: deletingPriceList.id });
        setDeletingPriceList(null);
      } catch (error) {
        console.error('Delete error:', error);
        // Error handling is done in the hook
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
          <h1 className="text-2xl font-bold text-gray-900">Price Catalog</h1>
          <p className="text-gray-600">Manage pricing for your products across different markets</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddPriceList}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Price List</span>
          </button>
        </div>
      </div>

      <PricingStats />

      <PriceListFilters filters={filters} onFiltersChange={setFilters} />

      <PriceListTable
        priceLists={data?.priceLists || []}
        loading={isLoading}
        onView={handleViewPriceList}
        onEdit={handleEditPriceList}
        onDuplicate={handleDuplicatePriceList}
        onSetDefault={handleSetDefault}
        onDelete={handleDeletePriceList}
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

      <PriceListForm
        isOpen={isFormOpen}
        onClose={() => {
          console.log('Closing form');
          setIsFormOpen(false);
          setEditingPriceList(null);
        }}
        onSubmit={handleFormSubmit}
        priceList={editingPriceList || undefined}
        loading={createPriceList.isPending || updatePriceList.isPending}
        title={editingPriceList?.id ? 'Edit Price List' : 'Create New Price List'}
      />

      <ConfirmDialog
        isOpen={!!deletingPriceList}
        onClose={() => setDeletingPriceList(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Price List"
        message={`Are you sure you want to delete "${deletingPriceList?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
                    loading={deletePriceList.isPending}
      />
    </div>
  );
};