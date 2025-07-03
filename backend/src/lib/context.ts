import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { createUserSupabaseClient, supabaseAdmin } from './supabase';
import { logger } from './logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

export const createContext = async ({ req, res }: CreateExpressContextOptions) => {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  let user: AuthenticatedUser | null = null;
  let userSupabase = null;

  if (token) {
    try {
      // Verify JWT token and extract user information
      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is not configured');
      }
      const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
      
      // Get user details from Supabase
      const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !userData.user) {
        logger.warn('Invalid or expired token provided');
      } else {
        // Check if user is admin
        const { data: adminUser } = await supabaseAdmin
          .from('admin_users')
          .select('*')
          .eq('email', userData.user.email!)
          .eq('active', true)
          .single();

        if (!adminUser) {
          logger.warn('User is not an active admin');
          throw new Error('Access denied: Admin privileges required');
        }

        user = {
          id: userData.user.id,
          email: userData.user.email!,
          role: adminUser.role || 'admin'
        };

        // Create user-scoped Supabase client
        userSupabase = createUserSupabaseClient(token);
        
        logger.info(`User authenticated: ${user.email} (role: ${user.role})`);
      }
    } catch (error) {
      logger.warn('Token verification failed:', error);
    }
  }

  return {
    req,
    res,
    user,
    supabase: userSupabase || supabaseAdmin,
    supabaseAdmin,
    logger
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;