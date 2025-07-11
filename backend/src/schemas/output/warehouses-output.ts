import { z } from 'zod';

// ==============================================================
// WAREHOUSES OUTPUT SCHEMAS
// ==============================================================

// ============ Base Entities ============

export const AddressSchema = z.object({
  id: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string(),
  instructions: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity_cylinders: z.number().nullable(),
  address_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  address: z.array(AddressSchema).nullable(),
});

export const WarehouseOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
});

// ============ Core Warehouse Operations ============

export const WarehouseListResponseSchema = z.object({
  warehouses: z.array(WarehouseSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const WarehouseDetailResponseSchema = WarehouseSchema;

export const WarehouseStatsResponseSchema = z.object({
  total: z.number(),
  total_capacity: z.number(),
  average_capacity: z.number(),
});

export const WarehouseOptionsResponseSchema = z.array(WarehouseOptionSchema);

export const CreateWarehouseResponseSchema = WarehouseSchema;

export const UpdateWarehouseResponseSchema = WarehouseSchema;

export const DeleteWarehouseResponseSchema = z.object({
  success: z.boolean(),
}); 