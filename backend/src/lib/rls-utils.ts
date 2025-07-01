/**
 * Row Level Security (RLS) Utilities
 * 
 * This module provides utilities for working with RLS policies
 * and ensuring proper tenant isolation in the application.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

export interface TenantContext {
  tenant_id: string;
  user_id: string;
  role: string;
}

/**
 * Validates that a user can access data for a specific tenant
 */
export async function validateTenantAccess(
  supabase: SupabaseClient,
  tenantId: string,
  userContext: TenantContext
): Promise<boolean> {
  // Service role bypasses all checks
  if (userContext.role === 'service_role') {
    return true;
  }

  // Check if user belongs to the tenant
  if (userContext.tenant_id !== tenantId) {
    logger.warn('Tenant isolation violation attempted', {
      user_id: userContext.user_id,
      user_tenant: userContext.tenant_id,
      attempted_tenant: tenantId
    });
    return false;
  }

  return true;
}

/**
 * Creates a Supabase client with proper RLS context
 */
export function createTenantScopedClient(
  supabase: SupabaseClient,
  tenantContext: TenantContext
): SupabaseClient {
  // The client should already have the JWT token set
  // RLS policies will automatically enforce tenant isolation
  return supabase;
}

/**
 * Tests RLS policies for a specific tenant
 */
export async function testRLSPolicies(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{
  success: boolean;
  results: Record<string, boolean>;
  errors: string[];
}> {
  const results: Record<string, boolean> = {};
  const errors: string[] = [];

  try {
    // Test customers table RLS
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, tenant_id')
        .limit(1);
      
      if (error) {
        errors.push(`Customers RLS test failed: ${error.message}`);
        results.customers = false;
      } else {
        // Verify all returned records belong to the current tenant
        const wrongTenantRecords = data?.filter(record => record.tenant_id !== tenantId) || [];
        results.customers = wrongTenantRecords.length === 0;
        if (wrongTenantRecords.length > 0) {
          errors.push(`Customers RLS leak: Found ${wrongTenantRecords.length} records from other tenants`);
        }
      }
    } catch (error) {
      errors.push(`Customers RLS test error: ${error}`);
      results.customers = false;
    }

    // Test orders table RLS
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, tenant_id')
        .limit(1);
      
      if (error) {
        errors.push(`Orders RLS test failed: ${error.message}`);
        results.orders = false;
      } else {
        const wrongTenantRecords = data?.filter(record => record.tenant_id !== tenantId) || [];
        results.orders = wrongTenantRecords.length === 0;
        if (wrongTenantRecords.length > 0) {
          errors.push(`Orders RLS leak: Found ${wrongTenantRecords.length} records from other tenants`);
        }
      }
    } catch (error) {
      errors.push(`Orders RLS test error: ${error}`);
      results.orders = false;
    }

    // Test products table RLS
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, tenant_id')
        .limit(1);
      
      if (error) {
        errors.push(`Products RLS test failed: ${error.message}`);
        results.products = false;
      } else {
        const wrongTenantRecords = data?.filter(record => record.tenant_id !== tenantId) || [];
        results.products = wrongTenantRecords.length === 0;
        if (wrongTenantRecords.length > 0) {
          errors.push(`Products RLS leak: Found ${wrongTenantRecords.length} records from other tenants`);
        }
      }
    } catch (error) {
      errors.push(`Products RLS test error: ${error}`);
      results.products = false;
    }

    // Test inventory table RLS
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, tenant_id')
        .limit(1);
      
      if (error) {
        errors.push(`Inventory RLS test failed: ${error.message}`);
        results.inventory = false;
      } else {
        const wrongTenantRecords = data?.filter(record => record.tenant_id !== tenantId) || [];
        results.inventory = wrongTenantRecords.length === 0;
        if (wrongTenantRecords.length > 0) {
          errors.push(`Inventory RLS leak: Found ${wrongTenantRecords.length} records from other tenants`);
        }
      }
    } catch (error) {
      errors.push(`Inventory RLS test error: ${error}`);
      results.inventory = false;
    }

    const success = Object.values(results).every(result => result === true) && errors.length === 0;

    return {
      success,
      results,
      errors
    };

  } catch (error) {
    logger.error('RLS policy test failed', { error, tenantId });
    return {
      success: false,
      results,
      errors: [...errors, `General RLS test error: ${error}`]
    };
  }
}

/**
 * Monitors RLS policy violations from the audit log
 */
export async function getRLSViolations(
  supabaseAdmin: SupabaseClient,
  since?: Date,
  limit: number = 100
): Promise<{
  violations: any[];
  summary: {
    total: number;
    byTable: Record<string, number>;
    byOperation: Record<string, number>;
  };
}> {
  try {
    let query = supabaseAdmin
      .from('rls_audit_log')
      .select('*')
      .order('blocked_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('blocked_at', since.toISOString());
    }

    const { data: violations, error } = await query;

    if (error) {
      logger.error('Failed to fetch RLS violations', { error });
      throw error;
    }

    // Create summary statistics
    const summary = {
      total: violations?.length || 0,
      byTable: {} as Record<string, number>,
      byOperation: {} as Record<string, number>
    };

    violations?.forEach(violation => {
      summary.byTable[violation.table_name] = (summary.byTable[violation.table_name] || 0) + 1;
      summary.byOperation[violation.operation] = (summary.byOperation[violation.operation] || 0) + 1;
    });

    return {
      violations: violations || [],
      summary
    };

  } catch (error) {
    logger.error('Error getting RLS violations', { error });
    throw error;
  }
}

/**
 * Validates that all required tables have RLS enabled
 */
export async function validateRLSStatus(
  supabaseAdmin: SupabaseClient
): Promise<{
  allEnabled: boolean;
  tableStatus: Record<string, boolean>;
  missingRLS: string[];
}> {
  const requiredTables = [
    'customers',
    'orders', 
    'order_lines',
    'products',
    'inventory',
    'warehouses',
    'transfers',
    'transfer_items',
    'price_lists',
    'price_list_items',
    'addresses',
    'trucks'
  ];

  const tableStatus: Record<string, boolean> = {};
  const missingRLS: string[] = [];

  try {
    // Query PostgreSQL system tables to check RLS status
    const { data, error } = await supabaseAdmin
      .rpc('check_rls_status', { table_names: requiredTables });

    if (error) {
      logger.error('Failed to check RLS status', { error });
      throw error;
    }

    data?.forEach((table: any) => {
      const hasRLS = table.rowsecurity;
      tableStatus[table.table_name] = hasRLS;
      if (!hasRLS) {
        missingRLS.push(table.table_name);
      }
    });

    const allEnabled = missingRLS.length === 0;

    return {
      allEnabled,
      tableStatus,
      missingRLS
    };

  } catch (error) {
    logger.error('Error validating RLS status', { error });
    
    // Fallback: assume all tables need RLS if we can't check
    requiredTables.forEach(table => {
      tableStatus[table] = false;
    });

    return {
      allEnabled: false,
      tableStatus,
      missingRLS: requiredTables
    };
  }
}

/**
 * Helper function to create RLS-compatible database queries
 * Automatically adds tenant filtering when needed
 */
export function createTenantQuery(
  supabase: SupabaseClient,
  table: string,
  tenantId: string
) {
  // RLS policies will automatically filter by tenant_id
  // But we can add explicit filtering for better performance
  return supabase.from(table).select('*').eq('tenant_id', tenantId);
}

/**
 * Middleware to ensure tenant context is properly set
 */
export function ensureTenantContext(tenantContext: TenantContext | null) {
  if (!tenantContext) {
    throw new Error('Tenant context not found. Authentication required.');
  }

  if (!tenantContext.tenant_id) {
    throw new Error('Tenant ID not found in context. Invalid authentication.');
  }

  return tenantContext;
}