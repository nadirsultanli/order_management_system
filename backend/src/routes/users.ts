import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { supabaseAdmin } from '../lib/supabase';
import {
  UserFiltersSchema,
  CreateUserSchema,
  UpdateUserSchema,
  UserIdSchema,
  DeleteUserSchema,
  DriversFilterSchema,
  ChangePasswordSchema,
  UserValidationSchema,
  ValidateEmailSchema,
  SimpleResetPasswordSchema,
} from '../schemas/input/users-input';
import { UserSchema, UserListSchema } from '../schemas/output/users-output';

export const usersRouter = router({
  // GET /users - List users with filtering and pagination
  list: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users',
        tags: ['users'],
        summary: 'List users',
        description: 'Get a list of users with filtering options',
        protect: true,
      }
    })
    .input(UserFiltersSchema)
    .output(UserListSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as { page?: number; limit?: number; search?: string; role?: 'admin' | 'driver' | 'user' };
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const search = filters.search;
      const role = filters.role;
      
      ctx.logger.info('Fetching users with filters:', filters);
      
      // Get total count first
      let countQuery = ctx.supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true });

      // Apply filters to count query
      if (search) {
        countQuery = countQuery.or(
          `name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      if (role) {
        countQuery = countQuery.eq('role', role);
      }

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        ctx.logger.error('Error getting user count:', countError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: countError.message
        });
      }

      // Get paginated users
      let query = ctx.supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Apply same filters to main query
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Supabase users error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const totalPages = Math.ceil((totalCount || 0) / limit);

      // Validate pagination request
      if (page > totalPages && totalPages > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Requested page ${page} exceeds total pages ${totalPages}`
        });
      }

      return {
        users: data || [],
        totalCount: totalCount || 0,
        totalPages,
        currentPage: page,
      };
    }),

  // GET /users/{id} - Get single user by ID
  getById: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/{user_id}',
        tags: ['users'],
        summary: 'Get user by ID',
        description: 'Get a single user by their ID',
        protect: true,
      }
    })
    .input(UserIdSchema)
    .output(UserSchema)
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Fetching user:', input.user_id);
      
      const { data, error } = await ctx.supabase
        .from('admin_users')
        .select('*')
        .eq('id', input.user_id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }
        ctx.logger.error('User fetch error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      return data;
    }),

  // POST /users - Create new user
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users',
        tags: ['users'],
        summary: 'Create user',
        description: 'Create a new user account using the proper auth registration flow',
        protect: true,
      }
    })
    .input(CreateUserSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Creating user:', { email: input.email, role: input.role });
      
      try {
        let authUserId: string | null = null;
        if (input.password) {
          // Create user in Supabase Auth first if password is provided
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true, // Auto-confirm for admin-created users
          });

          if (authError || !authData.user) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: authError?.message || 'Failed to create auth user',
            });
          }
          authUserId = authData.user.id;
        }

        // Create user record in admin_users table
        const insertData: any = {
          auth_user_id: authUserId,
          email: input.email,
          name: input.name,
          role: input.role,
          active: true, // Ensure users created by admins are active
        };
        if (input.phone) insertData.phone = input.phone;
        if (input.employee_id) insertData.employee_id = input.employee_id;
        if (input.department) insertData.department = input.department;
        if (input.hire_date) insertData.hire_date = input.hire_date;

        // Add optional fields if provided
        if (input.phone) insertData.phone = input.phone;
        if (input.license_number) insertData.license_number = input.license_number;
        if (input.hire_date) insertData.hire_date = input.hire_date;
        if (input.emergency_contact) insertData.emergency_contact = input.emergency_contact;
        if (input.emergency_phone) insertData.emergency_phone = input.emergency_phone;
        if (input.notes) insertData.notes = input.notes;
        if (input.employee_id) insertData.employee_id = input.employee_id;
        if (input.department) insertData.department = input.department;

        const { data: userData, error: userError } = await ctx.supabase
          .from('admin_users')
          .insert(insertData)
          .select()
          .single();

        if (userError) {
          // Clean up auth user if admin_users creation fails
          if (authUserId) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          }
          ctx.logger.error('User creation failed:', userError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create admin user: ${userError.message || userError.code || 'Unknown error'}`
          });
        }

        ctx.logger.info('User created successfully:', userData.id);
        return userData;
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        
        ctx.logger.error('User creation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `User creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  // PUT /users/{id} - Update user
  update: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/users/{id}',
        tags: ['users'],
        summary: 'Update user',
        description: 'Update user information',
        protect: true,
      }
    })
    .input(UpdateUserSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Updating user:', input.id);
      
      const { id, ...updateData } = input;
      
      // Filter out undefined values and fields that don't exist in admin_users table
      const allowedFields = ['email', 'name', 'role', 'active', 'phone', 'license_number', 'hire_date', 'emergency_contact', 'emergency_phone', 'notes', 'employee_id', 'department'];
      const userUpdateFields = Object.fromEntries(
        Object.entries(updateData)
          .filter(([key, value]) => value !== undefined && allowedFields.includes(key))
      );
      
      if (Object.keys(userUpdateFields).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No fields to update'
        });
      }

      // Update user in admin_users table
      const { data, error } = await ctx.supabase
        .from('admin_users')
        .update(userUpdateFields)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
        }
        ctx.logger.error('Update user error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // If email was updated, also update it in Supabase Auth
      if (userUpdateFields.email && typeof userUpdateFields.email === 'string' && data.auth_user_id) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(data.auth_user_id, {
            email: userUpdateFields.email,
          });
        } catch (authError) {
          ctx.logger.warn('Failed to update auth email:', authError);
          // Don't fail the whole operation if auth update fails
        }
      }

      ctx.logger.info('User updated successfully:', data.id);
      return data;
    }),

  // DELETE /users/{id} - Delete or deactivate user
  delete: protectedProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: '/users/{user_id}',
        tags: ['users'],
        summary: 'Delete user',
        description: 'Delete or deactivate a user account',
        protect: true,
      }
    })
    .input(DeleteUserSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Deleting user:', input.user_id);
      
      // Get auth_user_id before deleting
      const { data: userData, error: fetchError } = await ctx.supabase
        .from('admin_users')
        .select('auth_user_id')
        .eq('id', input.user_id)
        .single();

      if (fetchError) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // Delete from admin_users table
      const { error } = await ctx.supabase
        .from('admin_users')
        .delete()
        .eq('id', input.user_id);

      if (error) {
        ctx.logger.error('Delete user error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      // Delete from Supabase Auth
      if (userData.auth_user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(userData.auth_user_id);
        } catch (authError) {
          ctx.logger.warn('Failed to delete auth user:', authError);
          // Don't fail if auth deletion fails
        }
      }

      ctx.logger.info('User permanently deleted:', input.user_id);
      return { success: true, message: 'User deleted successfully' };
    }),

  // GET /users/drivers - Get drivers only (filtered list)
  getDrivers: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/users/drivers',
        tags: ['users', 'drivers'],
        summary: 'Get drivers',
        description: 'Get a list of users with driver role',
        protect: true,
      }
    })
    .input(DriversFilterSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      // Provide default values if input is undefined
      const filters = input || {} as { page?: number; limit?: number; search?: string; active?: boolean; available?: boolean };
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const search = filters.search;
      const active = filters.active;
      
      ctx.logger.info('Fetching drivers with filters:', filters);
      
      // Get total count of drivers
      let countQuery = ctx.supabase
        .from('admin_users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'driver');

      // Apply filters to count query
      if (search) {
        countQuery = countQuery.or(
          `name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      if (active !== undefined) {
        countQuery = countQuery.eq('active', active);
      }

      const { count: totalCount, error: countError } = await countQuery;

      if (countError) {
        ctx.logger.error('Error getting driver count:', countError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: countError.message
        });
      }

      // Get paginated drivers
      let query = ctx.supabase
        .from('admin_users')
        .select('*')
        .eq('role', 'driver')
        .order('name', { ascending: true })
        .range((page - 1) * limit, page * limit - 1);

      // Apply same filters to main query
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      if (active !== undefined) {
        query = query.eq('active', active);
      }

      const { data, error } = await query;

      if (error) {
        ctx.logger.error('Supabase drivers error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message
        });
      }

      const totalPages = Math.ceil((totalCount || 0) / limit);

      return {
        drivers: data || [],
        totalCount: totalCount || 0,
        totalPages,
        currentPage: page,
      };
    }),

  // POST /users/{id}/change-password - Change user password
  changePassword: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users/{user_id}/change-password',
        tags: ['users'],
        summary: 'Change user password',
        description: 'Change password for a user',
        protect: true,
      }
    })
    .input(ChangePasswordSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Changing password for user:', input.user_id);
      
      // Get user's auth_user_id
      const { data: userData, error: fetchError } = await ctx.supabase
        .from('admin_users')
        .select('auth_user_id, name')
        .eq('id', input.user_id)
        .single();

      if (fetchError || !userData) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // Update password in Supabase Auth
      try {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userData.auth_user_id,
          { password: input.new_password }
        );

        if (authError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: authError.message
          });
        }

        ctx.logger.info('Password changed successfully for user:', userData.name);
        return { success: true, message: 'Password changed successfully' };
      } catch (error) {
        ctx.logger.error('Password change error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to change password'
        });
      }
    }),

  // POST /users/validate - Validate user data
  validate: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users/validate',
        tags: ['users', 'validation'],
        summary: 'Validate user data',
        description: 'Validate user data for duplicates',
        protect: true,
      }
    })
    .input(UserValidationSchema)
    .output(z.any())
    .mutation(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Validating user data:', input);
      
      const errors: string[] = [];
      const warnings: string[] = [];
      
      // Check for duplicate email
      if (input.email) {
        let emailQuery = ctx.supabase
          .from('admin_users')
          .select('id, name')
          .eq('email', input.email);
        
        if (input.exclude_id) {
          emailQuery = emailQuery.neq('id', input.exclude_id);
        }
        
        const { data: existingByEmail } = await emailQuery.single();
        
        if (existingByEmail) {
          errors.push(`A user with email "${input.email}" already exists: ${existingByEmail.name}`);
        }
      }
      
      // Check for duplicate employee_id
      if (input.employee_id) {
        let employeeIdQuery = ctx.supabase
          .from('admin_users')
          .select('id, name')
          .eq('employee_id', input.employee_id);
        
        if (input.exclude_id) {
          employeeIdQuery = employeeIdQuery.neq('id', input.exclude_id);
        }
        
        const { data: existingByEmployeeId } = await employeeIdQuery.single();
        
        if (existingByEmployeeId) {
          errors.push(`A user with employee ID "${input.employee_id}" already exists: ${existingByEmployeeId.name}`);
        }
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    }),

  // POST /users/validate-email - Validate if email exists
  validateEmail: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users/validate-email',
        tags: ['users', 'password-reset'],
        summary: 'Validate email exists',
        description: 'Check if user email exists in the system',
        protect: true,
      }
    })
    .input(ValidateEmailSchema)
    .output(z.object({
      exists: z.boolean(),
      message: z.string(),
      user_name: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // No authentication required
      ctx.logger.info('Validating email exists:', input.email);
      
      try {
        // Check if user exists in admin_users table
        const { data: userData, error: userError } = await ctx.supabase
          .from('admin_users')
          .select('id, name, email')
          .eq('email', input.email)
          .single();

        if (userError || !userData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No user found with this email address'
          });
        }

        ctx.logger.info('Email validation successful for:', userData.name);
        
        return {
          exists: true,
          message: 'Email found. You can proceed to reset password.',
          user_name: userData.name
        };

      } catch (error) {
        ctx.logger.error('Email validation error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No user found with this email address'
        });
      }
    }),

  // POST /users/reset-password-simple - Reset password with email validation
  resetPasswordSimple: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/users/reset-password-simple',
        tags: ['users', 'password-reset'],
        summary: 'Reset password (simple)',
        description: 'Reset user password after validating email exists (no token required)',
        protect: true,
      }
    })
    .input(SimpleResetPasswordSchema)
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // No authentication required
      ctx.logger.info('Resetting password for email:', input.email);
      
      try {
        // Validate that passwords match (also done in schema)
        if (input.password !== input.confirm_password) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Passwords do not match'
          });
        }

        // Check if user exists and get auth_user_id
        const { data: userData, error: userError } = await ctx.supabase
          .from('admin_users')
          .select('id, name, email, auth_user_id')
          .eq('email', input.email)
          .single();

        if (userError || !userData) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No user found with this email address'
          });
        }

        if (!userData.auth_user_id) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'User account is not properly configured'
          });
        }

        // Update password in Supabase Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          userData.auth_user_id,
          { password: input.password }
        );

        if (authError) {
          ctx.logger.error('Password reset error:', authError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to reset password: ${authError.message}`
          });
        }

        ctx.logger.info('Password reset successful for user:', userData.name);
        
        return {
          success: true,
          message: `Password has been reset successfully for ${userData.name}`
        };

      } catch (error) {
        ctx.logger.error('Password reset error:', error);
        
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset password'
        });
      }
    }),
});