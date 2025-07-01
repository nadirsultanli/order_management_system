/**
 * This file contains example code for setting up the tRPC client in your React frontend.
 * Copy this code to your frontend project and adjust imports as needed.
 */

// Frontend setup example (copy to your React project):

/*
// 1. Install dependencies in your frontend:
// npm install @trpc/client @trpc/react-query

// 2. Create src/lib/trpc-client.ts:

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../backend/src/routes';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: 'http://localhost:3001/api/v1/trpc',
      headers: () => {
        // Get auth token from your auth context/storage
        const token = localStorage.getItem('auth_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

// 3. Wrap your App with tRPC provider in src/main.tsx:

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, trpcClient } from './lib/trpc-client';

const queryClient = new QueryClient();

function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <YourAppComponents />
      </QueryClientProvider>
    </trpc.Provider>
  );
}

// 4. Use in your components:

import { trpc } from '../lib/trpc-client';

function OrdersList() {
  const { data, isLoading } = trpc.orders.list.useQuery({
    page: 1,
    limit: 20
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      // Invalidate orders list to refetch
      trpc.useContext().orders.list.invalidate();
    }
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {data?.orders.map(order => (
        <div key={order.id}>{order.customer.name}</div>
      ))}
    </div>
  );
}

// 5. Replace your existing useOrders hook with tRPC calls:

// OLD (remove this):
// const { data: orders } = useOrders(filters);

// NEW:
// const { data: orders } = trpc.orders.list.useQuery(filters);

*/

export const TRPC_CLIENT_SETUP_GUIDE = `
To integrate the new backend with your React frontend:

1. Install tRPC client dependencies:
   npm install @trpc/client @trpc/react-query

2. Create tRPC client configuration
3. Replace direct Supabase calls with tRPC calls
4. Update your useOrders hook to use the backend API
5. Test the integration

The backend is now ready to receive requests and handle all order business logic!
`;