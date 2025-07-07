import { SupabaseClient } from '@supabase/supabase-js';
import { TRPCError } from '@trpc/server';
import { logger } from './logger';

export interface PriceListStatus {
  status: 'active' | 'future' | 'expired';
  label: string;
  color: string;
}

export interface PriceCalculationResult {
  unitPrice: number;
  surchargePercent: number;
  finalPrice: number;
  priceListId: string;
  priceListName: string;
  // Tax-related fields
  priceExcludingTax?: number;
  taxAmount?: number;
  priceIncludingTax?: number;
  taxRate?: number;
  taxCategory?: string;
}

export interface OrderTotals {
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
}

export class PricingService {
  constructor(
    private supabase: SupabaseClient,
    private logger: any
  ) {}

  /**
   * Calculate final price with surcharge
   */
  calculateFinalPrice(unitPrice: number, surchargePercent?: number): number {
    if (!surchargePercent) return unitPrice;
    return unitPrice * (1 + surchargePercent / 100);
  }

  /**
   * Get price list status based on dates
   */
  getPriceListStatus(startDate: string, endDate?: string): PriceListStatus {
    const today = new Date().toISOString().split('T')[0];
    
    if (startDate > today) {
      return {
        status: 'future',
        label: 'Future',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
      };
    }
    
    if (endDate && endDate < today) {
      return {
        status: 'expired',
        label: 'Expired',
        color: 'bg-red-100 text-red-800 border-red-200',
      };
    }
    
    return {
      status: 'active',
      label: 'Active',
      color: 'bg-green-100 text-green-800 border-green-200',
    };
  }

  /**
   * Validate date range for price lists
   */
  validateDateRange(startDate: string, endDate?: string): boolean {
    if (!endDate) return true;
    return new Date(startDate) <= new Date(endDate);
  }

  /**
   * Check if price list is expiring soon
   */
  isExpiringSoon(endDate?: string, days: number = 30): boolean {
    if (!endDate) return false;
    
    const today = new Date();
    const expiry = new Date(endDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiry <= days && daysUntilExpiry >= 0;
  }

  /**
   * Get product price from active price lists
   */
  async getProductPrice(productId: string, customerId?: string, date?: string): Promise<PriceCalculationResult | null> {
    const pricingDate = date || new Date().toISOString().split('T')[0];
    
    try {
      // First, try to get customer-specific pricing if customerId is provided
      // This is a placeholder for future customer-specific pricing implementation
      
      // Get active price lists containing this product
      const { data: priceLists, error } = await this.supabase
        .from('price_list')
        .select(`
          id,
          name,
          start_date,
          end_date,
          is_default,
          price_list_item!inner(
            unit_price,
            surcharge_pct,
            min_qty,
            product_id,
            price_excluding_tax,
            tax_amount,
            price_including_tax
          )
        `)
        .eq('price_list_item.product_id', productId)
        .lte('start_date', pricingDate)
        .or(`end_date.is.null,end_date.gte.${pricingDate}`);

      if (error) {
        this.logger.error('Error fetching product price:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch product price'
        });
      }

      if (!priceLists || priceLists.length === 0) {
        return null;
      }

      // Find the best price list (prioritize default > newest)
      let bestPriceList = priceLists[0];
      if (priceLists.length > 1) {
        const defaultList = priceLists.find(pl => pl.is_default);
        if (defaultList) {
          bestPriceList = defaultList;
        } else {
          // Sort by start_date desc to get newest
          priceLists.sort((a, b) => b.start_date.localeCompare(a.start_date));
          bestPriceList = priceLists[0];
        }
      }

      const priceItem = (bestPriceList as any).price_list_item[0];
      const finalPrice = this.calculateFinalPrice(priceItem.unit_price, priceItem.surcharge_pct);

      // Get product tax information
      const { data: productData } = await this.supabase
        .from('products')
        .select('tax_category, tax_rate')
        .eq('id', productId)
        .single();

      return {
        unitPrice: priceItem.unit_price,
        surchargePercent: priceItem.surcharge_pct || 0,
        finalPrice,
        priceListId: bestPriceList.id,
        priceListName: bestPriceList.name,
        // Tax-related fields from price list item (pre-calculated)
        priceExcludingTax: priceItem.price_excluding_tax || priceItem.unit_price,
        taxAmount: priceItem.tax_amount || 0,
        priceIncludingTax: priceItem.price_including_tax || priceItem.unit_price,
        taxRate: productData?.tax_rate || 0,
        taxCategory: productData?.tax_category || 'standard',
      };
    } catch (error) {
      this.logger.error('Error in getProductPrice:', error);
      throw error;
    }
  }

  /**
   * Get prices for multiple products
   */
  async getProductPrices(productIds: string[], customerId?: string, date?: string): Promise<Map<string, PriceCalculationResult | null>> {
    const results = new Map<string, PriceCalculationResult | null>();
    
    // Fetch prices for all products in parallel
    const pricePromises = productIds.map(productId => 
      this.getProductPrice(productId, customerId, date)
        .then(price => ({ productId, price }))
        .catch(error => {
          this.logger.error(`Error fetching price for product ${productId}:`, error);
          return { productId, price: null };
        })
    );
    
    const prices = await Promise.all(pricePromises);
    
    prices.forEach(({ productId, price }) => {
      results.set(productId, price);
    });
    
    return results;
  }

  /**
   * Calculate order totals with tax
   */
  calculateOrderTotals(lines: { quantity: number; unit_price: number; subtotal?: number }[], taxPercent: number = 0): OrderTotals {
    const subtotal = lines.reduce((total, line) => total + (line.subtotal || line.quantity * line.unit_price), 0);
    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;
    
    return { subtotal, taxAmount, grandTotal };
  }

  /**
   * Validate product pricing for order
   */
  async validateProductPricing(productId: string, requestedPrice: number, quantity: number, priceListId?: string): Promise<{
    valid: boolean;
    errors: string[];
    actualPrice?: number;
  }> {
    const errors: string[] = [];
    
    try {
      // Get current price for the product
      const currentPrice = await this.getProductPrice(productId);
      
      if (!currentPrice) {
        errors.push('No pricing found for this product');
        return { valid: false, errors };
      }
      
      // If specific price list requested, validate it matches
      if (priceListId && currentPrice.priceListId !== priceListId) {
        errors.push('Requested price list is not applicable for this product');
      }
      
      // Check if requested price matches current price
      const priceTolerance = 0.01; // Allow small rounding differences
      if (Math.abs(requestedPrice - currentPrice.finalPrice) > priceTolerance) {
        errors.push(`Price mismatch: requested ${requestedPrice} but current price is ${currentPrice.finalPrice}`);
      }
      
      // Additional validations can be added here (e.g., minimum quantity checks)
      
      return {
        valid: errors.length === 0,
        errors,
        actualPrice: currentPrice.finalPrice
      };
    } catch (error) {
      this.logger.error('Error validating product pricing:', error);
      errors.push('Failed to validate pricing');
      return { valid: false, errors };
    }
  }

  /**
   * Get active price lists for a given date
   */
  async getActivePriceLists(date?: string): Promise<any[]> {
    const checkDate = date || new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await this.supabase
        .from('price_list')
        .select('*')
        .lte('start_date', checkDate)
        .or(`end_date.is.null,end_date.gte.${checkDate}`)
        .order('is_default', { ascending: false })
        .order('start_date', { ascending: false });

      if (error) {
        this.logger.error('Error fetching active price lists:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch active price lists'
        });
      }

      return data || [];
    } catch (error) {
      this.logger.error('Error in getActivePriceLists:', error);
      throw error;
    }
  }

  /**
   * Apply bulk pricing rules
   */
  applyBulkPricingRules(quantity: number, unitPrice: number, minQty?: number, bulkDiscount?: number): number {
    // If quantity doesn't meet minimum, return regular price
    if (minQty && quantity < minQty) {
      return unitPrice;
    }
    
    // Apply bulk discount if applicable
    if (bulkDiscount && minQty && quantity >= minQty) {
      return unitPrice * (1 - bulkDiscount / 100);
    }
    
    return unitPrice;
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number, currencyCode: string = 'KES'): string {
    // Handle invalid input gracefully
    if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
      return 'Ksh 0.00';
    }
    
    try {
      // Always use Ksh for Kenyan Shilling
      const symbol = currencyCode === 'KES' ? 'Ksh' : currencyCode;
      const formattedAmount = amount.toLocaleString('en-KE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${symbol} ${formattedAmount}`;
    } catch (error) {
      // Fallback if locale string fails
      const symbol = currencyCode === 'KES' ? 'Ksh' : currencyCode;
      return `${symbol} ${amount.toFixed(2)}`;
    }
  }

  /**
   * Get pricing statistics
   */
  async getPricingStats(): Promise<{
    totalPriceLists: number;
    activePriceLists: number;
    expiringPriceLists: number;
    productsWithoutPricing: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // Get all price lists
      const { data: priceLists, error: plError } = await this.supabase
        .from('price_list')
        .select('id, start_date, end_date')
;
        
      if (plError) throw plError;
      
      const stats = {
        totalPriceLists: priceLists?.length || 0,
        activePriceLists: 0,
        expiringPriceLists: 0,
        productsWithoutPricing: 0
      };
      
      if (priceLists) {
        priceLists.forEach(pl => {
          const status = this.getPriceListStatus(pl.start_date, pl.end_date);
          if (status.status === 'active') {
            stats.activePriceLists++;
          }
          if (this.isExpiringSoon(pl.end_date)) {
            stats.expiringPriceLists++;
          }
        });
      }
      
      // Get products without pricing
      const { count: productsWithoutPricingCount, error: pwpError } = await this.supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .not('id', 'in', `(
          SELECT DISTINCT product_id 
          FROM price_list_item pli
          JOIN price_list pl ON pli.price_list_id = pl.id
          AND pl.start_date <= '${today}'
          AND (pl.end_date IS NULL OR pl.end_date >= '${today}')
        )`);
        
      if (!pwpError) {
        stats.productsWithoutPricing = productsWithoutPricingCount || 0;
      }
      
      return stats;
    } catch (error) {
      this.logger.error('Error getting pricing stats:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get pricing statistics'
      });
    }
  }
}