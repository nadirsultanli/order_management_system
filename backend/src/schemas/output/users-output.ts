import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  auth_user_id: z.string().uuid().nullable(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(['admin', 'driver', 'user']),
  active: z.boolean(),
  phone: z.string().nullable().optional(),
  employee_id: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  hire_date: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const UserListSchema = z.object({
  users: z.array(UserSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
}); 