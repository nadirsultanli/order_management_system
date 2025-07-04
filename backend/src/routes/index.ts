import { router } from '../lib/trpc';
import { authRouter } from './auth';
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
import { stockMovementsRouter } from './stock-movements';
// import { driverRouter } from './driver'; // Temporarily disabled
import { paymentsRouter } from './payments';

export const appRouter = router({
  auth: authRouter as any,
  orders: ordersRouter as any,
  inventory: inventoryRouter as any,
  transfers: transfersRouter as any,
  pricing: pricingRouter as any,
  customers: customersRouter as any,
  analytics: analyticsRouter as any,
  admin: adminRouter as any,
  trucks: trucksRouter as any,
  warehouses: warehousesRouter as any,
  products: productsRouter as any,
  stockMovements: stockMovementsRouter as any,
  // driver: driverRouter as any, // Temporarily disabled
  payments: paymentsRouter as any,
});

export type AppRouter = typeof appRouter;