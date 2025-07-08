// For now, create a simple OpenAPI document without trpc-openapi dependency
// This avoids the version compatibility issues
export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Order Management System API',
    description: 'API for managing orders, customers, products, inventory, and deliveries',
    version: '1.0.0',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: process.env.API_URL || 'http://localhost:3001',
      description: 'API Server',
    },
  ],
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
  paths: {
    // Authentication endpoints
    '/api/v1/trpc/auth.login': {
      post: {
        summary: 'User login',
        description: 'Authenticate a user with email and password',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/api/v1/trpc/auth.register': {
      post: {
        summary: 'Register new user',
        description: 'Create a new admin user account',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 6 },
                  name: { type: 'string' },
                },
                required: ['email', 'password', 'name'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'User created successfully' },
        },
      },
    },
    '/api/v1/trpc/auth.me': {
      post: {
        summary: 'Get current user',
        description: 'Get the currently authenticated user information',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current user information' },
        },
      },
    },
    '/api/v1/trpc/auth.refresh': {
      post: {
        summary: 'Refresh access token',
        description: 'Exchange a refresh token for a new access token',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refresh_token: { type: 'string' },
                },
                required: ['refresh_token'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Token refreshed successfully' },
        },
      },
    },
    '/api/v1/trpc/auth.logout': {
      post: {
        summary: 'User logout',
        description: 'Logout the current user',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Logout successful' },
        },
      },
    },

    // Orders endpoints
    '/api/v1/trpc/orders.list': {
      post: {
        summary: 'List orders',
        description: 'Get a paginated list of orders with advanced filtering options',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled'] },
                  customer_id: { type: 'string', format: 'uuid' },
                  search: { type: 'string' },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 50 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Orders retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/orders.getById': {
      post: {
        summary: 'Get order by ID',
        description: 'Get a single order with all related data',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { type: 'string', format: 'uuid' },
                },
                required: ['order_id'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/orders.create': {
      post: {
        summary: 'Create order',
        description: 'Create a new order with line items',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                  delivery_method: { type: 'string', enum: ['pickup', 'delivery'] },
                  order_lines: { type: 'array' },
                  notes: { type: 'string' },
                },
                required: ['customer_id', 'order_lines'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Order created successfully' },
        },
      },
    },

    // Customers endpoints
    '/api/v1/trpc/customers.list': {
      post: {
        summary: 'List customers',
        description: 'Get paginated list of customers with advanced filtering',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  search: { type: 'string' },
                  account_status: { type: 'string', enum: ['active', 'credit_hold', 'closed'] },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 50 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Customers retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/customers.getById': {
      post: {
        summary: 'Get customer details',
        description: 'Get single customer with full details and addresses',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Customer retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/customers.create': {
      post: {
        summary: 'Create customer',
        description: 'Create new customer with address information',
        tags: ['customers'],
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
                  address: { type: 'object' },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Customer created successfully' },
        },
      },
    },

    // Products endpoints
    '/api/v1/trpc/products.list': {
      post: {
        summary: 'List products',
        description: 'Get product catalog with advanced filtering and search',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  search: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'discontinued', 'out_of_stock'] },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 50 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Products retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/products.getById': {
      post: {
        summary: 'Get product details',
        description: 'Get single product with variants and specifications',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                },
                required: ['id'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Product retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/products.create': {
      post: {
        summary: 'Create product',
        description: 'Create new product in catalog',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  sku: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  unit_of_measure: { type: 'string' },
                  capacity_kg: { type: 'number' },
                },
                required: ['sku', 'name'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Product created successfully' },
        },
      },
    },

    // Inventory endpoints
    '/api/v1/trpc/inventory.list': {
      post: {
        summary: 'List inventory',
        description: 'Get inventory with advanced filtering and stock levels',
        tags: ['inventory'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                  product_id: { type: 'string', format: 'uuid' },
                  low_stock_only: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Inventory retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/inventory.adjustStock': {
      post: {
        summary: 'Adjust stock levels',
        description: 'Adjust inventory levels with audit trail',
        tags: ['inventory'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                  product_id: { type: 'string', format: 'uuid' },
                  quantity_change: { type: 'number' },
                  reason: { type: 'string' },
                },
                required: ['warehouse_id', 'product_id', 'quantity_change'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Stock adjusted successfully' },
        },
      },
    },

    // Warehouses endpoints
    '/api/v1/trpc/warehouses.list': {
      post: {
        summary: 'List warehouses',
        description: 'Get all warehouses with capacity and location info',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Warehouses retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/warehouses.create': {
      post: {
        summary: 'Create warehouse',
        description: 'Add new warehouse to the system',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  address: { type: 'string' },
                  capacity: { type: 'number' },
                  is_mobile: { type: 'boolean' },
                },
                required: ['name', 'address'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Warehouse created successfully' },
        },
      },
    },

    // Trucks endpoints
    '/api/v1/trpc/trucks.list': {
      post: {
        summary: 'List trucks',
        description: 'Get fleet listing with capacity and status filters',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['active', 'maintenance', 'inactive'] },
                  available_only: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Trucks retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/trucks.create': {
      post: {
        summary: 'Create truck',
        description: 'Add new truck to fleet',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  license_plate: { type: 'string' },
                  model: { type: 'string' },
                  capacity_kg: { type: 'number' },
                  status: { type: 'string', enum: ['active', 'maintenance', 'inactive'] },
                },
                required: ['license_plate', 'capacity_kg'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Truck created successfully' },
        },
      },
    },

    // Pricing endpoints
    '/api/v1/trpc/pricing.list': {
      post: {
        summary: 'List price lists',
        description: 'Get all price lists with filtering and date ranges',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  active_only: { type: 'boolean' },
                  search: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Price lists retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/pricing.getProductPrice': {
      post: {
        summary: 'Get product price',
        description: 'Get current price for product with customer-specific discounts',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  product_id: { type: 'string', format: 'uuid' },
                  customer_id: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number' },
                },
                required: ['product_id'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Product price retrieved successfully' },
        },
      },
    },

    // Payments endpoints
    '/api/v1/trpc/payments.list': {
      post: {
        summary: 'List payments',
        description: 'Get paginated list of payments with filtering',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
                  order_id: { type: 'string', format: 'uuid' },
                  page: { type: 'integer', default: 1 },
                  limit: { type: 'integer', default: 20 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Payments retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/payments.create': {
      post: {
        summary: 'Record payment',
        description: 'Record payment for an order',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { type: 'string', format: 'uuid' },
                  amount: { type: 'number' },
                  payment_method: { type: 'string', enum: ['cash', 'bank_transfer', 'card', 'mobile_money'] },
                  reference_number: { type: 'string' },
                },
                required: ['order_id', 'amount', 'payment_method'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Payment recorded successfully' },
        },
      },
    },

    // Transfers endpoints
    '/api/v1/trpc/transfers.list': {
      post: {
        summary: 'List transfers',
        description: 'Get inventory transfers with filtering and status tracking',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['pending', 'in_transit', 'completed', 'cancelled'] },
                  from_warehouse_id: { type: 'string', format: 'uuid' },
                  to_warehouse_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Transfers retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/transfers.create': {
      post: {
        summary: 'Create transfer',
        description: 'Create new inter-warehouse inventory transfer',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  from_warehouse_id: { type: 'string', format: 'uuid' },
                  to_warehouse_id: { type: 'string', format: 'uuid' },
                  items: { type: 'array' },
                  notes: { type: 'string' },
                },
                required: ['from_warehouse_id', 'to_warehouse_id', 'items'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Transfer created successfully' },
        },
      },
    },

    // Analytics endpoints
    '/api/v1/trpc/analytics.getDashboardStats': {
      post: {
        summary: 'Dashboard statistics',
        description: 'Get comprehensive dashboard overview with KPIs',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date_range: { type: 'string', enum: ['today', 'week', 'month', 'year'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Dashboard stats retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/analytics.getRevenueAnalytics': {
      post: {
        summary: 'Revenue analytics',
        description: 'Get detailed revenue analysis and trends',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  group_by: { type: 'string', enum: ['day', 'week', 'month'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Revenue analytics retrieved successfully' },
        },
      },
    },

    // Stock Movements endpoints
    '/api/v1/trpc/stockMovements.list': {
      post: {
        summary: 'List stock movements',
        description: 'Get stock movements with filtering',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                  product_id: { type: 'string', format: 'uuid' },
                  movement_type: { type: 'string', enum: ['adjustment', 'transfer', 'order', 'return'] },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Stock movements retrieved successfully' },
        },
      },
    },
    '/api/v1/trpc/stockMovements.create': {
      post: {
        summary: 'Create stock movement',
        description: 'Create new stock movement record',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                  product_id: { type: 'string', format: 'uuid' },
                  quantity: { type: 'number' },
                  movement_type: { type: 'string', enum: ['adjustment', 'transfer', 'order', 'return'] },
                  reason: { type: 'string' },
                },
                required: ['warehouse_id', 'product_id', 'quantity', 'movement_type'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Stock movement created successfully' },
        },
      },
    },

    // Deliveries endpoints
    '/api/v1/trpc/deliveries.list': {
      post: {
        summary: 'List deliveries',
        description: 'Get deliveries with filtering and status tracking',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['scheduled', 'en_route', 'delivered', 'failed'] },
                  delivery_date: { type: 'string', format: 'date' },
                  truck_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Deliveries retrieved successfully' },
        },
      },
    },

    // Admin endpoints
    '/api/v1/trpc/admin.healthCheck': {
      post: {
        summary: 'System health check',
        description: 'Comprehensive system health and security validation',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Health check completed' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};