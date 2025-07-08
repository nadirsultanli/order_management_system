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
                        code: { type: 'string' },
                        message: { type: 'string' },
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
      post: {
        summary: 'Get current user',
        description: 'Get the currently authenticated user information',
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