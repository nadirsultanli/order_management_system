import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { createUserSupabaseClient, supabaseAdmin } from './supabase';
import { logger, formatErrorMessage } from './logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  user_id: string;
}

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let user: AuthenticatedUser | null = null;
  let userSupabase = null;

  if (token) {
    try {
      // Get user details from Supabase using the token (JWT_SECRET not needed for Supabase auth)
      const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !userData.user) {
        logger.warn('Invalid or expired token provided:', {
          error: error?.message,
          hasUser: !!userData?.user,
          tokenLength: token?.length
        });
      } else {
        // First check if user is an admin user
        const { data: adminUser, error: adminError } = await supabaseAdmin
          .from('admin_users')
          .select('*')
          .eq('auth_user_id', userData.user.id)
          .eq('active', true)
          .single();

        if (adminUser) {
          // User is an admin
          user = {
            id: userData.user.id,
            email: userData.user.email!,
            role: adminUser.role || 'admin',
            user_id: userData.user.id
          };

          // Create user-scoped Supabase client
          userSupabase = createUserSupabaseClient(token);
          
          logger.info(`Admin user authenticated: ${user.email} (role: ${user.role})`);
        } else {
          // Check if user is a regular user
          const { data: regularUser, error: userError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', userData.user.email!)
            .eq('active', true)
            .single();

          if (regularUser) {
            // User is a regular user  
            user = {
              id: userData.user.id,
              email: userData.user.email!,
              role: regularUser.user_type || 'user',
              user_id: userData.user.id
            };

            // Create user-scoped Supabase client
            userSupabase = createUserSupabaseClient(token);
            
            logger.info(`Regular user authenticated: ${user.email} (type: ${user.role})`);
          } else {
            logger.warn('User not found in admin_users or users table:', userData.user.email, { 
              adminError: adminError?.message,
              userError: userError?.message,
              userEmail: userData.user.email 
            });
          }
        }
      }
    } catch (error) {
      logger.warn('Context creation error:', {
        error: formatErrorMessage(error),
        tokenPresent: !!token,
        tokenLength: token?.length
      });
    }
  }

  return {
    req,
    res,
    user,
    supabase: supabaseAdmin, // Always use service role to bypass RLS
    supabaseAdmin,
    logger
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;