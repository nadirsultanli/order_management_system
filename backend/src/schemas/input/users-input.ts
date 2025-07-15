// schemas/input/users-input.ts
import { z } from 'zod';

// Helper to handle optional date fields that might be empty strings
const optionalDate = () => z.string().optional().transform((val) => {
  if (val === '' || val === undefined || val === null) {
    return undefined;
  }
  // For date inputs, we expect YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(val)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }
  return val;
});

// User filtering and pagination
export const UserFiltersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(['admin', 'driver', 'user']).optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(50),
}).default({});

// User creation schema
export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['admin', 'driver', 'user']).default('user'),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  hire_date: optionalDate(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  notes: z.string().optional(),
  employee_id: z.string().optional(),
  department: z.string().optional(),
}).refine((data) => {
  // Password is required only for admin users
  if (data.role === 'admin' && !data.password) {
    return false;
  }
  return true;
}, {
  message: 'Password is required for admin users',
  path: ['password'],
});

// User update schema
export const UpdateUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'driver', 'user']).optional(),
  phone: z.string().optional(),
  license_number: z.string().optional(),
  hire_date: optionalDate(),
  emergency_contact: z.string().optional(),
  emergency_phone: z.string().optional(),
  notes: z.string().optional(),
  employee_id: z.string().optional(),
  department: z.string().optional(),
});

// User ID parameter
export const UserIdSchema = z.object({
  user_id: z.string().uuid(),
});

// User deletion
export const DeleteUserSchema = z.object({
  user_id: z.string().uuid(),
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

export const ValidateEmailSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const SimpleResetPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  confirm_password: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});