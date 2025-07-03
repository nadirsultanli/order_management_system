import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../backend/src/routes';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_BACKEND_URL || 
           (import.meta.env.PROD ? 'https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1/trpc' : 'http://localhost:3001/api/v1/trpc'),
      headers: async () => {
        try {
          // Get auth token from localStorage with fallback to session storage
          let token = localStorage.getItem('auth_token');
          
          // If auth_token doesn't exist, try to get from Supabase session object
          if (!token) {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
              if (key.includes('auth-token')) {
                const value = localStorage.getItem(key);
                try {
                  const parsed = JSON.parse(value);
                  if (parsed && parsed.access_token) {
                    token = parsed.access_token;
                    break;
                  }
                } catch (e) {
                  // Not JSON, skip
                }
              }
            }
          }
          
          if (token) {
            return {
              Authorization: `Bearer ${token}`,
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