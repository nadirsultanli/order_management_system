// DEPRECATED: This file contains legacy functions that violate architecture separation.
// All transfer operations should now use tRPC endpoints (when implemented in backend).
// Frontend should only use the tRPC client via useQuery/useMutation hooks.

export interface TruckInventoryItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  qty_full: number;
  qty_empty: number;
  updated_at: string;
}

export interface TransferLine {
  product_id: string;
  product_name?: string;
  product_sku?: string;
  unit_of_measure?: string;
  qty_full: number;
  qty_empty: number;
}

export interface Transfer {
  id: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  transfer_date: string;
  status: string;
  transfer_type: 'load' | 'return';
  created_at: string;
}

export interface TransferData {
  truck_id: string;
  warehouse_id: string;
  lines: TransferLine[];
}

// DEPRECATED: Use tRPC inventory endpoints instead
export const getTruckInventory = async (truckId: string): Promise<TruckInventoryItem[]> => {
  throw new Error('DEPRECATED: Use tRPC inventory endpoints instead of direct Supabase calls');
};

// DEPRECATED: Use tRPC transfer endpoints instead
export const createLoadTransfer = async (data: TransferData) => {
  throw new Error('DEPRECATED: Use tRPC transfer endpoints instead of direct Supabase calls');
};

// DEPRECATED: Use tRPC transfer endpoints instead
export const createReturnTransfer = async (data: TransferData) => {
  throw new Error('DEPRECATED: Use tRPC transfer endpoints instead of direct Supabase calls');
};

// DEPRECATED: Use tRPC transfer endpoints instead
export const getTransfers = async (type?: 'load' | 'return') => {
  throw new Error('DEPRECATED: Use tRPC transfer endpoints instead of direct Supabase calls');
};

// DEPRECATED: Use tRPC truck/warehouse endpoints instead
export const getAvailableTrucks = async () => {
  throw new Error('DEPRECATED: Use tRPC truck/warehouse endpoints instead of direct Supabase calls');
}; 