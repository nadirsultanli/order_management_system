import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../backend/src/routes';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: import.meta.env.VITE_BACKEND_URL || 
           (import.meta.env.PROD ? 'https://your-railway-backend.railway.app/api/v1/trpc' : 'http://localhost:3001/api/v1/trpc'),
      headers: async () => {
        try {
          // Get auth token from localStorage (we'll implement proper auth later)
          const token = localStorage.getItem('auth_token');
          
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