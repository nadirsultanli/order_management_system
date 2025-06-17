import React, { useState, useEffect } from 'react';
import { LoadTransferForm } from '../components/transfers/LoadTransferForm';
import { ReturnTransferForm } from '../components/transfers/ReturnTransferForm';
import { CustomerSelector } from '../components/customers/CustomerSelector';
import { useCustomers } from '../hooks/useCustomers';
import { Customer } from '../types/customer';

export const TransfersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'load' | 'return'>('load');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const { data: customersData } = useCustomers({ limit: 1000 });
  const customers = customersData?.customers || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Transfers</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage inventory transfers between depot and trucks.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('load')}
              className={`${
                activeTab === 'load'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Load Transfer
            </button>
            <button
              onClick={() => setActiveTab('return')}
              className={`${
                activeTab === 'return'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Return Transfer
            </button>
          </nav>
        </div>

        <div className="mt-8">
          {activeTab === 'load' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer
              </label>
              <CustomerSelector
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
                customers={customers}
                placeholder="Search customer by name, ID, or tax ID..."
                className="w-full"
              />
            </div>
          )}

          {activeTab === 'load' ? (
            <LoadTransferForm 
              onSuccess={() => console.log('Load transfer created')} 
              customerId={selectedCustomerId}
            />
          ) : (
            <ReturnTransferForm onSuccess={() => console.log('Return transfer created')} />
          )}
        </div>
      </div>
    </div>
  );
}; 