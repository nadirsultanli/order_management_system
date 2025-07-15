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
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/login',
        tags: ['auth'],
        summary: 'User login',
        description: 'Authenticate user with email and password',
      }
    })
    .input(LoginSchema)
    .output(z.object({
      user: z.object({
        id: z.string(), // This will now be admin_users.id
        auth_user_id: z.string(), // Add auth user ID for reference
        email: z.string(),
        name: z.string(),
        role: z.string(),
      }),
      session: z.object({
        access_token: z.string(),
        refresh_token: z.string(),
        expires_at: z.number().optional(),
      }),
    }))
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
          .eq('auth_user_id', data.user.id)
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
            id: adminUser.id, // Return admin_users.id instead of auth user ID
            auth_user_id: data.user.id, // Keep auth user ID for reference
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/register',
        tags: ['auth'],
        summary: 'User registration',
        description: 'Register a new admin user',
      }
    })
    .input(RegisterSchema)
    .output(z.object({
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        role: z.string(),
      }),
    }))
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
            auth_user_id: data.user.id,
            email: input.email,
            name: input.name,
            role: 'admin',
            active: true,
          });

        if (adminUserError) {
          // Clean up auth user if admin creation fails
          await supabaseAdmin.auth.admin.deleteUser(data.user.id);
          
          // Provide detailed error message for debugging
          console.error('Admin user creation failed:', adminUserError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create admin user: ${adminUserError.message || adminUserError.code || 'Unknown error'}`,
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
        
        // Log the full error for debugging
        console.error('Registration error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Get current user session
  me: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/auth/me',
        tags: ['auth'],
        summary: 'Get current user',
        description: 'Get current authenticated user information',
        protect: true,
      }
    })
    .input(z.void())
    .output(z.object({
      user: z.object({
        id: z.string(), // This will now be admin_users.id
        auth_user_id: z.string(), // Add auth user ID for reference
        email: z.string(),
        name: z.string(),
        role: z.string(),
      }),
    }))
    .query(async ({ ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      // Query admin_users table to get full user data including name
      const { data: adminUser, error: adminError } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('auth_user_id', ctx.user.id) // ctx.user.id is the Supabase auth user ID
        .eq('active', true)
        .single();

      if (adminError || !adminUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Access denied: Admin user not found',
        });
      }

      return {
        user: {
          id: adminUser.id, // Return admin_users.id instead of auth user ID
          auth_user_id: ctx.user.id, // Keep auth user ID for reference
          email: ctx.user.email || adminUser.email,
          name: adminUser.name,
          role: adminUser.role || 'admin',
        },
      };
    }),

  // Refresh token endpoint
  refresh: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/refresh',
        tags: ['auth'],
        summary: 'Refresh token',
        description: 'Refresh authentication token',
      }
    })
    .input(RefreshTokenSchema)
    .output(z.object({
      session: z.object({
        access_token: z.string(),
        refresh_token: z.string(),
        expires_at: z.number().optional(),
      }),
    }))
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
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/logout',
        tags: ['auth'],
        summary: 'User logout',
        description: 'Logout current user',
        protect: true,
      }
    })
    .input(z.void())
    .output(z.object({
      success: z.boolean(),
    }))
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