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

    // Additional endpoints with proper HTTP methods...
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