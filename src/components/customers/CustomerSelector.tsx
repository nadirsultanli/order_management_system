import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, X, Plus } from 'lucide-react';
import { Customer, CreateCustomerData } from '../../types/customer';
import { CustomerForm } from './CustomerForm';
import { useCreateCustomer } from '../../hooks/useCustomers';

interface CustomerSelectorProps {
  value: string;
  onChange: (value: string) => void;
  customers: Customer[];
  placeholder?: string;
  className?: string;
  onCustomerCreated?: (customer: Customer) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  value,
  onChange,
  customers,
  placeholder = 'Search customer...',
  className = '',
  onCustomerCreated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  
  const createCustomer = useCreateCustomer();

  useEffect(() => {
    if (searchTerm) {
      const filtered = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.external_id && customer.external_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (customer.tax_id && customer.tax_id.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);

  const selectedCustomer = customers.find(c => c.id === value);

  const handleSelect = (customerId: string) => {
    onChange(customerId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
  };

  const handleAddCustomer = () => {
    setIsAddCustomerModalOpen(true);
    setIsOpen(false);
  };

  const handleCustomerCreated = async (customerData: CreateCustomerData) => {
    try {
      const newCustomer = await createCustomer.mutateAsync(customerData);
      setIsAddCustomerModalOpen(false);
      
      // Call the optional callback
      if (onCustomerCreated) {
        onCustomerCreated(newCustomer);
      }
      
      // Select the newly created customer
      onChange(newCustomer.id);
      setSearchTerm('');
    } catch (error) {
      console.error('Error creating customer:', error);
    }
  };

  const handleCloseAddCustomerModal = () => {
    setIsAddCustomerModalOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <div
          onClick={() => setIsOpen(!isOpen)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          {selectedCustomer ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">{selectedCustomer.name}</div>
                {selectedCustomer.external_id && (
                  <div className="text-sm text-gray-500">ID: {selectedCustomer.external_id}</div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-gray-500">
              <span>{placeholder}</span>
              <ChevronDown className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to search..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-auto">
            {/* Add Customer Option */}
            <div
              onClick={handleAddCustomer}
              className="px-4 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-200 bg-green-50"
            >
              <div className="flex items-center text-green-700">
                <Plus className="h-4 w-4 mr-2" />
                <span className="font-medium">Add New Customer</span>
              </div>
            </div>
            
            {/* Existing Customers */}
            {filteredCustomers.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No customers found</div>
            ) : (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => handleSelect(customer.id)}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                >
                  <div className="font-medium text-gray-900">{customer.name}</div>
                  {customer.external_id && (
                    <div className="text-sm text-gray-500">ID: {customer.external_id}</div>
                  )}
                  {customer.tax_id && (
                    <div className="text-sm text-gray-500">Tax ID: {customer.tax_id}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Add Customer Modal */}
      <CustomerForm
        isOpen={isAddCustomerModalOpen}
        onClose={handleCloseAddCustomerModal}
        onSubmit={handleCustomerCreated}
        loading={createCustomer.isLoading}
        title="Add New Customer"
        showAddressFields={false}
      />
    </div>
  );
}; 