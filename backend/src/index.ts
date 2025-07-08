import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createOpenApiHttpHandler } from 'trpc-openapi';
import { renderTrpcPanel } from 'trpc-panel';
import { appRouter } from './routes';
import { createContext } from './lib/context';
import { logger } from './lib/logger';
import { openApiDocument } from './openapi';

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
  
  // Debug logging
  logger.info('CORS Request - Origin:', origin, 'Allowed origins:', allowedOrigins);
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    logger.info('CORS - Origin allowed:', origin);
  } else if (origin) {
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
  res.json(openApiDocument);
});

// OpenAPI HTTP Handler for REST-like endpoints
app.use('/api/v1', createOpenApiHttpHandler({
  router: appRouter,
  createContext,
}));

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
  logger.info(`📖 API Documentation available at http://localhost:${PORT}/scalar`);
  logger.info(`📊 tRPC Panel available at http://localhost:${PORT}/panel`);
  logger.info(`🔗 OpenAPI Spec at http://localhost:${PORT}/openapi.json`);
});
