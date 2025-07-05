import { Handler } from '@netlify/functions';
import { createNetlifyHandler } from '../../backend/src/lib/netlify-adapter';

// Validate required environment variables
if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
}
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY environment variable is required');
}
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Set production environment
process.env.NODE_ENV = 'production';

// Export the Netlify handler
export const handler: Handler = createNetlifyHandler();