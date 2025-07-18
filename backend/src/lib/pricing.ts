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

export interface WeightBasedPriceCalculation {
  netGasWeight_kg: number;
  gasPricePerKg: number;
  gasCharge: number;
  depositAmount: number;
  subtotal: number;
  taxAmount: number;
  totalPrice: number;
  pricingMethod: 'per_kg' | 'per_unit' | 'flat_rate' | 'tiered' | 'copy_from_list' | 'markup';
}

export interface CylinderDepositRate {
  capacity_l: number;
  deposit_amount: number;
  currency_code: string;
  effective_date: string;
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
   * Enhanced calculate final price supporting different pricing methods
   */
  async calculateFinalPriceWithMethod(
    productId: string,
    quantity: number,
    pricingMethod: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered' | 'copy_from_list' | 'markup',
    unitPrice: number,
    surchargePercent?: number,
    customerId?: string,
    date?: string
  ): Promise<number> {
    switch (pricingMethod) {
      case 'per_unit':
        return this.calculateFinalPrice(unitPrice, surchargePercent) * quantity;
      
      case 'per_kg':
        const weightBasedPrice = await this.getWeightBasedPrice(productId, quantity, customerId, date);
        return weightBasedPrice?.totalPrice || 0;
      
      case 'flat_rate':
        // Flat rate applies the same price regardless of quantity
        return this.calculateFinalPrice(unitPrice, surchargePercent);
      
      case 'tiered':
        // Tiered pricing - apply bulk discounts based on quantity
        return this.applyTieredPricing(unitPrice, quantity, surchargePercent);
      
      case 'copy_from_list':
        // Copy from list - this should be handled in the route logic
        return this.calculateFinalPrice(unitPrice, surchargePercent) * quantity;
      
      case 'markup':
        // Markup pricing - this should be handled in the route logic
        return this.calculateFinalPrice(unitPrice, surchargePercent) * quantity;
      
      default:
        return this.calculateFinalPrice(unitPrice, surchargePercent) * quantity;
    }
  }

  /**
   * Apply tiered pricing based on quantity
   */
  applyTieredPricing(unitPrice: number, quantity: number, surchargePercent?: number): number {
    let discountPercent = 0;
    
    // Define quantity tiers and their discounts
    if (quantity >= 100) {
      discountPercent = 0.15; // 15% discount for 100+
    } else if (quantity >= 50) {
      discountPercent = 0.10; // 10% discount for 50-99
    } else if (quantity >= 20) {
      discountPercent = 0.05; // 5% discount for 20-49
    } else if (quantity >= 10) {
      discountPercent = 0.02; // 2% discount for 10-19
    }
    
    const basePrice = this.calculateFinalPrice(unitPrice, surchargePercent);
    const discountedPrice = basePrice * (1 - discountPercent);
    return discountedPrice * quantity;
  }

  /**
   * Calculate gas charge based on weight and price per kg
   */
  calculateGasCharge(netGasWeight_kg: number, gasPricePerKg: number): number {
    if (netGasWeight_kg <= 0 || gasPricePerKg <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Net gas weight and price per kg must be positive values'
      });
    }
    return netGasWeight_kg * gasPricePerKg;
  }

  /**
   * Get current deposit rate for a cylinder capacity
   */
  async getCurrentDepositRate(capacity_l: number, currency_code: string = 'KES', asOfDate?: string): Promise<number> {
    const checkDate = asOfDate || new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await this.supabase
        .rpc('get_current_deposit_rate', {
          p_capacity_l: capacity_l,
          p_currency_code: currency_code,
          p_as_of_date: checkDate
        });

      if (error) {
        this.logger.error('Error fetching deposit rate:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch deposit rate'
        });
      }

      return data || 0;
    } catch (error) {
      this.logger.error('Error in getCurrentDepositRate:', error);
      throw error;
    }
  }

  /**
   * Calculate total price including gas charge, deposit, and tax
   */
  calculateWeightBasedTotal(
    netGasWeight_kg: number, 
    gasPricePerKg: number, 
    depositAmount: number, 
    taxRate: number = 0
  ): WeightBasedPriceCalculation {
    const gasCharge = this.calculateGasCharge(netGasWeight_kg, gasPricePerKg);
    const subtotal = gasCharge + depositAmount;
    const taxAmount = subtotal * (taxRate / 100);
    const totalPrice = subtotal + taxAmount;

    return {
      netGasWeight_kg,
      gasPricePerKg,
      gasCharge,
      depositAmount,
      subtotal,
      taxAmount,
      totalPrice,
      pricingMethod: 'per_kg'
    };
  }

  /**
   * Get weight-based pricing for a product
   */
  async getWeightBasedPrice(
    productId: string, 
    quantity: number = 1, 
    customerId?: string, 
    date?: string
  ): Promise<WeightBasedPriceCalculation | null> {
    try {
      // Get product details including weight information
      const { data: product, error: productError } = await this.supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          sku_variant,
          capacity_l,
          gross_weight_kg,
          net_gas_weight_kg,
          tare_weight_kg,
          tax_rate,
          tax_category
        `)
        .eq('id', productId)
        .single();

      if (productError || !product) {
        this.logger.error('Product not found:', productError);
        return null;
      }

      // Gas fill pricing should only apply to FULL-OUT and FULL-XCH variants
      if (product.sku_variant && !['FULL-OUT', 'FULL-XCH'].includes(product.sku_variant)) {
        this.logger.warn(`Gas fill pricing not applicable for variant: ${product.sku_variant}`, productId);
        return null;
      }

      // Check if product has weight information
      if (!product.net_gas_weight_kg || !product.capacity_l) {
        this.logger.warn('Product missing weight or capacity information:', productId);
        return null;
      }

      // Get current pricing from price lists with per_kg method
      const { data: priceLists, error: priceError } = await this.supabase
        .from('price_list')
        .select(`
          id,
          name,
          pricing_method,
          price_list_item!inner(
            unit_price,
            surcharge_pct,
            product_id
          )
        `)
        .eq('price_list_item.product_id', productId)
        .eq('pricing_method', 'per_kg')
        .lte('start_date', date || new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${date || new Date().toISOString().split('T')[0]}`);

      if (priceError || !priceLists || priceLists.length === 0) {
        this.logger.warn('No per_kg pricing found for product:', productId);
        return null;
      }

      // Use the first applicable price list (could be enhanced with priority logic)
      const priceList = priceLists[0];
      const priceItem = (priceList as any).price_list_item[0];
      
      // Calculate gas price per kg (unit_price is treated as price per kg for per_kg method)
      const gasPricePerKg = this.calculateFinalPrice(priceItem.unit_price, priceItem.surcharge_pct);
      
      // Get deposit amount for this cylinder capacity
      const depositAmount = await this.getCurrentDepositRate(product.capacity_l);
      
      // Calculate total for the requested quantity
      const singleCylinderCalc = this.calculateWeightBasedTotal(
        product.net_gas_weight_kg,
        gasPricePerKg,
        depositAmount,
        product.tax_rate || 0
      );

      // Scale by quantity
      return {
        ...singleCylinderCalc,
        gasCharge: singleCylinderCalc.gasCharge * quantity,
        depositAmount: singleCylinderCalc.depositAmount * quantity,
        subtotal: singleCylinderCalc.subtotal * quantity,
        taxAmount: singleCylinderCalc.taxAmount * quantity,
        totalPrice: singleCylinderCalc.totalPrice * quantity
      };

    } catch (error) {
      this.logger.error('Error in getWeightBasedPrice:', error);
      throw error;
    }
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
   * Enhanced calculate order totals with deposit support
   */
  async calculateOrderTotalsWithDeposits(
    lines: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      pricing_method?: 'per_unit' | 'per_kg' | 'flat_rate' | 'tiered' | 'copy_from_list' | 'markup';
      include_deposit?: boolean;
      subtotal?: number;
    }>,
    taxPercent: number = 0,
    customerId?: string,
    date?: string
  ): Promise<OrderTotals & { depositAmount: number; gasCharges: number }> {
    let gasCharges = 0;
    let depositAmount = 0;
    let subtotal = 0;

    for (const line of lines) {
      if (line.pricing_method === 'per_kg') {
        // Use weight-based pricing
        const weightBasedPrice = await this.getWeightBasedPrice(
          line.product_id,
          line.quantity,
          customerId,
          date
        );
        
        if (weightBasedPrice) {
          gasCharges += weightBasedPrice.gasCharge;
          if (line.include_deposit) {
            depositAmount += weightBasedPrice.depositAmount;
          }
          subtotal += weightBasedPrice.gasCharge + (line.include_deposit ? weightBasedPrice.depositAmount : 0);
        }
      } else {
        // Traditional pricing
        const lineSubtotal = line.subtotal || (line.quantity * line.unit_price);
        gasCharges += lineSubtotal;
        subtotal += lineSubtotal;

        // Add deposit if requested and product has capacity
        if (line.include_deposit) {
          const { data: product } = await this.supabase
            .from('products')
            .select('capacity_kg')
            .eq('id', line.product_id)
            .single();

          if (product?.capacity_kg) {
            const capacityL = product.capacity_kg * 2.2; // Convert kg to liters
            const deposit = await this.getCurrentDepositRate(capacityL);
            const lineDeposit = deposit * line.quantity;
            depositAmount += lineDeposit;
            subtotal += lineDeposit;
          }
        }
      }
    }

    const taxAmount = subtotal * (taxPercent / 100);
    const grandTotal = subtotal + taxAmount;

    return {
      subtotal,
      taxAmount,
      grandTotal,
      depositAmount,
      gasCharges,
    };
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
   * Validate weight-based pricing requirements
   */
  async validateWeightBasedPricingRequirements(productId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    product?: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get product details
      const { data: product, error } = await this.supabase
        .from('products')
        .select(`
          id, name, sku, capacity_l, gross_weight_kg, 
          net_gas_weight_kg, tare_weight_kg, tax_rate, tax_category
        `)
        .eq('id', productId)
        .single();

      if (error || !product) {
        errors.push('Product not found');
        return { valid: false, errors, warnings };
      }

      // Check required fields for weight-based pricing
      if (!product.capacity_l || product.capacity_l <= 0) {
        errors.push('Product must have a valid capacity in liters');
      }

      if (!product.net_gas_weight_kg || product.net_gas_weight_kg <= 0) {
        errors.push('Product must have a valid net gas weight');
      }

      if (!product.gross_weight_kg || product.gross_weight_kg <= 0) {
        warnings.push('Product missing gross weight - some calculations may be incomplete');
      }

      if (!product.tare_weight_kg || product.tare_weight_kg <= 0) {
        warnings.push('Product missing tare weight - net weight calculation may be incorrect');
      }

      // Check if capacity has deposit rate
      if (product.capacity_l) {
        const depositRate = await this.getCurrentDepositRate(product.capacity_l);
        if (depositRate === 0) {
          warnings.push(`No deposit rate found for ${product.capacity_l}L capacity`);
        }
      }

      // Check for per_kg pricing in price lists
      const { data: priceLists } = await this.supabase
        .from('price_list')
        .select(`
          id, name, pricing_method,
          price_list_item!inner(product_id, unit_price)
        `)
        .eq('price_list_item.product_id', productId)
        .eq('pricing_method', 'per_kg');

      if (!priceLists || priceLists.length === 0) {
        warnings.push('No per_kg pricing method found in any price list for this product');
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        product
      };
    } catch (error) {
      this.logger.error('Error validating weight-based pricing requirements:', error);
      errors.push('Failed to validate pricing requirements');
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate deposit rate configuration
   */
  async validateDepositRateConfiguration(capacity_l: number, currency_code: string = 'KES'): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    currentRate?: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (capacity_l <= 0) {
        errors.push('Capacity must be positive');
        return { valid: false, errors, warnings };
      }

      // Check current rate
      const currentRate = await this.getCurrentDepositRate(capacity_l, currency_code);
      
      if (currentRate === 0) {
        errors.push(`No deposit rate configured for ${capacity_l}L capacity`);
      }

      // Check for multiple overlapping rates
      const { data: overlappingRates } = await this.supabase
        .from('cylinder_deposit_rates')
        .select('*')
        .eq('capacity_l', capacity_l)
        .eq('currency_code', currency_code)
        .eq('is_active', true)
        .lte('effective_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`);

      if (overlappingRates && overlappingRates.length > 1) {
        warnings.push('Multiple overlapping deposit rates found - using most recent');
      }

      // Check for upcoming rate changes
      const { data: futureRates } = await this.supabase
        .from('cylinder_deposit_rates')
        .select('effective_date, deposit_amount')
        .eq('capacity_l', capacity_l)
        .eq('currency_code', currency_code)
        .eq('is_active', true)
        .gt('effective_date', new Date().toISOString().split('T')[0])
        .order('effective_date', { ascending: true })
        .limit(1);

      if (futureRates && futureRates.length > 0) {
        warnings.push(`Rate change scheduled for ${futureRates[0].effective_date}`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        currentRate
      };
    } catch (error) {
      this.logger.error('Error validating deposit rate configuration:', error);
      errors.push('Failed to validate deposit rate configuration');
      return { valid: false, errors, warnings };
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

  /**
   * Calculate pricing with partial fill support for order creation
   * This method handles weight-based pricing with partial fill percentages and automatic deposit calculation
   */
  async calculateOrderLinePricing(
    productId: string,
    quantity: number = 1,
    fillPercentage: number = 100,
    customerId?: string,
    date?: string
  ): Promise<{
    unitPrice: number;
    subtotal: number;
    gasCharge: number;
    depositAmount: number;
    taxAmount: number;
    totalPrice: number;
    adjustedWeight: number;
    originalWeight: number;
    pricingMethod: string;
    inheritedFromParent?: boolean;
    parentProductId?: string | null;
  } | null> {
    try {
      // Get product details including weight information
      const { data: product, error: productError } = await this.supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          sku_variant,
          capacity_l,
          capacity_kg,
          gross_weight_kg,
          net_gas_weight_kg,
          tare_weight_kg,
          tax_rate,
          tax_category,
          is_variant,
          parent_products_id
        `)
        .eq('id', productId)
        .single();

      if (productError || !product) {
        this.logger.error('Product not found:', productError);
        return null;
      }

      // Get pricing information with inheritance support
      const pricingResult = await this.getProductPrice(productId, customerId, date);
      if (!pricingResult) {
        this.logger.warn('No pricing found for product:', productId);
        return null;
      }

      // Get tax rate from pricing result (which includes proper inheritance)
      const taxRate = pricingResult.taxRate || 0.16; // Default 16% VAT

      // Determine capacity for deposit lookup - use capacity_l, then capacity_kg as fallback
      const capacityForDeposit = product.capacity_l || product.capacity_kg || 0;
      
      // Get deposit amount based on capacity (always check for deposits on cylinders)
      let depositAmount = 0;
      if (capacityForDeposit > 0) {
        depositAmount = await this.getCurrentDepositRate(capacityForDeposit) || 0;
        this.logger.info(`Deposit amount for ${capacityForDeposit}L: ${depositAmount}`);
      }
      
      // Determine if this is a gas product that supports partial fills
      const isGasProduct = ['FULL-OUT', 'FULL-XCH'].includes(product.sku_variant || '') || 
                          (product.capacity_l && product.capacity_l > 0);
      
      // Check if product has weight information for partial fill calculations
      const hasWeightInfo = product.net_gas_weight_kg || 
                           (product.gross_weight_kg && product.tare_weight_kg) || 
                           product.capacity_kg;
      
      // Initialize pricing variables
      let gasCharge = pricingResult.finalPrice;
      let originalWeight = 0;
      let adjustedWeight = 0;
      let pricingMethod = 'per_unit';

      if (isGasProduct && hasWeightInfo && fillPercentage < 100) {
        // Calculate net weight
        if (product.net_gas_weight_kg) {
          originalWeight = product.net_gas_weight_kg;
        } else if (product.gross_weight_kg && product.tare_weight_kg) {
          originalWeight = product.gross_weight_kg - product.tare_weight_kg;
        } else if (product.capacity_kg) {
          originalWeight = product.capacity_kg;
        }

        if (originalWeight > 0) {
          adjustedWeight = originalWeight * (fillPercentage / 100);
          
          // For partial fills, only adjust the gas portion of the price
          // Assume gas represents the variable portion affected by fill percentage
          gasCharge = pricingResult.finalPrice * (fillPercentage / 100);
          pricingMethod = 'per_kg_partial';
          
          this.logger.info(`Partial fill calculation: ${fillPercentage}% of ${originalWeight}kg = ${adjustedWeight}kg, gas charge: ${gasCharge}`);
        }
      } else if (fillPercentage < 100) {
        // For non-gas products or products without weight info, still apply partial fill logic
        gasCharge = pricingResult.finalPrice * (fillPercentage / 100);
        pricingMethod = 'per_unit_partial';
      }

      // Calculate subtotal (gas charge + deposit)
      const subtotal = gasCharge + depositAmount;
      
      // Calculate tax (applied to gas charge only, deposits are typically not taxed)
      const taxAmount = gasCharge * taxRate;
      
      // Calculate total price
      const totalPrice = gasCharge + depositAmount + taxAmount;
      
      return {
        unitPrice: totalPrice,
        subtotal: subtotal * quantity,
        gasCharge: gasCharge * quantity,
        depositAmount: depositAmount * quantity,
        taxAmount: taxAmount * quantity,
        totalPrice: totalPrice * quantity,
        adjustedWeight,
        originalWeight,
        pricingMethod,
        inheritedFromParent: pricingResult.inheritedFromParent,
        parentProductId: pricingResult.parentProductId
      };
    } catch (error) {
      this.logger.error('Error in calculateOrderLinePricing:', error);
      throw error;
    }
  }
}