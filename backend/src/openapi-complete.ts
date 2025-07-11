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
        description: 'Get paginated list of orders with advanced filtering (tRPC Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'input',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              description: 'URL-encoded JSON object containing filter parameters',
            },
            examples: {
              empty_request: {
                summary: 'Empty request (get all orders)',
                value: `{}`
              },
              single_status: {
                summary: 'Single status filter',
                value: `{
          "status": "confirmed",
          "page": 1,
          "limit": 20
        }`
              },
              multiple_statuses_csv: {
                summary: 'Multiple statuses (comma-separated)',
                value: `{
          "status": "confirmed,scheduled,en_route",
          "sort_by": "scheduled_date",
          "sort_order": "asc"
        }`
              },
              multiple_statuses_array: {
                summary: 'Multiple statuses (as array)',
                value: `{
          "status": ["confirmed", "scheduled", "en_route"],
          "include_analytics": true,
          "limit": 25
        }`
              },
              complex_filtering: {
                summary: 'Complex filtering with all supported parameters',
                value: `{
                  "status": "confirmed,scheduled",
                  "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                  "search": "gas cylinder",
                  "order_date_from": "2024-01-01",
                  "order_date_to": "2024-12-31",
                  "scheduled_date_from": "2024-01-01",
                  "scheduled_date_to": "2024-12-31",
                  "include_analytics": true,
                  "page": 1,
                  "limit": 30
                }`
              }
            }
          }
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
                                  id: { type: 'string', format: 'uuid' },
                                  order_date: { type: 'string', format: 'date' },
                                  scheduled_date: { type: 'string', format: 'date-time' },
                                  status: { 
                                    type: 'string',
                                    enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']
                                  },
                                  total_amount: { type: 'number' },
                                  delivery_method: {
                                    type: 'string',
                                    enum: ['pickup', 'delivery']
                                  },
                                  priority: {
                                    type: 'string',
                                    enum: ['low', 'normal', 'high', 'urgent']
                                  },
                                  created_at: { type: 'string', format: 'date-time' },
                                  // Business metrics calculated by tRPC
                                  is_high_value: { 
                                    type: 'boolean', 
                                    description: 'True if order amount > 1000 (calculated field)' 
                                  },
                                  days_since_order: { 
                                    type: 'integer', 
                                    description: 'Number of days since order was placed (calculated field)' 
                                  },
                                  estimated_delivery_window: { 
                                    type: 'string', 
                                    description: 'Estimated delivery timeframe (calculated field)' 
                                  },
                                  risk_level: { 
                                    type: 'string', 
                                    description: 'Order risk assessment (calculated field)' 
                                  },
                                  payment_balance: { 
                                    type: 'number', 
                                    description: 'Remaining payment balance (calculated field)' 
                                  },
                                  payment_status: { 
                                    type: 'string', 
                                    description: 'Current payment status (calculated field)' 
                                  },
                                  payment_summary: {
                                    type: 'object',
                                    description: 'Calculated payment summary',
                                    properties: {
                                      total_paid: { type: 'number' },
                                      balance: { type: 'number' },
                                      status: { type: 'string' }
                                    }
                                  },
                                  // Related data from tRPC joins
                                  customer: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string', format: 'uuid' },
                                      name: { type: 'string' },
                                      email: { type: 'string', format: 'email' },
                                      phone: { type: 'string' },
                                      account_status: { type: 'string' },
                                      credit_terms_days: { type: 'integer' }
                                    }
                                  },
                                  delivery_address: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string', format: 'uuid' },
                                      line1: { type: 'string' },
                                      line2: { type: 'string' },
                                      city: { type: 'string' },
                                      state: { type: 'string' },
                                      postal_code: { type: 'string' },
                                      country: { type: 'string' },
                                      instructions: { type: 'string' }
                                    }
                                  },
                                  source_warehouse: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string', format: 'uuid' },
                                      name: { type: 'string' },
                                      is_mobile: { type: 'boolean' }
                                    }
                                  },
                                  order_lines: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        product_id: { type: 'string', format: 'uuid' },
                                        quantity: { type: 'number' },
                                        unit_price: { type: 'number' },
                                        subtotal: { type: 'number' },
                                        product: {
                                          type: 'object',
                                          properties: {
                                            id: { type: 'string', format: 'uuid' },
                                            sku: { type: 'string' },
                                            name: { type: 'string' },
                                            unit_of_measure: { type: 'string' }
                                          }
                                        }
                                      }
                                    }
                                  },
                                  payments: {
                                    type: 'array',
                                    items: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string', format: 'uuid' },
                                        amount: { type: 'number' },
                                        payment_method: { type: 'string' },
                                        payment_status: { type: 'string' },
                                        payment_date: { type: 'string', format: 'date-time' },
                                        transaction_id: { type: 'string' }
                                      }
                                    }
                                  }
                                }
                              }
                            },
                            totalCount: { 
                              type: 'integer',
                              description: 'Total number of orders matching the filters'
                            },
                            totalPages: { 
                              type: 'integer',
                              description: 'Total number of pages available'
                            },
                            currentPage: { 
                              type: 'integer',
                              description: 'Current page number'
                            },
                            analytics: {
                              type: 'object',
                              description: 'Analytics data (only included if include_analytics is true)',
                              properties: {
                                // Analytics structure matching your generateOrderAnalytics function
                                total_value: { type: 'number' },
                                average_order_value: { type: 'number' },
                                status_distribution: { 
                                  type: 'object',
                                  additionalProperties: { type: 'integer' }
                                },
                                trends: { 
                                  type: 'object',
                                  description: 'Trend analysis data'
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
          '400': {
            description: 'Bad request - Invalid parameters',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'BAD_REQUEST' },
                        message: { type: 'string', example: 'Invalid filter parameters' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication'
          },
          '500': {
            description: 'Internal server error'
          }
        }
      }
    },
    '/api/v1/trpc/orders.getById': {
      get: {
        summary: 'Get order by ID',
        description: 'Get detailed information about a specific order (tRPC Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'input',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              description: 'JSON object containing the order ID'
            },
            example: '{"order_id":"123e4567-e89b-12d3-a456-426614174000"}'
          }
        ],
        responses: {
          '200': {
            description: 'Order details retrieved successfully',
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
                          description: 'Complete order object with all nested relationships',
                          properties: {
                            // Base order fields (from your SELECT *)
                            id: { type: 'string', format: 'uuid' },
                            order_date: { type: 'string', format: 'date' },
                            scheduled_date: { type: 'string', format: 'date-time' },
                            status: { 
                              type: 'string',
                              enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']
                            },
                            total_amount: { type: 'number' },
                            delivery_method: { type: 'string', enum: ['pickup', 'delivery'] },
                            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
                            created_at: { type: 'string', format: 'date-time' },
                            updated_at: { type: 'string', format: 'date-time' },
                            order_notes: { type: 'string' },
                            customer_id: { type: 'string', format: 'uuid' },
                            delivery_address_id: { type: 'string', format: 'uuid' },
                            source_warehouse_id: { type: 'string', format: 'uuid' },
                            
                            // Calculated fields added by tRPC
                            payment_summary: {
                              type: 'object',
                              description: 'Calculated payment summary from calculateOrderPaymentSummary()',
                              properties: {
                                total_paid: { type: 'number' },
                                balance: { type: 'number' },
                                status: { type: 'string', enum: ['pending', 'paid', 'overdue'] }
                              }
                            },
                            payment_balance: { 
                              type: 'number',
                              description: 'Remaining balance (calculated field)'
                            },
                            payment_status: { 
                              type: 'string',
                              description: 'Current payment status (calculated or cached)'
                            },
                            
                            // Nested customer data (from JOIN)
                            customer: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', format: 'uuid' },
                                name: { type: 'string' },
                                email: { type: 'string', format: 'email' },
                                phone: { type: 'string' },
                                account_status: { type: 'string' },
                                credit_terms_days: { type: 'integer' }
                              }
                            },
                            
                            // Nested delivery address data (from JOIN)
                            delivery_address: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', format: 'uuid' },
                                line1: { type: 'string' },
                                line2: { type: 'string' },
                                city: { type: 'string' },
                                state: { type: 'string' },
                                postal_code: { type: 'string' },
                                country: { type: 'string' },
                                instructions: { type: 'string' }
                              }
                            },
                            
                            // Nested warehouse data (from JOIN)
                            source_warehouse: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', format: 'uuid' },
                                name: { type: 'string' },
                                is_mobile: { type: 'boolean' }
                              }
                            },
                            
                            // Nested order lines data (from JOIN)
                            order_lines: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', format: 'uuid' },
                                  product_id: { type: 'string', format: 'uuid' },
                                  quantity: { type: 'number' },
                                  unit_price: { type: 'number' },
                                  subtotal: { type: 'number' },
                                  // Nested product data
                                  product: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string', format: 'uuid' },
                                      sku: { type: 'string' },
                                      name: { type: 'string' },
                                      unit_of_measure: { type: 'string' },
                                      capacity_kg: { type: 'number' },
                                      tare_weight_kg: { type: 'number' }
                                    }
                                  }
                                }
                              }
                            },
                            
                            // Nested payments data (from JOIN)
                            payments: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', format: 'uuid' },
                                  amount: { type: 'number' },
                                  payment_method: { type: 'string' },
                                  payment_status: { type: 'string' },
                                  payment_date: { type: 'string', format: 'date-time' },
                                  transaction_id: { type: 'string' },
                                  reference_number: { type: 'string' }
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
          '400': {
            description: 'Bad request - Invalid order_id format',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'BAD_REQUEST' },
                        message: { type: 'string', example: 'Invalid UUID format for order_id' }
                      }
                    }
                  }
                }
              }
            }
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
                        message: { type: 'string', example: 'Order not found' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication'
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
                        message: { type: 'string', example: 'Database connection error' }
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
    '/api/v1/trpc/orders.create': {
      post: {
        summary: 'Create order',
        description: 'Create a new order (Mutation)',
        tags: ['orders'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                  delivery_address_id: { type: 'string', format: 'uuid' },
                  source_warehouse_id: { type: 'string', format: 'uuid' },
                  order_date: { type: 'string', format: 'date', example: '2025-07-09' },
                  scheduled_date: { type: 'string', format: 'date-time' },
                  notes: { type: 'string' },
                  idempotency_key: { type: 'string' },
                  validate_pricing: { type: 'boolean', default: true },
                  skip_inventory_check: { type: 'boolean', default: false },
                  order_type: {
                    type: 'string',
                    enum: ['delivery', 'refill', 'exchange', 'pickup'],
                    default: 'delivery'
                  },
                  service_type: {
                    type: 'string',
                    enum: ['standard', 'express', 'scheduled'],
                    default: 'standard'
                  },
                  exchange_empty_qty: { type: 'number', minimum: 0, default: 0 },
                  requires_pickup: { type: 'boolean', default: false },
                  order_lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number', minimum: 1 },
                        unit_price: { type: 'number' },
                        expected_price: { type: 'number' },
                        price_list_id: { type: 'string', format: 'uuid' }
                      },
                      required: ['product_id', 'quantity']
                    },
                    minItems: 1
                  }
                },
                required: ['customer_id', 'order_lines', 'source_warehouse_id']
              }
            }
          }
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
                          description: 'The created order and its metadata'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation or business rule error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/trpc/orders.update': {
      put: {
        summary: 'Update order',
        description: 'Update an existing order with comprehensive validation and business rules (Mutation)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Unique identifier of the order to update',
                    example: '550e8400-e29b-41d4-a716-446655440000'
                  },
                  customer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Customer ID (optional - can reassign order to different customer)',
                    example: '123e4567-e89b-12d3-a456-426614174000'
                  },
                  delivery_address_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Delivery address ID (must belong to the customer)',
                    example: '789e0123-e45b-67c8-d901-234567890123'
                  },
                  source_warehouse_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Source warehouse for order fulfillment',
                    example: 'abc12345-ef67-89ab-cdef-123456789abc'
                  },
                  order_date: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Order placement date (YYYY-MM-DD)',
                    example: '2025-01-15'
                  },
                  scheduled_date: { 
                    type: 'string', 
                    format: 'date-time',
                    description: 'Scheduled delivery date and time (ISO 8601 format)',
                    example: '2025-01-20T14:30:00.000Z'
                  },
                  notes: { 
                    type: 'string',
                    description: 'Order notes or special instructions',
                    example: 'Deliver to back entrance, call upon arrival'
                  },
                  order_type: {
                    type: 'string',
                    enum: ['delivery', 'refill', 'exchange', 'pickup'],
                    description: 'Type of order operation',
                    example: 'delivery'
                  },
                  service_type: {
                    type: 'string',
                    enum: ['standard', 'express', 'scheduled'],
                    description: 'Service level for the order',
                    example: 'standard'
                  },
                  exchange_empty_qty: {
                    type: 'number',
                    minimum: 0,
                    description: 'Number of empty cylinders to exchange (for refill/exchange orders)',
                    example: 2
                  },
                  requires_pickup: {
                    type: 'boolean',
                    description: 'Whether empty cylinder pickup is required',
                    example: false
                  },
                  priority: {
                    type: 'string',
                    enum: ['low', 'normal', 'high', 'urgent'],
                    description: 'Order priority level',
                    example: 'normal'
                  },
                  delivery_method: {
                    type: 'string',
                    enum: ['pickup', 'delivery'],
                    description: 'Method of order fulfillment',
                    example: 'delivery'
                  },
                  order_lines: {
                    type: 'array',
                    description: 'Order line items (products and quantities)',
                    items: {
                      type: 'object',
                      properties: {
                        id: {
                          type: 'string',
                          format: 'uuid',
                          description: 'Existing line ID (for updates, omit for new lines)',
                          example: 'def45678-9abc-def0-1234-56789abcdef0'
                        },
                        product_id: { 
                          type: 'string', 
                          format: 'uuid',
                          description: 'Product identifier',
                          example: '456e7890-e12b-34d5-a678-901234567890'
                        },
                        quantity: { 
                          type: 'number',
                          minimum: 1,
                          description: 'Quantity of the product',
                          example: 5
                        },
                        unit_price: { 
                          type: 'number',
                          minimum: 0,
                          description: 'Unit price (optional - will use pricing engine if not provided)',
                          example: 45.50
                        },
                        delete: {
                          type: 'boolean',
                          description: 'Mark this line for deletion (requires existing line ID)',
                          example: false
                        }
                      },
                      required: ['product_id', 'quantity']
                    },
                    example: [
                      {
                        "id": "def45678-9abc-def0-1234-56789abcdef0",
                        "product_id": "456e7890-e12b-34d5-a678-901234567890",
                        "quantity": 3,
                        "unit_price": 45.50
                      },
                      {
                        "product_id": "567f8901-f23c-45e6-b789-012345678901",
                        "quantity": 2
                      }
                    ]
                  }
                },
                required: ['order_id'],
                example: {
                  "order_id": "550e8400-e29b-41d4-a716-446655440000",
                  "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                  "delivery_address_id": "789e0123-e45b-67c8-d901-234567890123",
                  "scheduled_date": "2025-01-20T14:30:00.000Z",
                  "notes": "Deliver to back entrance",
                  "order_type": "delivery",
                  "priority": "normal",
                  "order_lines": [
                    {
                      "id": "def45678-9abc-def0-1234-56789abcdef0",
                      "product_id": "456e7890-e12b-34d5-a678-901234567890",
                      "quantity": 3,
                      "unit_price": 45.50
                    }
                  ]
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Order updated successfully',
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
                          description: 'Updated order with full details',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            customer_id: { type: 'string', format: 'uuid' },
                            order_date: { type: 'string', format: 'date' },
                            scheduled_date: { type: 'string', format: 'date-time' },
                            status: { 
                              type: 'string',
                              enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']
                            },
                            total_amount: { type: 'number', description: 'Recalculated order total' },
                            notes: { type: 'string' },
                            customer: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                email: { type: 'string' },
                                phone: { type: 'string' }
                              }
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
                                  product: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      sku: { type: 'string' },
                                      name: { type: 'string' }
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
                  example: {
                    "result": {
                      "data": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                        "order_date": "2025-01-15",
                        "scheduled_date": "2025-01-20T14:30:00.000Z",
                        "status": "confirmed",
                        "total_amount": 136.50,
                        "notes": "Deliver to back entrance",
                        "customer": {
                          "id": "123e4567-e89b-12d3-a456-426614174000",
                          "name": "John Smith",
                          "email": "john@example.com",
                          "phone": "+1234567890"
                        },
                        "order_lines": [
                          {
                            "id": "def45678-9abc-def0-1234-56789abcdef0",
                            "product_id": "456e7890-e12b-34d5-a678-901234567890",
                            "quantity": 3,
                            "unit_price": 45.50,
                            "subtotal": 136.50,
                            "product": {
                              "id": "456e7890-e12b-34d5-a678-901234567890",
                              "sku": "LPG-50KG",
                              "name": "LPG Cylinder 50kg"
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad Request - Validation errors or business rule violations',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'BAD_REQUEST' },
                        message: { type: 'string' },
                        details: { 
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "BAD_REQUEST",
                      "message": "Cannot update order with status 'delivered'. Only draft, confirmed, scheduled, or cancelled orders can be updated.",
                      "details": [
                        "Order status validation failed",
                        "Current status: delivered",
                        "Allowed statuses for update: draft, confirmed, scheduled, cancelled"
                      ]
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Authentication required"
                  }
                }
              }
            }
          },
          '403': {
            description: 'Forbidden - Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  "error": {
                    "code": "FORBIDDEN",
                    "message": "You don't have permission to update this order"
                  }
                }
              }
            }
          },
          '404': {
            description: 'Not Found - Order, customer, product, or address not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string' },
                        resource: { type: 'string' },
                        resource_id: { type: 'string' }
                      }
                    }
                  }
                },
                examples: {
                  order_not_found: {
                    summary: 'Order not found',
                    value: {
                      "error": {
                        "code": "NOT_FOUND",
                        "message": "Order not found",
                        "resource": "order",
                        "resource_id": "550e8400-e29b-41d4-a716-446655440000"
                      }
                    }
                  },
                  customer_not_found: {
                    summary: 'Customer not found',
                    value: {
                      "error": {
                        "code": "NOT_FOUND",
                        "message": "Customer not found",
                        "resource": "customer",
                        "resource_id": "123e4567-e89b-12d3-a456-426614174000"
                      }
                    }
                  },
                  product_not_found: {
                    summary: 'Product not found',
                    value: {
                      "error": {
                        "code": "NOT_FOUND",
                        "message": "Product not found for line with product_id: 456e7890-e12b-34d5-a678-901234567890",
                        "resource": "product",
                        "resource_id": "456e7890-e12b-34d5-a678-901234567890"
                      }
                    }
                  },
                  address_not_found: {
                    summary: 'Delivery address not found',
                    value: {
                      "error": {
                        "code": "NOT_FOUND",
                        "message": "Delivery address not found or does not belong to customer",
                        "resource": "address",
                        "resource_id": "789e0123-e45b-67c8-d901-234567890123"
                      }
                    }
                  }
                }
              }
            }
          },
          '409': {
            description: 'Conflict - Business rule conflicts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'CONFLICT' },
                        message: { type: 'string' },
                        conflict_type: { type: 'string' },
                        details: { 
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                examples: {
                  inactive_customer: {
                    summary: 'Inactive customer assignment',
                    value: {
                      "error": {
                        "code": "CONFLICT",
                        "message": "Cannot assign order to inactive customer",
                        "conflict_type": "customer_status",
                        "details": [
                          "Customer status: credit_hold",
                          "Only active customers can receive new orders"
                        ]
                      }
                    }
                  },
                  inactive_product: {
                    summary: 'Inactive product in order line',
                    value: {
                      "error": {
                        "code": "CONFLICT",
                        "message": "Product LPG-50KG is not active",
                        "conflict_type": "product_status",
                        "details": [
                          "Product status: obsolete",
                          "Only active products can be ordered"
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '422': {
            description: 'Unprocessable Entity - Validation errors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'UNPROCESSABLE_ENTITY' },
                        message: { type: 'string' },
                        validation_errors: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              field: { type: 'string' },
                              message: { type: 'string' },
                              value: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "UNPROCESSABLE_ENTITY",
                      "message": "Order validation failed",
                      "validation_errors": [
                        {
                          "field": "order_lines[0].quantity",
                          "message": "Quantity must be greater than 0",
                          "value": "0"
                        },
                        {
                          "field": "scheduled_date",
                          "message": "Scheduled date must be in the future",
                          "value": "2024-12-01T10:00:00Z"
                        }
                      ]
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal Server Error - System error during order update',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
                        message: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        request_id: { type: 'string' }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "INTERNAL_SERVER_ERROR",
                      "message": "Failed to update order lines",
                      "timestamp": "2025-01-15T10:30:00.000Z",
                      "request_id": "req_123456789"
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    // Customers endpoints
    '/api/v1/trpc/customers.list': {
      get: {
        summary: 'List customers',
        description: 'Get paginated list of customers with filtering (Query)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
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
    '/api/v1/trpc/customers.update': {
      put: {
        summary: 'Update customer',
        description: 'Update an existing customer and optionally their primary address (Mutation)',
        tags: ['customers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid', example: 'customer-uuid' },
                  external_id: { type: 'string', example: 'EXT123' },
                  name: { type: 'string', example: 'Acme Corp' },
                  tax_id: { type: 'string', example: '123456789' },
                  phone: { type: 'string', example: '+1234567890' },
                  email: { type: 'string', format: 'email', example: 'info@acme.com' },
                  account_status: { type: 'string', enum: ['active', 'credit_hold', 'closed'] },
                  credit_terms_days: { type: 'integer', example: 30 },
                  address: {
                    type: 'object',
                    properties: {
                      label: { type: 'string', example: 'HQ' },
                      line1: { type: 'string', example: '123 Main St' },
                      line2: { type: 'string', example: 'Suite 100' },
                      city: { type: 'string', example: 'Metropolis' },
                      state: { type: 'string', example: 'CA' },
                      postal_code: { type: 'string', example: '90001' },
                      country: { type: 'string', example: 'US' },
                      latitude: { type: 'number', example: 34.0522 },
                      longitude: { type: 'number', example: -118.2437 },
                      delivery_window_start: { type: 'string', example: '08:00' },
                      delivery_window_end: { type: 'string', example: '17:00' },
                      instructions: { type: 'string', example: 'Leave at front desk' },
                    },
                  },
                },
                required: ['id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer updated successfully',
            content: {
              'application/json': {
                schema: {
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
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string', example: 'Customer not found' },
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
    '/api/v1/trpc/customers.delete': {
      delete: {
        summary: 'Delete customer',
        description: 'Delete a customer by ID (Mutation)',
        tags: ['customers'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid', example: 'customer-uuid' },
                },
                required: ['customer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer deleted successfully',
            content: {
              'application/json': {
                schema: {
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
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string', example: 'Customer not found' },
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
        requestBody: {
          required: true,
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
        requestBody: {
          required: true,
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
      post: {
        summary: 'List warehouses',
        description: 'Get all warehouses (Query)',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['active', 'maintenance', 'inactive'],
                    description: 'Filter trucks by status'
                  },
                  available_only: { 
                    type: 'boolean',
                    description: 'Only return available trucks'
                  },
                },
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  truck_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the truck to get inventory for'
                  },
                  include_product_details: { 
                    type: 'boolean', 
                    default: true,
                    description: 'Whether to include detailed product information'
                  },
                },
                required: ['truck_id'],
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  active_only: { 
                    type: 'boolean',
                    description: 'Filter to only active price lists'
                  },
                  search: { 
                    type: 'string',
                    description: 'Search term for price list names'
                  },
                },
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  product_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the product to get price for'
                  },
                  customer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the customer for personalized pricing'
                  },
                  quantity: { 
                    type: 'number',
                    description: 'Quantity for bulk pricing calculation'
                  },
                },
                required: ['product_id'],
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['pending', 'completed', 'failed', 'refunded'],
                    description: 'Filter payments by status'
                  },
                  order_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter payments by order ID'
                  },
                  page: { 
                    type: 'integer', 
                    default: 1,
                    description: 'Page number for pagination'
                  },
                  limit: { 
                    type: 'integer', 
                    default: 20,
                    description: 'Number of items per page'
                  },
                },
              },
            },
          },
        },
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['pending', 'in_transit', 'completed', 'cancelled'],
                    description: 'Filter transfers by status'
                  },
                  from_warehouse_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter transfers by source warehouse'
                  },
                  to_warehouse_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter transfers by destination warehouse'
                  },
                },
              },
            },
          },
        },
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
        requestBody: {
          required: true,
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { 
                    type: 'string', 
                    enum: ['scheduled', 'en_route', 'delivered', 'failed'],
                    description: 'Filter deliveries by status'
                  },
                  delivery_date: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Filter deliveries by date'
                  },
                  truck_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter deliveries by truck ID'
                  },
                },
              },
            },
          },
        },
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
    // Add these missing delivery endpoints to your OpenAPI specification:
    '/api/v1/trpc/deliveries.process': {
      post: {
        summary: 'Process delivery or pickup',
        description: 'Unified endpoint to process delivery or pickup operations (Mutation)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['delivery', 'pickup'],
                    description: 'Type of operation to process'
                  },
                  data: {
                    oneOf: [
                      {
                        // Delivery data schema
                        type: 'object',
                        properties: {
                          order_id: { type: 'string', format: 'uuid' },
                          customer_id: { type: 'string', format: 'uuid' },
                          delivery_address_id: { type: 'string', format: 'uuid' },
                          truck_id: { type: 'string', format: 'uuid' },
                          delivery_items: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                product_id: { type: 'string', format: 'uuid' },
                                quantity_delivered: { type: 'integer', minimum: 0 },
                                quantity_returned: { type: 'integer', minimum: 0 },
                                unit_price: { type: 'number' }
                              },
                              required: ['product_id', 'quantity_delivered']
                            }
                          },
                          driver_name: { type: 'string' },
                          driver_notes: { type: 'string' },
                          delivery_latitude: { type: 'number' },
                          delivery_longitude: { type: 'number' }
                        },
                        required: ['customer_id', 'truck_id', 'delivery_items']
                      },
                      {
                        // Pickup data schema
                        type: 'object',
                        properties: {
                          customer_id: { type: 'string', format: 'uuid' },
                          pickup_address_id: { type: 'string', format: 'uuid' },
                          truck_id: { type: 'string', format: 'uuid' },
                          pickup_items: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                product_id: { type: 'string', format: 'uuid' },
                                quantity_picked_up: { type: 'integer', minimum: 0 },
                                condition: { type: 'string', enum: ['good', 'damaged', 'needs_repair'] }
                              },
                              required: ['product_id', 'quantity_picked_up']
                            }
                          },
                          driver_name: { type: 'string' },
                          driver_notes: { type: 'string' },
                          pickup_latitude: { type: 'number' },
                          pickup_longitude: { type: 'number' }
                        },
                        required: ['customer_id', 'truck_id', 'pickup_items']
                      }
                    ]
                  }
                },
                required: ['type', 'data']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Operation processed successfully',
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
                            delivery_id: { type: 'string', format: 'uuid' },
                            pickup_id: { type: 'string', format: 'uuid' },
                            delivery_number: { type: 'string' },
                            pickup_number: { type: 'string' },
                            message: { type: 'string' }
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

    '/api/v1/trpc/deliveries.complete': {
      post: {
        summary: 'Complete delivery or pickup',
        description: 'Mark delivery or pickup as completed with proof (Mutation)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['delivery', 'pickup'],
                    description: 'Type of operation to complete'
                  },
                  data: {
                    oneOf: [
                      {
                        type: 'object',
                        properties: {
                          delivery_id: { type: 'string', format: 'uuid' },
                          customer_signature: { type: 'string' },
                          photo_proof: { type: 'string' },
                          delivery_latitude: { type: 'number' },
                          delivery_longitude: { type: 'number' }
                        },
                        required: ['delivery_id']
                      },
                      {
                        type: 'object',
                        properties: {
                          pickup_id: { type: 'string', format: 'uuid' },
                          customer_signature: { type: 'string' },
                          photo_proof: { type: 'string' },
                          pickup_latitude: { type: 'number' },
                          pickup_longitude: { type: 'number' }
                        },
                        required: ['pickup_id']
                      }
                    ]
                  }
                },
                required: ['type', 'data']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Operation completed successfully',
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
                            message: { type: 'string' }
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

    '/api/v1/trpc/deliveries.listPickups': {
      get: {
        summary: 'List pickups',
        description: 'Get paginated list of pickups with filtering (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter pickups by customer ID'
                  },
                  truck_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Filter pickups by truck ID'
                  },
                  status: { 
                    type: 'string', 
                    enum: ['pending', 'in_transit', 'completed', 'failed', 'cancelled'],
                    description: 'Filter pickups by status'
                  },
                  date_from: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Filter pickups from this date'
                  },
                  date_to: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Filter pickups to this date'
                  },
                  page: { 
                    type: 'integer', 
                    minimum: 1, 
                    default: 1,
                    description: 'Page number for pagination'
                  },
                  limit: { 
                    type: 'integer', 
                    minimum: 1, 
                    maximum: 100, 
                    default: 20,
                    description: 'Number of items per page'
                  }
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pickups retrieved successfully',
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
                            pickups: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', format: 'uuid' },
                                  pickup_number: { type: 'string' },
                                  customer_id: { type: 'string', format: 'uuid' },
                                  truck_id: { type: 'string', format: 'uuid' },
                                  status: { type: 'string' },
                                  pickup_date: { type: 'string', format: 'date-time' },
                                  created_at: { type: 'string', format: 'date-time' }
                                }
                              }
                            },
                            total: { type: 'integer' },
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            totalPages: { type: 'integer' }
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

    '/api/v1/trpc/deliveries.getCustomerBalance': {
      get: {
        summary: 'Get customer cylinder balance',
        description: 'Get customer cylinder balance for tracking inventory (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Customer ID to get balance for'
                  },
                  product_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Optional product ID to filter balance'
                  }
                },
                required: ['customer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer balance retrieved successfully',
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
                              product_id: { type: 'string', format: 'uuid' },
                              product_name: { type: 'string' },
                              full_cylinders: { type: 'integer' },
                              empty_cylinders: { type: 'integer' },
                              total_cylinders: { type: 'integer' }
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

    '/api/v1/trpc/deliveries.getDelivery': {
      get: {
        summary: 'Get delivery details',
        description: 'Get detailed information about a specific delivery (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  delivery_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the delivery to get details for'
                  }
                },
                required: ['delivery_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Delivery details retrieved successfully',
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
                            id: { type: 'string', format: 'uuid' },
                            delivery_number: { type: 'string' },
                            customer: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                phone: { type: 'string' },
                                email: { type: 'string' }
                              }
                            },
                            delivery_address: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                line1: { type: 'string' },
                                line2: { type: 'string' },
                                city: { type: 'string' },
                                state: { type: 'string' },
                                postal_code: { type: 'string' }
                              }
                            },
                            truck: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                fleet_number: { type: 'string' },
                                driver_name: { type: 'string' }
                              }
                            },
                            items: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  product_id: { type: 'string' },
                                  quantity_delivered: { type: 'integer' },
                                  unit_price: { type: 'number' },
                                  product: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      name: { type: 'string' },
                                      sku: { type: 'string' }
                                    }
                                  }
                                }
                              }
                            },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Delivery not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },

    '/api/v1/trpc/deliveries.getPickup': {
      get: {
        summary: 'Get pickup details',
        description: 'Get detailed information about a specific pickup (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  pickup_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the pickup to get details for'
                  }
                },
                required: ['pickup_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pickup details retrieved successfully',
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
                            id: { type: 'string', format: 'uuid' },
                            pickup_number: { type: 'string' },
                            customer: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                phone: { type: 'string' },
                                email: { type: 'string' }
                              }
                            },
                            pickup_address: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                line1: { type: 'string' },
                                line2: { type: 'string' },
                                city: { type: 'string' },
                                state: { type: 'string' },
                                postal_code: { type: 'string' }
                              }
                            },
                            truck: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                fleet_number: { type: 'string' },
                                driver_name: { type: 'string' }
                              }
                            },
                            items: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  product_id: { type: 'string' },
                                  quantity_picked_up: { type: 'integer' },
                                  condition: { type: 'string' },
                                  product: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      name: { type: 'string' },
                                      sku: { type: 'string' }
                                    }
                                  }
                                }
                              }
                            },
                            status: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Pickup not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      }
    },

    '/api/v1/trpc/deliveries.getCustomerTransactions': {
      get: {
        summary: 'Get customer transaction history',
        description: 'Get paginated transaction history for a customer (Query)',
        tags: ['deliveries'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Customer ID to get transactions for'
                  },
                  product_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Optional product ID to filter transactions'
                  },
                  date_from: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Filter transactions from this date'
                  },
                  date_to: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Filter transactions to this date'
                  },
                  page: { 
                    type: 'integer', 
                    minimum: 1, 
                    default: 1,
                    description: 'Page number for pagination'
                  },
                  limit: { 
                    type: 'integer', 
                    minimum: 1, 
                    maximum: 100, 
                    default: 20,
                    description: 'Number of items per page'
                  }
                },
                required: ['customer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer transactions retrieved successfully',
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
                            transactions: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string', format: 'uuid' },
                                  transaction_type: { type: 'string' },
                                  quantity: { type: 'integer' },
                                  transaction_date: { type: 'string', format: 'date-time' },
                                  product: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      name: { type: 'string' },
                                      sku: { type: 'string' }
                                    }
                                  }
                                }
                              }
                            },
                            total: { type: 'integer' },
                            page: { type: 'integer' },
                            limit: { type: 'integer' },
                            totalPages: { type: 'integer' }
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
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { 
                    type: 'string', 
                    enum: ['today', 'week', 'month', 'quarter', 'year'], 
                    default: 'month',
                    description: 'Time period for dashboard statistics'
                  },
                },
              },
            },
          },
        },
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
                            period: { type: 'string' },
                            totalOrders: { type: 'number' },
                            totalRevenue: { type: 'number' },
                            avgOrderValue: { type: 'number' },
                            newCustomers: { type: 'number' },
                            uniqueCustomers: { type: 'number' },
                            statusCounts: { type: 'object' },
                            totalCustomers: { type: 'number' },
                            activeCustomers: { type: 'number' },
                            totalProducts: { type: 'number' },
                            activeProducts: { type: 'number' },
                            totalWarehouses: { type: 'number' },
                            totalCylinders: { type: 'number' },
                            lowStockProducts: { type: 'number' },
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

    // Analytics endpoints
    '/api/v1/trpc/analytics.getRevenueAnalytics': {
      get: {
        summary: 'Revenue analytics',
        description: 'Get revenue analytics with time-series data (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { 
                    type: 'string', 
                    enum: ['week', 'month', 'quarter', 'year'], 
                    default: 'month',
                    description: 'Time period for analytics'
                  },
                  breakdown_by: { 
                    type: 'string', 
                    enum: ['day', 'week', 'month'], 
                    default: 'day',
                    description: 'Breakdown granularity for the data'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Revenue analytics retrieved successfully',
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
                            period: { type: 'string' },
                            breakdown_by: { type: 'string' },
                            totalRevenue: { type: 'number' },
                            totalOrders: { type: 'number' },
                            chartData: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  date: { type: 'string' },
                                  revenue: { type: 'number' },
                                  orders: { type: 'number' },
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

    '/api/v1/trpc/analytics.getOrderAnalytics': {
      get: {
        summary: 'Order analytics',
        description: 'Get order analytics with grouping options (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { 
                    type: 'string', 
                    enum: ['week', 'month', 'quarter', 'year'], 
                    default: 'month',
                    description: 'Time period for analytics'
                  },
                  group_by: { 
                    type: 'string', 
                    enum: ['status', 'customer', 'product'],
                    description: 'Group data by specified field'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order analytics retrieved successfully',
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
                            period: { type: 'string' },
                            group_by: { type: 'string' },
                            totalOrders: { type: 'number' },
                            totalRevenue: { type: 'number' },
                            statusBreakdown: { type: 'object' },
                            groupedData: {
                              type: 'array',
                              items: { type: 'object' },
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

    '/api/v1/trpc/analytics.getCustomerAnalytics': {
      get: {
        summary: 'Customer analytics',
        description: 'Get customer analytics with breakdown options (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { 
                    type: 'string', 
                    enum: ['week', 'month', 'quarter', 'year'], 
                    default: 'month',
                    description: 'Time period for analytics'
                  },
                  breakdown_by: { 
                    type: 'string', 
                    enum: ['new', 'returning', 'top_spending'], 
                    default: 'new',
                    description: 'Breakdown type for customer analytics'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer analytics retrieved successfully',
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
                            period: { type: 'string' },
                            breakdown_by: { type: 'string' },
                            totalNewCustomers: { type: 'number' },
                            customersByDate: { type: 'object' },
                            customers: { type: 'array', items: { type: 'object' } },
                            topCustomers: { type: 'array', items: { type: 'object' } },
                            totalReturningCustomers: { type: 'number' },
                            returningCustomers: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/analytics.getInventoryAnalytics': {
      get: {
        summary: 'Inventory analytics',
        description: 'Get inventory analytics with warehouse breakdown (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Inventory analytics retrieved successfully',
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
                            totalProducts: { type: 'number' },
                            totalStockValue: { type: 'number' },
                            lowStockCount: { type: 'number' },
                            outOfStockCount: { type: 'number' },
                            lowStockItems: { type: 'array', items: { type: 'object' } },
                            outOfStockItems: { type: 'array', items: { type: 'object' } },
                            warehouseBreakdown: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/analytics.getComprehensiveOrderAnalytics': {
      get: {
        summary: 'Comprehensive order analytics',
        description: 'Get comprehensive order analytics for date range (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  start_date: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Start date for analytics range'
                  },
                  end_date: { 
                    type: 'string', 
                    format: 'date',
                    description: 'End date for analytics range'
                  },
                },
                required: ['start_date', 'end_date'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Comprehensive order analytics retrieved successfully',
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
                            summary: { type: 'object' },
                            orders_by_status: { type: 'array', items: { type: 'object' } },
                            daily_trends: { type: 'array', items: { type: 'object' } },
                            top_customers: { type: 'array', items: { type: 'object' } },
                            top_products: { type: 'array', items: { type: 'object' } },
                            delivery_performance: { type: 'object' },
                            regional_breakdown: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/analytics.getOrderStats': {
      get: {
        summary: 'Order statistics',
        description: 'Get order statistics for a period (Query)',
        tags: ['analytics'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  period: { 
                    type: 'string', 
                    enum: ['today', 'week', 'month', 'quarter', 'year'], 
                    default: 'month',
                    description: 'Time period for order statistics'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order statistics retrieved successfully',
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
                            draft_orders: { type: 'number' },
                            confirmed_orders: { type: 'number' },
                            scheduled_orders: { type: 'number' },
                            en_route_orders: { type: 'number' },
                            delivered_orders: { type: 'number' },
                            invoiced_orders: { type: 'number' },
                            cancelled_orders: { type: 'number' },
                            todays_deliveries: { type: 'number' },
                            overdue_orders: { type: 'number' },
                            total_revenue: { type: 'number' },
                            avg_order_value: { type: 'number' },
                            orders_this_month: { type: 'number' },
                            orders_last_month: { type: 'number' },
                            revenue_this_month: { type: 'number' },
                            revenue_last_month: { type: 'number' },
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
    '/api/v1/trpc/admin.testRLSPolicies': {
      get: {
        summary: 'Test RLS policies',
        description: 'Test Row Level Security policies (Query)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'RLS policies tested successfully',
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
                            results: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/admin.getRLSViolations': {
      get: {
        summary: 'Get RLS violations',
        description: 'Get Row Level Security violations (Query)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  since: { 
                    type: 'string', 
                    format: 'date-time',
                    description: 'Get violations since this timestamp'
                  },
                  limit: { 
                    type: 'integer', 
                    minimum: 1, 
                    maximum: 1000, 
                    default: 100,
                    description: 'Maximum number of violations to return'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'RLS violations retrieved successfully',
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
                            violations: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/admin.validateRLSStatus': {
      get: {
        summary: 'Validate RLS status',
        description: 'Validate Row Level Security status (Query)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'RLS status validated successfully',
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
                            allEnabled: { type: 'boolean' },
                            missingRLS: { type: 'array', items: { type: 'string' } },
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

    '/api/v1/trpc/admin.getSystemStats': {
      get: {
        summary: 'System statistics',
        description: 'Get system statistics (Query)',
        tags: ['admin'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'System statistics retrieved successfully',
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
                            totalCustomers: { type: 'number' },
                            totalOrders: { type: 'number' },
                            activeOrders: { type: 'number' },
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
    // Additional Orders endpoints
    '/api/v1/trpc/orders.updateStatus': {
      post: {
        summary: 'Update order status',
        description: 'Update order status with workflow validation and business rules (Mutation)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Unique identifier of the order to update',
                    example: '550e8400-e29b-41d4-a716-446655440000'
                  },
                  new_status: { 
                    type: 'string', 
                    enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled'],
                    description: 'New status for the order',
                    example: 'confirmed'
                  },
                  scheduled_date: { 
                    type: 'string', 
                    format: 'date-time',
                    description: 'Scheduled delivery date (required when changing to scheduled status)',
                    example: '2025-01-20T14:30:00.000Z'
                  },
                  reason: { 
                    type: 'string',
                    description: 'Reason for the status change (optional)',
                    example: 'Customer requested earlier delivery'
                  },
                  metadata: { 
                    type: 'object',
                    description: 'Additional metadata for the status change',
                    example: {
                      "driver_notes": "Confirmed with customer via phone",
                      "delivery_preference": "morning"
                    }
                  },
                },
                required: ['order_id', 'new_status'],
                example: {
                  "order_id": "550e8400-e29b-41d4-a716-446655440000",
                  "new_status": "scheduled",
                  "scheduled_date": "2025-01-20T14:30:00.000Z",
                  "reason": "Customer confirmed availability",
                  "metadata": {
                    "priority_upgrade": false,
                    "driver_notes": "Use back entrance"
                  }
                }
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order status updated successfully',
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
                          description: 'Updated order with new status',
                          properties: {
                            id: { type: 'string', format: 'uuid' },
                            status: { 
                              type: 'string',
                              enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled']
                            },
                            scheduled_date: { type: 'string', format: 'date-time' },
                            updated_at: { type: 'string', format: 'date-time' },
                            customer_id: { type: 'string', format: 'uuid' },
                            total_amount: { type: 'number' }
                          }
                        },
                      },
                    },
                  },
                  example: {
                    "result": {
                      "data": {
                        "id": "550e8400-e29b-41d4-a716-446655440000",
                        "status": "scheduled",
                        "scheduled_date": "2025-01-20T14:30:00.000Z",
                        "updated_at": "2025-01-15T10:30:00.000Z",
                        "customer_id": "123e4567-e89b-12d3-a456-426614174000",
                        "total_amount": 136.50
                      }
                    }
                  }
                },
              },
            },
          },
          '400': {
            description: 'Bad Request - Invalid status transition or validation errors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'BAD_REQUEST' },
                        message: { type: 'string' },
                        transition_error: { type: 'string' },
                        allowed_transitions: { 
                          type: 'array',
                          items: { type: 'string' }
                        },
                        details: { 
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                examples: {
                  invalid_transition: {
                    summary: 'Invalid status transition',
                    value: {
                      "error": {
                        "code": "BAD_REQUEST",
                        "message": "Invalid status transition from 'delivered' to 'confirmed'",
                        "transition_error": "Cannot move backwards in order workflow",
                        "allowed_transitions": ["invoiced"],
                        "details": [
                          "Current status: delivered",
                          "Attempted transition: confirmed",
                          "Valid next statuses: invoiced"
                        ]
                      }
                    }
                  },
                  missing_scheduled_date: {
                    summary: 'Missing scheduled date for scheduled status',
                    value: {
                      "error": {
                        "code": "BAD_REQUEST",
                        "message": "Scheduled date is required when changing status to 'scheduled'",
                        "details": [
                          "Status change requires additional data",
                          "Field: scheduled_date",
                          "Required for status: scheduled"
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized - Invalid or missing authentication token',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  "error": {
                    "code": "UNAUTHORIZED",
                    "message": "Authentication required"
                  }
                }
              }
            }
          },
          '403': {
            description: 'Forbidden - Insufficient permissions for status change',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
                example: {
                  "error": {
                    "code": "FORBIDDEN",
                    "message": "You don't have permission to change order status to 'invoiced'"
                  }
                }
              }
            }
          },
          '404': {
            description: 'Not Found - Order not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'NOT_FOUND' },
                        message: { type: 'string' },
                        resource: { type: 'string' },
                        resource_id: { type: 'string' }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "NOT_FOUND",
                      "message": "Order not found",
                      "resource": "order",
                      "resource_id": "550e8400-e29b-41d4-a716-446655440000"
                    }
                  }
                }
              }
            }
          },
          '409': {
            description: 'Conflict - Business rule violations or inventory constraints',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'CONFLICT' },
                        message: { type: 'string' },
                        conflict_type: { type: 'string' },
                        details: { 
                          type: 'array',
                          items: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                examples: {
                  insufficient_inventory: {
                    summary: 'Insufficient inventory for confirmation',
                    value: {
                      "error": {
                        "code": "CONFLICT",
                        "message": "Cannot confirm order - insufficient inventory",
                        "conflict_type": "inventory_shortage",
                        "details": [
                          "Product: LPG-50KG",
                          "Required: 5 units",
                          "Available: 2 units",
                          "Warehouse: Main Warehouse"
                        ]
                      }
                    }
                  },
                  concurrent_modification: {
                    summary: 'Order modified by another user',
                    value: {
                      "error": {
                        "code": "CONFLICT",
                        "message": "Order has been modified by another user",
                        "conflict_type": "concurrent_modification",
                        "details": [
                          "Order updated at: 2025-01-15T10:25:00Z",
                          "Your last refresh: 2025-01-15T10:20:00Z",
                          "Please refresh and try again"
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          '422': {
            description: 'Unprocessable Entity - Order validation errors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'UNPROCESSABLE_ENTITY' },
                        message: { type: 'string' },
                        validation_errors: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              field: { type: 'string' },
                              message: { type: 'string' },
                              current_value: { type: 'string' }
                            }
                          }
                        }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "UNPROCESSABLE_ENTITY",
                      "message": "Order validation failed for status transition",
                      "validation_errors": [
                        {
                          "field": "delivery_address",
                          "message": "Delivery address is required for scheduled orders",
                          "current_value": "null"
                        },
                        {
                          "field": "order_lines",
                          "message": "Order must have at least one item",
                          "current_value": "[]"
                        }
                      ]
                    }
                  }
                }
              }
            }
          },
          '500': {
            description: 'Internal Server Error - System error during status update',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: {
                      type: 'object',
                      properties: {
                        code: { type: 'string', example: 'INTERNAL_SERVER_ERROR' },
                        message: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        request_id: { type: 'string' }
                      }
                    }
                  },
                  example: {
                    "error": {
                      "code": "INTERNAL_SERVER_ERROR",
                      "message": "Failed to update order status",
                      "timestamp": "2025-01-15T10:30:00.000Z",
                      "request_id": "req_123456789"
                    }
                  }
                }
              }
            }
          }
        },
      },
    },

    '/api/v1/trpc/orders.getOverdue': {
      get: {
        summary: 'Get overdue orders',
        description: 'Get orders that are overdue for delivery (Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  days_overdue_min: { 
                    type: 'integer', 
                    minimum: 0, 
                    default: 1,
                    description: 'Minimum number of days overdue to filter by'
                  },
                  include_cancelled: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Whether to include cancelled orders in the results'
                  },
                  priority_filter: { 
                    type: 'string', 
                    enum: ['low', 'normal', 'high', 'urgent'],
                    description: 'Filter by order priority level'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Overdue orders retrieved successfully',
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
                          items: { type: 'object' },
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

    '/api/v1/trpc/orders.getDeliveryCalendar': {
      get: {
        summary: 'Get delivery calendar',
        description: 'Get delivery schedule calendar with logistics optimization (Query)',
        tags: ['orders'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date_from: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Start date for the delivery calendar (YYYY-MM-DD)'
                  },
                  date_to: { 
                    type: 'string', 
                    format: 'date',
                    description: 'End date for the delivery calendar (YYYY-MM-DD)'
                  },
                  delivery_area: { 
                    type: 'string',
                    description: 'Filter by specific delivery area'
                  },
                  truck_capacity_filter: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Apply truck capacity constraints in the calendar'
                  },
                  optimize_routes: { 
                    type: 'boolean', 
                    default: false,
                    description: 'Apply route optimization to the delivery schedule'
                  }
                },
                required: ['date_from', 'date_to']
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Delivery calendar retrieved successfully',
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
                            calendar: { type: 'array', items: { type: 'object' } },
                            metrics: { type: 'object' },
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

    '/api/v1/trpc/orders.allocateToTruck': {
      post: {
        summary: 'Allocate order to truck',
        description: 'Allocate order to a truck for delivery (Mutation)',
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
                  truck_id: { type: 'string', format: 'uuid' },
                  allocation_date: { type: 'string', format: 'date' },
                  force_allocation: { type: 'boolean', default: false },
                },
                required: ['order_id', 'allocation_date'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order allocated successfully',
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
                            allocation_id: { type: 'string' },
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

    '/api/v1/trpc/orders.validateOrderPricing': {
      post: {
        summary: 'Validate order pricing',
        description: 'Validate pricing for order lines (Mutation)',
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
                  order_lines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number', minimum: 1 },
                        expected_price: { type: 'number', minimum: 0 },
                        price_list_id: { type: 'string', format: 'uuid' },
                      },
                      required: ['product_id', 'quantity'],
                    },
                    minItems: 1,
                  },
                },
                required: ['customer_id', 'order_lines'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order pricing validated successfully',
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
                            valid: { type: 'boolean' },
                            pricing_results: { type: 'array', items: { type: 'object' } },
                            warnings: { type: 'array', items: { type: 'string' } },
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

    // Customer Address Management endpoints
    '/api/v1/trpc/customers.getAddresses': {
      get: {
        summary: 'Get customer addresses',
        description: 'Get all addresses for a customer (Query)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                },
                required: ['customer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer addresses retrieved successfully',
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
                              id: { type: 'string', format: 'uuid' },
                              label: { type: 'string' },
                              line1: { type: 'string' },
                              line2: { type: 'string' },
                              city: { type: 'string' },
                              state: { type: 'string' },
                              postal_code: { type: 'string' },
                              country: { type: 'string' },
                              is_primary: { type: 'boolean' },
                              delivery_window_start: { type: 'string' },
                              delivery_window_end: { type: 'string' },
                              instructions: { type: 'string' },
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

    '/api/v1/trpc/customers.createAddress': {
      post: {
        summary: 'Create customer address',
        description: 'Create new address for customer (Mutation)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                  label: { type: 'string' },
                  line1: { type: 'string' },
                  line2: { type: 'string' },
                  city: { type: 'string' },
                  state: { type: 'string' },
                  postal_code: { type: 'string' },
                  country: { type: 'string', minLength: 2 },
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  delivery_window_start: { type: 'string' },
                  delivery_window_end: { type: 'string' },
                  instructions: { type: 'string' },
                },
                required: ['customer_id', 'line1', 'city', 'country'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Address created successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/customers.getOrderHistory': {
      get: {
        summary: 'Get customer order history',
        description: 'Get paginated order history for customer (Query)',
        tags: ['customers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                  limit: { type: 'integer', minimum: 1, maximum: 1000, default: 50 },
                  offset: { type: 'integer', minimum: 0, default: 0 },
                  status: { type: 'string', enum: ['draft', 'confirmed', 'scheduled', 'en_route', 'delivered', 'invoiced', 'cancelled'] },
                },
                required: ['customer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Customer order history retrieved successfully',
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
                            orders: { type: 'array', items: { type: 'object' } },
                            totalCount: { type: 'integer' },
                            hasMore: { type: 'boolean' },
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

    // Product Management endpoints
    '/api/v1/trpc/products.getVariants': {
      get: {
        summary: 'Get product variants',
        description: 'Get variants for a parent product (Query)',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  parent_product_id: { type: 'string', format: 'uuid' },
                },
                required: ['parent_product_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product variants retrieved successfully',
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
                          items: { type: 'object' },
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

    '/api/v1/trpc/products.createVariant': {
      post: {
        summary: 'Create product variant',
        description: 'Create new product variant (Mutation)',
        tags: ['products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  parent_product_id: { type: 'string', format: 'uuid' },
                  variant_name: { type: 'string' },
                  sku: { type: 'string' },
                  capacity_kg: { type: 'number', minimum: 0 },
                  tare_weight_kg: { type: 'number', minimum: 0 },
                  valve_type: { type: 'string' },
                },
                required: ['parent_product_id', 'variant_name', 'sku'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Product variant created successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/products.validateSku': {
      post: {
        summary: 'Validate product SKU',
        description: 'Validate SKU for uniqueness (Mutation)',
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
                  exclude_id: { type: 'string', format: 'uuid' },
                },
                required: ['sku'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'SKU validation completed',
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
                            valid: { type: 'boolean' },
                            errors: { type: 'array', items: { type: 'string' } },
                            warnings: { type: 'array', items: { type: 'string' } },
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

    // Inventory Management endpoints
    '/api/v1/trpc/inventory.getByWarehouse': {
      get: {
        summary: 'Get inventory by warehouse',
        description: 'Get inventory for specific warehouse (Query)',
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
                },
                required: ['warehouse_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Warehouse inventory retrieved successfully',
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
                          items: { type: 'object' },
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

    '/api/v1/trpc/inventory.transferStock': {
      post: {
        summary: 'Transfer stock between warehouses',
        description: 'Transfer inventory between warehouses (Mutation)',
        tags: ['inventory'],
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
                  product_id: { type: 'string', format: 'uuid' },
                  qty_full: { type: 'integer', minimum: 0 },
                  qty_empty: { type: 'integer', minimum: 0 },
                  notes: { type: 'string' },
                },
                required: ['from_warehouse_id', 'to_warehouse_id', 'product_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock transferred successfully',
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
                            transfer_id: { type: 'string' },
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

    '/api/v1/trpc/inventory.getLowStock': {
      get: {
        summary: 'Get low stock items',
        description: 'Get items with low stock levels (Query)',
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
                  threshold_days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Low stock items retrieved successfully',
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
                          items: { type: 'object' },
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

    // Pricing Management endpoints
    '/api/v1/trpc/pricing.createPriceList': {
      post: {
        summary: 'Create price list',
        description: 'Create new price list (Mutation)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 255 },
                  description: { type: 'string' },
                  currency_code: { type: 'string', length: 3, default: 'KES' },
                  start_date: { type: 'string', format: 'date' },
                  end_date: { type: 'string', format: 'date' },
                  is_default: { type: 'boolean', default: false },
                },
                required: ['name', 'start_date'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Price list created successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/pricing.getPriceListItems': {
      get: {
        summary: 'Get price list items',
        description: 'Get items in a price list (Query)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  price_list_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the price list to get items for'
                  },
                  search: { 
                    type: 'string',
                    description: 'Search term for item names'
                  },
                  page: { 
                    type: 'integer', 
                    minimum: 1, 
                    default: 1,
                    description: 'Page number for pagination'
                  },
                  limit: { 
                    type: 'integer', 
                    minimum: 1, 
                    maximum: 100, 
                    default: 50,
                    description: 'Number of items per page'
                  },
                },
                required: ['price_list_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Price list items retrieved successfully',
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
                            items: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/pricing.bulkAddProducts': {
      post: {
        summary: 'Bulk add products to price list',
        description: 'Add multiple products to price list with bulk pricing (Mutation)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  price_list_id: { type: 'string', format: 'uuid' },
                  product_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
                  pricing_method: { type: 'string', enum: ['fixed', 'copy_from_list', 'markup', 'cost_plus'] },
                  unit_price: { type: 'number', minimum: 0 },
                  source_price_list_id: { type: 'string', format: 'uuid' },
                  markup_percentage: { type: 'number' },
                  min_qty: { type: 'integer', minimum: 1 },
                  surcharge_pct: { type: 'number', minimum: 0, maximum: 100 },
                },
                required: ['price_list_id', 'product_ids', 'pricing_method'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Products added to price list successfully',
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
                            items: { type: 'array', items: { type: 'object' } },
                            errors: { type: 'array', items: { type: 'object' } },
                            successCount: { type: 'integer' },
                            errorCount: { type: 'integer' },
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

    '/api/v1/trpc/pricing.calculate': {
      post: {
        summary: 'Calculate dynamic pricing',
        description: 'Calculate pricing for customer and items (Mutation)',
        tags: ['pricing'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customer_id: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'number', minimum: 1 },
                      },
                      required: ['product_id', 'quantity'],
                    },
                  },
                },
                required: ['customer_id', 'items'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Pricing calculated successfully',
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
                            items: { type: 'array', items: { type: 'object' } },
                            totals: { type: 'object' },
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

    // Payment Management endpoints
    '/api/v1/trpc/payments.getByOrderId': {
      get: {
        summary: 'Get payments by order ID',
        description: 'Get all payments for a specific order (Query)',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the order to get payments for'
                  },
                  include_summary: { 
                    type: 'boolean', 
                    default: true,
                    description: 'Include payment summary information'
                  },
                },
                required: ['order_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Order payments retrieved successfully',
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
                            order: { type: 'object' },
                            payments: { type: 'array', items: { type: 'object' } },
                            summary: { type: 'object' },
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

    '/api/v1/trpc/payments.updateStatus': {
      put: {
        summary: 'Update payment status',
        description: 'Update payment status and details (Mutation)',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  payment_id: { type: 'string', format: 'uuid' },
                  payment_status: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] },
                  transaction_id: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['payment_id', 'payment_status'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment status updated successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/payments.getSummary': {
      get: {
        summary: 'Get payment summary',
        description: 'Get payment summary statistics (Query)',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date_from: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Start date for payment summary'
                  },
                  date_to: { 
                    type: 'string', 
                    format: 'date',
                    description: 'End date for payment summary'
                  },
                  payment_method: { 
                    type: 'string', 
                    enum: ['Cash', 'Mpesa', 'Card'],
                    description: 'Filter by payment method'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Payment summary retrieved successfully',
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
                            summary: { type: 'object' },
                            by_method: { type: 'object' },
                            by_status: { type: 'object' },
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

    '/api/v1/trpc/payments.getOverdueOrders': {
      get: {
        summary: 'Get overdue payment orders',
        description: 'Get orders with overdue payments (Query)',
        tags: ['payments'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  days_overdue_min: { 
                    type: 'integer', 
                    minimum: 0, 
                    default: 1,
                    description: 'Minimum number of days overdue'
                  },
                  limit: { 
                    type: 'integer', 
                    minimum: 1, 
                    maximum: 100, 
                    default: 50,
                    description: 'Maximum number of orders to return'
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Overdue orders retrieved successfully',
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
                            orders: { type: 'array', items: { type: 'object' } },
                            summary: { type: 'object' },
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

    // Truck Management endpoints
    '/api/v1/trpc/trucks.getById': {
      get: {
        summary: 'Get truck details',
        description: 'Get detailed information about a specific truck (Query)',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  truck_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the truck to get details for'
                  },
                },
                required: ['truck_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Truck details retrieved successfully',
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
                            truck: { type: 'object' },
                            current_inventory: { type: 'array', items: { type: 'object' } },
                            current_route: { type: 'object' },
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

    '/api/v1/trpc/trucks.getAllocations': {
      get: {
        summary: 'Get truck allocations',
        description: 'Get truck allocations for a specific date (Query)',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date: { 
                    type: 'string', 
                    format: 'date',
                    description: 'Date to get allocations for'
                  },
                  truck_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'Optional truck ID to filter allocations'
                  },
                },
                required: ['date'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Truck allocations retrieved successfully',
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
                          items: { type: 'object' },
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

    '/api/v1/trpc/trucks.loadInventory': {
      post: {
        summary: 'Load inventory onto truck',
        description: 'Load items from warehouse onto truck (Mutation)',
        tags: ['trucks'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  truck_id: { type: 'string', format: 'uuid' },
                  warehouse_id: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        qty_full: { type: 'integer', minimum: 0 },
                        qty_empty: { type: 'integer', minimum: 0 },
                      },
                      required: ['product_id'],
                    },
                  },
                },
                required: ['truck_id', 'warehouse_id', 'items'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Inventory loaded successfully',
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
                            loaded_items: { type: 'array', items: { type: 'object' } },
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

    // Transfer Management endpoints
    '/api/v1/trpc/transfers.getById': {
      get: {
        summary: 'Get transfer details',
        description: 'Get detailed information about a specific transfer (Query)',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transfer_id: { 
                    type: 'string', 
                    format: 'uuid',
                    description: 'ID of the transfer to get details for'
                  },
                },
                required: ['transfer_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer details retrieved successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/transfers.validate': {
      post: {
        summary: 'Validate transfer request',
        description: 'Validate transfer request before creation (Mutation)',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  source_warehouse_id: { type: 'string', format: 'uuid' },
                  destination_warehouse_id: { type: 'string', format: 'uuid' },
                  transfer_date: { type: 'string', format: 'date' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity_to_transfer: { type: 'number', minimum: 1 },
                      },
                      required: ['product_id', 'quantity_to_transfer'],
                    },
                  },
                },
                required: ['source_warehouse_id', 'destination_warehouse_id', 'transfer_date', 'items'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer validation completed',
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
                            is_valid: { type: 'boolean' },
                            errors: { type: 'array', items: { type: 'string' } },
                            warnings: { type: 'array', items: { type: 'string' } },
                            blocked_items: { type: 'array', items: { type: 'string' } },
                            total_weight_kg: { type: 'number' },
                            estimated_cost: { type: 'number' },
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

    '/api/v1/trpc/transfers.updateStatus': {
      post: {
        summary: 'Update transfer status',
        description: 'Update transfer status and completion details (Mutation)',
        tags: ['transfers'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  transfer_id: { type: 'string', format: 'uuid' },
                  new_status: { type: 'string', enum: ['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled'] },
                  notes: { type: 'string' },
                  completed_items: { type: 'array', items: { type: 'string', format: 'uuid' } },
                },
                required: ['transfer_id', 'new_status'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Transfer status updated successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    // Warehouse Management endpoints
    '/api/v1/trpc/warehouses.getById': {
      post: {
        summary: 'Get warehouse details',
        description: 'Get detailed information about a specific warehouse (Query)',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  warehouse_id: { type: 'string', format: 'uuid' },
                },
                required: ['warehouse_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Warehouse details retrieved successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/warehouses.getStats': {
      post: {
        summary: 'Get warehouse statistics',
        description: 'Get warehouse system statistics (Query)',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Warehouse statistics retrieved successfully',
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
                            total: { type: 'number' },
                            total_capacity: { type: 'number' },
                            average_capacity: { type: 'number' },
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

    '/api/v1/trpc/warehouses.getOptions': {
      post: {
        summary: 'Get warehouse options',
        description: 'Get simplified warehouse list for UI dropdowns (Query)',
        tags: ['warehouses'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {},
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Warehouse options retrieved successfully',
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
                              id: { type: 'string', format: 'uuid' },
                              name: { type: 'string' },
                              capacity_cylinders: { type: 'number' },
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

    // Stock Movement endpoints
    '/api/v1/trpc/stockMovements.get': {
      get: {
        summary: 'Get stock movement details',
        description: 'Get detailed information about a specific stock movement (Query)',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  movement_id: { type: 'string', format: 'uuid' },
                },
                required: ['movement_id'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock movement details retrieved successfully',
            content: {
              'application/json': {
                schema: {
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
          },
        },
      },
    },

    '/api/v1/trpc/stockMovements.createBulk': {
      post: {
        summary: 'Create bulk stock movements',
        description: 'Create multiple stock movements in one operation (Mutation)',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  movements: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        warehouse_id: { type: 'string', format: 'uuid' },
                        truck_id: { type: 'string', format: 'uuid' },
                        order_id: { type: 'string', format: 'uuid' },
                        movement_type: { type: 'string', enum: ['delivery', 'pickup', 'refill', 'exchange', 'transfer', 'adjustment'] },
                        qty_full_in: { type: 'integer', minimum: 0 },
                        qty_full_out: { type: 'integer', minimum: 0 },
                        qty_empty_in: { type: 'integer', minimum: 0 },
                        qty_empty_out: { type: 'integer', minimum: 0 },
                        movement_date: { type: 'string', format: 'date' },
                        reference_number: { type: 'string' },
                        notes: { type: 'string' },
                      },
                      required: ['product_id', 'movement_type', 'movement_date'],
                    },
                  },
                },
                required: ['movements'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Bulk stock movements created successfully',
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
                          items: { type: 'object' },
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

    '/api/v1/trpc/stockMovements.getSummary': {
      get: {
        summary: 'Get stock movement summary',
        description: 'Get summary of stock movements with breakdowns (Query)',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  date_from: { type: 'string', format: 'date' },
                  date_to: { type: 'string', format: 'date' },
                  product_id: { type: 'string', format: 'uuid' },
                  warehouse_id: { type: 'string', format: 'uuid' },
                  truck_id: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Stock movement summary retrieved successfully',
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
                            summary: { type: 'object' },
                            by_type: { type: 'object' },
                            by_product: { type: 'array', items: { type: 'object' } },
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

    '/api/v1/trpc/stockMovements.processRefillOrder': {
      post: {
        summary: 'Process refill order',
        description: 'Process a refill order with stock movements (Mutation)',
        tags: ['stock-movements'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  order_id: { type: 'string', format: 'uuid' },
                  warehouse_id: { type: 'string', format: 'uuid' },
                  truck_id: { type: 'string', format: 'uuid' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        product_id: { type: 'string', format: 'uuid' },
                        quantity: { type: 'integer', minimum: 1 },
                      },
                      required: ['product_id', 'quantity'],
                    },
                  },
                },
                required: ['order_id', 'warehouse_id', 'items'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Refill order processed successfully',
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