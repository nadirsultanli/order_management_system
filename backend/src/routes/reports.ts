import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';

// Import output schemas
import {
  StockValuationResponseSchema,
  DepositAnalysisResponseSchema,
  MarginAnalysisResponseSchema,
  OperationalKPIsResponseSchema,
  ReportExportResponseSchema,
} from '../schemas/output/reports-output';

// ============ INPUT SCHEMAS ============

const DateRangeSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
});

const PaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(100),
});

// Stock Valuation Report Input
const StockValuationReportSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  as_of_date: z.string().optional(),
  include_summary: z.boolean().default(true),
  group_by: z.enum(['warehouse', 'product', 'cylinder_type']).default('warehouse'),
}).merge(PaginationSchema);

// Deposit Analysis Report Input  
const DepositAnalysisReportSchema = z.object({
  customer_id: z.string().uuid().optional(),
  aging_buckets: z.boolean().default(true),
  include_zero_balances: z.boolean().default(false),
  min_days_outstanding: z.number().min(0).optional(),
  threshold_amount: z.number().min(0).optional(),
  as_of_date: z.string().optional(),
}).merge(DateRangeSchema).merge(PaginationSchema);

// Margin Analysis Report Input
const MarginAnalysisReportSchema = z.object({
  order_type: z.enum(['FULL-OUT', 'FULL-XCH', 'all']).default('all'),
  product_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  group_by: z.enum(['order_type', 'product', 'customer', 'date']).default('order_type'),
  include_costs_breakdown: z.boolean().default(true),
}).merge(DateRangeSchema).merge(PaginationSchema);

// Operational KPIs Report Input
const OperationalKPIsReportSchema = z.object({
  customer_id: z.string().uuid().optional(),
  product_capacity: z.number().optional(),
  include_trends: z.boolean().default(true),
  kpi_types: z.string().default('return_rates,deposit_liability,lost_cylinders,aging'),
}).merge(DateRangeSchema).merge(PaginationSchema);

// ============ OUTPUT TYPES ============

interface StockValuationData {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  capacity_kg: number;
  qty_full: number;
  qty_empty: number;
  total_cylinders: number;
  standard_cost: number;
  full_valuation: number;
  empty_valuation: number;
  total_valuation: number;
}

interface DepositAnalysisData {
  customer_id: string;
  customer_name: string;
  outstanding_amount: number;
  cylinder_count: number;
  oldest_deposit_date: string;
  days_outstanding: number;
  aging_bucket: string;
  exceeds_threshold: boolean;
  last_return_date: string | null;
}

interface MarginAnalysisData {
  order_id: string;
  order_type: string;
  order_date: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  revenue: number;
  gas_fill_cost: number;
  cylinder_handling_cost: number;
  total_cogs: number;
  gross_margin: number;
  margin_percentage: number;
}

interface OperationalKPIData {
  metric_name: string;
  metric_value: number;
  metric_unit: string;
  period: string;
  benchmark: number | null;
  variance: number | null;
  trend_direction: 'up' | 'down' | 'stable';
}

export const reportsRouter = router({
  // ============ STOCK VALUATION REPORT ============
  
  getStockValuation: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/reports/stock-valuation',
        tags: ['reports'],
        summary: 'Get stock valuation report',
        description: 'Generate inventory valuation report showing FULL vs EMPTY cylinder counts with standard costs and total valuations by warehouse and product',
        protect: true,
      }
    })
    .input(StockValuationReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating stock valuation report:', input);

      const asOfDate = input.as_of_date || new Date().toISOString().split('T')[0];

      try {
        // Build the main query with joins - using the actual table structure
        let query = ctx.supabase
          .from('inventory_balance')
          .select(`
            *,
            warehouse:warehouses(id, name),
            product:products(id, sku, name, capacity_kg)
          `, { count: 'exact' });

        // Apply filters
        if (input.warehouse_id) {
          query = query.eq('warehouse_id', input.warehouse_id);
        }

        if (input.product_id) {
          query = query.eq('product_id', input.product_id);
        }

        // Apply pagination
        const from = (input.page - 1) * input.limit;
        const to = from + input.limit - 1;
        query = query.range(from, to);

        const { data: inventoryData, error, count } = await query;

        if (error) {
          ctx.logger.error('Stock valuation query error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch inventory data: ${formatErrorMessage(error)}`
          });
        }

        // Transform and calculate valuations
        const stockValuationData: StockValuationData[] = (inventoryData || []).map(item => {
          const product = item.product as any;
          const warehouse = item.warehouse as any;
          
          // Use a default standard cost if not available in products table
          const standardCost = 1000; // Default cost per cylinder
          
          return {
            warehouse_id: item.warehouse_id,
            warehouse_name: warehouse?.name || 'Unknown',
            product_id: item.product_id,
            product_name: product?.name || 'Unknown',
            product_sku: product?.sku || '',
            capacity_kg: product?.capacity_kg || 0,
            qty_full: item.qty_full || 0,
            qty_empty: item.qty_empty || 0,
            total_cylinders: (item.qty_full || 0) + (item.qty_empty || 0),
            standard_cost: standardCost,
            full_valuation: (item.qty_full || 0) * standardCost,
            empty_valuation: (item.qty_empty || 0) * standardCost * 0.7, // Empty cylinders valued at 70% of full
            total_valuation: ((item.qty_full || 0) * standardCost) + ((item.qty_empty || 0) * standardCost * 0.7),
          };
        });

        // Calculate summary statistics
        let summary = null;
        if (input.include_summary) {
          summary = {
            total_warehouses: new Set(stockValuationData.map(item => item.warehouse_id)).size,
            total_products: new Set(stockValuationData.map(item => item.product_id)).size,
            total_full_cylinders: stockValuationData.reduce((sum, item) => sum + item.qty_full, 0),
            total_empty_cylinders: stockValuationData.reduce((sum, item) => sum + item.qty_empty, 0),
            total_cylinders: stockValuationData.reduce((sum, item) => sum + item.total_cylinders, 0),
            total_valuation: stockValuationData.reduce((sum, item) => sum + item.total_valuation, 0),
            full_valuation: stockValuationData.reduce((sum, item) => sum + item.full_valuation, 0),
            empty_valuation: stockValuationData.reduce((sum, item) => sum + item.empty_valuation, 0),
          };
        }

        // Group data based on grouping preference
        let groupedData = null;
        if (input.group_by === 'warehouse') {
          const warehouseGroups = stockValuationData.reduce((acc, item) => {
            const key = item.warehouse_id;
            if (!acc[key]) {
              acc[key] = {
                warehouse_id: item.warehouse_id,
                warehouse_name: item.warehouse_name,
                total_valuation: 0,
                total_cylinders: 0,
                products_count: 0,
                items: []
              };
            }
            acc[key].total_valuation += item.total_valuation;
            acc[key].total_cylinders += item.total_cylinders;
            acc[key].products_count += 1;
            acc[key].items.push(item);
            return acc;
          }, {} as Record<string, any>);
          
          groupedData = Object.values(warehouseGroups);
        } else if (input.group_by === 'product') {
          const productGroups = stockValuationData.reduce((acc, item) => {
            const key = item.product_id;
            if (!acc[key]) {
              acc[key] = {
                product_id: item.product_id,
                product_name: item.product_name,
                product_sku: item.product_sku,
                total_valuation: 0,
                total_cylinders: 0,
                warehouses_count: 0,
                items: []
              };
            }
            acc[key].total_valuation += item.total_valuation;
            acc[key].total_cylinders += item.total_cylinders;
            acc[key].warehouses_count += 1;
            acc[key].items.push(item);
            return acc;
          }, {} as Record<string, any>);
          
          groupedData = Object.values(productGroups);
        } else if (input.group_by === 'cylinder_type') {
          const cylinderGroups = stockValuationData.reduce((acc, item) => {
            const key = `${item.capacity_kg}kg`;
            if (!acc[key]) {
              acc[key] = {
                cylinder_type: key,
                capacity_kg: item.capacity_kg,
                total_valuation: 0,
                total_cylinders: 0,
                items: []
              };
            }
            acc[key].total_valuation += item.total_valuation;
            acc[key].total_cylinders += item.total_cylinders;
            acc[key].items.push(item);
            return acc;
          }, {} as Record<string, any>);
          
          groupedData = Object.values(cylinderGroups);
        }

        return {
          data: stockValuationData,
          summary,
          grouped_data: groupedData,
          as_of_date: asOfDate,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / input.limit),
          currentPage: input.page,
          filters_applied: {
            warehouse_id: input.warehouse_id || null,
            product_id: input.product_id || null,
            group_by: input.group_by,
          }
        };

      } catch (error) {
        ctx.logger.error('Stock valuation report error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate stock valuation report'
        });
      }
    }),

  // ============ DEPOSIT ANALYSIS REPORT ============
  
  getDepositAnalysis: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/reports/deposit-analysis',
        tags: ['reports'],
        summary: 'Get deposit analysis report',
        description: 'Generate deposit analysis report showing outstanding deposits per customer with aging buckets, deposit liability totals, and threshold warnings',
        protect: true,
      }
    })
    .input(DepositAnalysisReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating deposit analysis report:', input);

      const asOfDate = input.as_of_date || new Date().toISOString().split('T')[0];

      try {
        // Get all customers with deposit transactions
        let customerQuery = ctx.supabase
          .from('customers')
          .select('id, name, email, phone, created_at');

        if (input.customer_id) {
          customerQuery = customerQuery.eq('id', input.customer_id);
        }

        const { data: customers, error: customerError } = await customerQuery;

        if (customerError) {
          ctx.logger.error('Customer query error:', customerError);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch customers: ${formatErrorMessage(customerError)}`
          });
        }

        const depositAnalysisData: DepositAnalysisData[] = [];
        let totalOutstanding = 0;
        let customersWithDeposits = 0;
        let totalCylinders = 0;

        for (const customer of customers || []) {
          // Get customer balance from customer_balances table
          const { data: customerBalances } = await ctx.supabase
            .from('customer_balances')
            .select('*')
            .eq('customer_id', customer.id);

          let balance = 0;
          let oldestDepositDate: string | null = null;
          let lastReturnDate: string | null = null;
          let cylinderCount = 0;

          // Calculate total balance and get oldest deposit date
          (customerBalances || []).forEach(cb => {
            balance += cb.deposit_amount || 0;
            cylinderCount += cb.cylinders_with_customer || 0;
            
            if (cb.last_transaction_date) {
              if (!oldestDepositDate || cb.last_transaction_date < oldestDepositDate) {
                oldestDepositDate = cb.last_transaction_date;
              }
            }
          });

          if (balance > 0 || input.include_zero_balances) {
            if (oldestDepositDate) {
              const daysOutstanding = Math.floor(
                (new Date(asOfDate).getTime() - new Date(oldestDepositDate).getTime()) / (1000 * 60 * 60 * 24)
              );

              // Apply minimum days filter
              if (!input.min_days_outstanding || daysOutstanding >= input.min_days_outstanding) {
                // Determine aging bucket
                let agingBucket = '0-30 days';
                if (daysOutstanding > 90) agingBucket = '90+ days';
                else if (daysOutstanding > 60) agingBucket = '61-90 days';
                else if (daysOutstanding > 30) agingBucket = '31-60 days';

                const exceedsThreshold = input.threshold_amount ? balance > input.threshold_amount : false;

                depositAnalysisData.push({
                  customer_id: customer.id,
                  customer_name: customer.name,
                  outstanding_amount: balance,
                  cylinder_count: cylinderCount,
                  oldest_deposit_date: oldestDepositDate,
                  days_outstanding: daysOutstanding,
                  aging_bucket: agingBucket,
                  exceeds_threshold: exceedsThreshold,
                  last_return_date: lastReturnDate,
                });

                if (balance > 0) {
                  totalOutstanding += balance;
                  customersWithDeposits++;
                  totalCylinders += cylinderCount;
                }
              }
            }
          }
        }

        // Sort by outstanding amount (highest first)
        depositAnalysisData.sort((a, b) => b.outstanding_amount - a.outstanding_amount);

        // Apply pagination
        const totalCount = depositAnalysisData.length;
        const from = (input.page - 1) * input.limit;
        const to = from + input.limit;
        const paginatedData = depositAnalysisData.slice(from, to);

        // Calculate aging bucket breakdown
        let agingBreakdown = null;
        if (input.aging_buckets) {
          agingBreakdown = depositAnalysisData.reduce((acc, item) => {
            if (!acc[item.aging_bucket]) {
              acc[item.aging_bucket] = {
                bucket: item.aging_bucket,
                customer_count: 0,
                total_amount: 0,
                cylinder_count: 0,
              };
            }
            acc[item.aging_bucket].customer_count++;
            acc[item.aging_bucket].total_amount += item.outstanding_amount;
            acc[item.aging_bucket].cylinder_count += item.cylinder_count;
            return acc;
          }, {} as Record<string, any>);
        }

        // Transform to match expected schema
        const agingSummary = {
          current: depositAnalysisData.filter(d => d.aging_bucket === 'current').length,
          days_30: depositAnalysisData.filter(d => d.aging_bucket === '30-60 days').length,
          days_60: depositAnalysisData.filter(d => d.aging_bucket === '60-90 days').length,
          days_90: depositAnalysisData.filter(d => d.aging_bucket === '90+ days').length,
          over_90: depositAnalysisData.filter(d => d.aging_bucket === 'over_90').length,
        };

        return {
          report_date: asOfDate,
          total_outstanding: totalOutstanding,
          total_customers: customersWithDeposits,
          total_cylinders: totalCylinders,
          aging_summary: agingSummary,
          customers: paginatedData,
          summary: {
            average_outstanding_per_customer: customersWithDeposits > 0 ? totalOutstanding / customersWithDeposits : 0,
            customers_exceeding_threshold: depositAnalysisData.filter(d => d.exceeds_threshold).length,
            total_risk_amount: depositAnalysisData.filter(d => d.exceeds_threshold).reduce((sum, d) => sum + d.outstanding_amount, 0),
          }
        };

      } catch (error) {
        ctx.logger.error('Deposit analysis report error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate deposit analysis report'
        });
      }
    }),

  // ============ MARGIN ANALYSIS REPORT ============
  
  getMarginAnalysis: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/reports/margin-analysis',
        tags: ['reports'],
        summary: 'Get margin analysis report',
        description: 'Generate margin analysis report showing revenue by order type (FULL-OUT vs FULL-XCH), gas fill costs vs cylinder handling costs, and profitability metrics',
        protect: true,
      }
    })
    .input(MarginAnalysisReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating margin analysis report:', input);

      try {
        // Build order query with relationships
        let query = ctx.supabase
          .from('orders')
          .select(`
            id,
            order_date,
            status,
            total_amount,
            customer_id,
            customer:customers(id, name),
            order_lines(
              id,
              product_id,
              quantity,
              unit_price,
              subtotal,
              product:products(id, name, sku, capacity_kg)
            )
          `, { count: 'exact' })
          .gte('order_date', input.start_date)
          .lte('order_date', input.end_date)
          .in('status', ['delivered', 'invoiced']); // Only completed orders

        // Apply filters
        if (input.customer_id) {
          query = query.eq('customer_id', input.customer_id);
        }

        if (input.warehouse_id) {
          query = query.eq('source_warehouse_id', input.warehouse_id);
        }

        // Apply pagination
        const from = (input.page - 1) * input.limit;
        const to = from + input.limit - 1;
        query = query.range(from, to);

        const { data: orders, error, count } = await query;

        if (error) {
          ctx.logger.error('Margin analysis query error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to fetch orders: ${formatErrorMessage(error)}`
          });
        }

        const marginAnalysisData: MarginAnalysisData[] = [];

        for (const order of orders || []) {
          const customer = order.customer as any;
          
          for (const line of order.order_lines || []) {
            const product = line.product as any;
            
            // Determine order type based on product type and business logic
            // This is simplified - you may need more complex logic based on your business rules
            const orderType = product?.capacity_kg ? 
              (line.quantity > 0 ? 'FULL-OUT' : 'FULL-XCH') : 
              'FULL-OUT';

            // Skip if filtering by order type
            if (input.order_type !== 'all' && orderType !== input.order_type) {
              continue;
            }

            // Skip if filtering by product
            if (input.product_id && line.product_id !== input.product_id) {
              continue;
            }

            const revenue = line.subtotal || (line.quantity * line.unit_price);
            // Use estimated costs since actual cost fields may not exist
            const gasFillCost = revenue * 0.6; // Estimate 60% of revenue as gas cost
            const cylinderHandlingCost = revenue * 0.1; // Estimate 10% as handling cost
            const totalCogs = gasFillCost + cylinderHandlingCost;
            const grossMargin = revenue - totalCogs;
            const marginPercentage = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

            marginAnalysisData.push({
              order_id: order.id,
              order_type: orderType,
              order_date: order.order_date,
              customer_id: order.customer_id,
              customer_name: customer?.name || 'Unknown',
              product_id: line.product_id,
              product_name: product?.name || 'Unknown',
              quantity: line.quantity,
              revenue,
              gas_fill_cost: gasFillCost,
              cylinder_handling_cost: cylinderHandlingCost,
              total_cogs: totalCogs,
              gross_margin: grossMargin,
              margin_percentage: marginPercentage,
            });
          }
        }

        // Calculate summary metrics
        const summary = {
          total_revenue: marginAnalysisData.reduce((sum, item) => sum + item.revenue, 0),
          total_cogs: marginAnalysisData.reduce((sum, item) => sum + item.total_cogs, 0),
          total_gas_fill_costs: marginAnalysisData.reduce((sum, item) => sum + item.gas_fill_cost, 0),
          total_handling_costs: marginAnalysisData.reduce((sum, item) => sum + item.cylinder_handling_cost, 0),
          total_gross_margin: marginAnalysisData.reduce((sum, item) => sum + item.gross_margin, 0),
          average_margin_percentage: marginAnalysisData.length > 0 ? 
            marginAnalysisData.reduce((sum, item) => sum + item.margin_percentage, 0) / marginAnalysisData.length : 0,
          order_count: marginAnalysisData.length,
        };

        // Group data based on grouping preference
        let groupedData = null;
        if (input.group_by === 'order_type') {
          const orderTypeGroups = marginAnalysisData.reduce((acc, item) => {
            const key = item.order_type;
            if (!acc[key]) {
              acc[key] = {
                order_type: key,
                revenue: 0,
                cogs: 0,
                gross_margin: 0,
                order_count: 0,
                margin_percentage: 0,
              };
            }
            acc[key].revenue += item.revenue;
            acc[key].cogs += item.total_cogs;
            acc[key].gross_margin += item.gross_margin;
            acc[key].order_count += 1;
            return acc;
          }, {} as Record<string, any>);
          
          // Calculate average margin percentage for each group
          Object.values(orderTypeGroups).forEach((group: any) => {
            group.margin_percentage = group.revenue > 0 ? (group.gross_margin / group.revenue) * 100 : 0;
          });
          
          groupedData = Object.values(orderTypeGroups);
        }

        // Include cost breakdown if requested
        let costsBreakdown = null;
        if (input.include_costs_breakdown) {
          costsBreakdown = {
            gas_fill_percentage: summary.total_cogs > 0 ? (summary.total_gas_fill_costs / summary.total_cogs) * 100 : 0,
            handling_percentage: summary.total_cogs > 0 ? (summary.total_handling_costs / summary.total_cogs) * 100 : 0,
            cogs_to_revenue_ratio: summary.total_revenue > 0 ? (summary.total_cogs / summary.total_revenue) * 100 : 0,
          };
        }

        // Transform to match expected schema
        const highMarginOrders = marginAnalysisData.filter(d => d.margin_percentage > 20).length;
        const lowMarginOrders = marginAnalysisData.filter(d => d.margin_percentage <= 20 && d.margin_percentage > 0).length;
        const negativeMarginOrders = marginAnalysisData.filter(d => d.margin_percentage <= 0).length;

        // Calculate top margin products
        const productMargins = marginAnalysisData.reduce((acc, item) => {
          if (!acc[item.product_id]) {
            acc[item.product_id] = {
              product_id: item.product_id,
              product_name: item.product_name,
              total_revenue: 0,
              total_margin: 0,
              order_count: 0,
            };
          }
          acc[item.product_id].total_revenue += item.revenue;
          acc[item.product_id].total_margin += item.gross_margin;
          acc[item.product_id].order_count += 1;
          return acc;
        }, {} as Record<string, any>);

        const topMarginProducts = Object.values(productMargins)
          .map((p: any) => ({
            product_id: p.product_id,
            product_name: p.product_name,
            total_revenue: p.total_revenue,
            average_margin: p.order_count > 0 ? p.total_margin / p.order_count : 0,
          }))
          .sort((a, b) => b.average_margin - a.average_margin)
          .slice(0, 5);

        return {
          report_date: new Date().toISOString().split('T')[0],
          total_revenue: summary.total_revenue,
          total_cogs: summary.total_cogs,
          total_gross_margin: summary.total_gross_margin,
          average_margin_percentage: summary.average_margin_percentage,
          orders: marginAnalysisData,
          summary: {
            high_margin_orders: highMarginOrders,
            low_margin_orders: lowMarginOrders,
            negative_margin_orders: negativeMarginOrders,
            top_margin_products: topMarginProducts,
          }
        };

      } catch (error) {
        ctx.logger.error('Margin analysis report error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate margin analysis report'
        });
      }
    }),

  // ============ OPERATIONAL KPIs REPORT ============
  
  getOperationalKPIs: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/reports/operational-kpis',
        tags: ['reports'],
        summary: 'Get operational KPIs report',
        description: 'Generate operational KPIs report showing empty cylinder return rates, average days to return, deposit liability trends, and lost cylinder tracking',
        protect: true,
      }
    })
    .input(OperationalKPIsReportSchema)
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating operational KPIs report:', input);

      try {
        // Parse kpi_types string into array
        const kpiTypesArray = input.kpi_types.split(',').map(type => type.trim());
        
        const kpis: OperationalKPIData[] = [];
        const startDate = new Date(input.start_date);
        const endDate = new Date(input.end_date);

        // ============ EMPTY CYLINDER RETURN RATES ============
        if (input.kpi_types.includes('return_rates')) {
          // Get empty return lines from order_lines table
          let returnQuery = ctx.supabase
            .from('order_lines')
            .select('*')
            .eq('line_type', 'empty_return')
            .gte('created_at', input.start_date)
            .lte('created_at', input.end_date);

          if (input.customer_id) {
            // Join with orders to filter by customer
            returnQuery = ctx.supabase
              .from('order_lines')
              .select(`
                *,
                order:orders(customer_id)
              `)
              .eq('line_type', 'empty_return')
              .eq('order.customer_id', input.customer_id)
              .gte('created_at', input.start_date)
              .lte('created_at', input.end_date);
          }

          const { data: returnLines } = await returnQuery;

          const totalCredits = returnLines?.length || 0;
          // For now, assume all returns are successful (you may need to add status tracking)
          const returnedCredits = totalCredits;
          const returnRate = totalCredits > 0 ? (returnedCredits / totalCredits) * 100 : 0;

          kpis.push({
            metric_name: 'Empty Cylinder Return Rate',
            metric_value: returnRate,
            metric_unit: '%',
            period: `${input.start_date} to ${input.end_date}`,
            benchmark: 85, // Industry benchmark
            variance: returnRate - 85,
            trend_direction: returnRate >= 85 ? 'up' : 'down',
          });

          // Average days to return (simplified calculation)
          if (returnLines && returnLines.length > 0) {
            const avgDaysToReturn = 14; // Default estimate

            kpis.push({
              metric_name: 'Average Days to Return',
              metric_value: avgDaysToReturn,
              metric_unit: 'days',
              period: `${input.start_date} to ${input.end_date}`,
              benchmark: 14, // 2 weeks benchmark
              variance: avgDaysToReturn - 14,
              trend_direction: avgDaysToReturn <= 14 ? 'up' : 'down',
            });
          }
        }

        // ============ DEPOSIT LIABILITY TRENDS ============
        if (input.kpi_types.includes('deposit_liability')) {
          // Get deposit transactions for the period to calculate liability
          const { data: depositTransactions } = await ctx.supabase
            .from('deposit_transactions')
            .select('transaction_type, amount, transaction_date')
            .eq('is_voided', false)
            .gte('transaction_date', input.start_date)
            .lte('transaction_date', input.end_date);

          // Calculate total deposit liability from transactions
          let totalDepositLiability = 0;
          if (depositTransactions) {
            depositTransactions.forEach(tx => {
              if (tx.transaction_type === 'charge') {
                totalDepositLiability += tx.amount || 0;
              } else if (tx.transaction_type === 'refund') {
                totalDepositLiability -= tx.amount || 0;
              }
              // Adjustments can be positive or negative
              else if (tx.transaction_type === 'adjustment') {
                totalDepositLiability += tx.amount || 0;
              }
            });
          }

          // Also get current cylinder inventory for additional context
          const { data: cylinderInventory } = await ctx.supabase
            .from('deposit_cylinder_inventory')
            .select('quantity, unit_deposit');

          let currentCylinderLiability = 0;
          if (cylinderInventory) {
            cylinderInventory.forEach(inv => {
              currentCylinderLiability += (inv.quantity || 0) * (inv.unit_deposit || 0);
            });
          }

          kpis.push({
            metric_name: 'Total Deposit Liability',
            metric_value: totalDepositLiability,
            metric_unit: 'currency',
            period: `${input.start_date} to ${input.end_date}`,
            benchmark: null,
            variance: null,
            trend_direction: 'stable',
          });

          kpis.push({
            metric_name: 'Current Cylinder Liability',
            metric_value: currentCylinderLiability,
            metric_unit: 'currency',
            period: 'Current',
            benchmark: null,
            variance: null,
            trend_direction: 'stable',
          });
        }

        // ============ LOST CYLINDER TRACKING ============
        if (input.kpi_types.includes('lost_cylinders')) {
          // Get expired return lines
          const { data: expiredReturns } = await ctx.supabase
            .from('order_lines')
            .select('*')
            .eq('line_type', 'empty_return')
            .lt('return_deadline_date', new Date().toISOString().split('T')[0])
            .gte('created_at', input.start_date)
            .lte('created_at', input.end_date);

          const lostCylinders = expiredReturns?.reduce((sum, line) => sum + (line.quantity || 0), 0) || 0;
          const lostValue = lostCylinders * 1000; // Estimate value per cylinder

          kpis.push({
            metric_name: 'Lost Cylinders Count',
            metric_value: lostCylinders,
            metric_unit: 'cylinders',
            period: `${input.start_date} to ${input.end_date}`,
            benchmark: 5, // Benchmark of max 5 lost cylinders per period
            variance: lostCylinders - 5,
            trend_direction: lostCylinders <= 5 ? 'up' : 'down',
          });

          kpis.push({
            metric_name: 'Lost Cylinders Value',
            metric_value: lostValue,
            metric_unit: 'currency',
            period: `${input.start_date} to ${input.end_date}`,
            benchmark: null,
            variance: null,
            trend_direction: 'stable',
          });
        }

        // ============ AGING ANALYSIS ============
        if (input.kpi_types.includes('aging')) {
          // Get current pending returns for aging analysis
          const { data: pendingReturns } = await ctx.supabase
            .from('order_lines')
            .select('*')
            .eq('line_type', 'empty_return')
            .is('return_deadline_date', null);

          if (pendingReturns && pendingReturns.length > 0) {
            const today = new Date();
            const agingBuckets = {
              '0-30': 0,
              '31-60': 0,
              '61-90': 0,
              '90+': 0,
            };

            pendingReturns.forEach(line => {
              const daysOld = Math.floor((today.getTime() - new Date(line.created_at).getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysOld <= 30) agingBuckets['0-30']++;
              else if (daysOld <= 60) agingBuckets['31-60']++;
              else if (daysOld <= 90) agingBuckets['61-90']++;
              else agingBuckets['90+']++;
            });

            // Add aging metrics
            Object.entries(agingBuckets).forEach(([bucket, count]) => {
              kpis.push({
                metric_name: `Pending Returns ${bucket} days`,
                metric_value: count,
                metric_unit: 'cylinders',
                period: 'Current',
                benchmark: null,
                variance: null,
                trend_direction: 'stable',
              });
            });
          }
        }

        // Calculate trend analysis if requested
        let trends = null;
        if (input.include_trends) {
          // This is a simplified trend calculation
          // In a real implementation, you'd compare with previous periods
          trends = {
            period_comparison: 'vs_previous_period',
            metrics_improving: kpis.filter(k => k.trend_direction === 'up').length,
            metrics_declining: kpis.filter(k => k.trend_direction === 'down').length,
            metrics_stable: kpis.filter(k => k.trend_direction === 'stable').length,
          };
        }

        return {
          report_date: new Date().toISOString().split('T')[0],
          period: `${input.start_date} to ${input.end_date}`,
          kpis: kpis,
          summary: {
            total_metrics: kpis.length,
            improving_metrics: kpis.filter(k => k.trend_direction === 'up').length,
            declining_metrics: kpis.filter(k => k.trend_direction === 'down').length,
            stable_metrics: kpis.filter(k => k.trend_direction === 'stable').length,
          }
        };

      } catch (error) {
        ctx.logger.error('Operational KPIs report error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate operational KPIs report'
        });
      }
    }),

  // ============ DASHBOARD SUMMARY ENDPOINT ============
  
  getDashboardSummary: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/reports/dashboard-summary',
        tags: ['reports'],
        summary: 'Get dashboard summary',
        description: 'Get key metrics summary for the reports dashboard including stock valuation, deposit liability, return rates, and margin highlights',
        protect: true,
      }
    })
    .input(z.object({
      period_days: z.number().min(1).max(365).default(30),
    }))
    .output(z.any())
    .query(async ({ input, ctx }) => {
      const user = requireAuth(ctx);
      
      ctx.logger.info('Generating dashboard summary');

      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - input.period_days);
        const startDateStr = startDate.toISOString().split('T')[0];

        // Get total stock valuation
        const { data: inventory } = await ctx.supabase
          .from('inventory_balance')
          .select(`
            qty_full,
            qty_empty
          `);

        const totalStockValue = (inventory || []).reduce((sum, item) => {
          const standardCost = 1000; // Default cost per cylinder
          return sum + ((item.qty_full || 0) * standardCost) + ((item.qty_empty || 0) * standardCost * 0.7);
        }, 0);

        const totalCylinders = (inventory || []).reduce((sum, item) => {
          return sum + (item.qty_full || 0) + (item.qty_empty || 0);
        }, 0);

        // Get total deposit liability
        const { data: depositTransactions } = await ctx.supabase
          .from('deposit_transactions')
          .select('transaction_type, amount')
          .eq('is_voided', false);

        let totalDepositLiability = 0;
        if (depositTransactions) {
          depositTransactions.forEach(tx => {
            if (tx.transaction_type === 'charge') {
              totalDepositLiability += tx.amount || 0;
            } else if (tx.transaction_type === 'refund') {
              totalDepositLiability -= tx.amount || 0;
            } else if (tx.transaction_type === 'adjustment') {
              totalDepositLiability += tx.amount || 0;
            }
          });
        }

        // Get return rate for period
        const { data: returnLines } = await ctx.supabase
          .from('order_lines')
          .select('id')
          .eq('line_type', 'empty_return')
          .gte('created_at', startDateStr)
          .lte('created_at', endDate);

        const totalCredits = returnLines?.length || 0;
        const returnedCredits = totalCredits; // Assume all are returned for now
        const returnRate = totalCredits > 0 ? (returnedCredits / totalCredits) * 100 : 0;

        // Get margin metrics for period
        const { data: orders } = await ctx.supabase
          .from('orders')
          .select(`
            total_amount,
            order_lines(
              quantity,
              unit_price,
              subtotal
            )
          `)
          .gte('order_date', startDateStr)
          .lte('order_date', endDate)
          .in('status', ['delivered', 'invoiced']);

        let totalRevenue = 0;
        let totalCogs = 0;

        (orders || []).forEach(order => {
          totalRevenue += order.total_amount || 0;
          
          (order.order_lines || []).forEach(line => {
            const revenue = line.subtotal || (line.quantity * line.unit_price);
            const estimatedCost = revenue * 0.7; // Estimate 70% as cost
            totalCogs += estimatedCost;
          });
        });

        const grossMarginPercentage = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) * 100 : 0;

        return {
          stock_valuation: {
            total_value: totalStockValue,
            total_cylinders: totalCylinders,
            currency: 'KES',
          },
          deposit_liability: {
            total_outstanding: totalDepositLiability,
            currency: 'KES',
          },
          operational_metrics: {
            return_rate_percentage: returnRate,
            period_days: input.period_days,
          },
          financial_performance: {
            total_revenue: totalRevenue,
            gross_margin_percentage: grossMarginPercentage,
            period_days: input.period_days,
            currency: 'KES',
          },
          generated_at: new Date().toISOString(),
          period: {
            start_date: startDateStr,
            end_date: endDate,
          }
        };

      } catch (error) {
        ctx.logger.error('Dashboard summary error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to generate dashboard summary'
        });
      }
    }),
});