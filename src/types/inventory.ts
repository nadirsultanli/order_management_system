export interface InventoryBalance {
  id: string;
  warehouse_id: string;
  product_id: string;
  qty_full: number;
  qty_empty: number;
  qty_reserved: number;
  qty_quarantine?: number;
  qty_damaged?: number;
  qty_in_transit?: number;
  qty_under_maintenance?: number;
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
  movement_type: 'adjustment' | 'transfer_in' | 'transfer_out' | 'order_reserve' | 'order_fulfill' | 'receipt' | 'damage' | 'maintenance' | 'disposal';
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

// New interfaces for warehouse operations

export interface Receipt {
  id: string;
  warehouse_id: string;
  supplier_dn_number?: string;
  truck_registration?: string;
  driver_name?: string;
  receipt_date: string;
  status: 'open' | 'partial' | 'completed' | 'cancelled';
  total_items_expected: number;
  total_items_received: number;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
  warehouse?: {
    id: string;
    name: string;
  };
  receipt_lines?: ReceiptLine[];
}

export interface ReceiptLine {
  id: string;
  receipt_id: string;
  product_id: string;
  qty_expected: number;
  qty_received_good: number;
  qty_received_damaged: number;
  condition_flag: 'good' | 'damaged';
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface CycleCount {
  id: string;
  warehouse_id: string;
  count_date: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  counted_by_user_id?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  warehouse?: {
    id: string;
    name: string;
  };
  cycle_count_lines?: CycleCountLine[];
}

export interface CycleCountLine {
  id: string;
  cycle_count_id: string;
  product_id: string;
  system_qty_full: number;
  system_qty_empty: number;
  counted_qty_full: number;
  counted_qty_empty: number;
  variance_qty_full: number;
  variance_qty_empty: number;
  notes?: string;
  created_at: string;
  product?: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface CreateReceiptData {
  warehouse_id: string;
  supplier_dn_number?: string;
  truck_registration?: string;
  driver_name?: string;
  receipt_date?: string;
  notes?: string;
  receipt_lines: {
    product_id: string;
    qty_expected: number;
    qty_received_good: number;
    qty_received_damaged: number;
    condition_flag: 'good' | 'damaged';
    notes?: string;
  }[];
}

export interface CreateCycleCountData {
  warehouse_id: string;
  count_date?: string;
  notes?: string;
  cycle_count_lines: {
    product_id: string;
    system_qty_full: number;
    system_qty_empty: number;
    counted_qty_full: number;
    counted_qty_empty: number;
    notes?: string;
  }[];
}