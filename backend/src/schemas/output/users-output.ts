import { z } from 'zod';

// ==============================================================
// USERS OUTPUT SCHEMAS
// ==============================================================

// ============ Base User Schema ============

export const UserSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'driver', 'user']),
  active: z.boolean(),
  phone: z.string().nullable().optional(),
  license_number: z.string().nullable().optional(),
  hire_date: z.string().nullable().optional(),
  emergency_contact: z.string().nullable().optional(),
  emergency_phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  employee_id: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// ============ User List Operations ============

export const UserListResponseSchema = z.object({
  users: z.array(UserSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

export const UserDetailResponseSchema = UserSchema;

export const CreateUserResponseSchema = UserSchema;

export const UpdateUserResponseSchema = UserSchema;

export const DeleteUserResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============ Driver Operations ============

export const DriverListResponseSchema = z.object({
  drivers: z.array(UserSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
});

// ============ Password Operations ============

export const ChangePasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

// ============ Validation Operations ============

export const UserValidationResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const ValidateEmailResponseSchema = z.object({
  exists: z.boolean(),
  message: z.string(),
  user_name: z.string().optional(),
});

export const ResetPasswordResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
}); 