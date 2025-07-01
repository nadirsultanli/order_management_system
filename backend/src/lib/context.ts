import { inferAsyncReturnType } from '@trpc/server';
import { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import jwt from 'jsonwebtoken';
import { createUserSupabaseClient, supabaseAdmin } from './supabase';
import { logger } from './logger';

export interface AuthenticatedUser {
  id: string;
  email: string;
  tenant_id: string;
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
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      // Get user details from Supabase
      const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
      
      if (error || !userData.user) {
        logger.warn('Invalid or expired token provided');
      } else {
        // Extract tenant_id from user metadata or app_metadata
        const tenantId = userData.user.app_metadata?.tenant_id || userData.user.user_metadata?.tenant_id;
        
        if (!tenantId) {
          throw new Error('User does not have a tenant_id assigned');
        }

        user = {
          id: userData.user.id,
          email: userData.user.email!,
          tenant_id: tenantId,
          role: userData.user.app_metadata?.role || 'user'
        };

        // Create user-scoped Supabase client
        userSupabase = createUserSupabaseClient(token);
        
        logger.info(`User authenticated: ${user.email} (tenant: ${user.tenant_id})`);
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