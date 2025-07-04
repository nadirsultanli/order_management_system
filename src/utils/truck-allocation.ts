import { TruckCapacityInfo, AllocationSuggestion, TruckAllocation, OrderWeight } from '../types/truck';

/**
 * Utility functions for truck allocation and capacity management
 */

export function calculateUtilizationColor(percentage: number): string {
  if (percentage <= 50) return 'text-green-600';
  if (percentage <= 75) return 'text-yellow-600';
  if (percentage <= 90) return 'text-orange-600';
  return 'text-red-600';
}

export function getUtilizationBadgeColor(percentage: number): string {
  if (percentage <= 50) return 'bg-green-100 text-green-800';
  if (percentage <= 75) return 'bg-yellow-100 text-yellow-800';
  if (percentage <= 90) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

export function formatCapacityInfo(capacity: TruckCapacityInfo): string {
  const { allocated_weight_kg, total_capacity_kg, utilization_percentage } = capacity;
  return `${allocated_weight_kg.toFixed(0)}kg / ${total_capacity_kg.toFixed(0)}kg (${utilization_percentage.toFixed(1)}%)`;
}

export function getAllocationStatusColor(status: string): string {
  switch (status) {
    case 'planned':
      return 'bg-blue-100 text-blue-800';
    case 'loaded':
      return 'bg-yellow-100 text-yellow-800';
    case 'delivered':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getAllocationStatusIcon(status: string): string {
  switch (status) {
    case 'planned':
      return '📋';
    case 'loaded':
      return '🚛';
    case 'delivered':
      return '✅';
    case 'cancelled':
      return '❌';
    default:
      return '❓';
  }
}

export function sortAllocationsByScore(suggestions: AllocationSuggestion[]): AllocationSuggestion[] {
  return [...suggestions].sort((a, b) => b.score - a.score);
}

export function filterSuitableTrucks(suggestions: AllocationSuggestion[]): AllocationSuggestion[] {
  return suggestions.filter(suggestion => suggestion.score > 0);
}

export function getBestAllocationSuggestion(suggestions: AllocationSuggestion[]): AllocationSuggestion | null {
  const suitable = filterSuitableTrucks(suggestions);
  return suitable.length > 0 ? suitable[0] : null;
}

export function calculateTotalOrderWeight(orderWeight: OrderWeight): number {
  return orderWeight.breakdown.reduce((total, item) => total + item.total_weight_kg, 0);
}

export function formatWeight(weightKg: number): string {
  if (weightKg < 1000) {
    return `${weightKg.toFixed(1)}kg`;
  }
  return `${(weightKg / 1000).toFixed(2)}t`;
}

export function validateAllocation(
  orderWeight: number,
  capacity: TruckCapacityInfo,
  forceAllocation: boolean = false
): { isValid: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check basic capacity
  if (orderWeight > capacity.available_capacity_kg) {
    const message = `Order weight (${formatWeight(orderWeight)}) exceeds available capacity (${formatWeight(capacity.available_capacity_kg)})`;
    if (forceAllocation) {
      warnings.push(message);
    } else {
      errors.push(message);
    }
  }

  // Check for overallocation
  if (capacity.is_overallocated) {
    warnings.push('Truck is already overallocated');
  }

  // Check utilization
  const newUtilization = ((capacity.allocated_weight_kg + orderWeight) / capacity.total_capacity_kg) * 100;
  if (newUtilization > 95) {
    warnings.push('Very high capacity utilization (>95%)');
  } else if (newUtilization > 85) {
    warnings.push('High capacity utilization (>85%)');
  }

  // Check number of orders
  if (capacity.orders_count >= 8) {
    warnings.push('Truck has many orders already allocated');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
}

export function calculateRouteEfficiency(allocations: TruckAllocation[]): {
  totalStops: number;
  estimatedDistance: number;
  estimatedDuration: number;
  efficiency: 'high' | 'medium' | 'low';
} {
  const totalStops = allocations.length;
  
  // Simple estimation - in a real app, this would use routing algorithms
  const estimatedDistance = totalStops > 0 ? 20 + (totalStops - 1) * 15 : 0; // km
  const estimatedDuration = totalStops > 0 ? 60 + (totalStops - 1) * 30 : 0; // minutes
  
  let efficiency: 'high' | 'medium' | 'low' = 'high';
  if (totalStops > 8) {
    efficiency = 'low';
  } else if (totalStops > 5) {
    efficiency = 'medium';
  }

  return {
    totalStops,
    estimatedDistance,
    estimatedDuration,
    efficiency,
  };
}

export function groupAllocationsByDate(allocations: TruckAllocation[]): Record<string, TruckAllocation[]> {
  return allocations.reduce((groups, allocation) => {
    const date = allocation.allocation_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(allocation);
    return groups;
  }, {} as Record<string, TruckAllocation[]>);
}

export function sortAllocationsBySequence(allocations: TruckAllocation[]): TruckAllocation[] {
  return [...allocations].sort((a, b) => {
    // Sort by stop_sequence if available, otherwise by allocation time
    if (a.stop_sequence && b.stop_sequence) {
      return a.stop_sequence - b.stop_sequence;
    }
    if (a.stop_sequence && !b.stop_sequence) return -1;
    if (!a.stop_sequence && b.stop_sequence) return 1;
    return new Date(a.allocated_at).getTime() - new Date(b.allocated_at).getTime();
  });
}

export function calculateFleetUtilization(capacities: TruckCapacityInfo[]): {
  totalCapacity: number;
  totalAllocated: number;
  averageUtilization: number;
  overallocatedTrucks: number;
  idleTrucks: number;
} {
  const totalCapacity = capacities.reduce((sum, c) => sum + c.total_capacity_kg, 0);
  const totalAllocated = capacities.reduce((sum, c) => sum + c.allocated_weight_kg, 0);
  const averageUtilization = capacities.length > 0 
    ? capacities.reduce((sum, c) => sum + c.utilization_percentage, 0) / capacities.length 
    : 0;
  const overallocatedTrucks = capacities.filter(c => c.is_overallocated).length;
  const idleTrucks = capacities.filter(c => c.orders_count === 0).length;

  return {
    totalCapacity,
    totalAllocated,
    averageUtilization,
    overallocatedTrucks,
    idleTrucks,
  };
}

export function generateAllocationRecommendations(
  suggestions: AllocationSuggestion[],
  orderWeight: number
): string[] {
  const recommendations: string[] = [];
  const best = getBestAllocationSuggestion(suggestions);

  if (!best) {
    recommendations.push('No suitable truck found. Consider splitting the order or using multiple trucks.');
    return recommendations;
  }

  if (best.score >= 80) {
    recommendations.push('Excellent allocation - optimal capacity utilization and efficiency.');
  } else if (best.score >= 60) {
    recommendations.push('Good allocation - reasonable capacity utilization.');
  } else if (best.score >= 40) {
    recommendations.push('Acceptable allocation - monitor capacity closely.');
  } else {
    recommendations.push('Suboptimal allocation - consider alternatives.');
  }

  // Specific recommendations based on capacity
  const newUtilization = ((best.capacity_info.allocated_weight_kg + orderWeight) / best.capacity_info.total_capacity_kg) * 100;
  
  if (newUtilization > 90) {
    recommendations.push('High capacity utilization - consider reducing other allocations.');
  }

  if (best.capacity_info.orders_count >= 6) {
    recommendations.push('Many stops already planned - consider route optimization.');
  }

  // Check for alternative trucks
  const alternatives = suggestions.filter(s => s.score > 0 && s.truck_id !== best.truck_id);
  if (alternatives.length > 0) {
    recommendations.push(`${alternatives.length} alternative truck(s) available.`);
  }

  return recommendations;
}

export function canModifyAllocation(allocation: TruckAllocation): boolean {
  return allocation.status === 'planned';
}

export function isAllocationOverdue(allocation: TruckAllocation): boolean {
  const today = new Date();
  const allocationDate = new Date(allocation.allocation_date);
  return allocationDate < today && allocation.status !== 'delivered' && allocation.status !== 'cancelled';
}

export function formatAllocationDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateString === today.toISOString().split('T')[0]) {
    return 'Today';
  } else if (dateString === tomorrow.toISOString().split('T')[0]) {
    return 'Tomorrow';
  } else if (dateString === yesterday.toISOString().split('T')[0]) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString();
  }
}

export function getStopSequenceColor(sequence?: number): string {
  if (!sequence) return 'bg-gray-100 text-gray-600';
  
  const colors = [
    'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600', 
    'bg-yellow-100 text-yellow-600',
    'bg-purple-100 text-purple-600',
    'bg-pink-100 text-pink-600',
    'bg-indigo-100 text-indigo-600',
    'bg-orange-100 text-orange-600',
    'bg-red-100 text-red-600',
  ];
  
  return colors[(sequence - 1) % colors.length] || colors[0];
}