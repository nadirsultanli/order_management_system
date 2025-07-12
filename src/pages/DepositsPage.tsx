import React, { useState, useEffect } from 'react';
import { Plus, DollarSign, Users, TrendingUp } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
import { DepositSummaryCards } from '../components/deposits/DepositSummaryCards';
import { DepositRateTable } from '../components/deposits/DepositRateTable';
import { DepositRateForm } from '../components/deposits/DepositRateForm';
import { DepositRateFilters } from '../components/deposits/DepositRateFilters';
import { DepositTransactionTable } from '../components/deposits/DepositTransactionTable';
import { DepositTransactionFilters } from '../components/deposits/DepositTransactionFilters';
import { CustomerDepositBalance } from '../components/deposits/CustomerDepositBalance';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { 
  useDepositRates, 
  useCreateDepositRate, 
  useUpdateDepositRate, 
  useDeleteDepositRate,
  useDepositTransactions,
  useDepositSummaryStats
} from '../hooks/useDeposits';
import { 
  DepositRate, 
  DepositRateFilters as RateFilterType, 
  DepositTransactionFilters as TransactionFilterType,
  CreateDepositRateData 
} from '../types/deposits';

export const DepositsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('rates');
  const [rateFilters, setRateFilters] = useState<RateFilterType>({ page: 1 });
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilterType>({ page: 1 });
  const [isRateFormOpen, setIsRateFormOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<DepositRate | null>(null);
  const [deletingRate, setDeletingRate] = useState<DepositRate | null>(null);

  // Hooks for deposit rates
  const { data: ratesData, isLoading: ratesLoading, error: ratesError } = useDepositRates(rateFilters);
  const createRate = useCreateDepositRate();
  const updateRate = useUpdateDepositRate();
  const deleteRate = useDeleteDepositRate();

  // Hooks for transactions
  const { data: transactionsData, isLoading: transactionsLoading } = useDepositTransactions(transactionFilters);

  // Summary stats
  const { data: summaryStats } = useDepositSummaryStats();

  // Debug logging
  useEffect(() => {
    console.log('DepositsPage state:', {
      activeTab,
      rateFilters,
      transactionFilters,
      ratesData,
      ratesLoading,
      ratesError,
      isRateFormOpen,
      editingRate,
    });
  }, [activeTab, rateFilters, transactionFilters, ratesData, ratesLoading, ratesError, isRateFormOpen, editingRate]);

  const handleAddRate = () => {
    console.log('Adding new deposit rate');
    setEditingRate(null);
    setIsRateFormOpen(true);
  };

  const handleEditRate = (rate: DepositRate) => {
    console.log('Editing deposit rate:', rate);
    setEditingRate(rate);
    setIsRateFormOpen(true);
  };

  const handleDeleteRate = (rate: DepositRate) => {
    console.log('Deleting deposit rate:', rate);
    setDeletingRate(rate);
  };

  const handleRateFormSubmit = async (data: CreateDepositRateData) => {
    console.log('Rate form submit:', data);
    try {
      if (editingRate?.id) {
        await updateRate.mutateAsync({ id: editingRate.id, ...data });
      } else {
        await createRate.mutateAsync(data);
      }
      setIsRateFormOpen(false);
      setEditingRate(null);
    } catch (error) {
      console.error('Rate form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDeleteRate = async () => {
    if (deletingRate) {
      console.log('Confirming delete rate:', deletingRate);
      try {
        await deleteRate.mutateAsync({ id: deletingRate.id });
        setDeletingRate(null);
      } catch (error) {
        console.error('Delete rate error:', error);
        // Error handling is done in the hook
      }
    }
  };

  const handleRatePageChange = (page: number) => {
    console.log('Rate page change:', page);
    setRateFilters(prev => ({ ...prev, page }));
  };

  const handleTransactionPageChange = (page: number) => {
    console.log('Transaction page change:', page);
    setTransactionFilters(prev => ({ ...prev, page }));
  };

  const tabs = [
    {
      id: 'rates',
      label: 'Deposit Rates',
      icon: DollarSign,
      count: ratesData?.totalCount
    },
    {
      id: 'customers',
      label: 'Customer Deposits',
      icon: Users,
      count: summaryStats?.total_customers_with_deposits
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: TrendingUp,
      count: transactionsData?.totalCount
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deposit Management</h1>
          <p className="text-gray-600">Manage cylinder deposits, rates, and customer balances</p>
          {ratesError && (
            <p className="text-red-600 text-sm mt-1">
              Error: {ratesError.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          {activeTab === 'rates' && (
            <button
              onClick={handleAddRate}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Deposit Rate</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <DepositSummaryCards stats={summaryStats} />

      {/* Tabs */}
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'rates' && (
          <div className="space-y-6">
            <DepositRateFilters 
              filters={rateFilters} 
              onFiltersChange={setRateFilters} 
            />

            <DepositRateTable
              rates={ratesData?.rates || []}
              loading={ratesLoading}
              onEdit={handleEditRate}
              onDelete={handleDeleteRate}
            />

            {ratesData && ratesData.totalPages > 1 && (
              <CustomerPagination
                currentPage={ratesData.currentPage}
                totalPages={ratesData.totalPages}
                totalCount={ratesData.totalCount}
                onPageChange={handleRatePageChange}
                itemsPerPage={15}
              />
            )}
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-6">
            <CustomerDepositBalance />
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <DepositTransactionFilters 
              filters={transactionFilters} 
              onFiltersChange={setTransactionFilters} 
            />

            <DepositTransactionTable
              transactions={transactionsData?.transactions || []}
              loading={transactionsLoading}
              summary={transactionsData?.summary}
            />

            {transactionsData && transactionsData.totalPages > 1 && (
              <CustomerPagination
                currentPage={transactionsData.currentPage}
                totalPages={transactionsData.totalPages}
                totalCount={transactionsData.totalCount}
                onPageChange={handleTransactionPageChange}
                itemsPerPage={15}
              />
            )}
          </div>
        )}
      </div>

      {/* Deposit Rate Form Modal */}
      <DepositRateForm
        isOpen={isRateFormOpen}
        onClose={() => {
          console.log('Closing rate form');
          setIsRateFormOpen(false);
          setEditingRate(null);
        }}
        onSubmit={handleRateFormSubmit}
        rate={editingRate || undefined}
        loading={createRate.isPending || updateRate.isPending}
        title={editingRate?.id ? 'Edit Deposit Rate' : 'Create New Deposit Rate'}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingRate}
        onClose={() => setDeletingRate(null)}
        onConfirm={handleConfirmDeleteRate}
        title="Delete Deposit Rate"
        message={`Are you sure you want to delete the deposit rate for ${deletingRate?.capacity_l}L cylinders (${deletingRate?.currency_code} ${deletingRate?.deposit_amount})? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
        loading={deleteRate.isPending}
      />
    </div>
  );
};