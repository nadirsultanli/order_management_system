import { z } from 'zod';

// ==============================================================
// WAREHOUSES INPUT SCHEMAS
// ==============================================================

// ============ Base Schemas ============

export const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().min(1),
  instructions: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

// ============ Core Warehouse Operations ============

export const WarehouseFiltersSchema = z.object({
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
});

export const GetWarehouseByIdSchema = z.object({
  id: z.string().uuid(),
});

export const CreateWarehouseSchema = z.object({
  name: z.string().min(1),
  capacity_cylinders: z.number().positive().optional(),
  address: AddressSchema.optional(),
});

export const UpdateWarehouseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  capacity_cylinders: z.number().positive().optional(),
  address: AddressSchema.optional().nullable(), // Allow null to delete address
});

export const DeleteWarehouseSchema = z.object({
  id: z.string().uuid(),
}); 