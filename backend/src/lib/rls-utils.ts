/**
 * Row Level Security (RLS) Utilities
 * 
 * This module provides utilities for working with RLS policies
 * and database access validation.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * Tests RLS policies for basic database access
 */
export async function testRLSPolicies(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  success: boolean;
  results: Record<string, boolean>;
  errors: string[];
}> {
  const results: Record<string, boolean> = {};
  const errors: string[] = [];

  try {
    // Test customers table access
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .limit(1);
      
      if (error) {
        errors.push(`Customers access test failed: ${error.message}`);
        results.customers = false;
      } else {
        results.customers = true;
      }
    } catch (error) {
      errors.push(`Customers access test error: ${error}`);
      results.customers = false;
    }

    // Test orders table access
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
      
      if (error) {
        errors.push(`Orders access test failed: ${error.message}`);
        results.orders = false;
      } else {
        results.orders = true;
      }
    } catch (error) {
      errors.push(`Orders access test error: ${error}`);
      results.orders = false;
    }

    // Test products table access
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id')
        .limit(1);
      
      if (error) {
        errors.push(`Products access test failed: ${error.message}`);
        results.products = false;
      } else {
        results.products = true;
      }
    } catch (error) {
      errors.push(`Products access test error: ${error}`);
      results.products = false;
    }

    // Test inventory table access
    try {
      const { data, error } = await supabase
        .from('inventory_balance')
        .select('id')
        .limit(1);
      
      if (error) {
        errors.push(`Inventory access test failed: ${error.message}`);
        results.inventory = false;
      } else {
        results.inventory = true;
      }
    } catch (error) {
      errors.push(`Inventory access test error: ${error}`);
      results.inventory = false;
    }

    const success = Object.values(results).every(result => result === true) && errors.length === 0;

    return {
      success,
      results,
      errors
    };

  } catch (error) {
    logger.error('RLS policy test failed', { error, userId });
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
    'inventory_balance',
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

