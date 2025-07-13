import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const router = express.Router();

const {
  MPESA_CONSUMER_KEY,
  MPESA_CONSUMER_SECRET,
  MPESA_BASE_URL,
  MPESA_SHORTCODE,
  MPESA_PASSKEY,
  MPESA_CALLBACK_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

// Initialize Supabase client for webhook processing
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// =============================================================================
// TRANSACTION STATUS POLLING INTERFACES
// =============================================================================

interface TransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  OriginatorConversationID?: string;
  ConversationID?: string;
  TransactionID?: string;
  ResultCode?: string;
  ResultDesc?: string;
}

// =============================================================================
// MPESA TOKEN MANAGEMENT
// =============================================================================

// Function to get OAuth token
export async function getMpesaToken(): Promise<string> {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const res = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  return res.data.access_token;
}

// =============================================================================
// WEBHOOK ENDPOINTS
// =============================================================================

// Validation endpoint (for Daraja to hit)
router.post('/api/mpesa/validation', (req: Request, res: Response) => {
  const payload = req.body;
  console.log('Validation received:', payload);

  // Optional: Validate the payload contents before accepting
  // This is called before the payment is processed

  return res.json({
    ResultCode: 0,
    ResultDesc: 'Accepted',
  });
});

// Confirmation endpoint (for Daraja to hit)
router.post('/api/mpesa/confirmation', async (req: Request, res: Response) => {
  const payload = req.body;
  console.log('Confirmation received:', payload);

  try {
    // Extract payment details from webhook payload
    const {
      Body: {
        stkCallback: {
          CheckoutRequestID,
          ResultCode,
          ResultDesc,
          CallbackMetadata,
        },
      },
    } = payload;

    console.log('Processing Mpesa confirmation:', {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
    });

    // Find the payment record by transaction_id (CheckoutRequestID)
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', CheckoutRequestID)
      .single();

    if (fetchError || !payment) {
      console.error('Payment not found for CheckoutRequestID:', CheckoutRequestID);
      return res.json({
        ResultCode: 0,
        ResultDesc: 'Accepted - Payment not found',
      });
    }

    // Check if we already processed this MpesaReceiptNumber (idempotency)
    if (CallbackMetadata && CallbackMetadata.Item) {
      const items = CallbackMetadata.Item;
      const mpesaReceiptNumber = items.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      
      if (mpesaReceiptNumber) {
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('metadata->>mpesa_receipt_number', mpesaReceiptNumber)
          .single();
        
        if (existingPayment) {
          console.log(`🔄 Duplicate webhook for receipt: ${mpesaReceiptNumber}`);
          return res.json({ ResultCode: 0, ResultDesc: 'Already processed' });
        }
      }
    }

    // Determine payment status based on Mpesa result code
    let paymentStatus: 'completed' | 'failed' | 'pending' = 'pending';
    let transactionId = payment.transaction_id;
    let metadata = payment.metadata || {};

    if (ResultCode === '0') {
      // Payment successful
      paymentStatus = 'completed';
      
      // Extract additional transaction details if available
      if (CallbackMetadata && CallbackMetadata.Item) {
        const items = CallbackMetadata.Item;
        const mpesaReceiptNumber = items.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
        const transactionDate = items.find((item: any) => item.Name === 'TransactionDate')?.Value;
        const phoneNumber = items.find((item: any) => item.Name === 'PhoneNumber')?.Value;

        if (mpesaReceiptNumber) {
          transactionId = mpesaReceiptNumber;
        }

        metadata = {
          ...metadata,
          mpesa_receipt_number: mpesaReceiptNumber,
          mpesa_transaction_date: transactionDate,
          mpesa_phone_number: phoneNumber,
          webhook_processed_at: new Date().toISOString(),
          webhook_result_code: ResultCode,
          webhook_result_desc: ResultDesc,
        };
      }
    } else {
      // Payment failed
      paymentStatus = 'failed';
      metadata = {
        ...metadata,
        webhook_processed_at: new Date().toISOString(),
        webhook_result_code: ResultCode,
        webhook_result_desc: ResultDesc,
        failure_reason: ResultDesc,
      };
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        payment_status: paymentStatus,
        transaction_id: transactionId,
        metadata: metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Failed to update payment status:', updateError);
      return res.json({
        ResultCode: 1,
        ResultDesc: 'Failed to update payment status',
      });
    }

    console.log('Payment status updated successfully:', {
      payment_id: payment.id,
      order_id: payment.order_id,
      status: paymentStatus,
      transaction_id: transactionId,
    });

    // If payment is completed, update order payment status
    if (paymentStatus === 'completed') {
      // Update order payment status cache
      const { error: orderUpdateError } = await supabase
        .rpc('update_order_payment_status_cache', { p_order_id: payment.order_id });

      if (orderUpdateError) {
        console.error('Failed to update order payment status:', orderUpdateError);
      }

      // Step 12: Handle payment completion and order status updates
      await handlePaymentCompletion(payment, supabase);
    }

    return res.json({
      ResultCode: 0,
      ResultDesc: 'Accepted',
    });

  } catch (error) {
    console.error('Error processing Mpesa confirmation:', error);
    return res.json({
      ResultCode: 1,
      ResultDesc: 'Internal server error',
    });
  }
});

// Status result webhook endpoints
router.post('/api/mpesa/status-result', (req: Request, res: Response) => {
  console.log('Status result received:', req.body);
  return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

router.post('/api/mpesa/status-timeout', (req: Request, res: Response) => {
  console.log('Status timeout received:', req.body);
  return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Additional endpoint to check payment status
router.get('/api/mpesa/status/:checkoutRequestId', async (req: Request, res: Response) => {
  const { checkoutRequestId } = req.params;

  try {
    // Find payment by CheckoutRequestID
    const { data: payment, error } = await supabase
      .from('payments')
      .select(`
        *,
        order:orders(
          id,
          total_amount,
          status,
          customer:customers(id, name, email)
        )
      `)
      .eq('transaction_id', checkoutRequestId)
      .single();

    if (error || !payment) {
      return res.status(404).json({
        error: 'Payment not found',
      });
    }

    return res.json({
      payment_id: payment.id,
      order_id: payment.order_id,
      amount: payment.amount,
      payment_status: payment.payment_status,
      payment_method: payment.payment_method,
      transaction_id: payment.transaction_id,
      payment_date: payment.payment_date,
      metadata: payment.metadata,
      order: payment.order,
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

// =============================================================================
// PAYMENT PROCESSING HELPERS
// =============================================================================

// Helper function to handle payment completion and order status updates
export async function handlePaymentCompletion(payment: any, supabase: any) {
  try {
    // Check if order is in a status that can be marked as paid
    const { data: order, error: orderFetchError } = await supabase
      .from('orders')
      .select('id, status, total_amount, customer_id')
      .eq('id', payment.order_id)
      .single();

    if (orderFetchError) {
      console.error('Failed to fetch order for status update:', orderFetchError);
      return;
    }

    if (!order || !['invoiced', 'delivered'].includes(order.status)) {
      console.log('Order not in correct status for payment processing:', {
        order_id: payment.order_id,
        status: order?.status,
      });
      return;
    }

    // Calculate total paid amount
    const { data: allPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', payment.order_id)
      .eq('payment_status', 'completed');

    if (paymentsError) {
      console.error('Failed to fetch payments for calculation:', paymentsError);
      return;
    }

    const totalPaid = allPayments?.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) || 0;
    const orderTotal = order.total_amount || 0;
    const balance = orderTotal - totalPaid;

    console.log('Payment analysis:', {
      order_id: payment.order_id,
      order_total: orderTotal,
      total_paid: totalPaid,
      balance: balance,
      payment_amount: payment.amount,
    });

    // Handle different payment scenarios
    if (balance <= 0) {
      // Full payment or overpayment
      const { error: statusUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.order_id);

      if (statusUpdateError) {
        console.error('Failed to update order status to paid:', statusUpdateError);
      } else {
        console.log('✅ Order marked as paid:', {
          order_id: payment.order_id,
          total_paid: totalPaid,
          order_total: orderTotal,
        });

        // Handle overpayment - create customer credit if applicable
        if (balance < 0 && order.customer_id) {
          const overpaymentAmount = Math.abs(balance);
          console.log('💰 Overpayment detected - creating customer credit:', {
            customer_id: order.customer_id,
            overpayment_amount: overpaymentAmount,
          });

          // Note: In a full implementation, you would create a customer credit record here
          // For now, we'll just log it. You can extend this to create customer credits table
          // and handle the accounting entries as outlined in the workflow.
        }
      }
    } else {
      // Partial payment - order remains invoiced
      console.log('💰 Partial payment received - order remains invoiced:', {
        order_id: payment.order_id,
        total_paid: totalPaid,
        order_total: orderTotal,
        remaining: balance,
      });
    }
  } catch (error) {
    console.error('Error in payment completion handling:', error);
  }
}

// =============================================================================
// TRANSACTION STATUS POLLING SYSTEM
// =============================================================================

// Query M-Pesa transaction status
async function queryTransactionStatus(checkoutRequestId: string): Promise<TransactionStatusResponse> {
  const token = await getMpesaToken();
  
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
  const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  
  const payload = {
    Initiator: MPESA_SHORTCODE,
    SecurityCredential: password,
    CommandID: 'TransactionStatusQuery',
    TransactionID: checkoutRequestId,
    PartyA: MPESA_SHORTCODE,
    IdentifierType: '4',
    ResultURL: `${MPESA_CALLBACK_URL}/api/mpesa/status-result`,
    QueueTimeOutURL: `${MPESA_CALLBACK_URL}/api/mpesa/status-timeout`,
    Remarks: 'Transaction status query',
    Occasion: 'Status check',
  };

  console.log('Querying transaction status for:', checkoutRequestId);

  try {
    const response = await axios.post(
      `${MPESA_BASE_URL}/mpesa/transactionstatus/v1/query`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error:any) {
    console.error('Transaction status query failed:', error.response?.data || error.message);
    throw error;
  }
}

// Find payments that need status checking
async function findPendingPayments() {
  // Get payments that are:
  // 1. Still pending
  // 2. Created more than 5 minutes ago (webhook should have arrived)
  // 3. Not checked in the last 10 minutes (avoid spam)
  
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: payments, error } = await supabase
    .from('payments')
    .select('*')
    .eq('payment_method', 'Mpesa')
    .eq('payment_status', 'pending')
    .lt('created_at', fiveMinutesAgo)
    .or(`metadata->last_status_check.is.null,metadata->last_status_check.lt.${tenMinutesAgo}`)
    .limit(50); // Process max 50 at a time

  if (error) {
    console.error('Error fetching pending payments:', error);
    return [];
  }

  return payments || [];
}

// Update payment based on transaction status
async function updatePaymentFromStatus(payment: any, statusResponse: TransactionStatusResponse) {
  let paymentStatus: 'pending' | 'completed' | 'failed' = 'pending';
  let updatedMetadata = { ...payment.metadata };

  // Update last check timestamp
  updatedMetadata.last_status_check = new Date().toISOString();
  updatedMetadata.status_query_response = statusResponse;

  // Determine status based on response
  if (statusResponse.ResponseCode === '0') {
    // Query was successful, check result
    if (statusResponse.ResultCode === '0') {
      paymentStatus = 'completed';
      updatedMetadata.transaction_confirmed_via_polling = true;
      updatedMetadata.transaction_id = statusResponse.TransactionID || payment.transaction_id;
    } else {
      paymentStatus = 'failed';
      updatedMetadata.failure_reason = statusResponse.ResultDesc || 'Transaction failed';
    }
  } else {
    // Query failed - might be too early or transaction doesn't exist
    console.log(`Status query failed for ${payment.id}: ${statusResponse.ResponseDescription}`);
    // Keep as pending, but update metadata
  }

  // Update payment in database
  const { error: updateError } = await supabase
    .from('payments')
    .update({
      payment_status: paymentStatus,
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  if (updateError) {
    console.error(`Failed to update payment ${payment.id}:`, updateError);
    return false;
  }

  // If completed, update order payment status
  if (paymentStatus === 'completed') {
    const { error: orderUpdateError } = await supabase
      .rpc('update_order_payment_status_cache', { p_order_id: payment.order_id });

    if (orderUpdateError) {
      console.error('Failed to update order payment status:', orderUpdateError);
    }

    // Step 12: Handle payment completion and order status updates
    await handlePaymentCompletion(payment, supabase);

    console.log(`✅ Payment ${payment.id} marked as completed via polling`);
  } else if (paymentStatus === 'failed') {
    console.log(`❌ Payment ${payment.id} marked as failed via polling`);
  }

  return true;
}

// Main polling function
export async function runTransactionStatusPolling() {
  console.log('🔍 Starting M-Pesa transaction status polling...');
  
  try {
    const pendingPayments = await findPendingPayments();
    console.log(`Found ${pendingPayments.length} pending payments to check`);

    if (pendingPayments.length === 0) {
      return;
    }

    const results = {
      checked: 0,
      completed: 0,
      failed: 0,
      errors: 0,
    };

    // Process each payment
    for (const payment of pendingPayments) {
      try {
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        const statusResponse = await queryTransactionStatus(payment.transaction_id);
        const updated = await updatePaymentFromStatus(payment, statusResponse);
        
        if (updated) {
          results.checked++;
          
          if (payment.payment_status === 'completed') results.completed++;
          if (payment.payment_status === 'failed') results.failed++;
        } else {
          results.errors++;
        }

      } catch (error: any) {
        console.error(`Error checking payment ${payment.id}:`, error.message);
        results.errors++;
        
        // Update metadata to track the error
        await supabase
          .from('payments')
          .update({
            metadata: {
              ...payment.metadata,
              last_status_check: new Date().toISOString(),
              last_status_error: error.message,
            }
          })
          .eq('id', payment.id);
      }
    }

    console.log('📊 Polling completed:', results);
    
    // Log summary to help with monitoring
    if (results.completed > 0 || results.failed > 0) {
      console.log(`🎯 Status polling recovered ${results.completed + results.failed} payments`);
    }

  } catch (error) {
    console.error('❌ Transaction status polling failed:', error);
  }
}

// Manual status check function
export async function manualStatusCheck(checkoutRequestId: string) {
  console.log(`🔍 Manual status check for: ${checkoutRequestId}`);
  
  try {
    // Find the payment
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('transaction_id', checkoutRequestId)
      .single();

    if (error || !payment) {
      throw new Error(`Payment not found for checkout request: ${checkoutRequestId}`);
    }

    // Query status
    const statusResponse = await queryTransactionStatus(checkoutRequestId);
    
    // Update payment
    const updated = await updatePaymentFromStatus(payment, statusResponse);
    
    if (updated) {
      // Step 12: Handle payment completion and order status updates
      await handlePaymentCompletion(payment, supabase);

      console.log(`✅ Manual status check completed for ${checkoutRequestId}`);
      return { success: true, payment_status: payment.payment_status };
    } else {
      throw new Error('Failed to update payment');
    }

  } catch (error: any) {
    console.error(`❌ Manual status check failed:`, error);
    return { success: false, error: error.message };
  }
}

// Cleanup job to mark old pending Mpesa payments as failed
export async function cleanupOldPendingPayments() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Fetch old pending payments
  const { data: oldPayments, error } = await supabase
    .from('payments')
    .select('id, metadata')
    .eq('payment_method', 'Mpesa')
    .eq('payment_status', 'pending')
    .lt('created_at', oneDayAgo);

  if (error) {
    console.error('Error fetching old pending payments:', error);
    return;
  }

  if (!oldPayments || oldPayments.length === 0) {
    console.log('🧹 No old pending payments to clean up');
    return;
  }

  // Update each payment to failed and add cleanup_reason
  for (const payment of oldPayments) {
    const updatedMetadata = {
      ...(payment.metadata || {}),
      cleanup_reason: 'Expired',
      cleanup_at: new Date().toISOString(),
    };
    await supabase
      .from('payments')
      .update({ payment_status: 'failed', metadata: updatedMetadata })
      .eq('id', payment.id);
  }

  console.log(`🧹 Cleaned up ${oldPayments.length} old pending payments`);
}

export default router;