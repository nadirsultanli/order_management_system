import { z } from 'zod';
import { router, protectedProcedure } from '../lib/trpc';
import { requireAuth } from '../lib/auth';
import { TRPCError } from '@trpc/server';
import { formatErrorMessage } from '../lib/logger';

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
  kpi_types: z.array(z.enum(['return_rates', 'deposit_liability', 'lost_cylinders', 'aging'])).default(['return_rates', 'deposit_liability', 'lost_cylinders', 'aging']),
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
        // Build the main query with joins
        let query = ctx.supabase
          .from('inventory_balance')
          .select(`
            *,
            warehouse:warehouses!inventory_balance_warehouse_id_fkey(id, name),
            product:products!inventory_balance_product_id_fkey(id, sku, name, capacity_kg, standard_cost, unit_of_measure)
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
          const standardCost = product?.standard_cost || 0;
          
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
            warehouse_id: input.warehouse_id,
            product_id: input.product_id,
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
          // Get deposit balance for customer
          const { data: transactions } = await ctx.supabase
            .from('deposit_transactions')
            .select('transaction_type, amount, transaction_date')
            .eq('customer_id', customer.id)
            .lte('transaction_date', input.end_date)
            .eq('is_voided', false);

          let balance = 0;
          let oldestDepositDate: string | null = null;
          let lastReturnDate: string | null = null;

          (transactions || []).forEach(tx => {
            if (tx.transaction_type === 'charge') {
              balance += tx.amount;
              if (!oldestDepositDate || tx.transaction_date < oldestDepositDate) {
                oldestDepositDate = tx.transaction_date;
              }
            } else if (tx.transaction_type === 'refund') {
              balance -= tx.amount;
              if (!lastReturnDate || tx.transaction_date > lastReturnDate) {
                lastReturnDate = tx.transaction_date;
              }
            } else if (tx.transaction_type === 'adjustment') {
              balance += tx.amount;
            }
          });

          if (balance > 0 || input.include_zero_balances) {
            // Get cylinder count
            const { data: cylinders } = await ctx.supabase
              .from('deposit_cylinder_inventory')
              .select('quantity')
              .eq('customer_id', customer.id);

            const cylinderCount = cylinders?.reduce((sum, c) => sum + c.quantity, 0) || 0;

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

        return {
          data: paginatedData,
          summary: {
            total_outstanding_amount: totalOutstanding,
            customers_with_deposits: customersWithDeposits,
            total_cylinders_on_deposit: totalCylinders,
            average_outstanding_per_customer: customersWithDeposits > 0 ? totalOutstanding / customersWithDeposits : 0,
            customers_exceeding_threshold: depositAnalysisData.filter(d => d.exceeds_threshold).length,
          },
          aging_breakdown: agingBreakdown ? Object.values(agingBreakdown) : null,
          as_of_date: asOfDate,
          totalCount,
          totalPages: Math.ceil(totalCount / input.limit),
          currentPage: input.page,
          filters_applied: {
            customer_id: input.customer_id,
            threshold_amount: input.threshold_amount,
            min_days_outstanding: input.min_days_outstanding,
            date_range: { start_date: input.start_date, end_date: input.end_date },
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
              product:products(id, name, sku, capacity_kg, standard_cost, gas_fill_cost, handling_cost)
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
            const gasFillCost = (product?.gas_fill_cost || 0) * line.quantity;
            const cylinderHandlingCost = (product?.handling_cost || 0) * line.quantity;
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

        return {
          data: marginAnalysisData,
          summary,
          grouped_data: groupedData,
          costs_breakdown: costsBreakdown,
          totalCount: count || 0,
          totalPages: Math.ceil((count || 0) / input.limit),
          currentPage: input.page,
          filters_applied: {
            order_type: input.order_type,
            product_id: input.product_id,
            customer_id: input.customer_id,
            warehouse_id: input.warehouse_id,
            date_range: { start_date: input.start_date, end_date: input.end_date },
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
        const kpis: OperationalKPIData[] = [];
        const startDate = new Date(input.start_date);
        const endDate = new Date(input.end_date);

        // ============ EMPTY CYLINDER RETURN RATES ============
        if (input.kpi_types.includes('return_rates')) {
          // Get empty return credits for the period
          let returnQuery = ctx.supabase
            .from('empty_return_credits')
            .select('*')
            .gte('created_at', input.start_date)
            .lte('created_at', input.end_date);

          if (input.customer_id) {
            returnQuery = returnQuery.eq('customer_id', input.customer_id);
          }

          if (input.product_capacity) {
            returnQuery = returnQuery.eq('capacity_l', input.product_capacity);
          }

          const { data: returnCredits } = await returnQuery;

          const totalCredits = returnCredits?.length || 0;
          const returnedCredits = returnCredits?.filter(c => c.status === 'returned').length || 0;
          const returnRate = totalCredits > 0 ? (returnedCredits / totalCredits) * 100 : 0;

          kpis.push({
            metric_name: 'Empty Cylinder Return Rate',
            metric_value: returnRate,
            metric_unit: 'percentage',
            period: `${input.start_date} to ${input.end_date}`,
            benchmark: 85, // Industry benchmark
            variance: returnRate - 85,
            trend_direction: returnRate >= 85 ? 'up' : 'down',
          });

          // Average days to return
          const returnedCreditDetails = returnCredits?.filter(c => c.status === 'returned' && c.actual_return_date);
          if (returnedCreditDetails && returnedCreditDetails.length > 0) {
            const totalDays = returnedCreditDetails.reduce((sum, credit) => {
              const deliveryDate = new Date(credit.created_at);
              const returnDate = new Date(credit.actual_return_date);
              return sum + Math.floor((returnDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
            }, 0);

            const avgDaysToReturn = totalDays / returnedCreditDetails.length;

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
          // Get deposit transactions for trend analysis
          const { data: depositTxs } = await ctx.supabase
            .from('deposit_transactions')
            .select('transaction_date, transaction_type, amount')
            .gte('transaction_date', input.start_date)
            .lte('transaction_date', input.end_date)
            .eq('is_voided', false)
            .order('transaction_date', { ascending: true });

          let runningBalance = 0;
          const dailyBalances: { date: string; balance: number }[] = [];

          // Calculate running balance
          (depositTxs || []).forEach(tx => {
            if (tx.transaction_type === 'charge') {
              runningBalance += tx.amount;
            } else if (tx.transaction_type === 'refund') {
              runningBalance -= tx.amount;
            } else if (tx.transaction_type === 'adjustment') {
              runningBalance += tx.amount;
            }
            
            const existingEntry = dailyBalances.find(d => d.date === tx.transaction_date);
            if (existingEntry) {
              existingEntry.balance = runningBalance;
            } else {
              dailyBalances.push({ date: tx.transaction_date, balance: runningBalance });
            }
          });

          if (dailyBalances.length > 0) {
            const finalBalance = dailyBalances[dailyBalances.length - 1].balance;
            const initialBalance = dailyBalances[0].balance;
            const trendDirection = finalBalance > initialBalance ? 'up' : finalBalance < initialBalance ? 'down' : 'stable';

            kpis.push({
              metric_name: 'Total Deposit Liability',
              metric_value: finalBalance,
              metric_unit: 'currency',
              period: `${input.start_date} to ${input.end_date}`,
              benchmark: null,
              variance: finalBalance - initialBalance,
              trend_direction: trendDirection,
            });
          }
        }

        // ============ LOST CYLINDER TRACKING ============
        if (input.kpi_types.includes('lost_cylinders')) {
          // Get expired credits that were never returned
          const { data: expiredCredits } = await ctx.supabase
            .from('empty_return_credits')
            .select('*')
            .eq('status', 'expired')
            .gte('created_at', input.start_date)
            .lte('created_at', input.end_date);

          const lostCylinders = expiredCredits?.reduce((sum, credit) => sum + credit.quantity, 0) || 0;
          const lostValue = expiredCredits?.reduce((sum, credit) => sum + credit.total_credit_amount, 0) || 0;

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
          // Get current pending credits for aging analysis
          const { data: pendingCredits } = await ctx.supabase
            .from('empty_return_credits')
            .select('*')
            .eq('status', 'pending');

          if (pendingCredits && pendingCredits.length > 0) {
            const today = new Date();
            const agingBuckets = {
              '0-30': 0,
              '31-60': 0,
              '61-90': 0,
              '90+': 0,
            };

            pendingCredits.forEach(credit => {
              const daysOld = Math.floor((today.getTime() - new Date(credit.created_at).getTime()) / (1000 * 60 * 60 * 24));
              
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
          data: kpis,
          trends,
          summary: {
            total_metrics: kpis.length,
            metrics_with_benchmarks: kpis.filter(k => k.benchmark !== null).length,
            metrics_meeting_benchmarks: kpis.filter(k => k.benchmark !== null && k.variance! >= 0).length,
          },
          period: {
            start_date: input.start_date,
            end_date: input.end_date,
          },
          filters_applied: {
            customer_id: input.customer_id,
            product_capacity: input.product_capacity,
            kpi_types: input.kpi_types,
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
            qty_empty,
            product:products(standard_cost)
          `);

        const totalStockValue = (inventory || []).reduce((sum, item) => {
          const standardCost = (item.product as any)?.standard_cost || 0;
          return sum + ((item.qty_full || 0) * standardCost) + ((item.qty_empty || 0) * standardCost * 0.7);
        }, 0);

        const totalCylinders = (inventory || []).reduce((sum, item) => {
          return sum + (item.qty_full || 0) + (item.qty_empty || 0);
        }, 0);

        // Get total deposit liability
        const { data: depositTxs } = await ctx.supabase
          .from('deposit_transactions')
          .select('transaction_type, amount')
          .eq('is_voided', false);

        const totalDepositLiability = (depositTxs || []).reduce((sum, tx) => {
          if (tx.transaction_type === 'charge') return sum + tx.amount;
          if (tx.transaction_type === 'refund') return sum - tx.amount;
          if (tx.transaction_type === 'adjustment') return sum + tx.amount;
          return sum;
        }, 0);

        // Get return rate for period
        const { data: returnCredits } = await ctx.supabase
          .from('empty_return_credits')
          .select('status')
          .gte('created_at', startDateStr)
          .lte('created_at', endDate);

        const totalCredits = returnCredits?.length || 0;
        const returnedCredits = returnCredits?.filter(c => c.status === 'returned').length || 0;
        const returnRate = totalCredits > 0 ? (returnedCredits / totalCredits) * 100 : 0;

        // Get margin metrics for period
        const { data: orders } = await ctx.supabase
          .from('orders')
          .select(`
            total_amount,
            order_lines(
              quantity,
              unit_price,
              subtotal,
              product:products(gas_fill_cost, handling_cost)
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
            const product = line.product as any;
            const gasCost = (product?.gas_fill_cost || 0) * line.quantity;
            const handlingCost = (product?.handling_cost || 0) * line.quantity;
            totalCogs += gasCost + handlingCost;
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