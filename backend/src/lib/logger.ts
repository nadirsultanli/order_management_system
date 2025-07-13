import * as winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'order-management-api' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Safely extracts a human-readable error message from various error types
 * Handles Supabase errors, PostgreSQL errors, JavaScript errors, and plain objects
 */
export function formatErrorMessage(error: any): string {
  if (!error) {
    return 'Unknown error occurred';
  }

  // Handle standard JavaScript Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase/PostgreSQL error objects
  if (typeof error === 'object') {
    // Try common error message properties
    if (error.message && typeof error.message === 'string') {
      return error.message;
    }
    
    if (error.error && typeof error.error === 'string') {
      return error.error;
    }
    
    if (error.detail && typeof error.detail === 'string') {
      return error.detail;
    }
    
    if (error.hint && typeof error.hint === 'string') {
      return error.hint;
    }
    
    // For PostgreSQL errors, try to format nicely
    if (error.code && error.message) {
      return `${error.code}: ${error.message}`;
    }
    
    // Try to stringify the error object with useful properties
    try {
      const errorObj = {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        constraint: error.constraint,
        table: error.table,
        column: error.column
      };
      
      // Filter out undefined values
      const filteredObj = Object.fromEntries(
        Object.entries(errorObj).filter(([_, value]) => value !== undefined)
      );
      
      if (Object.keys(filteredObj).length > 0) {
        return JSON.stringify(filteredObj, null, 2);
      }
    } catch (stringifyError) {
      // If JSON.stringify fails, fall back to string conversion
    }
  }

  // Handle string errors
  if (typeof error === 'string') {
    return error;
  }

  // Handle number errors (rare but possible)
  if (typeof error === 'number') {
    return `Error code: ${error}`;
  }

  // Last resort: try to convert to string but avoid [object Object]
  try {
    const stringified = JSON.stringify(error);
    if (stringified && stringified !== '{}') {
      return stringified;
    }
  } catch (stringifyError) {
    // If JSON.stringify fails, we'll use the fallback below
  }

  // Final fallback
  return 'Unknown error occurred (unable to extract error message)';
}