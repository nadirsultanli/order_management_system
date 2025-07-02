import { TRPCError } from '@trpc/server';
import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../routes';
import { createContext } from './context';
import { logger } from './logger';

// Express app instance
let app: express.Application | null = null;

const createApp = () => {
  if (app) return app;
  
  app = express();
  
  // CORS configuration
  app.use(cors({
    origin: [
      /https:\/\/.*\.netlify\.app$/,
      'http://localhost:5173',
      'http://localhost:3000'
    ],
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', async (req, res) => {
    try {
      const { supabaseAdmin } = await import('./supabase');
      
      const { error } = await supabaseAdmin
        .from('customers')
        .select('count')
        .limit(1);
      
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        database: error ? 'disconnected' : 'connected',
        environment: 'netlify-functions'
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Database connection failed'
      });
    }
  });

  // tRPC middleware
  app.use('/trpc', createExpressMiddleware({
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      logger.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error);
    },
  }));

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  });

  return app;
};

// Convert Netlify event to Express-compatible request/response
const convertEvent = (event: HandlerEvent) => {
  const url = new URL(event.rawUrl);
  
  return {
    method: event.httpMethod,
    url: url.pathname + url.search,
    path: url.pathname,
    query: event.queryStringParameters || {},
    headers: event.headers,
    body: event.body,
    isBase64Encoded: event.isBase64Encoded
  };
};

export const createNetlifyHandler = (): Handler => {
  return async (event: HandlerEvent, context: HandlerContext) => {
    // Set environment variables
    process.env.NODE_ENV = 'production';
    
    // Initialize Express app
    const expressApp = createApp();
    
    return new Promise((resolve, reject) => {
      const req = convertEvent(event) as any;
      
      const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: '',
        
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        
        setHeader(name: string, value: string) {
          this.headers[name] = value;
          return this;
        },
        
        json(data: any) {
          this.headers['Content-Type'] = 'application/json';
          this.body = JSON.stringify(data);
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            body: this.body
          });
        },
        
        send(data: any) {
          this.body = typeof data === 'string' ? data : JSON.stringify(data);
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            body: this.body
          });
        },
        
        end(data?: any) {
          if (data) this.body = data;
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            body: this.body
          });
        }
      } as any;

      try {
        // Mock Express app behavior
        req.app = expressApp;
        res.app = expressApp;
        
        expressApp(req, res);
      } catch (error) {
        logger.error('Netlify handler error:', error);
        reject(error);
      }
    });
  };
};