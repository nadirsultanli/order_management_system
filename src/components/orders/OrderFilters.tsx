import React from 'react';
import { Filter, Calendar } from 'lucide-react';
import { GenericFilters, FilterField } from '../ui/GenericFilters';
import { OrderFilters as FilterType } from '../../types/order';

interface OrderFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
}

export const OrderFilters: React.FC<OrderFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const filterFields: FilterField[] = [
    {
      type: 'search',
      key: 'search',
      placeholder: 'Search by order ID or customer name...',
    },
    {
      type: 'select',
      key: 'status',
      label: 'All Statuses',
      icon: Filter,
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'en_route', label: 'En Route' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'invoiced', label: 'Invoiced' },
        { value: 'cancelled', label: 'Cancelled' },
      ],
    },
    {
      type: 'date',
      key: 'order_date_from',
      placeholder: 'From date',
      icon: Calendar,
    },
    {
      type: 'date',
      key: 'order_date_to',
      placeholder: 'To date',
    },
  ];

  return (
    <GenericFilters
      filters={filters}
      onFiltersChange={onFiltersChange}
      fields={filterFields}
    />
  );
};