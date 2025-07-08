// Complete OpenAPI specification with proper HTTP methods and response schemas
export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Order Management System API',
    description: 'Complete API documentation for managing orders, customers, products, inventory, and deliveries',
    version: '1.0.0',
    contact: {
      name: 'API Support',
    },
  },
  servers: [
    {
      url: process.env.NODE_ENV === 'production' ? 'https://ordermanagementsystem-production-3ed7.up.railway.app' : 'http://localhost:3001',
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
    { name: 'trucks', description: 'Fleet management' },
    { name: 'pricing', description: 'Pricing management' },
    { name: 'payments', description: 'Payment processing' },
    { name: 'transfers', description: 'Transfer management' },
    { name: 'analytics', description: 'Analytics and reporting' },
    { name: 'admin', description: 'Admin operations' },
    { name: 'stock-movements', description: 'Stock movement tracking' },
    { name: 'deliveries', description: 'Delivery management' },
  ],
  paths: {
    // Authentication endpoints
    '/api/v1/trpc/auth.login': {
      post: {
        summary: 'User login',
        description: 'Authenticate a user with email and password (Mutation)',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@example.com' },
                  password: { type: 'string', minLength: 6, example: 'password123' },
                },
                required: ['email', 'password'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
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
                            user: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                              },
                            },
                            session: {
                              type: 'object',
                              properties: {
                                access_token: { type: 'string' },
                                refresh_token: { type: 'string' },
                                expires_at: { type: 'number' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'UNAUTHORIZED' },
                        message: { type: 'string', example: 'Invalid email or password' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/auth.register': {
      post: {
        summary: 'Register new user',
        description: 'Create a new admin user account (Mutation)',
        tags: ['auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email', example: 'admin@example.com' },
                  password: { type: 'string', minLength: 6, example: 'password123' },
                  name: { type: 'string', example: 'John Doe' },
                },
                required: ['email', 'password', 'name'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'User created successfully',
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
                            user: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/auth.me': {
      get: {
        summary: 'Get current user',
        description: 'Get the currently authenticated user information (Query)',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Current user information',
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
                            user: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                email: { type: 'string' },
                                name: { type: 'string' },
                                role: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'UNAUTHORIZED' },
                        message: { type: 'string', example: 'Not authenticated' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/auth.refresh': {
      post: {
        summary: 'Refresh access token',
        description: 'Exchange a refresh token for a new access token (Mutation)',
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
          '200': {
            description: 'Token refreshed successfully',
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
                            session: {
                              type: 'object',
                              properties: {
                                access_token: { type: 'string' },
                                refresh_token: { type: 'string' },
                                expires_at: { type: 'number' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/auth.logout': {
      post: {
        summary: 'User logout',
        description: 'Logout the current user (Mutation)',
        tags: ['auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
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
                            success: { type: 'boolean', example: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Orders endpoints  
    '/api/v1/trpc/orders.list': {
      get: {
        summary: 'List orders',
        description: 'Get a paginated list of orders with advanced filtering (Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled'] } },
          { name: 'customer_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
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
                            orders: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  order_number: { type: 'string' },
                                  customer_id: { type: 'string' },
                                  status: { type: 'string' },
                                  total_amount: { type: 'number' },
                                  created_at: { type: 'string', format: 'date-time' },
                                },
                              },
                            },
                            totalCount: { type: 'integer' },
                            totalPages: { type: 'integer' },
                            currentPage: { type: 'integer' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/orders.getById': {
      get: {
        summary: 'Get order by ID',
        description: 'Get a single order with all related data (Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'order_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Order retrieved successfully',
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
                            id: { type: 'string' },
                            order_number: { type: 'string' },
                            status: { type: 'string' },
                            total_amount: { type: 'number' },
                            customer: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                email: { type: 'string' },
                              },
                            },
                            order_lines: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  product_id: { type: 'string' },
                                  quantity: { type: 'number' },
                                  unit_price: { type: 'number' },
                                  subtotal: { type: 'number' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string', example: 'Order not found' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/orders.create': {
      post: {
        summary: 'Create order',
        description: 'Create a new order with line items (Mutation)',
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
                  order_lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number' },
                        unit_price: { type: 'number' },
                      },
                      required: ['product_id', 'quantity'],
                    },
                  },
                  notes: { type: 'string' },
                },
                required: ['customer_id', 'order_lines'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order created successfully',
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
                            id: { type: 'string' },
                            order_number: { type: 'string' },
                            customer_id: { type: 'string' },
                            status: { type: 'string' },
                            total_amount: { type: 'number' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Customers endpoints
    '/api/v1/trpc/customers.list': {
      get: {
        summary: 'List customers',
        description: 'Get paginated list of customers with filtering (Query)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'account_status', in: 'query', schema: { type: 'string', enum: ['active', 'credit_hold', 'closed'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': {
            description: 'Customers retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              email: { type: 'string' },
                              phone: { type: 'string' },
                              account_status: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/customers.getById': {
      get: {
        summary: 'Get customer details',
        description: 'Get single customer with full details (Query)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Customer retrieved successfully',
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
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            phone: { type: 'string' },
                            account_status: { type: 'string' },
                            addresses: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  line1: { type: 'string' },
                                  city: { type: 'string' },
                                  state: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/customers.create': {
      post: {
        summary: 'Create customer',
        description: 'Create new customer with address (Mutation)',
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
                  address: {
                    type: 'object',
                    properties: {
                      line1: { type: 'string' },
                      city: { type: 'string' },
                      state: { type: 'string' },
                      postal_code: { type: 'string' },
                    },
                  },
                },
                required: ['name', 'email'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer created successfully',
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
                            id: { type: 'string' },
                            name: { type: 'string' },
                            email: { type: 'string' },
                            phone: { type: 'string' },
                            account_status: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Products endpoints
    '/api/v1/trpc/products.list': {
      get: {
        summary: 'List products',
        description: 'Get product catalog with filtering (Query)',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'discontinued', 'out_of_stock'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: {
          '200': {
            description: 'Products retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              sku: { type: 'string' },
                              name: { type: 'string' },
                              description: { type: 'string' },
                              unit_of_measure: { type: 'string' },
                              capacity_kg: { type: 'number' },
                              status: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/products.getById': {
      get: {
        summary: 'Get product details',
        description: 'Get single product with specifications (Query)',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Product retrieved successfully',
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
                            id: { type: 'string' },
                            sku: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' },
                            unit_of_measure: { type: 'string' },
                            capacity_kg: { type: 'number' },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/products.create': {
      post: {
        summary: 'Create product',
        description: 'Create new product in catalog (Mutation)',
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
                  status: { type: 'string', enum: ['active', 'discontinued', 'out_of_stock'] },
                },
                required: ['sku', 'name'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product created successfully',
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
                            id: { type: 'string' },
                            sku: { type: 'string' },
                            name: { type: 'string' },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Inventory endpoints
    '/api/v1/trpc/inventory.list': {
      get: {
        summary: 'List inventory',
        description: 'Get inventory levels with filtering (Query)',
        tags: ['inventory'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'low_stock_only', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'Inventory retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              warehouse_id: { type: 'string' },
                              product_id: { type: 'string' },
                              quantity_available: { type: 'number' },
                              quantity_reserved: { type: 'number' },
                              last_updated: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/inventory.adjustStock': {
      post: {
        summary: 'Adjust stock levels',
        description: 'Adjust inventory levels with audit trail (Mutation)',
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
          '200': {
            description: 'Stock adjusted successfully',
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
                            success: { type: 'boolean' },
                            new_quantity: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Warehouses endpoints
    '/api/v1/trpc/warehouses.list': {
      get: {
        summary: 'List warehouses',
        description: 'Get all warehouses (Query)',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Warehouses retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              address: { type: 'string' },
                              capacity: { type: 'number' },
                              is_mobile: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/warehouses.create': {
      post: {
        summary: 'Create warehouse',
        description: 'Add new warehouse to the system (Mutation)',
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
          '200': {
            description: 'Warehouse created successfully',
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
                            id: { type: 'string' },
                            name: { type: 'string' },
                            address: { type: 'string' },
                            capacity: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Trucks endpoints
    '/api/v1/trpc/trucks.list': {
      get: {
        summary: 'List trucks',
        description: 'Get fleet listing with status filters (Query)',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'maintenance', 'inactive'] } },
          { name: 'available_only', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'Trucks retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              license_plate: { type: 'string' },
                              model: { type: 'string' },
                              capacity_kg: { type: 'number' },
                              status: { type: 'string' },
                              current_load_kg: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/trucks.create': {
      post: {
        summary: 'Create truck',
        description: 'Add new truck to fleet (Mutation)',
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
          '200': {
            description: 'Truck created successfully',
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
                            id: { type: 'string' },
                            license_plate: { type: 'string' },
                            model: { type: 'string' },
                            capacity_kg: { type: 'number' },
                            status: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/trucks.getInventory': {
      get: {
        summary: 'Get truck inventory',
        description: 'Get current inventory of products in a specific truck (Query)',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { 
            name: 'truck_id', 
            in: 'query', 
            required: true, 
            schema: { type: 'string', format: 'uuid' },
            description: 'ID of the truck to get inventory for'
          },
          { 
            name: 'include_product_details', 
            in: 'query', 
            schema: { type: 'boolean', default: true },
            description: 'Whether to include detailed product information'
          },
        ],
        responses: {
          '200': {
            description: 'Truck inventory retrieved successfully',
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
                            truck: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', format: 'uuid' },
                                fleet_number: { type: 'string' },
                                license_plate: { type: 'string' },
                                active: { type: 'boolean' },
                                capacity_cylinders: { type: 'integer' },
                                capacity_kg: { type: 'number' },
                              },
                            },
                            inventory: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', format: 'uuid' },
                                  product_id: { type: 'string', format: 'uuid' },
                                  qty_full: { type: 'integer', minimum: 0 },
                                  qty_empty: { type: 'integer', minimum: 0 },
                                  total_cylinders: { type: 'integer', minimum: 0 },
                                  weight_kg: { type: 'number', minimum: 0 },
                                  updated_at: { type: 'string', format: 'date-time' },
                                  product: {
                                    type: 'object',
                                    description: 'Included when include_product_details is true',
                                    properties: {
                                      id: { type: 'string', format: 'uuid' },
                                      name: { type: 'string' },
                                      sku: { type: 'string' },
                                      variant_name: { type: 'string' },
                                      capacity_kg: { type: 'number' },
                                      tare_weight_kg: { type: 'number' },
                                      unit_of_measure: { type: 'string' },
                                      status: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                            summary: {
                              type: 'object',
                              properties: {
                                total_products: { type: 'integer', minimum: 0 },
                                total_full_cylinders: { type: 'integer', minimum: 0 },
                                total_empty_cylinders: { type: 'integer', minimum: 0 },
                                total_cylinders: { type: 'integer', minimum: 0 },
                                total_weight_kg: { type: 'number', minimum: 0 },
                                capacity_utilization_percent: { type: 'number', minimum: 0, maximum: 100 },
                                is_overloaded: { type: 'boolean' },
                                last_updated: { type: 'string', format: 'date-time', nullable: true },
                              },
                            },
                            timestamp: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '404': {
            description: 'Truck not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string', example: 'Truck not found' },
                      },
                    },
                  },
                },
              },
            },
          },
          '500': {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
                        message: { type: 'string', example: 'Failed to fetch truck inventory' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Pricing endpoints
    '/api/v1/trpc/pricing.list': {
      get: {
        summary: 'List price lists',
        description: 'Get all price lists with filtering (Query)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'active_only', in: 'query', schema: { type: 'boolean' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'Price lists retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              description: { type: 'string' },
                              valid_from: { type: 'string', format: 'date' },
                              valid_to: { type: 'string', format: 'date' },
                              is_active: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/pricing.getProductPrice': {
      get: {
        summary: 'Get product price',
        description: 'Get current price for product (Query)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'product_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'customer_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'quantity', in: 'query', schema: { type: 'number' } },
        ],
        responses: {
          '200': {
            description: 'Product price retrieved successfully',
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
                            product_id: { type: 'string' },
                            unit_price: { type: 'number' },
                            currency: { type: 'string' },
                            discount_percent: { type: 'number' },
                            final_price: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Payments endpoints
    '/api/v1/trpc/payments.list': {
      get: {
        summary: 'List payments',
        description: 'Get paginated list of payments (Query)',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] } },
          { name: 'order_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Payments retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              order_id: { type: 'string' },
                              amount: { type: 'number' },
                              payment_method: { type: 'string' },
                              payment_status: { type: 'string' },
                              payment_date: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/payments.create': {
      post: {
        summary: 'Record payment',
        description: 'Record payment for an order (Mutation)',
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
                  notes: { type: 'string' },
                },
                required: ['order_id', 'amount', 'payment_method'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment recorded successfully',
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
                            id: { type: 'string' },
                            order_id: { type: 'string' },
                            amount: { type: 'number' },
                            payment_method: { type: 'string' },
                            payment_status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Transfers endpoints
    '/api/v1/trpc/transfers.list': {
      get: {
        summary: 'List transfers',
        description: 'Get inventory transfers with filtering (Query)',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_transit', 'completed', 'cancelled'] } },
          { name: 'from_warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'to_warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Transfers retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              from_warehouse_id: { type: 'string' },
                              to_warehouse_id: { type: 'string' },
                              status: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/transfers.create': {
      post: {
        summary: 'Create transfer',
        description: 'Create new inter-warehouse inventory transfer (Mutation)',
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
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number' },
                      },
                      required: ['product_id', 'quantity'],
                    },
                  },
                  notes: { type: 'string' },
                },
                required: ['from_warehouse_id', 'to_warehouse_id', 'items'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer created successfully',
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
                            id: { type: 'string' },
                            from_warehouse_id: { type: 'string' },
                            to_warehouse_id: { type: 'string' },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Stock Movements endpoints
    '/api/v1/trpc/stockMovements.list': {
      get: {
        summary: 'List stock movements',
        description: 'Get stock movements with filtering (Query)',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'warehouse_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'product_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'movement_type', in: 'query', schema: { type: 'string', enum: ['adjustment', 'transfer', 'order', 'return'] } },
          { name: 'start_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end_date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': {
            description: 'Stock movements retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              warehouse_id: { type: 'string' },
                              product_id: { type: 'string' },
                              quantity: { type: 'number' },
                              movement_type: { type: 'string' },
                              reason: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/trpc/stockMovements.create': {
      post: {
        summary: 'Create stock movement',
        description: 'Create new stock movement record (Mutation)',
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
                  reference_id: { type: 'string' },
                },
                required: ['warehouse_id', 'product_id', 'quantity', 'movement_type'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock movement created successfully',
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
                            id: { type: 'string' },
                            warehouse_id: { type: 'string' },
                            product_id: { type: 'string' },
                            quantity: { type: 'number' },
                            movement_type: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Deliveries endpoints
    '/api/v1/trpc/deliveries.list': {
      get: {
        summary: 'List deliveries',
        description: 'Get deliveries with filtering and status tracking (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['scheduled', 'en_route', 'delivered', 'failed'] } },
          { name: 'delivery_date', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'truck_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Deliveries retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    result: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              order_id: { type: 'string' },
                              truck_id: { type: 'string' },
                              status: { type: 'string' },
                              scheduled_date: { type: 'string', format: 'date-time' },
                              delivered_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // Admin endpoints
    '/api/v1/trpc/admin.healthCheck': {
      get: {
        summary: 'System health check',
        description: 'Comprehensive system health and security validation (Query)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Health check completed',
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
                            status: { type: 'string', example: 'healthy' },
                            timestamp: { type: 'string', format: 'date-time' },
                            services: {
                              type: 'object',
                              properties: {
                                database: { type: 'string' },
                                auth: { type: 'string' },
                                storage: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/trpc/analytics.getDashboardStats': {
      get: {
        summary: 'Dashboard statistics',
        description: 'Get comprehensive dashboard KPIs (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'date_range', in: 'query', schema: { type: 'string', enum: ['today', 'week', 'month', 'year'] } },
        ],
        responses: {
          '200': {
            description: 'Dashboard stats retrieved successfully',
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
                            total_orders: { type: 'number' },
                            total_revenue: { type: 'number' },
                            active_customers: { type: 'number' },
                            pending_deliveries: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
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
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          result: {
            type: 'object',
            properties: {
              data: { type: 'object' },
            },
          },
        },
      },
    },
  },
};