import { StockMovement, StockMovementSummary, CreateStockMovementData } from '../types/truck';

/**
 * Utility functions for stock movements and inventory tracking
 */

export function getMovementTypeColor(movementType: string): string {
  switch (movementType) {
    case 'delivery':
      return 'bg-blue-100 text-blue-800';
    case 'pickup':
      return 'bg-green-100 text-green-800';
    case 'refill':
      return 'bg-purple-100 text-purple-800';
    case 'exchange':
      return 'bg-orange-100 text-orange-800';
    case 'transfer':
      return 'bg-yellow-100 text-yellow-800';
    case 'adjustment':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getMovementTypeIcon(movementType: string): string {
  switch (movementType) {
    case 'delivery':
      return '🚚';
    case 'pickup':
      return '📦';
    case 'refill':
      return '🔄';
    case 'exchange':
      return '🔁';
    case 'transfer':
      return '📋';
    case 'adjustment':
      return '⚖️';
    default:
      return '❓';
  }
}

export function getMovementDirection(movement: StockMovement): 'in' | 'out' | 'mixed' {
  const hasIn = movement.qty_full_in > 0 || movement.qty_empty_in > 0;
  const hasOut = movement.qty_full_out > 0 || movement.qty_empty_out > 0;
  
  if (hasIn && hasOut) return 'mixed';
  if (hasIn) return 'in';
  if (hasOut) return 'out';
  return 'mixed'; // fallback
}

export function getMovementDirectionIcon(direction: 'in' | 'out' | 'mixed'): string {
  switch (direction) {
    case 'in':
      return '⬇️';
    case 'out':
      return '⬆️';
    case 'mixed':
      return '↕️';
    default:
      return '❓';
  }
}

export function calculateNetMovement(movement: StockMovement): {
  net_full: number;
  net_empty: number;
  net_total: number;
} {
  const net_full = movement.qty_full_in - movement.qty_full_out;
  const net_empty = movement.qty_empty_in - movement.qty_empty_out;
  const net_total = net_full + net_empty;

  return { net_full, net_empty, net_total };
}

export function formatMovementQuantities(movement: StockMovement): string {
  const parts: string[] = [];
  
  if (movement.qty_full_in > 0) {
    parts.push(`+${movement.qty_full_in} full`);
  }
  if (movement.qty_full_out > 0) {
    parts.push(`-${movement.qty_full_out} full`);
  }
  if (movement.qty_empty_in > 0) {
    parts.push(`+${movement.qty_empty_in} empty`);
  }
  if (movement.qty_empty_out > 0) {
    parts.push(`-${movement.qty_empty_out} empty`);
  }
  
  return parts.length > 0 ? parts.join(', ') : 'No quantities';
}

export function summarizeMovementImpact(movement: StockMovement): string {
  const net = calculateNetMovement(movement);
  const impact: string[] = [];
  
  if (net.net_full > 0) {
    impact.push(`+${net.net_full} full cylinders`);
  } else if (net.net_full < 0) {
    impact.push(`${net.net_full} full cylinders`);
  }
  
  if (net.net_empty > 0) {
    impact.push(`+${net.net_empty} empty cylinders`);
  } else if (net.net_empty < 0) {
    impact.push(`${net.net_empty} empty cylinders`);
  }
  
  return impact.length > 0 ? impact.join(', ') : 'No net impact';
}

export function validateStockMovement(movement: CreateStockMovementData): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check that at least one quantity is specified
  const totalQty = (movement.qty_full_in || 0) + (movement.qty_full_out || 0) + 
                   (movement.qty_empty_in || 0) + (movement.qty_empty_out || 0);
  
  if (totalQty === 0) {
    errors.push('At least one quantity must be greater than 0');
  }

  // Validate movement date
  const movementDate = new Date(movement.movement_date);
  const today = new Date();
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  if (movementDate > today) {
    warnings.push('Movement date is in the future');
  } else if (movementDate < oneYearAgo) {
    warnings.push('Movement date is more than a year old');
  }

  // Validate movement type specific rules
  switch (movement.movement_type) {
    case 'delivery':
      if ((movement.qty_full_out || 0) === 0) {
        warnings.push('Delivery movements typically should have full cylinders going out');
      }
      break;
    case 'pickup':
      if ((movement.qty_empty_in || 0) === 0) {
        warnings.push('Pickup movements typically should have empty cylinders coming in');
      }
      break;
    case 'refill':
      if ((movement.qty_full_out || 0) === 0 || (movement.qty_empty_in || 0) === 0) {
        warnings.push('Refill movements typically should have full cylinders going out and empty cylinders coming in');
      }
      break;
    case 'exchange':
      if ((movement.qty_full_out || 0) === 0 || (movement.qty_empty_in || 0) === 0) {
        warnings.push('Exchange movements typically should have both full and empty cylinder movements');
      }
      break;
  }

  // Validate warehouse/truck context
  if (movement.movement_type === 'transfer' && !movement.truck_id && !movement.warehouse_id) {
    errors.push('Transfer movements require either a truck or warehouse to be specified');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function groupMovementsByType(movements: StockMovement[]): Record<string, StockMovement[]> {
  return movements.reduce((groups, movement) => {
    const type = movement.movement_type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(movement);
    return groups;
  }, {} as Record<string, StockMovement[]>);
}

export function groupMovementsByDate(movements: StockMovement[]): Record<string, StockMovement[]> {
  return movements.reduce((groups, movement) => {
    const date = movement.movement_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(movement);
    return groups;
  }, {} as Record<string, StockMovement[]>);
}

export function groupMovementsByProduct(movements: StockMovement[]): Record<string, StockMovement[]> {
  return movements.reduce((groups, movement) => {
    const productKey = movement.product?.sku || movement.product_id;
    if (!groups[productKey]) {
      groups[productKey] = [];
    }
    groups[productKey].push(movement);
    return groups;
  }, {} as Record<string, StockMovement[]>);
}

export function calculateProductMovementSummary(movements: StockMovement[]): {
  total_full_in: number;
  total_full_out: number;
  total_empty_in: number;
  total_empty_out: number;
  net_full: number;
  net_empty: number;
  movement_count: number;
} {
  const summary = movements.reduce(
    (acc, movement) => ({
      total_full_in: acc.total_full_in + movement.qty_full_in,
      total_full_out: acc.total_full_out + movement.qty_full_out,
      total_empty_in: acc.total_empty_in + movement.qty_empty_in,
      total_empty_out: acc.total_empty_out + movement.qty_empty_out,
      movement_count: acc.movement_count + 1,
    }),
    {
      total_full_in: 0,
      total_full_out: 0,
      total_empty_in: 0,
      total_empty_out: 0,
      movement_count: 0,
    }
  );

  return {
    ...summary,
    net_full: summary.total_full_in - summary.total_full_out,
    net_empty: summary.total_empty_in - summary.total_empty_out,
  };
}

export function suggestMovementType(context: {
  hasOrder?: boolean;
  hasTruck?: boolean;
  hasWarehouse?: boolean;
  isFullCylinder?: boolean;
  isEmptyCylinder?: boolean;
}): string[] {
  const suggestions: string[] = [];

  if (context.hasOrder && context.hasTruck) {
    if (context.isFullCylinder) {
      suggestions.push('delivery');
    }
    if (context.isEmptyCylinder) {
      suggestions.push('pickup');
    }
  }

  if (context.hasOrder && (context.isFullCylinder || context.isEmptyCylinder)) {
    suggestions.push('refill', 'exchange');
  }

  if (context.hasTruck && context.hasWarehouse) {
    suggestions.push('transfer');
  }

  if (!context.hasOrder && !context.hasTruck) {
    suggestions.push('adjustment');
  }

  return suggestions.length > 0 ? suggestions : ['adjustment'];
}

export function formatMovementReference(movement: StockMovement): string {
  if (movement.reference_number) {
    return movement.reference_number;
  }
  
  if (movement.order?.id) {
    return `ORDER-${movement.order.id.slice(-8)}`;
  }
  
  if (movement.truck?.fleet_number) {
    return `TRUCK-${movement.truck.fleet_number}`;
  }
  
  return `MOV-${movement.id.slice(-8)}`;
}

export function isRecentMovement(movement: StockMovement, days: number = 7): boolean {
  const movementDate = new Date(movement.movement_date);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return movementDate >= cutoffDate;
}

export function getMovementVelocity(movements: StockMovement[], days: number = 30): {
  movements_per_day: number;
  full_cylinders_per_day: number;
  empty_cylinders_per_day: number;
} {
  const recentMovements = movements.filter(m => isRecentMovement(m, days));
  const summary = calculateProductMovementSummary(recentMovements);
  
  return {
    movements_per_day: summary.movement_count / days,
    full_cylinders_per_day: Math.abs(summary.net_full) / days,
    empty_cylinders_per_day: Math.abs(summary.net_empty) / days,
  };
}

export function identifyStockTrends(movements: StockMovement[]): {
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: 'high' | 'medium' | 'low';
  description: string;
} {
  if (movements.length < 5) {
    return {
      trend: 'stable',
      confidence: 'low',
      description: 'Insufficient data to determine trend',
    };
  }

  // Sort movements by date
  const sortedMovements = movements.sort((a, b) => 
    new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime()
  );

  const recentHalf = sortedMovements.slice(Math.floor(sortedMovements.length / 2));
  const olderHalf = sortedMovements.slice(0, Math.floor(sortedMovements.length / 2));

  const recentSummary = calculateProductMovementSummary(recentHalf);
  const olderSummary = calculateProductMovementSummary(olderHalf);

  const recentNet = recentSummary.net_full + recentSummary.net_empty;
  const olderNet = olderSummary.net_full + olderSummary.net_empty;

  const change = recentNet - olderNet;
  const changePercent = olderNet !== 0 ? Math.abs(change / olderNet) * 100 : 0;

  let trend: 'increasing' | 'decreasing' | 'stable';
  let confidence: 'high' | 'medium' | 'low';

  if (Math.abs(change) < 2) {
    trend = 'stable';
  } else if (change > 0) {
    trend = 'increasing';
  } else {
    trend = 'decreasing';
  }

  if (changePercent > 50) {
    confidence = 'high';
  } else if (changePercent > 20) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  const description = `Stock levels appear to be ${trend} based on recent movement patterns`;

  return { trend, confidence, description };
}

export function generateMovementInsights(summary: StockMovementSummary): string[] {
  const insights: string[] = [];

  // Movement frequency insights
  if (summary.total_movements === 0) {
    insights.push('No stock movements recorded in this period');
    return insights;
  }

  const avgMovementsPerType = summary.total_movements / Object.keys(summary.by_movement_type).length;
  if (avgMovementsPerType > 10) {
    insights.push('High movement activity detected');
  } else if (avgMovementsPerType < 2) {
    insights.push('Low movement activity');
  }

  // Balance insights
  const netFull = summary.total_full_in - summary.total_full_out;
  const netEmpty = summary.total_empty_in - summary.total_empty_out;

  if (netFull > netEmpty * 2) {
    insights.push('Building up full cylinder inventory');
  } else if (netEmpty > netFull * 2) {
    insights.push('Accumulating empty cylinders - consider refill operations');
  }

  // Movement type insights
  const deliveryCount = summary.by_movement_type.delivery?.count || 0;
  const pickupCount = summary.by_movement_type.pickup?.count || 0;
  const refillCount = summary.by_movement_type.refill?.count || 0;

  if (deliveryCount > pickupCount * 2) {
    insights.push('High delivery activity - monitor empty cylinder returns');
  }

  if (refillCount < deliveryCount * 0.1) {
    insights.push('Low refill activity relative to deliveries');
  }

  return insights;
}