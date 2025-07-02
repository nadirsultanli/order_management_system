import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { appRouter } from '../routes';
import { createContext } from './context';
import { logger } from './logger';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

export const createNetlifyHandler = (): Handler => {
  return async (event: HandlerEvent, context: HandlerContext) => {
    try {
      // Set environment variables
      process.env.NODE_ENV = 'production';
      
      logger.info('Netlify function invoked:', {
        method: event.httpMethod,
        path: event.path,
        url: event.rawUrl
      });

      // Health check endpoint
      if (event.path === '/health') {
        try {
          const { supabaseAdmin } = await import('./supabase');
          
          const { error } = await supabaseAdmin
            .from('customers')
            .select('count')
            .limit(1);
          
          return {
            statusCode: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
            },
            body: JSON.stringify({
              status: 'healthy',
              timestamp: new Date().toISOString(),
              database: error ? 'disconnected' : 'connected',
              environment: 'netlify-functions'
            })
          };
        } catch (error) {
          logger.error('Health check failed:', error);
          return {
            statusCode: 503,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              status: 'unhealthy',
              error: 'Database connection failed'
            })
          };
        }
      }

      // Handle CORS preflight
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
          },
          body: ''
        };
      }

      // Handle tRPC requests
      if (event.path?.includes('/trpc')) {
        // Create a Request object from the Netlify event
        const url = new URL(event.rawUrl);
        const request = new Request(url.toString(), {
          method: event.httpMethod,
          headers: new Headers(event.headers || {}),
          body: event.body || undefined,
        });

        // Use the tRPC fetch adapter
        const response = await fetchRequestHandler({
          endpoint: '/trpc',
          req: request,
          router: appRouter as any,
          createContext: async () => {
            return await createContext({
              req: {
                headers: event.headers || {},
                method: event.httpMethod,
                url: event.rawUrl,
                body: event.body ? JSON.parse(event.body) : undefined
              } as any,
              res: {} as any
            });
          },
          onError: ({ path, error }) => {
            logger.error(`❌ tRPC failed on ${path ?? '<no-path>'}:`, error);
          },
        });

        // Convert Web API Response to Netlify format
        const responseBody = await response.text();
        const responseHeaders: Record<string, string> = {};
        
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        // Add CORS headers
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        
        return {
          statusCode: response.status,
          headers: responseHeaders,
          body: responseBody,
        };
      }

      // Default response for unknown paths
      return {
        statusCode: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'Not found' })
      };

    } catch (error) {
      logger.error('Netlify handler error:', error);
      return {
        statusCode: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  };
};