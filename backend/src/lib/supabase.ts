import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

// Service role client for backend operations with full access
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Create user-scoped client with RLS enabled
export const createUserSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

// Test connection on startup
supabaseAdmin
  .from('customers')
  .select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      logger.error('❌ Supabase connection test failed:', error);
      process.exit(1);
    } else {
      logger.info(`✅ Supabase connected successfully. Customer count: ${count}`);
    }
  })
  .catch((error) => {
    logger.error('❌ Supabase connection test error:', error);
    process.exit(1);
  });