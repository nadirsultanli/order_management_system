/**
 * Transfer Verification Utilities
 * 
 * This module provides utilities for monitoring and verifying transfer integrity
 * across the entire system, from frontend validation to database execution.
 */

import { trpc } from '../lib/trpc-client';

export interface TransferIntegrityCheck {
  id: string;
  type: 'validation' | 'creation' | 'status_update' | 'completion' | 'stock_movement';
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
  transferId?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface TransferVerificationResult {
  transferId: string;
  overallStatus: 'healthy' | 'degraded' | 'failed';
  checks: TransferIntegrityCheck[];
  recommendations: string[];
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
    warning_checks: number;
  };
}

export interface SystemHealthMetrics {
  timestamp: string;
  transfer_functions_status: 'available' | 'degraded' | 'unavailable';
  recent_transfer_success_rate: number;
  avg_transfer_duration: number;
  active_transfers: number;
  failed_transfers_24h: number;
  database_connectivity: 'healthy' | 'degraded' | 'failed';
  api_response_time: number;
}

/**
 * Verify the integrity of a specific transfer
 */
export const verifyTransferIntegrity = async (transferId: string): Promise<TransferVerificationResult> => {
  const checks: TransferIntegrityCheck[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'failed' = 'healthy';
  const recommendations: string[] = [];

  try {
    // 1. Verify transfer exists and basic data integrity
    const transfer = await trpc.transfers.getById.query({ transfer_id: transferId });
    
    if (!transfer) {
      checks.push({
        id: 'transfer_exists',
        type: 'validation',
        status: 'failed',
        message: 'Transfer not found in database',
        severity: 'critical',
        timestamp: new Date().toISOString(),
        transferId
      });
      overallStatus = 'failed';
    } else {
      checks.push({
        id: 'transfer_exists',
        type: 'validation',
        status: 'passed',
        message: 'Transfer found and accessible',
        severity: 'low',
        timestamp: new Date().toISOString(),
        transferId,
        details: { transfer_reference: transfer.transfer_reference, status: transfer.status }
      });

      // 2. Verify transfer has required fields
      const requiredFields = ['source_warehouse_id', 'destination_warehouse_id', 'transfer_date', 'status'];
      const missingFields = requiredFields.filter(field => !transfer[field as keyof typeof transfer]);
      
      if (missingFields.length > 0) {
        checks.push({
          id: 'required_fields',
          type: 'validation',
          status: 'failed',
          message: `Missing required fields: ${missingFields.join(', ')}`,
          severity: 'high',
          timestamp: new Date().toISOString(),
          transferId,
          details: { missing_fields: missingFields }
        });
        overallStatus = 'degraded';
        recommendations.push('Ensure all required transfer fields are populated');
      } else {
        checks.push({
          id: 'required_fields',
          type: 'validation',
          status: 'passed',
          message: 'All required fields are present',
          severity: 'low',
          timestamp: new Date().toISOString(),
          transferId
        });
      }

      // 3. Verify transfer items exist
      if (!transfer.items || transfer.items.length === 0) {
        checks.push({
          id: 'transfer_items',
          type: 'validation',
          status: 'failed',
          message: 'Transfer has no items',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          transferId
        });
        overallStatus = 'failed';
        recommendations.push('Transfer must have at least one item');
      } else {
        checks.push({
          id: 'transfer_items',
          type: 'validation',
          status: 'passed',
          message: `Transfer has ${transfer.items.length} items`,
          severity: 'low',
          timestamp: new Date().toISOString(),
          transferId,
          details: { item_count: transfer.items.length }
        });

        // 4. Verify each item has valid product references
        const invalidItems = transfer.items.filter(item => !item.product_id);
        if (invalidItems.length > 0) {
          checks.push({
            id: 'item_product_refs',
            type: 'validation',
            status: 'failed',
            message: `${invalidItems.length} items have invalid product references`,
            severity: 'high',
            timestamp: new Date().toISOString(),
            transferId,
            details: { invalid_items: invalidItems.length }
          });
          overallStatus = 'degraded';
          recommendations.push('Ensure all transfer items have valid product references');
        } else {
          checks.push({
            id: 'item_product_refs',
            type: 'validation',
            status: 'passed',
            message: 'All items have valid product references',
            severity: 'low',
            timestamp: new Date().toISOString(),
            transferId
          });
        }
      }

      // 5. Verify status consistency
      const validStatuses = ['draft', 'pending', 'approved', 'in_transit', 'completed', 'cancelled'];
      if (!validStatuses.includes(transfer.status)) {
        checks.push({
          id: 'status_validity',
          type: 'validation',
          status: 'failed',
          message: `Invalid transfer status: ${transfer.status}`,
          severity: 'high',
          timestamp: new Date().toISOString(),
          transferId,
          details: { current_status: transfer.status, valid_statuses: validStatuses }
        });
        overallStatus = 'degraded';
        recommendations.push('Ensure transfer status is one of the valid values');
      } else {
        checks.push({
          id: 'status_validity',
          type: 'validation',
          status: 'passed',
          message: `Transfer status '${transfer.status}' is valid`,
          severity: 'low',
          timestamp: new Date().toISOString(),
          transferId,
          details: { status: transfer.status }
        });
      }

      // 6. Verify warehouse references exist
      try {
        const warehousesData = await trpc.warehouses.list.query();
        const warehouses = warehousesData?.warehouses || [];
        const warehouseIds = warehouses.map(w => w.id);
        
        const sourceExists = warehouseIds.includes(transfer.source_warehouse_id);
        const destExists = warehouseIds.includes(transfer.destination_warehouse_id);
        
        if (!sourceExists || !destExists) {
          checks.push({
            id: 'warehouse_refs',
            type: 'validation',
            status: 'failed',
            message: `Invalid warehouse references: source=${sourceExists}, destination=${destExists}`,
            severity: 'critical',
            timestamp: new Date().toISOString(),
            transferId,
            details: { 
              source_exists: sourceExists, 
              dest_exists: destExists,
              source_id: transfer.source_warehouse_id,
              dest_id: transfer.destination_warehouse_id
            }
          });
          overallStatus = 'failed';
          recommendations.push('Verify that source and destination warehouses exist');
        } else {
          checks.push({
            id: 'warehouse_refs',
            type: 'validation',
            status: 'passed',
            message: 'Source and destination warehouses are valid',
            severity: 'low',
            timestamp: new Date().toISOString(),
            transferId
          });
        }
      } catch (error) {
        checks.push({
          id: 'warehouse_refs',
          type: 'validation',
          status: 'warning',
          message: 'Could not verify warehouse references',
          severity: 'medium',
          timestamp: new Date().toISOString(),
          transferId,
          details: { error: error instanceof Error ? error.message : String(error) }
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
        recommendations.push('Check database connectivity for warehouse verification');
      }

      // 7. Verify stock availability for non-completed transfers
      if (transfer.status !== 'completed' && transfer.status !== 'cancelled') {
        try {
          const stockData = await trpc.transfers.getWarehouseStock.query({
            warehouse_id: transfer.source_warehouse_id,
            has_stock: true
          });
          
          let stockIssues = 0;
          for (const item of transfer.items) {
            const stock = stockData.find(s => s.product_id === item.product_id);
            const requestedQty = item.quantity_full + item.quantity_empty;
            const availableQty = stock ? (stock.qty_full + stock.qty_empty - stock.qty_reserved) : 0;
            
            if (availableQty < requestedQty) {
              stockIssues++;
            }
          }
          
          if (stockIssues > 0) {
            checks.push({
              id: 'stock_availability',
              type: 'validation',
              status: 'warning',
              message: `${stockIssues} items may have insufficient stock`,
              severity: 'medium',
              timestamp: new Date().toISOString(),
              transferId,
              details: { items_with_issues: stockIssues, total_items: transfer.items.length }
            });
            if (overallStatus === 'healthy') overallStatus = 'degraded';
            recommendations.push('Verify stock availability before proceeding with transfer');
          } else {
            checks.push({
              id: 'stock_availability',
              type: 'validation',
              status: 'passed',
              message: 'Stock appears sufficient for all items',
              severity: 'low',
              timestamp: new Date().toISOString(),
              transferId
            });
          }
        } catch (error) {
          checks.push({
            id: 'stock_availability',
            type: 'validation',
            status: 'warning',
            message: 'Could not verify stock availability',
            severity: 'medium',
            timestamp: new Date().toISOString(),
            transferId,
            details: { error: error instanceof Error ? error.message : String(error) }
          });
          if (overallStatus === 'healthy') overallStatus = 'degraded';
          recommendations.push('Check stock availability manually');
        }
      }

      // 8. Check for data consistency issues
      if (transfer.total_items !== transfer.items.length) {
        checks.push({
          id: 'item_count_consistency',
          type: 'validation',
          status: 'warning',
          message: `Item count mismatch: header=${transfer.total_items}, actual=${transfer.items.length}`,
          severity: 'medium',
          timestamp: new Date().toISOString(),
          transferId,
          details: { header_count: transfer.total_items, actual_count: transfer.items.length }
        });
        if (overallStatus === 'healthy') overallStatus = 'degraded';
        recommendations.push('Recalculate transfer totals to ensure consistency');
      } else {
        checks.push({
          id: 'item_count_consistency',
          type: 'validation',
          status: 'passed',
          message: 'Item counts are consistent',
          severity: 'low',
          timestamp: new Date().toISOString(),
          transferId
        });
      }
    }
  } catch (error) {
    checks.push({
      id: 'transfer_access',
      type: 'validation',
      status: 'failed',
      message: `Failed to access transfer: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'critical',
      timestamp: new Date().toISOString(),
      transferId,
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    overallStatus = 'failed';
    recommendations.push('Check database connectivity and transfer permissions');
  }

  // Calculate summary
  const summary = {
    total_checks: checks.length,
    passed_checks: checks.filter(c => c.status === 'passed').length,
    failed_checks: checks.filter(c => c.status === 'failed').length,
    warning_checks: checks.filter(c => c.status === 'warning').length
  };

  return {
    transferId,
    overallStatus,
    checks,
    recommendations: [...new Set(recommendations)], // Remove duplicates
    summary
  };
};

/**
 * Check overall system health for transfers
 */
export const checkSystemHealth = async (): Promise<SystemHealthMetrics> => {
  const startTime = Date.now();
  let transferFunctionsStatus: 'available' | 'degraded' | 'unavailable' = 'available';
  let databaseConnectivity: 'healthy' | 'degraded' | 'failed' = 'healthy';
  let recentSuccessRate = 0;
  let avgDuration = 0;
  let activeTransfers = 0;
  let failedTransfers24h = 0;

  try {
    // Test basic API connectivity
    const transfers = await trpc.transfers.list.query({ page: 1, limit: 10 });
    activeTransfers = transfers.transfers.filter(t => 
      ['pending', 'approved', 'in_transit'].includes(t.status)
    ).length;

    // Calculate success rate from recent transfers
    const recentTransfers = transfers.transfers.slice(0, 20);
    const completedTransfers = recentTransfers.filter(t => t.status === 'completed');
    const failedRecentTransfers = recentTransfers.filter(t => t.status === 'cancelled');
    
    if (recentTransfers.length > 0) {
      recentSuccessRate = (completedTransfers.length / recentTransfers.length) * 100;
    }

    failedTransfers24h = failedRecentTransfers.length;

  } catch (error) {
    databaseConnectivity = 'failed';
    transferFunctionsStatus = 'unavailable';
  }

  // Test transfer validation function
  try {
    // Try to get warehouse data to test transfer validation
    const warehousesData = await trpc.warehouses.list.query();
    if (!warehousesData?.warehouses?.length) {
      transferFunctionsStatus = 'degraded';
    }
  } catch (error) {
    transferFunctionsStatus = 'degraded';
  }

  const apiResponseTime = Date.now() - startTime;

  return {
    timestamp: new Date().toISOString(),
    transfer_functions_status: transferFunctionsStatus,
    recent_transfer_success_rate: recentSuccessRate,
    avg_transfer_duration: avgDuration,
    active_transfers: activeTransfers,
    failed_transfers_24h: failedTransfers24h,
    database_connectivity: databaseConnectivity,
    api_response_time: apiResponseTime
  };
};

/**
 * Verify database transfer functions are available
 */
export const verifyDatabaseFunctions = async (): Promise<TransferIntegrityCheck[]> => {
  const checks: TransferIntegrityCheck[] = [];
  
  // Note: This would require a backend endpoint to check database functions
  // For now, we'll create a placeholder that could be implemented
  
  checks.push({
    id: 'db_functions_check',
    type: 'validation',
    status: 'warning',
    message: 'Database function verification requires backend endpoint',
    severity: 'medium',
    timestamp: new Date().toISOString(),
    details: {
      required_functions: [
        'transfer_stock',
        'transfer_stock_to_truck',
        'transfer_stock_from_truck',
        'validate_transfer_request'
      ]
    }
  });

  return checks;
};

/**
 * Monitor transfer workflow health
 */
export const monitorTransferWorkflow = async (transferId: string): Promise<{
  stages: Array<{
    stage: string;
    status: 'completed' | 'current' | 'pending' | 'failed';
    timestamp?: string;
    duration?: number;
    issues?: string[];
  }>;
  currentStage: string;
  healthScore: number;
}> => {
  try {
    const transfer = await trpc.transfers.getById.query({ transfer_id: transferId });
    
    const stages = [
      { 
        stage: 'draft', 
        status: 'completed' as const, 
        timestamp: transfer.created_at,
        issues: []
      },
      { 
        stage: 'pending', 
        status: transfer.status === 'pending' ? 'current' as const : 
                ['approved', 'in_transit', 'completed'].includes(transfer.status) ? 'completed' as const : 'pending' as const,
        timestamp: transfer.status === 'pending' ? transfer.updated_at : undefined,
        issues: []
      },
      { 
        stage: 'approved', 
        status: transfer.status === 'approved' ? 'current' as const : 
                ['in_transit', 'completed'].includes(transfer.status) ? 'completed' as const : 'pending' as const,
        timestamp: transfer.approved_at,
        issues: []
      },
      { 
        stage: 'in_transit', 
        status: transfer.status === 'in_transit' ? 'current' as const : 
                transfer.status === 'completed' ? 'completed' as const : 'pending' as const,
        issues: []
      },
      { 
        stage: 'completed', 
        status: transfer.status === 'completed' ? 'completed' as const : 'pending' as const,
        timestamp: transfer.completed_date,
        issues: []
      }
    ];

    // Check for potential issues
    if (transfer.status === 'cancelled') {
      stages.forEach(stage => {
        if (stage.status === 'pending') {
          stage.status = 'failed';
          stage.issues = ['Transfer was cancelled'];
        }
      });
    }

    // Calculate health score (0-100)
    const completedStages = stages.filter(s => s.status === 'completed').length;
    const totalStages = stages.length;
    const healthScore = (completedStages / totalStages) * 100;

    return {
      stages,
      currentStage: transfer.status,
      healthScore
    };

  } catch (error) {
    return {
      stages: [],
      currentStage: 'unknown',
      healthScore: 0
    };
  }
};

/**
 * Generate transfer integrity report
 */
export const generateIntegrityReport = async (transferIds: string[]): Promise<{
  reportId: string;
  timestamp: string;
  transferCount: number;
  overallHealth: 'healthy' | 'degraded' | 'critical';
  systemMetrics: SystemHealthMetrics;
  transferResults: TransferVerificationResult[];
  summary: {
    healthy_transfers: number;
    degraded_transfers: number;
    failed_transfers: number;
    total_issues: number;
    critical_issues: number;
  };
  recommendations: string[];
}> => {
  const reportId = `integrity_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  const timestamp = new Date().toISOString();
  
  // Get system health
  const systemMetrics = await checkSystemHealth();
  
  // Verify each transfer
  const transferResults: TransferVerificationResult[] = [];
  for (const transferId of transferIds) {
    try {
      const result = await verifyTransferIntegrity(transferId);
      transferResults.push(result);
    } catch (error) {
      transferResults.push({
        transferId,
        overallStatus: 'failed',
        checks: [{
          id: 'verification_error',
          type: 'validation',
          status: 'failed',
          message: `Failed to verify transfer: ${error}`,
          severity: 'critical',
          timestamp: new Date().toISOString(),
          transferId
        }],
        recommendations: ['Check transfer accessibility'],
        summary: { total_checks: 1, passed_checks: 0, failed_checks: 1, warning_checks: 0 }
      });
    }
  }

  // Calculate summary
  const healthyTransfers = transferResults.filter(r => r.overallStatus === 'healthy').length;
  const degradedTransfers = transferResults.filter(r => r.overallStatus === 'degraded').length;
  const failedTransfers = transferResults.filter(r => r.overallStatus === 'failed').length;
  
  const totalIssues = transferResults.reduce((acc, r) => 
    acc + r.summary.failed_checks + r.summary.warning_checks, 0
  );
  
  const criticalIssues = transferResults.reduce((acc, r) => 
    acc + r.checks.filter(c => c.severity === 'critical' && c.status === 'failed').length, 0
  );

  // Determine overall health
  let overallHealth: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (criticalIssues > 0 || failedTransfers > transferResults.length * 0.3) {
    overallHealth = 'critical';
  } else if (degradedTransfers > 0 || totalIssues > 0) {
    overallHealth = 'degraded';
  }

  // Collect all recommendations
  const allRecommendations = transferResults.flatMap(r => r.recommendations);
  const uniqueRecommendations = [...new Set(allRecommendations)];

  return {
    reportId,
    timestamp,
    transferCount: transferIds.length,
    overallHealth,
    systemMetrics,
    transferResults,
    summary: {
      healthy_transfers: healthyTransfers,
      degraded_transfers: degradedTransfers,
      failed_transfers: failedTransfers,
      total_issues: totalIssues,
      critical_issues: criticalIssues
    },
    recommendations: uniqueRecommendations
  };
};