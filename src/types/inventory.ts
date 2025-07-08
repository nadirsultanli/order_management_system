export interface InventoryBalance {
  id: string;
  warehouse_id: string;
  product_id: string;
  qty_full: number;
  qty_empty: number;
  qty_reserved: number;
  updated_at: string;
  warehouse?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    sku: string;
    name: string;
    unit_of_measure: string;
  };
}

export interface CreateInventoryBalanceData {
  warehouse_id: string;
  product_id: string;
  qty_full: number;
  qty_empty: number;
  qty_reserved: number;
}

export interface UpdateInventoryBalanceData extends Partial<CreateInventoryBalanceData> {
  id: string;
}

export interface StockAdjustmentData {
  inventory_id: string;
  adjustment_type: 'received_full' | 'received_empty' | 'physical_count' | 'damage_loss' | 'other';
  qty_full_change: number;
  qty_empty_change: number;
  reason: string;
}

export interface StockTransferData {
  from_warehouse_id: string;
  to_warehouse_id: string;
  product_id: string;
  qty_full: number;
  qty_empty: number;
  notes: string;
}

export interface InventoryFilters {
  warehouse_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InventoryStats {
  total_cylinders: number;
  total_full: number;
  total_empty: number;
  total_reserved: number;
  low_stock_products: number;
  total_available: number;
}

export interface StockMovement {
  id: string;
  inventory_id: string;
  movement_type: 'adjustment' | 'transfer_in' | 'transfer_out' | 'order_reserve' | 'order_fulfill';
  qty_full_change: number;
  qty_empty_change: number;
  reason?: string;
  created_at: string;
  warehouse?: {
    name: string;
  };
  product?: {
    sku: string;
    name: string;
  };
}