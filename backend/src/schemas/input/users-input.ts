// schemas/input/users-input.ts
import { z } from 'zod';

// User filtering and pagination
export const UserFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['admin', 'driver', 'manager', 'user']).optional(),
  active: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
}).default({});

// User creation schema
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'driver', 'manager', 'user']).default('user'),
  active: z.boolean().default(true),
  phone: z.string().optional(),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().datetime().optional(),
});

// User update schema
export const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'driver', 'manager', 'user']).optional(),
  active: z.boolean().optional(),
  phone: z.string().optional(),
  employee_id: z.string().optional(),
  department: z.string().optional(),
  hire_date: z.string().datetime().optional(),
});

// User ID parameter
export const UserIdSchema = z.object({
  user_id: z.string().uuid(),
});

// User deletion/deactivation
export const DeleteUserSchema = z.object({
  user_id: z.string().uuid(),
  permanent: z.boolean().default(false), // true = delete, false = deactivate
});

// Drivers-only filter schema
export const DriversFilterSchema = z.object({
  search: z.string().optional(),
  active: z.boolean().optional(),
  available: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
}).default({});

// Change password schema
export const ChangePasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
});

// User validation schema
export const UserValidationSchema = z.object({
  email: z.string().email(),
  employee_id: z.string().optional(),
  exclude_id: z.string().uuid().optional(),
});

// Empty object for endpoints with no input
export const EmptyInputSchema = z.object({});

// Export types for TypeScript usage
export type UserFilters = z.infer<typeof UserFiltersSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type DeleteUser = z.infer<typeof DeleteUserSchema>;
export type DriversFilter = z.infer<typeof DriversFilterSchema>;
export type ChangePassword = z.infer<typeof ChangePasswordSchema>;
export type UserValidation = z.infer<typeof UserValidationSchema>;