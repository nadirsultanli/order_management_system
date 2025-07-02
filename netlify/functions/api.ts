import { Handler } from '@netlify/functions';
import { createNetlifyHandler } from '../../backend/src/lib/netlify-adapter';

// Set environment variables for Netlify Functions
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://trcrjinrdjgizqhjdgvc.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTA0MTY1MCwiZXhwIjoyMDY0NjE3NjUwfQ.3yf8UQGvmSl-EiYAdaKfZ8_HC-p5rgQMHseuvhGH59M';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY3JqaW5yZGpnaXpxaGpkZ3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNDE2NTAsImV4cCI6MjA2NDYxNzY1MH0.2-y5r5UzIfcGoHc6BPkRy5rnxWxl4SJwxUehPWBxAao';
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// Export the Netlify handler
export const handler: Handler = createNetlifyHandler();