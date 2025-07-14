import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  TrendingDown, 
  FileDown, 
  Phone, 
  Mail, 
  RefreshCw,
  Calendar,
  DollarSign,
  Clock,
  Users
} from 'lucide-react';
import { OverdueOrdersList } from '../components/payments/OverdueOrdersList';
import { useOverdueOrders, useCreatePayment, useInitiateMpesa } from '../hooks/usePayments';
import { OverdueOrderItem, PaymentMethod } from '../types/payment';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';

export const OverdueOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [daysOverdueFilter, setDaysOverdueFilter] = useState(1);
  const [selectedUrgencyFilter, setSelectedUrgencyFilter] = useState<string>('');

  // Hooks
  const {
    data: overdueData,
    isLoading,
    error,
    refetch,
  } = useOverdueOrders({
    days_overdue_min: daysOverdueFilter,
    limit: 100,
  });

  const createPayment = useCreatePayment();
  const initiateMpesa = useInitiateMpesa();

  // Filter orders by urgency if selected
  const filteredOrders = selectedUrgencyFilter 
    ? overdueData?.orders.filter(order => order.urgency_level === selectedUrgencyFilter) || []
    : overdueData?.orders || [];

  // Handle order click - navigate to order detail
  const handleOrderClick = useCallback((order: OverdueOrderItem) => {
    navigate(`/orders/${order.id}`);
  }, [navigate]);

  // Handle create payment
  const handleCreatePayment = useCallback(async (orderId: string, method: PaymentMethod) => {
    try {
      // For now, navigate to create payment page with pre-filled order ID
      navigate(`/payments/create?orderId=${orderId}&method=${method}`);
    } catch (error) {
      console.error('Failed to create payment:', error);
      toast.error('Failed to create payment');
    }
  }, [navigate]);

  // Handle contact customer
  const handleContactCustomer = useCallback((customerId: string, type: 'email' | 'phone') => {
    // Find the order with this customer
    const order = overdueData?.orders.find(o => o.customer?.id === customerId);
    if (!order?.customer) {
      toast.error('Customer information not found');
      return;
    }

    if (type === 'email') {
      const subject = `Payment Reminder - Order ${order.id}`;
      const body = `Dear ${order.customer.name},\n\nThis is a friendly reminder that your order ${order.id} for ${order.total_amount} is overdue by ${order.days_overdue} days.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\nYour Order Management Team`;
      
      const mailtoLink = `mailto:${order.customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(mailtoLink);
      
      toast.success('Email client opened with reminder message');
    } else if (type === 'phone') {
      if (order.customer.phone) {
        const telLink = `tel:${order.customer.phone}`;
        window.open(telLink);
        toast.success('Phone dialer opened');
      } else {
        toast.error('Phone number not available for this customer');
      }
    }
  }, [overdueData]);

  // Handle export
  const handleExport = useCallback(() => {
    if (!overdueData?.orders.length) {
      toast.error('No overdue orders to export');
      return;
    }

    // Create CSV data
    const headers = [
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Order Total',
      'Order Status',
      'Payment Status',
      'Days Overdue',
      'Urgency Level',
      'Payment Due Date',
      'Invoice Date'
    ];

    const csvData = [
      headers.join(','),
      ...overdueData.orders.map(order => [
        order.id,
        order.customer?.name || '',
        order.customer?.email || '',
        order.customer?.phone || '',
        order.total_amount,
        order.status,
        order.payment_status_cache || '',
        order.days_overdue,
        order.urgency_level,
        order.payment_due_date || '',
        order.invoice_date || ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `overdue-orders-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Overdue orders exported successfully');
  }, [overdueData]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Handle bulk email reminders
  const handleBulkEmailReminders = useCallback(() => {
    const ordersWithEmail = filteredOrders.filter(order => order.customer?.email);
    
    if (ordersWithEmail.length === 0) {
      toast.error('No orders with customer email addresses found');
      return;
    }

    // Create bulk email with all customers
    const subject = 'Payment Reminder - Overdue Orders';
    const recipients = ordersWithEmail.map(order => order.customer!.email).join(',');
    
    const mailtoLink = `mailto:?bcc=${encodeURIComponent(recipients)}&subject=${encodeURIComponent(subject)}`;
    window.open(mailtoLink);
    
    toast.success(`Email client opened for ${ordersWithEmail.length} customers`);
  }, [filteredOrders]);

  // Error handling
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6 max-w-md mx-auto">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Error Loading Overdue Orders
            </h2>
            <p className="text-gray-600 mb-4">
              {error.message || 'Failed to load overdue orders data'}
            </p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                Overdue Orders
              </h1>
              <p className="text-gray-600 mt-2">
                Manage orders requiring immediate attention for payment collection
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleBulkEmailReminders}
                disabled={filteredOrders.length === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Mail className="h-4 w-4 mr-2" />
                Bulk Email Reminders
              </button>

              <button
                onClick={handleExport}
                disabled={!overdueData?.orders.length}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileDown className="h-4 w-4 mr-2" />
                Export to CSV
              </button>

              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filters */}
        {overdueData && (
          <div className="mb-6">
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Days Overdue (Minimum)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={daysOverdueFilter}
                        onChange={(e) => setDaysOverdueFilter(parseInt(e.target.value) || 1)}
                        className="block w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Urgency Level
                      </label>
                      <select
                        value={selectedUrgencyFilter}
                        onChange={(e) => setSelectedUrgencyFilter(e.target.value)}
                        className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">All Levels</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Showing {filteredOrders.length} of {overdueData.orders.length} overdue orders
                    </p>
                    <p className="text-lg font-semibold text-gray-900">
                      Total Amount: {overdueData.summary ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      }).format(overdueData.summary.total_amount) : '$0.00'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Key Metrics */}
        {overdueData?.summary && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-red-100 rounded-lg">
                      <Clock className="h-6 w-6 text-red-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Average Days Overdue</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {overdueData.orders.length > 0 
                          ? Math.round(overdueData.orders.reduce((sum, order) => sum + order.days_overdue, 0) / overdueData.orders.length)
                          : 0
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <DollarSign className="h-6 w-6 text-orange-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Average Order Value</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {overdueData.orders.length > 0 
                          ? new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD'
                            }).format(overdueData.summary.total_amount / overdueData.orders.length)
                          : '$0.00'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Unique Customers</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {new Set(overdueData.orders.map(order => order.customer?.id).filter(Boolean)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <TrendingDown className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-500">Collection Rate Target</p>
                      <p className="text-2xl font-bold text-gray-900">85%</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Overdue Orders List */}
        <OverdueOrdersList
          orders={filteredOrders}
          summary={overdueData?.summary || {
            total_overdue: 0,
            total_amount: 0,
            critical_count: 0,
            high_count: 0,
          }}
          loading={isLoading}
          onOrderClick={handleOrderClick}
          onCreatePayment={handleCreatePayment}
          onContactCustomer={handleContactCustomer}
          onRefresh={handleRefresh}
          onExport={handleExport}
          daysOverdueFilter={daysOverdueFilter}
          onDaysFilterChange={setDaysOverdueFilter}
        />

        {/* Action Guidelines */}
        <div className="mt-8">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Collection Guidelines</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2 flex items-center">
                    <Clock className="h-4 w-4 mr-2" />
                    Critical (30+ days)
                  </h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• Immediate phone call required</li>
                    <li>• Consider collection agency</li>
                    <li>• Legal action if necessary</li>
                    <li>• Suspend future orders</li>
                  </ul>
                </div>

                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <h4 className="font-medium text-orange-900 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    High Priority (15-29 days)
                  </h4>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>• Send formal demand letter</li>
                    <li>• Schedule payment plan call</li>
                    <li>• Daily follow-up emails</li>
                    <li>• Escalate to manager</li>
                  </ul>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2 flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    Medium Priority (1-14 days)
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Send friendly reminder email</li>
                    <li>• Offer payment assistance</li>
                    <li>• Follow up in 3-5 days</li>
                    <li>• Maintain good relationship</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};