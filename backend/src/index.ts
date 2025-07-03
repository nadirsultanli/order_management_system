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

// Security and parsing middleware
app.use(helmet());
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
      documentation: '/docs'
    },
    documentation: {
      interactive: `${req.protocol}://${req.get('host')}/api/docs`,
      markdown: `${req.protocol}://${req.get('host')}/docs`
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

// API Documentation - Interactive tRPC Panel
app.use('/api/docs', (_req, res) => {
  return res.type('html').send(
    renderTrpcPanel(appRouter, {
      url: `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/v1/trpc`,
      transformer: 'superjson', // if you use superjson
    })
  );
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