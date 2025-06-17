import { supabase } from './supabase';

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
  qty_full: number;
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

export interface TransferLine {
  id: string;
  transfer_id: string;
  product_id: string;
  quantity_full: number;
  quantity_empty: number;
  created_at: string;
}

export interface TransferData {
  truck_id: string;
  warehouse_id: string;
  lines: TransferLine[];
}

export const getTruckInventory = async (truckId: string): Promise<TruckInventoryItem[]> => {
  const { data, error } = await supabase
    .rpc('get_truck_inventory', {
      p_truck_id: truckId
    });

  if (error) throw error;
  return data || [];
};

export const createLoadTransfer = async (data: TransferData) => {
  const { data: result, error } = await supabase
    .rpc('create_load_transfer', {
      p_truck_id: data.truck_id,
      p_warehouse_id: data.warehouse_id,
      p_lines: data.lines
    });

  if (error) throw error;
  return result;
};

export const createReturnTransfer = async (data: TransferData) => {
  const { data: result, error } = await supabase
    .rpc('create_return_transfer', {
      p_truck_id: data.truck_id,
      p_warehouse_id: data.warehouse_id,
      p_lines: data.lines
    });

  if (error) throw error;
  return result;
};

export const getTransfers = async (type?: 'load' | 'return') => {
  let query = supabase
    .from('transfers')
    .select(`
      *,
      source_warehouse:source_warehouse_id(name),
      destination_warehouse:destination_warehouse_id(name),
      transfer_lines(
        *,
        product:product_id(name, sku)
      )
    `)
    .order('created_at', { ascending: false });

  if (type) {
    query = query.eq('transfer_type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getAvailableTrucks = async () => {
  const { data, error } = await supabase
    .from('truck')
    .select(`
      *,
      warehouse:warehouses!truck_id(name)
    `)
    .eq('active', true);

  if (error) throw error;
  return data;
}; 