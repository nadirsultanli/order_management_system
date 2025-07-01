import { router } from '../lib/trpc';
import { ordersRouter } from './orders';
import { inventoryRouter } from './inventory';
import { transfersRouter } from './transfers';
import { pricingRouter } from './pricing';
import { customersRouter } from './customers';
import { analyticsRouter } from './analytics';
import { adminRouter } from './admin';

export const appRouter = router({
  orders: ordersRouter,
  inventory: inventoryRouter,
  transfers: transfersRouter,
  pricing: pricingRouter,
  customers: customersRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;