# Frontend Migration Guide

This guide explains how to migrate your React components from direct Supabase calls to the new backend APIs using tRPC.

## Overview

We've separated the business logic from your React frontend into a dedicated backend API. This migration involves:

1. **Replacing Supabase hooks** with tRPC hooks
2. **Removing business logic** from components
3. **Using backend APIs** instead of direct database calls

## Migration Steps

### 1. Update Dependencies

The following packages have been added:
- `@trpc/client` - tRPC client for API calls
- `@trpc/react-query` - React Query integration for tRPC

### 2. tRPC Setup

The tRPC client is configured in `src/lib/trpc-client.ts` and automatically:
- Gets authentication tokens from Supabase
- Connects to the backend API at `http://localhost:3001`
- Provides type-safe API calls

### 3. Replace Hooks

#### Before (Direct Supabase):
```typescript
import { useOrders } from '../hooks/useOrders';

function OrdersList() {
  const { data: orders, isLoading } = useOrders({ status: 'confirmed' });
  // ...
}
```

#### After (Backend API):
```typescript
import { useOrdersNew } from '../hooks/useOrdersNew';

function OrdersList() {
  const { data: orders, isLoading } = useOrdersNew({ status: 'confirmed' });
  // ...
}
```

### 4. Hook Mapping

| Old Hook | New Hook | Description |
|----------|----------|-------------|
| `useOrders` | `useOrdersNew` | List orders with filtering |
| `useOrder` | `useOrderNew` | Get single order details |
| `useCreateOrder` | `useCreateOrderNew` | Create new orders |
| `useChangeOrderStatus` | `useUpdateOrderStatusNew` | Update order status |
| `useInventory` | `useInventoryNew` | List inventory items |
| `useCustomers` | `useCustomersNew` | List customers |
| `usePricing` | `usePriceListsNew` | List price lists |

### 5. Component Migration Examples

#### Example 1: Orders List Component

**Before:**
```typescript
// OLD: Direct Supabase with business logic mixed in
import { useOrders } from '../hooks/useOrders';

function OrdersPage() {
  const [filters, setFilters] = useState({
    status: 'confirmed',
    page: 1,
    limit: 50
  });
  
  const { data, isLoading, error } = useOrders(filters);
  
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Complex business logic was here
    const { data: order } = await supabase
      .from('orders')
      .select('order_lines(product_id, quantity)')
      .eq('id', orderId)
      .single();
    
    // Inventory reservation logic
    if (newStatus === 'confirmed') {
      for (const line of order.order_lines) {
        await supabase.rpc('reserve_stock', {
          p_product_id: line.product_id,
          p_quantity: line.quantity,
        });
      }
    }
    
    // Update status
    await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
  };
  
  return (
    <div>
      {data?.orders.map(order => (
        <OrderCard 
          key={order.id} 
          order={order}
          onStatusChange={handleStatusChange}
        />
      ))}
    </div>
  );
}
```

**After:**
```typescript
// NEW: Clean component with backend API calls
import { useOrdersNew, useUpdateOrderStatusNew } from '../hooks/useOrdersNew';

function OrdersPage() {
  const [filters, setFilters] = useState({
    status: 'confirmed',
    page: 1,
    limit: 50
  });
  
  const { data, isLoading, error } = useOrdersNew(filters);
  const updateStatusMutation = useUpdateOrderStatusNew();
  
  const handleStatusChange = (orderId: string, newStatus: string) => {
    // Simple API call - all business logic handled by backend
    updateStatusMutation.mutate({
      order_id: orderId,
      new_status: newStatus
    });
  };
  
  return (
    <div>
      {data?.orders.map(order => (
        <OrderCard 
          key={order.id} 
          order={order}
          onStatusChange={handleStatusChange}
          isUpdating={updateStatusMutation.isLoading}
        />
      ))}
    </div>
  );
}
```

#### Example 2: Order Creation

**Before:**
```typescript
// OLD: Complex order creation with manual calculations
const createOrder = async (orderData) => {
  // Create order
  const { data: order } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
    
  // Create order lines
  const orderLines = items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    unit_price: item.unit_price || 0,
    subtotal: (item.unit_price || 0) * item.quantity,
  }));
  
  await supabase
    .from('order_lines')
    .insert(orderLines);
    
  // Calculate totals manually
  const subtotal = orderLines.reduce((sum, line) => sum + line.subtotal, 0);
  const taxAmount = subtotal * 0.1;
  const total = subtotal + taxAmount;
  
  // Update order total
  await supabase
    .from('orders')
    .update({ 
      total_amount: total,
      tax_amount: taxAmount 
    })
    .eq('id', order.id);
};
```

**After:**
```typescript
// NEW: Simple API call with automatic calculations
const createOrderMutation = useCreateOrderNew();

const createOrder = (orderData) => {
  createOrderMutation.mutate({
    customer_id: orderData.customer_id,
    delivery_address_id: orderData.delivery_address_id,
    order_lines: orderData.items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price
    }))
    // Backend automatically calculates totals, handles validations
  });
};
```

### 6. Error Handling

**Before:**
```typescript
const { data, error } = await supabase.from('orders').select('*');
if (error) {
  console.error('Supabase error:', error);
  toast.error('Failed to load orders');
}
```

**After:**
```typescript
// Error handling is built into the new hooks
const { data, isLoading, error } = useOrdersNew();
// Errors automatically show toast notifications
// No manual error handling needed
```

### 7. Loading States

**Before:**
```typescript
const [loading, setLoading] = useState(false);

const handleAction = async () => {
  setLoading(true);
  try {
    // ... manual operations
  } finally {
    setLoading(false);
  }
};
```

**After:**
```typescript
const mutation = useUpdateOrderStatusNew();

const handleAction = () => {
  mutation.mutate({ /* data */ });
};

// Loading state available as mutation.isLoading
```

### 8. Data Invalidation

**Before:**
```typescript
// Manual cache invalidation
queryClient.invalidateQueries(['orders']);
queryClient.invalidateQueries(['order', orderId]);
```

**After:**
```typescript
// Automatic invalidation built into mutations
const updateMutation = useUpdateOrderStatusNew();
// Automatically invalidates related queries on success
```

## Migration Checklist

### Phase 1: Setup ✅
- [x] Add tRPC dependencies to package.json
- [x] Create tRPC client configuration
- [x] Add tRPC provider to App
- [x] Create new hooks for all business areas

### Phase 2: Component Migration (Your Task)
- [ ] Update OrdersPage to use `useOrdersNew`
- [ ] Update OrderDetailPage to use `useOrderNew`
- [ ] Update CreateOrderPage to use `useCreateOrderNew`
- [ ] Update InventoryPage to use `useInventoryNew`
- [ ] Update CustomersPage to use `useCustomersNew`
- [ ] Update PricingPage to use `usePriceListsNew`

### Phase 3: Cleanup
- [ ] Remove old hooks (`useOrders.ts`, `useInventory.ts`, etc.)
- [ ] Remove direct Supabase imports from components
- [ ] Remove business logic utility functions
- [ ] Update type imports to use backend types

## Testing Migration

1. **Start the backend server:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Update environment variables:**
   ```env
   VITE_BACKEND_URL=http://localhost:3001/api/v1/trpc
   ```

3. **Test API connectivity:**
   ```typescript
   // In browser console
   const healthCheck = await trpc.admin.healthCheck.query();
   console.log('Backend health:', healthCheck);
   ```

## Benefits After Migration

✅ **Cleaner Components**: No business logic mixed with UI code
✅ **Type Safety**: Full TypeScript support across frontend and backend  
✅ **Better Error Handling**: Consistent error handling and user feedback
✅ **Automatic Loading States**: Built-in loading indicators
✅ **Optimistic Updates**: Automatic cache invalidation
✅ **Multi-tenant Security**: Automatic tenant isolation
✅ **Voice Agent Ready**: APIs ready for LLM integration

## Troubleshooting

### Common Issues

1. **Backend not running**: Ensure backend server is started on port 3001
2. **Authentication errors**: Check Supabase session is valid
3. **CORS issues**: Backend is configured for localhost:5173
4. **Type errors**: Ensure backend types are properly imported

### Debug Steps

```typescript
// Check tRPC connection
console.log('tRPC client:', trpcClient);

// Check authentication
const session = await supabase.auth.getSession();
console.log('Auth session:', session);

// Test backend health
const health = await trpc.admin.healthCheck.query();
console.log('Backend health:', health);
```

## Next Steps

1. **Start with one component** (e.g., OrdersPage)
2. **Test thoroughly** before moving to next component
3. **Keep old hooks** until migration is complete
4. **Use migration hooks** (`useOrdersMigration`) for gradual transition

The migration is designed to be **incremental** - you can migrate one component at a time while keeping the rest of your app working.