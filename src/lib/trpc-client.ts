import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../backend/src/routes';
import { supabase } from './supabase';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001/api/v1/trpc',
      headers: async () => {
        try {
          // Get the current session from Supabase
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session?.access_token) {
            return {
              Authorization: `Bearer ${session.access_token}`,
            };
          }
          
          return {};
        } catch (error) {
          console.warn('Failed to get auth token for tRPC:', error);
          return {};
        }
      },
    }),
  ],
});