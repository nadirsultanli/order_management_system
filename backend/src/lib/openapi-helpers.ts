import { AnyProcedure } from '@trpc/server';

export type OpenAPIMeta = {
  openapi: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    path: string;
    tags: string[];
    summary: string;
    description?: string;
    protect?: boolean;
  };
};

// Helper to create consistent OpenAPI metadata
export function createOpenAPIMeta(
  method: OpenAPIMeta['openapi']['method'],
  path: string,
  tag: string,
  summary: string,
  description?: string,
  protect = true
): OpenAPIMeta {
  return {
    openapi: {
      method,
      path,
      tags: [tag],
      summary,
      description,
      protect,
    },
  };
}