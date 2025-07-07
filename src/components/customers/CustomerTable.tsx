import React from 'react';
import { Eye, Edit, Trash2, Loader2, Users, MapPin } from 'lucide-react';
import { Customer } from '../../types/customer';
import { StatusBadge } from '../ui/StatusBadge';
import { getAddressSummary } from '../../utils/address';
import { formatDateSync } from '../../utils/order';

interface CustomerTableProps {
  customers: Customer[];
  loading?: boolean;
  onView: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onStatusChange: (customer: Customer, newStatus: 'active' | 'credit_hold' | 'closed') => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  loading = false,
  onView,
  onDelete,
  onStatusChange,
}) => {

  console.log('CustomerTable render:', { customers, loading });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-gray-600">Loading customers...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <div className="mb-4">
            <Users className="h-12 w-12 text-gray-300 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
          <p className="text-gray-500">
            {customers === null ? 'Failed to load customers. Please check your connection.' : 'Get started by adding your first customer.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">
          Customers ({customers.length})
        </h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Credit Terms
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {customer.name}
                    </div>
                    {customer.external_id && (
                      <div className="text-sm text-gray-500">
                        ID: {customer.external_id}
                      </div>
                    )}
                    {customer.tax_id && (
                      <div className="text-sm text-gray-500">
                        Tax ID: {customer.tax_id}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {customer.email && (
                      <div className="mb-1">{customer.email}</div>
                    )}
                    {customer.phone && (
                      <div className="text-gray-500">{customer.phone}</div>
                    )}
                    {!customer.email && !customer.phone && (
                      <span className="text-gray-400">No contact info</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge 
                    status={customer.account_status}
                    size="sm"
                    interactive={true}
                    onStatusChange={(newStatus) => onStatusChange(customer, newStatus as 'active' | 'credit_hold' | 'closed')}
                    options={[
                      { value: 'active', label: 'Active' },
                      { value: 'credit_hold', label: 'Credit Hold' },
                      { value: 'closed', label: 'Closed' }
                    ]}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.credit_terms_days} days
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateSync(customer.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onView(customer)}
                      className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                      title="View/Edit customer"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(customer)}
                      className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                      title="Delete customer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};