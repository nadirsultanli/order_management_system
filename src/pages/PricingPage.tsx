import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, DollarSign, Database, Eye } from 'lucide-react';
import { usePriceListsNew, useCreatePriceListNew, useUpdatePriceListNew, useDeletePriceListNew, useSetDefaultPriceListNew } from '../hooks/usePricing';
import { useDepositRates, useCreateDepositRate, useUpdateDepositRate, useDeleteDepositRate } from '../hooks/useDeposits';
import { PriceListTable } from '../components/pricing/PriceListTable';
import { PriceListFilters } from '../components/pricing/PriceListFilters';
import { PriceListForm } from '../components/pricing/PriceListForm';
import { PricingStats } from '../components/pricing/PricingStats';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { CapacityDepositManager } from '../components/pricing/CapacityDepositManager';
import { PriceList, PriceListFilters as FilterType, CreatePriceListData } from '../types/pricing';
import { DepositRate, DepositRateFilters, CreateDepositRateData } from '../types/deposits';

type TabType = 'price-lists' | 'deposit-rates';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('price-lists');
  
  // Price Lists state
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceList | null>(null);
  const [deletingPriceList, setDeletingPriceList] = useState<PriceList | null>(null);
  
  // Deposit Rates state
  const [depositFilters, setDepositFilters] = useState<DepositRateFilters>({ page: 1 });
  const [editingDepositRate, setEditingDepositRate] = useState<DepositRate | null>(null);
  const [deletingDepositRate, setDeletingDepositRate] = useState<DepositRate | null>(null);
  const [isDepositFormOpen, setIsDepositFormOpen] = useState(false);

  // Price Lists hooks
  const { data, isLoading, error, refetch } = usePriceListsNew(filters);
  const createPriceList = useCreatePriceListNew();
  const updatePriceList = useUpdatePriceListNew();
  const deletePriceList = useDeletePriceListNew();
  const setDefaultPriceList = useSetDefaultPriceListNew();
  
  // Deposit Rates hooks
  const { data: depositData, isLoading: depositLoading, error: depositError } = useDepositRates(depositFilters);
  const createDepositRate = useCreateDepositRate();
  const updateDepositRate = useUpdateDepositRate();
  const deleteDepositRate = useDeleteDepositRate();

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
    if (activeTab === 'price-lists') {
      setFilters(prev => ({ ...prev, page }));
    } else {
      setDepositFilters(prev => ({ ...prev, page }));
    }
  };

  // Deposit Rate handlers
  const handleEditDepositRate = (depositRate: DepositRate) => {
    console.log('Editing deposit rate:', depositRate);
    setEditingDepositRate(depositRate);
  };

  const handleDeleteDepositRate = (depositRate: DepositRate) => {
    console.log('Deleting deposit rate:', depositRate);
    setDeletingDepositRate(depositRate);
  };

  const handleDepositRateSubmit = async (data: CreateDepositRateData) => {
    console.log('Deposit rate submit:', data);
    try {
      if (editingDepositRate?.id) {
        await updateDepositRate.mutateAsync({ id: editingDepositRate.id, ...data });
      } else {
        await createDepositRate.mutateAsync(data);
      }
      setEditingDepositRate(null);
      setIsDepositFormOpen(false);
    } catch (error) {
      console.error('Deposit rate submit error:', error);
    }
  };

  const handleConfirmDeleteDepositRate = async () => {
    if (deletingDepositRate) {
      console.log('Confirming delete deposit rate:', deletingDepositRate);
      try {
        await deleteDepositRate.mutateAsync({ id: deletingDepositRate.id });
        setDeletingDepositRate(null);
      } catch (error) {
        console.error('Delete deposit rate error:', error);
      }
    }
  };



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Catalog</h1>
          <p className="text-gray-600">Manage pricing and deposit rates for your products</p>
          {(error || depositError) && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error?.message || depositError?.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {activeTab === 'deposit-rates' && (
            <button
              onClick={() => navigate('/pricing/demo')}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>How Deposits Work</span>
            </button>
          )}
          {activeTab === 'price-lists' && (
            <button
              onClick={() => navigate('/pricing/demo')}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>View Demo</span>
            </button>
          )}
          {activeTab === 'price-lists' ? (
            <button
              onClick={handleAddPriceList}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Price List</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setEditingDepositRate(null);
                setIsDepositFormOpen(true);
              }}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Deposit Rate</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('price-lists')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'price-lists'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-2" />
            Price Lists
          </button>
          <button
            onClick={() => setActiveTab('deposit-rates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'deposit-rates'
                ? 'border-green-500 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Database className="inline h-4 w-4 mr-2" />
            Deposit Rates
          </button>
        </nav>
      </div>

      {activeTab === 'price-lists' && <PricingStats />}

      {/* Content Area - Conditional based on active tab */}
      {activeTab === 'price-lists' ? (
        <>
          <PriceListFilters filters={filters} onFiltersChange={setFilters} />

          <PriceListTable
            priceLists={data?.priceLists || []}
            loading={isLoading}
            onView={handleViewPriceList}
            onEdit={handleEditPriceList}
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
        </>
      ) : (
        <>
          <CapacityDepositManager
            depositRates={depositData?.rates || []}
            loading={depositLoading}
            onEdit={handleEditDepositRate}
            onDelete={handleDeleteDepositRate}
            onSubmit={handleDepositRateSubmit}
            editingRate={editingDepositRate}
            onCancelEdit={() => setEditingDepositRate(null)}
            isFormOpen={isDepositFormOpen}
            onFormOpenChange={setIsDepositFormOpen}
          />

          {depositData && depositData.totalPages > 1 && (
            <CustomerPagination
              currentPage={depositData.currentPage}
              totalPages={depositData.totalPages}
              totalCount={depositData.totalCount}
              onPageChange={handlePageChange}
              itemsPerPage={15}
            />
          )}
        </>
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

      <ConfirmDialog
        isOpen={!!deletingDepositRate}
        onClose={() => setDeletingDepositRate(null)}
        onConfirm={handleConfirmDeleteDepositRate}
        title="Delete Deposit Rate"
        message={`Are you sure you want to delete the deposit rate for ${deletingDepositRate?.capacity_l}kg cylinders? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deleteDepositRate.isPending}
      />
    </div>
  );
};