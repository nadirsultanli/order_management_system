import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiExpressMiddleware } from 'trpc-openapi';
import { renderTrpcPanel } from 'trpc-panel';
import { appRouter } from './routes';
import { createContext } from './lib/context';
import { logger } from './lib/logger';
import { openApiDocument } from './openapi-complete';
import mpesaRouter from './helpers/mpesa';

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
  if (req.path === '/api/docs' || req.path === '/docs' || req.path === '/scalar' || req.path === '/swagger') {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'", "https:", "wss:", "https://cdn.jsdelivr.net", "https://unpkg.com"],
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
    process.env.LOCAL_FRONTEND_ALT_URL || 'http://localhost:3000',
    'http://localhost:3001', // Allow same-origin requests for Swagger UI
    'null' // Allow local file access
  ].filter(Boolean);
  
  const origin = req.headers.origin;
  
  // Debug logging
  logger.info('CORS Request - Origin:', origin);
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    logger.info('CORS - Origin allowed:', origin || 'no-origin');
  } else {
    logger.warn('CORS - Origin not allowed:', origin);
    // For now, allow the specific frontend domain as fallback
    if (origin === 'https://omsmvpapp.netlify.app') {
      res.header('Access-Control-Allow-Origin', origin);
      logger.info('CORS - Fallback allowed for:', origin);
    }
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-trpc-source');
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
      scalar: '/scalar',
      swagger: '/swagger'
    },
    documentation: {
      scalar_manual: `${req.protocol}://${req.get('host')}/scalar`,
      swagger_ui: `${req.protocol}://${req.get('host')}/swagger`,
      openapi_manual: `${req.protocol}://${req.get('host')}/openapi.json`,
      openapi_auto: `${req.protocol}://${req.get('host')}/openapi-auto.json`,
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

// Scalar API Documentation - Manual Spec
app.get('/scalar', (req, res) => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Order Management System API - Manual Spec</title>
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

// Swagger UI - Auto-generated spec
app.get('/swagger', (req, res) => {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <title>Order Management System API - Auto-generated</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />
      <style>
        html {
          box-sizing: border-box;
          overflow: -moz-scrollbars-vertical;
          overflow-y: scroll;
        }
        *, *:before, *:after {
          box-sizing: inherit;
        }
        body {
          margin:0;
          background: #fafafa;
        }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '${baseUrl}/openapi-auto.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout"
          });
        };
      </script>
    </body>
  </html>
  `;

  res.type('html').send(html);
});

// OpenAPI JSON endpoint for manual spec (Scalar)
app.get('/openapi.json', (req, res) => {
  // Dynamically update the server URL based on the request
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${req.get('host')}`
    : `http://${req.get('host')}`;
  
  const dynamicOpenApiDocument = {
    ...openApiDocument,
    servers: [
      {
        url: baseUrl,
        description: 'API Server',
      },
    ],
  };
  
  res.json(dynamicOpenApiDocument);
});

// OpenAPI JSON endpoint for auto-generated spec (Swagger)
app.get('/openapi-auto.json', (req, res) => {
  try {
    // Dynamically update the server URL based on the request
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? `https://${req.get('host')}`
      : `http://${req.get('host')}`;
    
    // Try to load auto-generated spec
    const autoSpecPath = path.join(__dirname, '../docs/openapi-auto.json');
    let autoSpec;
    
    if (fs.existsSync(autoSpecPath)) {
      autoSpec = JSON.parse(fs.readFileSync(autoSpecPath, 'utf-8'));
    } else {
      // Generate on-demand if file doesn't exist
      const { autoGeneratedOpenApi } = require('./routes/trpc-openapi');
      autoSpec = autoGeneratedOpenApi;
    }
    
    // Update the servers array with the correct URL
    const dynamicAutoSpec = {
      ...autoSpec,
      servers: [
        {
          url: baseUrl + '/api/v1',
          description: 'API Server',
        },
      ],
    };
    
    res.json(dynamicAutoSpec);
  } catch (error) {
    logger.error('Error serving auto-generated OpenAPI spec:', error);
    res.status(500).json({
      error: 'Failed to generate OpenAPI spec',
      message: 'Run npm run generate:openapi to create the auto-generated specification'
    });
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

// tRPC-OpenAPI REST middleware - handles direct HTTP requests from Swagger UI
app.use('/api/v1', createOpenApiExpressMiddleware({
  router: appRouter,
  createContext,
  onError: ({ path, error }: { path?: string; error: any }) => { // Fix: Add type annotations to fix implicit any
    logger.error(`❌ tRPC-OpenAPI failed on ${path ?? '<no-path>'}:`, error);
  },
}));

// Mpesa webhook routes
app.use(mpesaRouter);

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
  logger.info(`📖 Manual API Documentation (Scalar): http://localhost:${PORT}/scalar`);
  logger.info(`📖 Auto-generated API Documentation (Swagger): http://localhost:${PORT}/swagger`);
  logger.info(`🔗 Manual OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
  logger.info(`🔗 Auto-generated OpenAPI Spec: http://localhost:${PORT}/openapi-auto.json`);
});
