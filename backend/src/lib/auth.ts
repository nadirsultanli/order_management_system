import { TRPCError } from '@trpc/server';
import { Context } from './context';

export const requireAuth = (ctx: Context) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
  }
  return ctx.user;
};


export const requireRole = (ctx: Context, requiredRole: string) => {
  const user = requireAuth(ctx);
  
  if (user.role !== requiredRole && user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `Access denied: ${requiredRole} role required`
    });
  }
  
  return user;
};