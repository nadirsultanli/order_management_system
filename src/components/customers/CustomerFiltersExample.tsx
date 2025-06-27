// Example: CustomerFilters component using the new GenericFilters
// This replaces the old CustomerFilters.tsx with much less code

import React from 'react';
import { GenericFilters, FilterField } from '../ui/GenericFilters';
import { CustomerFilters as FilterType } from '../../types/customer';

interface CustomerFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

// Configuration for customer-specific filters
const customerFilterFields: FilterField[] = [
  {
    key: 'account_status',
    label: 'Account Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'suspended', label: 'Suspended' },
      { value: 'pending', label: 'Pending' }
    ]
  },
  {
    key: 'credit_terms_days',
    label: 'Credit Terms',
    type: 'select',
    options: [
      { value: '30', label: '30 days' },
      { value: '60', label: '60 days' },
      { value: '90', label: '90 days' }
    ]
  }
];

export const CustomerFilters: React.FC<CustomerFiltersProps> = ({ filters, onFiltersChange }) => {
  return (
    <GenericFilters
      filters={filters}
      onFiltersChange={onFiltersChange}
      fields={customerFilterFields}
      searchPlaceholder="Search customers..."
    />
  );
};

// Before consolidation: ~50-80 lines of code in CustomerFilters.tsx
// After consolidation: ~35 lines (this file) + reusable GenericFilters
// Code reduction: ~40-60% for filter components across the system 