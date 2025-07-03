import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { renderTrpcPanel } from 'trpc-panel';
import { appRouter } from './routes';
import { createContext } from './lib/context';
import { logger } from './lib/logger';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// Security middleware - strict CSP for most endpoints
app.use((req, res, next) => {
  // Relax CSP only for documentation endpoints
  if (req.path === '/api/docs' || req.path === '/docs' || req.path === '/scalar') {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https:", "wss:", "https://cdn.jsdelivr.net"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    })(req, res, next);
  } else {
    // Strict CSP for other endpoints
    helmet()(req, res, next);
  }
});
// Bulletproof CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'https://omsmvpapp.netlify.app',
    process.env.LOCAL_FRONTEND_URL || 'http://localhost:5173',
    process.env.LOCAL_FRONTEND_ALT_URL || 'http://localhost:3000'
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

logger.info('CORS configured for:', [process.env.FRONTEND_URL || 'https://omsmvpapp.netlify.app']);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Favicon endpoint to prevent 404 errors
app.get('/favicon.ico', (req, res) => {
  res.status(204).send(); // No content response
});

// Root endpoint - API status
app.get('/', (req, res) => {
  res.json({
    message: 'Order Management System API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/v1/trpc',
      scalar: '/scalar'
    },
    documentation: {
      scalar: `${req.protocol}://${req.get('host')}/scalar`,
      openapi: `${req.protocol}://${req.get('host')}/openapi.json`,
      readme: 'See README.md in project root for complete documentation'
    },
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint with database connectivity test
app.get('/health', async (req, res) => {
  try {
    const { supabaseAdmin } = await import('./lib/supabase');
    
    // Test database connection
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('count')
      .limit(1);
    
    const dbStatus = error ? 'disconnected' : 'connected';
    
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// Scalar API Documentation - Modern & Beautiful
app.get('/scalar', (req, res) => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Order Management System API</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </head>
    <body>
      <script
        id="api-reference"
        data-url="${baseUrl}/openapi.json"
        data-configuration='{
          "theme": "purple",
          "layout": "modern",
          "defaultHttpClient": {
            "targetKey": "javascript",
            "clientKey": "fetch"
          },
          "spec": {
            "url": "${baseUrl}/openapi.json"
          }
        }'></script>
      <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    </body>
  </html>
  `;

  res.type('html').send(html);
});

// OpenAPI JSON endpoint for Scalar
app.get('/openapi.json', (req, res) => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;

  const openApiSpec = {
    openapi: '3.0.0',
    info: {
      title: 'Order Management System API',
      version: '1.0.0',
      description: 'LPG Order Management System with multi-tenant support',
      contact: {
        name: 'API Support',
        url: `${baseUrl}/docs`
      }
    },
    servers: [
      {
        url: `${baseUrl}/api/v1/trpc`,
        description: 'Production API'
      }
    ],
    paths: {
      // Authentication Module (5 endpoints)
      '/auth.login': {
        post: {
          summary: 'User Authentication',
          description: 'Login with email and password to get JWT token',
          tags: ['🔑 Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'admin@example.com' },
                    password: { type: 'string', example: 'your-password' }
                  },
                  required: ['email', 'password']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Login successful with JWT tokens',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      result: {
                        type: 'object',
                        properties: {
                          data: {
                            type: 'object',
                            properties: {
                              user: { type: 'object' },
                              session: {
                                type: 'object',
                                properties: {
                                  access_token: { type: 'string' },
                                  refresh_token: { type: 'string' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/auth.register': {
        post: {
          summary: 'Register Admin User',
          description: 'Register new admin user account',
          tags: ['🔑 Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' }
                  },
                  required: ['email', 'password', 'name']
                }
              }
            }
          }
        }
      },
      '/auth.me': {
        get: {
          summary: 'Get Current User',
          description: 'Get current authenticated user session info',
          tags: ['🔑 Authentication'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/auth.refresh': {
        post: {
          summary: 'Refresh Token',
          description: 'Refresh authentication token',
          tags: ['🔑 Authentication'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/auth.logout': {
        post: {
          summary: 'User Logout',
          description: 'Logout current user and invalidate session',
          tags: ['🔑 Authentication'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Customer Management Module (18 endpoints)
      '/customers.list': {
        get: {
          summary: 'List Customers',
          description: 'Get paginated list of customers with advanced filtering',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'input',
              in: 'query',
              schema: {
                type: 'object',
                properties: {
                  page: { type: 'integer', minimum: 1, default: 1 },
                  limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
                  search: { type: 'string', description: 'Search by name, email, or phone' },
                  status: { type: 'string', enum: ['active', 'inactive'] }
                }
              }
            }
          ]
        }
      },
      '/customers.getById': {
        get: {
          summary: 'Get Customer Details',
          description: 'Get single customer with full details and addresses',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.create': {
        post: {
          summary: 'Create Customer',
          description: 'Create new customer with address information',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    email: { type: 'string', format: 'email' },
                    phone: { type: 'string' },
                    company: { type: 'string' },
                    address: { type: 'object' }
                  },
                  required: ['name', 'email']
                }
              }
            }
          }
        }
      },
      '/customers.update': {
        put: {
          summary: 'Update Customer',
          description: 'Update customer details',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.delete': {
        delete: {
          summary: 'Delete Customer',
          description: 'Remove customer from system',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.getOrderHistory': {
        get: {
          summary: 'Customer Order History',
          description: 'Get complete order history for customer',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.getAnalytics': {
        get: {
          summary: 'Customer Analytics',
          description: 'Get customer analytics and insights',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.getAddresses': {
        get: {
          summary: 'Customer Addresses',
          description: 'Get all addresses for a customer',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.createAddress': {
        post: {
          summary: 'Create Address',
          description: 'Add new address for customer',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.updateAddress': {
        put: {
          summary: 'Update Address',
          description: 'Modify existing customer address',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.deleteAddress': {
        delete: {
          summary: 'Delete Address',
          description: 'Remove customer address',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.setPrimaryAddress': {
        put: {
          summary: 'Set Primary Address',
          description: 'Set address as primary for customer',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.geocodeAddress': {
        post: {
          summary: 'Geocode Address',
          description: 'Get coordinates for address',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.validateAddress': {
        post: {
          summary: 'Validate Address',
          description: 'Validate address format and completeness',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.validateDeliveryWindow': {
        post: {
          summary: 'Validate Delivery Window',
          description: 'Validate delivery window business rules',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.validate': {
        post: {
          summary: 'Validate Customer Data',
          description: 'Validate customer information and business rules',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/customers.validateCreditTerms': {
        post: {
          summary: 'Validate Credit Terms',
          description: 'Validate customer credit terms and limits',
          tags: ['👥 Customer Management'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Order Management Module (19 endpoints)
      '/orders.list': {
        get: {
          summary: 'List Orders',
          description: 'Get orders with advanced filtering and pagination',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.getById': {
        get: {
          summary: 'Get Order Details',
          description: 'Get single order with complete details and line items',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.create': {
        post: {
          summary: 'Create Order',
          description: 'Create new order with line items',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    customer_id: { type: 'string', format: 'uuid' },
                    order_lines: { type: 'array' },
                    delivery_date: { type: 'string', format: 'date' },
                    notes: { type: 'string' }
                  },
                  required: ['customer_id', 'order_lines']
                }
              }
            }
          }
        }
      },
      '/orders.calculateTotals': {
        post: {
          summary: 'Calculate Order Totals',
          description: '💡 Real-time order total calculation (moved from frontend for clean architecture)',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    lines: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          quantity: { type: 'number' },
                          unit_price: { type: 'number' },
                          subtotal: { type: 'number' }
                        }
                      }
                    },
                    tax_percent: { type: 'number', default: 0 }
                  },
                  required: ['lines']
                }
              }
            }
          }
        }
      },
      '/orders.updateStatus': {
        put: {
          summary: 'Update Order Status',
          description: 'Update order status with inventory management',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.updateTax': {
        put: {
          summary: 'Update Order Tax',
          description: 'Update order tax and recalculate totals',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.getOverdue': {
        get: {
          summary: 'Get Overdue Orders',
          description: 'Get orders that are overdue with business logic',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.getDeliveryCalendar': {
        get: {
          summary: 'Delivery Calendar',
          description: 'Get orders by delivery date with route optimization',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.getWorkflow': {
        get: {
          summary: 'Order Workflow',
          description: 'Get order workflow steps and transitions',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.validateTransition': {
        post: {
          summary: 'Validate Status Transition',
          description: 'Validate order status change business rules',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.validateForConfirmation': {
        post: {
          summary: 'Validate Order for Confirmation',
          description: 'Validate order can be confirmed with business rules',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.validateForScheduling': {
        post: {
          summary: 'Validate Order for Scheduling',
          description: 'Validate order can be scheduled for delivery',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.validateDeliveryWindow': {
        post: {
          summary: 'Validate Delivery Window',
          description: 'Validate delivery window business constraints',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.getWorkflowInfo': {
        get: {
          summary: 'Get Workflow Information',
          description: 'Get order workflow state and available actions',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.formatOrderId': {
        post: {
          summary: 'Format Order ID',
          description: '💡 Format order ID consistently (moved from frontend)',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.formatCurrency': {
        post: {
          summary: 'Format Currency',
          description: '💡 Format currency values for orders (moved from frontend)',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/orders.formatDate': {
        post: {
          summary: 'Format Date',
          description: '💡 Format dates consistently (moved from frontend)',
          tags: ['📦 Order Management'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Product Catalog Module (25 endpoints)
      '/products.list': {
        get: {
          summary: 'List Products',
          description: 'Get product catalog with advanced filtering and search',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getById': {
        get: {
          summary: 'Get Product Details',
          description: 'Get single product with variants and specifications',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.create': {
        post: {
          summary: 'Create Product',
          description: 'Create new product in catalog',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.update': {
        put: {
          summary: 'Update Product',
          description: 'Update product details and specifications',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.delete': {
        delete: {
          summary: 'Delete Product',
          description: 'Soft delete product from catalog',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getVariants': {
        get: {
          summary: 'Product Variants',
          description: 'Get all variants for a product',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.createVariant': {
        post: {
          summary: 'Create Product Variant',
          description: 'Create new product variant (e.g., different cylinder sizes)',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getStats': {
        get: {
          summary: 'Product Statistics',
          description: 'Get product performance statistics and metrics',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getOptions': {
        get: {
          summary: 'Product Dropdown Options',
          description: 'Get formatted product options for dropdowns and forms',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.bulkUpdateStatus': {
        put: {
          summary: 'Bulk Update Product Status',
          description: 'Update status for multiple products in batch',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.reactivate': {
        put: {
          summary: 'Reactivate Product',
          description: 'Reactivate obsolete or discontinued products',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.validate': {
        post: {
          summary: 'Validate Product Data',
          description: 'Validate product information and business rules',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.validateSku': {
        post: {
          summary: 'Validate Product SKU',
          description: 'Validate SKU uniqueness and format',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.validateWeight': {
        post: {
          summary: 'Validate Product Weight',
          description: 'Validate weight constraints and specifications',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.validateStatusChange': {
        post: {
          summary: 'Validate Status Change',
          description: 'Validate product status transition rules',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getAvailabilityMatrix': {
        get: {
          summary: 'Product Availability Matrix',
          description: 'Get cross-warehouse product availability',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.calculateInventoryMovements': {
        post: {
          summary: 'Calculate Inventory Movements',
          description: 'Calculate inventory movements for order fulfillment',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.validateOrderType': {
        post: {
          summary: 'Validate Order Type',
          description: 'Validate order type business rules (delivery, refill, exchange)',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.calculateExchangeQuantity': {
        post: {
          summary: 'Calculate Exchange Quantity',
          description: '💡 Calculate cylinder exchange quantities (moved from frontend)',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.shouldRequirePickup': {
        post: {
          summary: 'Check Pickup Requirement',
          description: 'Determine if order requires empty cylinder pickup',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.getStandardCylinderVariants': {
        get: {
          summary: 'Standard Cylinder Variants',
          description: 'Get standard LPG cylinder variants (5kg, 15kg, 45kg, 90kg)',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.generateVariantSku': {
        post: {
          summary: 'Generate Variant SKU',
          description: 'Generate unique SKU for product variants',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/products.createVariantData': {
        post: {
          summary: 'Create Variant Data',
          description: 'Create standardized variant data structure',
          tags: ['🏭 Product Catalog'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Fleet Management Module (21 endpoints)
      '/trucks.list': {
        get: {
          summary: 'List Trucks',
          description: 'Get fleet listing with capacity and status filters',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.get': {
        get: {
          summary: 'Get Truck Details',
          description: 'Get truck details with current inventory and capacity',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.create': {
        post: {
          summary: 'Create Truck',
          description: 'Add new truck to fleet',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.calculateCapacity': {
        post: {
          summary: 'Calculate Truck Capacity',
          description: '💡 Real-time truck capacity utilization and optimization (moved from frontend)',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    truck_id: { type: 'string', format: 'uuid' },
                    date: { type: 'string', format: 'date' }
                  },
                  required: ['truck_id', 'date']
                }
              }
            }
          }
        }
      },
      '/trucks.calculateOrderWeight': {
        post: {
          summary: 'Calculate Order Weight',
          description: '💡 Calculate order weight for truck capacity planning (moved from frontend)',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.findBestAllocation': {
        post: {
          summary: 'Find Best Truck Allocation',
          description: 'AI-powered optimal truck assignment for orders',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.optimizeAllocations': {
        post: {
          summary: 'Optimize Fleet Allocations',
          description: 'Fleet-wide optimization for maximum efficiency',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.generateSchedule': {
        get: {
          summary: 'Generate Daily Schedule',
          description: 'Generate optimized daily delivery schedules',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.getAllocations': {
        get: {
          summary: 'Truck Allocations',
          description: 'Get truck allocations by date and truck',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.update': {
        put: {
          summary: 'Update Truck',
          description: 'Update truck details and specifications',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.delete': {
        delete: {
          summary: 'Delete Truck',
          description: 'Remove truck from fleet',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.allocateOrder': {
        post: {
          summary: 'Allocate Order to Truck',
          description: 'Assign specific order to truck for delivery',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.updateAllocation': {
        put: {
          summary: 'Update Truck Allocation',
          description: 'Modify existing truck allocation',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.getRoutes': {
        get: {
          summary: 'Truck Routes',
          description: 'Get optimized truck routes and schedules',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.createRoute': {
        post: {
          summary: 'Create Route',
          description: 'Create new delivery route for truck',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.updateRoute': {
        put: {
          summary: 'Update Route',
          description: 'Modify existing truck route',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.getMaintenance': {
        get: {
          summary: 'Maintenance Records',
          description: 'Get truck maintenance history and schedules',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.scheduleMaintenance': {
        post: {
          summary: 'Schedule Maintenance',
          description: 'Schedule maintenance for truck',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.updateMaintenance': {
        put: {
          summary: 'Update Maintenance',
          description: 'Update maintenance record status',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/trucks.validateAllocation': {
        post: {
          summary: 'Validate Truck Allocation',
          description: 'Validate truck assignment business rules',
          tags: ['🚛 Fleet Management'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Inventory Transfers Module (16 endpoints)
      '/transfers.list': {
        get: {
          summary: 'List Transfers',
          description: 'Get inventory transfers with filtering and status tracking',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.getById': {
        get: {
          summary: 'Get Transfer Details',
          description: 'Get single transfer with complete item details',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.create': {
        post: {
          summary: 'Create Transfer',
          description: 'Create new inter-warehouse inventory transfer',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.validateMultiSkuTransfer': {
        post: {
          summary: 'Validate Multi-SKU Transfer',
          description: 'Validate complex multi-product transfers with business rules',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.calculateTransferDetails': {
        post: {
          summary: 'Calculate Transfer Details',
          description: '💡 Calculate transfer costs, weights, and logistics (moved from frontend)',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.updateStatus': {
        put: {
          summary: 'Update Transfer Status',
          description: 'Update transfer status with business logic validation',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.validate': {
        post: {
          summary: 'Validate Transfer',
          description: 'Validate transfer business rules and constraints',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.getWarehouseStock': {
        get: {
          summary: 'Warehouse Stock for Transfer',
          description: 'Get available stock for transfer planning',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.getCostAnalysis': {
        get: {
          summary: 'Transfer Cost Analysis',
          description: 'Get detailed cost analysis for transfers',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.searchProducts': {
        get: {
          summary: 'Search Products for Transfer',
          description: 'Search available products for transfer',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.validateTransferCapacity': {
        post: {
          summary: 'Validate Transfer Capacity',
          description: 'Validate warehouse capacity constraints',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.validateInventoryAvailability': {
        post: {
          summary: 'Validate Inventory Availability',
          description: 'Validate inventory availability for transfer',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.checkTransferConflicts': {
        post: {
          summary: 'Check Transfer Conflicts',
          description: 'Check for conflicting transfers and reservations',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.estimateTransferDuration': {
        post: {
          summary: 'Estimate Transfer Duration',
          description: 'Estimate completion time based on distance and complexity',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/transfers.formatValidationErrors': {
        post: {
          summary: 'Format Validation Errors',
          description: '💡 Format transfer validation errors (moved from frontend)',
          tags: ['🔄 Inventory Transfers'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Dynamic Pricing Module (28 endpoints)
      '/pricing.list': {
        get: {
          summary: 'List Price Lists',
          description: 'Get all price lists with filtering and date ranges',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.calculateFinalPrice': {
        post: {
          summary: 'Calculate Final Price',
          description: '💡 Real-time price calculation with surcharges (moved from frontend)',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    unitPrice: { type: 'number' },
                    surchargePercent: { type: 'number' }
                  },
                  required: ['unitPrice']
                }
              }
            }
          }
        }
      },
      '/pricing.getProductPrice': {
        get: {
          summary: 'Get Product Price',
          description: 'Get current price for product with customer-specific discounts',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.calculateOrderTotals': {
        post: {
          summary: 'Calculate Order Totals',
          description: 'Calculate complete order totals with pricing rules',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getActivePriceLists': {
        get: {
          summary: 'Active Price Lists',
          description: 'Get currently active price lists for pricing',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.bulkUpdatePrices': {
        put: {
          summary: 'Bulk Update Prices',
          description: 'Update multiple prices in batch operations',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getById': {
        get: {
          summary: 'Get Price List Details',
          description: 'Get single price list with all items and metadata',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.create': {
        post: {
          summary: 'Create Price List',
          description: 'Create new price list with products',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.update': {
        put: {
          summary: 'Update Price List',
          description: 'Update price list details and settings',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.delete': {
        delete: {
          summary: 'Delete Price List',
          description: 'Remove price list from system',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.setDefault': {
        put: {
          summary: 'Set Default Price List',
          description: 'Set price list as default for system',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getItems': {
        get: {
          summary: 'Price List Items',
          description: 'Get all items in a price list',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.createItem': {
        post: {
          summary: 'Create Price Item',
          description: 'Add new item to price list',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.updateItem': {
        put: {
          summary: 'Update Price Item',
          description: 'Update price item details',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.deleteItem': {
        delete: {
          summary: 'Delete Price Item',
          description: 'Remove item from price list',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.bulkAddProducts': {
        post: {
          summary: 'Bulk Add Products',
          description: 'Add multiple products to price list',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getStats': {
        get: {
          summary: 'Pricing Statistics',
          description: 'Get price list statistics and analytics',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.calculate': {
        post: {
          summary: 'Calculate Dynamic Price',
          description: 'Calculate price using dynamic pricing rules',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.validatePriceList': {
        post: {
          summary: 'Validate Price List',
          description: 'Validate price list data and business rules',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getPriceListStatus': {
        get: {
          summary: 'Get Price List Status',
          description: '💡 Calculate price list status (moved from frontend)',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.validateDateRange': {
        post: {
          summary: 'Validate Date Range',
          description: 'Validate price list date constraints',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.isExpiringSoon': {
        get: {
          summary: 'Check Expiration Status',
          description: '💡 Check if price list expires soon (moved from frontend)',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getProductPrices': {
        get: {
          summary: 'Get Product Prices',
          description: 'Get bulk pricing for multiple products',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.validateProductPricing': {
        post: {
          summary: 'Validate Product Pricing',
          description: 'Validate product pricing constraints',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.formatCurrency': {
        post: {
          summary: 'Format Currency',
          description: '💡 Format currency values consistently (moved from frontend)',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/pricing.getCustomerPricingTiers': {
        get: {
          summary: 'Customer Pricing Tiers',
          description: 'Get customer-specific pricing tiers and discounts',
          tags: ['💰 Dynamic Pricing'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Business Intelligence Module (7 endpoints)
      '/analytics.getDashboardStats': {
        get: {
          summary: 'Dashboard Statistics',
          description: 'Get comprehensive dashboard overview with KPIs',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getRevenueAnalytics': {
        get: {
          summary: 'Revenue Analytics',
          description: 'Get detailed revenue analysis and trends',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getOrderAnalytics': {
        get: {
          summary: 'Order Analytics',
          description: 'Get order patterns, trends, and performance metrics',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getCustomerAnalytics': {
        get: {
          summary: 'Customer Analytics',
          description: 'Get customer behavior and lifetime value analysis',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getInventoryAnalytics': {
        get: {
          summary: 'Inventory Analytics',
          description: 'Get inventory turnover and optimization insights',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getComprehensiveOrderAnalytics': {
        get: {
          summary: 'Comprehensive Order Analytics',
          description: 'Get detailed order analysis with performance metrics',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/analytics.getOrderStats': {
        get: {
          summary: 'Order Statistics',
          description: 'Get statistical overview of order performance',
          tags: ['📊 Business Intelligence'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Warehouse Management Module (9 endpoints)
      '/warehouses.list': {
        get: {
          summary: 'List Warehouses',
          description: 'Get all warehouses with capacity and location info',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.get': {
        get: {
          summary: 'Get Warehouse Details',
          description: 'Get warehouse details with current inventory levels',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.create': {
        post: {
          summary: 'Create Warehouse',
          description: 'Add new warehouse to the system',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.update': {
        put: {
          summary: 'Update Warehouse',
          description: 'Update warehouse details and capacity',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.delete': {
        delete: {
          summary: 'Delete Warehouse',
          description: 'Remove warehouse from system',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.getStats': {
        get: {
          summary: 'Warehouse Statistics',
          description: 'Get warehouse utilization and performance stats',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/warehouses.getOptions': {
        get: {
          summary: 'Warehouse Dropdown Options',
          description: 'Get formatted warehouse options for dropdowns',
          tags: ['🏢 Warehouse Management'],
          security: [{ bearerAuth: [] }]
        }
      },

      // Inventory Management Module (12 endpoints)
      '/inventory.list': {
        get: {
          summary: 'List Inventory',
          description: 'Get inventory with advanced filtering and stock levels',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.getByWarehouse': {
        get: {
          summary: 'Warehouse Inventory',
          description: 'Get all inventory for specific warehouse',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.adjustStock': {
        post: {
          summary: 'Adjust Stock Levels',
          description: 'Adjust inventory levels with audit trail',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.transferStock': {
        post: {
          summary: 'Transfer Stock',
          description: 'Transfer stock between warehouses',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.getLowStock': {
        get: {
          summary: 'Low Stock Alerts',
          description: 'Get items with low stock levels requiring attention',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.getByProduct': {
        get: {
          summary: 'Product Inventory',
          description: 'Get inventory levels for specific product across warehouses',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.getStats': {
        get: {
          summary: 'Inventory Statistics',
          description: 'Get inventory statistics and KPIs',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.create': {
        post: {
          summary: 'Create Inventory Record',
          description: 'Create new inventory balance record',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.reserve': {
        post: {
          summary: 'Reserve Inventory',
          description: 'Reserve inventory for orders',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.getMovements': {
        get: {
          summary: 'Inventory Movements',
          description: 'Get inventory movement history and audit trail',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.validateAdjustment': {
        post: {
          summary: 'Validate Stock Adjustment',
          description: 'Validate stock adjustment business rules',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/inventory.checkAvailability': {
        get: {
          summary: 'Check Product Availability',
          description: 'Check product availability with business rules',
          tags: ['📦 Inventory Management'],
          security: [{ bearerAuth: [] }]
        }
      },

      // System Administration Module (7 endpoints)
      '/admin.healthCheck': {
        get: {
          summary: 'System Health Check',
          description: 'Comprehensive system health and security validation',
          tags: ['⚙️ System Administration'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/admin.getSystemStats': {
        get: {
          summary: 'System Statistics',
          description: 'Get system performance and usage statistics',
          tags: ['⚙️ System Administration'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/admin.testRLSPolicies': {
        get: {
          summary: 'Test Security Policies',
          description: 'Test Row Level Security policies for data isolation',
          tags: ['⚙️ System Administration'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/admin.validateRLSStatus': {
        get: {
          summary: 'Validate Security Status',
          description: 'Validate security status across all database tables',
          tags: ['⚙️ System Administration'],
          security: [{ bearerAuth: [] }]
        }
      },
      '/admin.getRLSViolations': {
        get: {
          summary: 'Get Security Violations',
          description: 'Get Row Level Security policy violations',
          tags: ['⚙️ System Administration'],
          security: [{ bearerAuth: [] }]
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    }
  };

  res.json(openApiSpec);
});


// tRPC middleware
app.use('/api/v1/trpc', createExpressMiddleware({
  router: appRouter as any,
  createContext,
  onError: ({ path, error }) => {
    logger.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error);
  },
}));

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    message: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    code: 'NOT_FOUND'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV}`);
  logger.info(`📝 Frontend URL: ${process.env.FRONTEND_URL}`);
  logger.info(`📝 CORS Origins configured for production mode`);
});