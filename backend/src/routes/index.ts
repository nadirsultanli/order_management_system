import { router } from '../lib/trpc';
import { ordersRouter } from './orders';
import { inventoryRouter } from './inventory';
import { transfersRouter } from './transfers';
import { pricingRouter } from './pricing';
import { customersRouter } from './customers';
import { analyticsRouter } from './analytics';
import { adminRouter } from './admin';
import { trucksRouter } from './trucks';
import { warehousesRouter } from './warehouses';
import { productsRouter } from './products';

export const appRouter = router({
  orders: ordersRouter,
  inventory: inventoryRouter,
  transfers: transfersRouter,
  pricing: pricingRouter,
  customers: customersRouter,
  analytics: analyticsRouter,
  admin: adminRouter,
  trucks: trucksRouter,
  warehouses: warehousesRouter,
  products: productsRouter,
});

export type AppRouter = typeof appRouter;