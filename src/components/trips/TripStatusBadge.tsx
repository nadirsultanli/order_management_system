import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';

interface TripStatusBadgeProps {
  status: 'planned' | 'loading' | 'loaded' | 'in_transit' | 'delivering' | 'unloading' | 'completed' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onStatusChange?: (newStatus: string) => void;
}

const TRIP_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'loading', label: 'Loading' },
  { value: 'loaded', label: 'Loaded' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivering', label: 'Delivering' },
  { value: 'unloading', label: 'Unloading' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const TripStatusBadge: React.FC<TripStatusBadgeProps> = ({
  status,
  size = 'md',
  interactive = false,
  onStatusChange
}) => {
  return (
    <StatusBadge
      status={status}
      size={size}
      interactive={interactive}
      onStatusChange={onStatusChange}
      options={interactive ? TRIP_STATUS_OPTIONS : []}
    />
  );
};