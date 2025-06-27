export interface Warehouse {
  id: string;
  name: string;
  address_id?: string;
  capacity_cylinders?: number;
  created_at: string;
  address?: {
    id: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface CreateWarehouseData {
  name: string;
  capacity_cylinders?: number;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code?: string;
    country: string;
    instructions?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface UpdateWarehouseData extends Partial<CreateWarehouseData> {
  id: string;
}

export interface WarehouseFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface WarehouseStats {
  total: number;
  total_capacity: number;
  average_capacity: number;
}

export interface WarehouseOption {
  id: string;
  name: string;
  city?: string;
  state?: string;
}