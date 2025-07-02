import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';
import { TRPCError } from '@trpc/server';
import { supabaseAdmin } from '../lib/supabase';

// Zod schemas for input validation
const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const RegisterSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
});

const RefreshTokenSchema = z.object({
  refresh_token: z.string(),
});

export const authRouter = router({
  // Login endpoint
  login: publicProcedure
    .input(LoginSchema)
    .mutation(async ({ input }) => {
      try {
        const { data, error } = await supabaseAdmin.auth.signInWithPassword({
          email: input.email,
          password: input.password,
        });

        if (error || !data.user || !data.session) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }

        // Check if user exists in admin_users table
        const { data: adminUser, error: adminError } = await supabaseAdmin
          .from('admin_users')
          .select('*')
          .eq('email', data.user.email!)
          .eq('active', true)
          .single();

        if (adminError || !adminUser) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Access denied: Admin privileges required',
          });
        }

        return {
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: adminUser.name || data.user.email!,
            role: adminUser.role || 'admin',
          },
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Login failed',
        });
      }
    }),

  // Register endpoint
  register: publicProcedure
    .input(RegisterSchema)
    .mutation(async ({ input }) => {
      try {
        // Create user in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: input.email,
          password: input.password,
          email_confirm: true, // Auto-confirm for development
        });

        if (error || !data.user) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error?.message || 'Failed to create user',
          });
        }

        // Create admin user record (only admins can register)
        const { error: adminUserError } = await supabaseAdmin
          .from('admin_users')
          .insert({
            id: data.user.id,
            email: input.email,
            name: input.name,
            role: 'admin',
            active: true,
          });

        if (adminUserError) {
          // Clean up auth user if admin creation fails
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create admin user',
          });
        }

        return {
          user: {
            id: data.user.id,
            email: data.user.email!,
            name: input.name,
            role: 'admin',
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Registration failed',
        });
      }
    }),

  // Get current user session
  me: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      return {
        user: ctx.user,
      };
    }),

  // Refresh token endpoint
  refresh: publicProcedure
    .input(RefreshTokenSchema)
    .mutation(async ({ input }) => {
      try {
        const { data, error } = await supabaseAdmin.auth.refreshSession({
          refresh_token: input.refresh_token,
        });

        if (error || !data.session) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid refresh token',
          });
        }

        return {
          session: {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Token refresh failed',
        });
      }
    }),

  // Logout endpoint
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Supabase doesn't need explicit logout on server side
        // Just return success - frontend will clear tokens
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Logout failed',
        });
      }
    }),
});