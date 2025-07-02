import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routes';
import { createContext } from './lib/context';
import { logger } from './lib/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security and parsing middleware
app.use(helmet());
// Configure CORS origins
const getCorsOrigins = (): (string | RegExp)[] => {
  if (process.env.NODE_ENV === 'production') {
    // Allow both environment variable and common deployment patterns
    const origins: string[] = [
      process.env.FRONTEND_URL,
      process.env.NETLIFY_URL,
      'https://trcrjinrdjgizqhjdgvc.netlify.app', // Add your actual Netlify URL here
    ].filter((url): url is string => Boolean(url));
    
    // Also allow any netlify.app subdomain for preview deployments
    return [...origins, /https:\/\/.*\.netlify\.app$/];
  }
  
  return ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'];
};

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📝 API docs available at http://localhost:${PORT}/api/v1/docs`);
});