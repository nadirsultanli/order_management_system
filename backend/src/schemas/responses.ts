import { z } from 'zod';

// Pagination metadata schema
export const paginationMetaSchema = z.object({
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  pageSize: z.number(),
});

// Generic paginated response schema
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    totalCount: z.number(),
    totalPages: z.number(),
    currentPage: z.number(),
  });
}

// Success response schema
export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

// Analytics response schema
export const analyticsResponseSchema = z.object({
  data: z.any(),
  summary: z.record(z.any()).optional(),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }).optional(),
});

// Bulk operation response schema
export const bulkOperationResponseSchema = z.object({
  success: z.number(),
  failed: z.number(),
  errors: z.array(z.object({
    id: z.string(),
    error: z.string(),
  })).optional(),
});

// Export type helpers
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
export type BulkOperationResponse = z.infer<typeof bulkOperationResponseSchema>;