import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';

// Initialize Supabase client for scheduled jobs
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Scheduled job to expire overdue empty return credits
 * Should be run daily via cron job or cloud scheduler
 */
export async function expireOverdueCredits(): Promise<void> {
  logger.info('Starting scheduled job: expire overdue credits');
  
  try {
    // Call the database function to expire overdue credits
    const { data, error } = await supabase
      .rpc('cancel_expired_empty_return_credits');

    if (error) {
      logger.error('Error expiring overdue credits:', error);
      throw error;
    }

    const expiredCount = data || 0;
    logger.info(`Expired ${expiredCount} overdue empty return credits`);

    // If we expired any credits, create deposit transactions for them
    if (expiredCount > 0) {
      // Get the newly expired credits to create deposit charges
      const { data: expiredCredits, error: fetchError } = await supabase
        .from('empty_return_credits')
        .select(`
          id,
          customer_id,
          order_id,
          total_credit_amount,
          currency_code,
          quantity,
          capacity_l,
          product:products!product_id (name)
        `)
        .eq('status', 'expired')
        .gte('updated_at', new Date(Date.now() - 60000).toISOString()); // Last minute

      if (fetchError) {
        logger.error('Error fetching expired credits:', fetchError);
        return;
      }

      // Create deposit charge transactions for expired credits
      const depositTransactions = (expiredCredits || []).map(credit => ({
        customer_id: credit.customer_id,
        transaction_type: 'charge',
        amount: credit.total_credit_amount,
        currency_code: credit.currency_code,
        order_id: credit.order_id,
        notes: `Automatic charge: Empty cylinder not returned (${credit.quantity}x ${credit.capacity_l}kg ${(credit.product as any)?.name || 'cylinders'})`,
        created_by: null, // System-generated
      }));

      if (depositTransactions.length > 0) {
        const { error: chargeError } = await supabase
          .from('deposit_transactions')
          .insert(depositTransactions);

        if (chargeError) {
          logger.error('Error creating deposit charges for expired credits:', chargeError);
        } else {
          logger.info(`Created ${depositTransactions.length} deposit charge transactions for expired credits`);
        }
      }
    }

    // Send notifications for credits expiring soon (within 3 days)
    await notifyExpiringSoon();

  } catch (error) {
    logger.error('Failed to expire overdue credits:', error);
    throw error;
  }
}

/**
 * Notify customers about credits expiring soon
 */
async function notifyExpiringSoon(): Promise<void> {
  try {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: expiringSoon, error } = await supabase
      .from('empty_return_credits')
      .select(`
        id,
        customer_id,
        total_credit_amount,
        return_deadline,
        quantity,
        capacity_l,
        customer:customers!customer_id (
          name,
          phone,
          email
        ),
        product:products!product_id (name)
      `)
      .eq('status', 'pending')
      .lte('return_deadline', threeDaysFromNow.toISOString().split('T')[0])
      .gt('return_deadline', new Date().toISOString().split('T')[0]);

    if (error) {
      logger.error('Error fetching expiring credits:', error);
      return;
    }

    if (expiringSoon && expiringSoon.length > 0) {
      logger.info(`Found ${expiringSoon.length} credits expiring within 3 days`);
      
      // TODO: Implement notification logic (SMS, email, push notifications)
      // For now, just log the notifications that would be sent
      expiringSoon.forEach(credit => {
        logger.info(`Notification needed: Customer ${(credit.customer as any)?.name} has ${credit.quantity}x ${credit.capacity_l}kg cylinders expiring on ${credit.return_deadline}`);
      });
    }

  } catch (error) {
    logger.error('Failed to notify about expiring credits:', error);
  }
}

/**
 * Express endpoint for manual execution of credit expiration
 */
export async function expireCreditsHandler(req: any, res: any): Promise<void> {
  try {
    await expireOverdueCredits();
    res.json({ 
      success: true, 
      message: 'Credit expiration job completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Credit expiration job failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Credit expiration job failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Export for use in cron jobs or cloud functions
if (require.main === module) {
  // Run immediately if called directly
  expireOverdueCredits()
    .then(() => {
      logger.info('Credit expiration job completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Credit expiration job failed:', error);
      process.exit(1);
    });
} 