import { generateOpenApiDocument } from 'trpc-openapi';
import { appRouter } from './routes';

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'Order Management System API',
  description: 'API for managing orders, customers, products, inventory, and deliveries',
  version: '1.0.0',
  baseUrl: process.env.API_URL || 'http://localhost:3000',
  docsUrl: 'https://github.com/your-repo/api-docs',
  tags: [
    { name: 'auth', description: 'Authentication endpoints' },
    { name: 'orders', description: 'Order management' },
    { name: 'customers', description: 'Customer management' },
    { name: 'products', description: 'Product catalog' },
    { name: 'inventory', description: 'Inventory management' },
    { name: 'warehouses', description: 'Warehouse operations' },
    { name: 'deliveries', description: 'Delivery and pickup processing' },
    { name: 'transfers', description: 'Transfer management' },
    { name: 'trucks', description: 'Fleet management' },
    { name: 'payments', description: 'Payment processing' },
    { name: 'pricing', description: 'Pricing management' },
    { name: 'analytics', description: 'Analytics and reporting' },
    { name: 'admin', description: 'Admin operations' },
    { name: 'stock-movements', description: 'Stock movement tracking' },
  ],
});