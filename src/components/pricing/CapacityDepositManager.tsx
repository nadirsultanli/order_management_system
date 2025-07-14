import React, { useState } from 'react';
import { Edit, Trash2, DollarSign } from 'lucide-react';
import { DepositRate, CreateDepositRateData } from '../../types/deposits';
import { DepositRateForm } from './DepositRateForm';

interface CapacityDepositManagerProps {
  depositRates: DepositRate[];
  loading: boolean;
  onEdit: (depositRate: DepositRate) => void;
  onDelete: (depositRate: DepositRate) => void;
  onSubmit: (data: CreateDepositRateData) => Promise<void>;
  editingRate: DepositRate | null;
  onCancelEdit: () => void;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
}

export const CapacityDepositManager: React.FC<CapacityDepositManagerProps> = ({
  depositRates,
  loading,
  onEdit,
  onDelete,
  onSubmit,
  editingRate,
  onCancelEdit,
  isFormOpen,
  onFormOpenChange,
}) => {
  const [sortBy, setSortBy] = useState<'capacity' | 'amount' | 'date'>('capacity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Group rates by capacity and show only the most recent active rate
  const groupedRates = depositRates.reduce((acc, rate) => {
    const capacity = rate.capacity_l;
    if (!acc[capacity] || new Date(rate.effective_date) > new Date(acc[capacity].effective_date)) {
      acc[capacity] = rate;
    }
    return acc;
  }, {} as Record<number, DepositRate>);

  const sortedRates = Object.values(groupedRates).sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'capacity':
        comparison = a.capacity_l - b.capacity_l;
        break;
      case 'amount':
        comparison = a.deposit_amount - b.deposit_amount;
        break;
      case 'date':
        comparison = new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime();
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: 'capacity' | 'amount' | 'date') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleEditClick = (rate: DepositRate) => {
    onFormOpenChange(true);
    onEdit(rate);
  };

  const handleFormSubmit = async (data: CreateDepositRateData) => {
    await onSubmit(data);
    onFormOpenChange(false);
    onCancelEdit();
  };

  const handleFormClose = () => {
    onFormOpenChange(false);
    onCancelEdit();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Cylinder Deposit Rates</h2>
        <p className="text-sm text-gray-600">
          Manage deposit rates by cylinder capacity
        </p>
      </div>

      {/* Sorting Controls */}
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-500">Sort by:</span>
        <button
          onClick={() => handleSort('capacity')}
          className={`text-sm font-medium ${
            sortBy === 'capacity' ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Capacity {sortBy === 'capacity' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleSort('amount')}
          className={`text-sm font-medium ${
            sortBy === 'amount' ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
        <button
          onClick={() => handleSort('date')}
          className={`text-sm font-medium ${
            sortBy === 'date' ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
        </button>
      </div>

      {/* Deposit Rates Grid */}
      {sortedRates.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Deposit Rates</h3>
          <p className="text-gray-600">
            Get started by adding your first cylinder deposit rate using the "Add Deposit Rate" button above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedRates.map((rate) => (
            <div
              key={rate.id}
              className={`bg-white rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                rate.is_active
                  ? 'border-green-200 hover:border-green-300'
                  : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-lg font-semibold text-gray-900">
                      {rate.capacity_l}L
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleEditClick(rate)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit rate"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(rate)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete rate"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(rate.deposit_amount, rate.currency_code)}
                    </p>
                    <p className="text-sm text-gray-500">Deposit Amount</p>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Effective:</span>
                      <span className="font-medium">{formatDate(rate.effective_date)}</span>
                    </div>
                    {rate.end_date && (
                      <div className="flex justify-between items-center text-sm mt-1">
                        <span className="text-gray-500">Expires:</span>
                        <span className="font-medium">{formatDate(rate.end_date)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-500">Status:</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rate.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rate.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {rate.notes && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-600 italic">"{rate.notes}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deposit Rate Form Modal */}
      <DepositRateForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        depositRate={editingRate || undefined}
        title={editingRate ? 'Edit Deposit Rate' : 'Add New Deposit Rate'}
      />
    </div>
  );
};