// Enhanced transfer types for multi-SKU operations with variant support

export interface MultiSkuTransferItem {
  id?: string; // for editing existing items
  product_id: string;
  product_sku: string;
  product_name: string;
  variant_name?: string; // 'full', 'empty', etc. for cylinders
  variant_type?: 'cylinder' | 'refillable' | 'disposable';
  
  // Transfer quantities
  quantity_to_transfer: number;
  available_stock: number;
  reserved_stock?: number; // stock already reserved for other transfers
  
  // Weight and capacity calculations
  unit_weight_kg?: number;
  total_weight_kg?: number;
  
  // Pricing (optional)
  unit_cost?: number;
  total_cost?: number;
  
  // Source warehouse specific data
  source_location?: string; // specific location within warehouse
  batch_number?: string; // for tracking
  expiry_date?: string; // if applicable
  
  // Validation
  is_valid: boolean;
  validation_errors: string[];
  validation_warnings: string[];
}

export interface MultiSkuTransfer {
  id: string;
  transfer_reference?: string; // user-defined reference
  
  // Warehouse information
  source_warehouse_id: string;
  source_warehouse_name?: string;
  destination_warehouse_id: string;
  destination_warehouse_name?: string;
  
  // Transfer details
  transfer_date: string;
  scheduled_date?: string; // when transfer should happen
  completed_date?: string; // when actually completed
  
  // Status and tracking
  status: 'draft' | 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  transfer_type: 'internal' | 'external' | 'adjustment' | 'return';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  
  // Items and totals
  items: MultiSkuTransferItem[];
  total_items: number;
  total_quantity: number;
  total_weight_kg?: number;
  total_cost?: number;
  
  // Additional information
  notes?: string;
  reason?: string; // reason for transfer
  instructions?: string; // special handling instructions
  
  // User tracking
  created_by_user_id: string;
  created_by_user_name?: string;
  approved_by_user_id?: string;
  approved_by_user_name?: string;
  processed_by_user_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  approved_at?: string;
  processed_at?: string;
  
  // Integration
  truck_id?: string; // if transport is required
  route_id?: string; // if part of delivery route
  
  // Audit and tracking
  tracking_number?: string;
  external_reference?: string;
}

export interface TransferValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
  blocked_items: string[]; // product IDs that cannot be transferred
  total_weight_kg: number;
  estimated_cost?: number;
}

export interface WarehouseStockInfo {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  variant_name?: string;
  
  // Stock levels
  qty_available: number;
  qty_reserved: number;
  qty_on_order: number;
  qty_full?: number; // for cylinders
  qty_empty?: number; // for cylinders
  
  // Location details
  locations: Array<{
    location_code: string;
    location_name: string;
    quantity: number;
  }>;
  
  // Additional info
  last_updated: string;
  reorder_level?: number;
  max_capacity?: number;
}

export interface TransferBatch {
  id: string;
  batch_date: string;
  source_warehouse_id: string;
  transfers: MultiSkuTransfer[];
  total_transfers: number;
  total_items: number;
  total_weight_kg: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_by_user_id: string;
  created_at: string;
}

export interface TransferHistory {
  id: string;
  transfer_id: string;
  action: 'created' | 'updated' | 'approved' | 'started' | 'completed' | 'cancelled';
  action_date: string;
  action_by_user_id: string;
  action_by_user_name?: string;
  notes?: string;
  previous_status?: string;
  new_status?: string;
  changes?: Record<string, any>; // JSON of what changed
}

export interface InventoryMovement {
  id: string;
  transfer_id: string;
  product_id: string;
  variant_name?: string;
  
  // Movement details
  movement_type: 'transfer_out' | 'transfer_in' | 'adjustment' | 'reservation';
  quantity: number;
  unit_cost?: number;
  
  // Warehouse information
  warehouse_id: string;
  location_code?: string;
  
  // Reference information
  reference_type: 'transfer' | 'order' | 'adjustment' | 'return';
  reference_id: string;
  
  // Timestamps
  movement_date: string;
  created_at: string;
  
  // Audit
  created_by_user_id: string;
  notes?: string;
}

// Create transfer request types
export interface CreateMultiSkuTransferRequest {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  transfer_date: string;
  items: Omit<MultiSkuTransferItem, 'id' | 'is_valid' | 'validation_errors' | 'validation_warnings'>[];
  notes?: string;
  reason?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  transfer_reference?: string;
}

export interface UpdateTransferStatusRequest {
  transfer_id: string;
  new_status: MultiSkuTransfer['status'];
  notes?: string;
  completed_items?: string[]; // for partial completions
}

// Filter and search types
export interface TransferFilters {
  source_warehouse_id?: string;
  destination_warehouse_id?: string;
  status?: MultiSkuTransfer['status'][];
  transfer_type?: MultiSkuTransfer['transfer_type'];
  date_from?: string;
  date_to?: string;
  created_by_user_id?: string;
  search_text?: string; // searches reference, notes, product names
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'transfer_date' | 'total_items' | 'total_weight_kg';
  sort_order?: 'asc' | 'desc';
}

export interface ProductSelectionFilters {
  warehouse_id: string;
  search_text?: string;
  variant_type?: 'cylinder' | 'refillable' | 'disposable';
  variant_name?: string;
  has_stock?: boolean; // only show products with available stock
  category?: string;
  page?: number;
  limit?: number;
}

// Utility types for form handling
export interface TransferFormData {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  transfer_date: string;
  scheduled_date?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  transfer_reference?: string;
  reason?: string;
  notes?: string;
  instructions?: string;
  selected_items: MultiSkuTransferItem[];
}

export interface TransferSummary {
  total_products: number;
  total_quantity: number;
  total_weight_kg: number;
  total_cost?: number;
  unique_variants: number;
  heaviest_item?: MultiSkuTransferItem;
  most_expensive_item?: MultiSkuTransferItem;
  validation_summary: {
    valid_items: number;
    invalid_items: number;
    items_with_warnings: number;
  };
}

// Status enums for better type safety
export const TransferStatus = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const TransferType = {
  INTERNAL: 'internal',
  EXTERNAL: 'external',
  ADJUSTMENT: 'adjustment',
  RETURN: 'return'
} as const;

export const TransferPriority = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent'
} as const; 