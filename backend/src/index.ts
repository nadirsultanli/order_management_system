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
  if (req.path === '/api/docs' || req.path === '/docs') {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https:", "wss:"],
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
      docs: '/api/docs',
      documentation: '/docs',
      scalar: '/scalar'
    },
    documentation: {
      scalar: `${req.protocol}://${req.get('host')}/scalar`,
      interactive: `${req.protocol}://${req.get('host')}/api/docs`,
      markdown: `${req.protocol}://${req.get('host')}/docs`,
      openapi: `${req.protocol}://${req.get('host')}/openapi.json`
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
      '/auth.login': {
        post: {
          summary: 'User Authentication',
          description: 'Login with email and password to get JWT token',
          tags: ['Authentication'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string', format: 'email', example: 'user@example.com' },
                    password: { type: 'string', example: 'your-password' }
                  },
                  required: ['email', 'password']
                }
              }
            }
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
      '/customers.list': {
        get: {
          summary: 'List Customers',
          description: 'Get paginated list of customers with filters',
          tags: ['Customers'],
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
                  search: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'inactive'] }
                }
              }
            }
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
                            type: 'object',
                            properties: {
                              customers: { type: 'array', items: { type: 'object' } },
                              totalCount: { type: 'integer' },
                              totalPages: { type: 'integer' },
                              currentPage: { type: 'integer' }
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
      '/orders.calculateTotals': {
        post: {
          summary: 'Calculate Order Totals',
          description: 'Calculate order totals with tax (moved from frontend for clean architecture)',
          tags: ['Orders'],
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
          },
          responses: {
            '200': {
              description: 'Order totals calculated',
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
                              subtotal: { type: 'number' },
                              taxAmount: { type: 'number' },
                              grandTotal: { type: 'number' }
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
      '/trucks.calculateCapacity': {
        post: {
          summary: 'Calculate Truck Capacity',
          description: 'Calculate truck capacity utilization and optimization',
          tags: ['Fleet Management'],
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
      '/analytics.getDashboard': {
        get: {
          summary: 'Get Dashboard Analytics',
          description: 'Get business intelligence dashboard data',
          tags: ['Analytics'],
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
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and authorization' },
      { name: 'Customers', description: 'Customer management operations' },
      { name: 'Orders', description: 'Order lifecycle management' },
      { name: 'Fleet Management', description: 'Truck and capacity management' },
      { name: 'Analytics', description: 'Business intelligence and reporting' }
    ]
  };

  res.json(openApiSpec);
});

// Simple API Documentation (no CSP issues)
app.get('/api/docs', (req, res) => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;
    
  try {
    const template = fs.readFileSync(path.join(__dirname, 'docs-template.html'), 'utf8');
    const html = template
      .replace(/\{\{BASE_URL\}\}/g, baseUrl)
      .replace(/\{\{ENVIRONMENT\}\}/g, process.env.NODE_ENV || 'development');
      
    return res.type('html').send(html);
  } catch (error) {
    logger.error('Error serving documentation template:', error);
    return res.type('html').send(`
      <html>
        <head><title>API Documentation</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Order Management System API</h1>
          <p><strong>Base URL:</strong> ${baseUrl}</p>
          <p><strong>Status:</strong> Running</p>
          <h2>Quick Links:</h2>
          <ul>
            <li><a href="${baseUrl}/docs">📋 Full Documentation</a></li>
            <li><a href="${baseUrl}/health">💚 Health Check</a></li>
            <li><a href="${baseUrl}/">🏠 API Info</a></li>
          </ul>
          <h2>Authentication:</h2>
          <p>Include Bearer token: <code>Authorization: Bearer YOUR_JWT_TOKEN</code></p>
          <h2>Main Endpoints:</h2>
          <ul>
            <li><code>POST /api/v1/trpc/auth.login</code> - Login</li>
            <li><code>GET /api/v1/trpc/customers.list</code> - Get customers</li>
            <li><code>GET /api/v1/trpc/orders.list</code> - Get orders</li>
            <li><code>POST /api/v1/trpc/orders.calculateTotals</code> - Calculate order totals</li>
          </ul>
        </body>
      </html>
    `);
  }
});

// Markdown Documentation
app.get('/docs', (req, res) => {
  try {
    const docsPath = path.join(__dirname, '../docs/API.md');
    const markdown = fs.readFileSync(docsPath, 'utf8');
    
    // Convert markdown to simple HTML for better readability
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Order Management System API Documentation</title>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1, h2, h3 { color: #333; }
            code { background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
            pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
            blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f2f2f2; }
            .highlight { background: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="highlight">
            <strong>📖 Interactive Documentation Available:</strong> 
            <a href="/api/docs">Visit /api/docs</a> for a better experience with live API testing.
        </div>
        <pre>${markdown.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
    </body>
    </html>
    `;
    
    res.type('html').send(html);
  } catch (error) {
    logger.error('Error serving documentation:', error);
    res.status(500).json({ error: 'Documentation not available' });
  }
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