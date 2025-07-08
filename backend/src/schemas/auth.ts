import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
});

// Session schema
export const sessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number().optional(),
});

// Login response schema
export const loginResponseSchema = z.object({
  user: userSchema,
  session: sessionSchema,
});

// Register response schema
export const registerResponseSchema = z.object({
  user: userSchema,
});

// Me response schema
export const meResponseSchema = z.object({
  user: userSchema,
});

// Refresh response schema
export const refreshResponseSchema = z.object({
  session: sessionSchema,
});

// Logout response schema
export const logoutResponseSchema = z.object({
  success: z.boolean(),
});

// Export types
export type User = z.infer<typeof userSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;