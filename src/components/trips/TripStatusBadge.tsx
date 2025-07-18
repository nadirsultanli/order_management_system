import React from 'react';
import { StatusBadge } from '../ui/StatusBadge';

interface TripStatusBadgeProps {
  status: 'planned' | 'loaded' | 'in_transit' | 'offloaded' | 'completed' | 'cancelled';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onStatusChange?: (newStatus: string) => void;
}

const TRIP_STATUS_OPTIONS = [
  { value: 'planned', label: 'Planned' },
  { value: 'loaded', label: 'Loaded' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'offloaded', label: 'Offloaded' },
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