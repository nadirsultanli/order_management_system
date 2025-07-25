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
import { tripsRouter } from './trips';
import { emptyReturnsRouter } from './emptyReturns';
import { complianceRouter } from './compliance';
import { warehousesRouter } from './warehouses';
import { productsRouter } from './products';
import { accessoriesRouter } from './accessories';
// import { stockMovementsRouter } from './stock-movements';
import { deliveriesRouter } from './deliveries';
import { depositsRouter } from './deposits';
import { usersRouter } from './users';
// import { driverRouter } from './driver'; // Temporarily disabled
import { paymentsRouter } from './payments';
import { reportsRouter } from './reports';

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
  trips: tripsRouter as any,
  emptyReturns: emptyReturnsRouter as any,
  compliance: complianceRouter as any,
  warehouses: warehousesRouter as any,
  products: productsRouter as any,
  accessories: accessoriesRouter as any,
  // stockMovements: stockMovementsRouter as any,
  deliveries: deliveriesRouter as any,
  deposits: depositsRouter as any,
  users: usersRouter as any,
  // driver: driverRouter as any, // Temporarily disabled
  payments: paymentsRouter as any,
  reports: reportsRouter as any,
});

export type AppRouter = typeof appRouter;