import React, { useState } from 'react';
import { RefreshCw, Download, AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import { EmptyReturnCreditsTable } from '../components/deposits/EmptyReturnCreditsTable';
import { Card } from '../components/ui/Card';

// Mock data for now - replace with actual API calls
const mockCredits = [
  {
    id: '1',
    order_id: 'order-123',
    customer_id: 'customer-456',
    product_id: 'product-789',
    quantity: 2,
    capacity_l: 13,
    unit_credit_amount: 1500,
    total_credit_amount: 3000,
    currency_code: 'KES',
    expected_return_date: '2024-01-20',
    return_deadline: '2024-02-05',
    status: 'pending' as const,
    created_at: '2024-01-15T10:00:00Z',
    order: {
      id: 'order-123',
      order_number: 'ORD-2024-001',
      order_date: '2024-01-15',
      delivery_date: '2024-01-16',
    },
    customer: {
      id: 'customer-456',
      name: 'John Doe',
      phone: '+254700123456',
    },
    product: {
      id: 'product-789',
      name: '13kg LPG Cylinder',
      sku: 'LPG-13KG-001',
      capacity_l: 13,
    },
  },
  {
    id: '2',
    order_id: 'order-124',
    customer_id: 'customer-457',
    product_id: 'product-790',
    quantity: 1,
    capacity_l: 19,
    unit_credit_amount: 2000,
    total_credit_amount: 2000,
    currency_code: 'KES',
    expected_return_date: '2024-01-10',
    return_deadline: '2024-01-25',
    status: 'pending' as const,
    created_at: '2024-01-08T14:30:00Z',
    order: {
      id: 'order-124',
      order_number: 'ORD-2024-002',
      order_date: '2024-01-08',
      delivery_date: '2024-01-09',
    },
    customer: {
      id: 'customer-457',
      name: 'Jane Smith',
      phone: '+254700654321',
    },
    product: {
      id: 'product-790',
      name: '19kg LPG Cylinder',
      sku: 'LPG-19KG-001',
      capacity_l: 19,
    },
  },
];

const mockSummary = {
  total_pending_credits: 5000,
  total_pending_quantity: 3,
  credits_expiring_soon: 2000,
  credits_overdue: 0,
};

export const EmptyReturnsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(mockCredits);

  const handleProcessReturn = async (creditId: string) => {
    console.log('Processing return for credit:', creditId);
    // TODO: Implement actual API call
    // For now, just update the status locally
    setCredits(prev => prev.map(credit => 
      credit.id === creditId 
        ? { ...credit, status: 'returned' as any, actual_return_date: new Date().toISOString().split('T')[0] }
        : credit
    ));
  };

  const handleCancelCredit = async (creditId: string, reason: string) => {
    console.log('Cancelling credit:', creditId, 'Reason:', reason);
    // TODO: Implement actual API call
    // For now, just update the status locally
    setCredits(prev => prev.map(credit => 
      credit.id === creditId 
        ? { ...credit, status: 'cancelled' as any, cancelled_reason: reason }
        : credit
    ));
  };

  const handleExpireOverdue = async () => {
    setLoading(true);
    try {
      console.log('Expiring overdue credits...');
      // TODO: Implement actual API call
      setTimeout(() => {
        setLoading(false);
        // Show success message
      }, 1000);
    } catch (error) {
      console.error('Error expiring credits:', error);
      setLoading(false);
    }
  };

  const filteredCredits = credits.filter(credit => {
    if (statusFilter === 'all') return true;
    return credit.status === statusFilter;
  });

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Empty Return Credits</h1>
          <p className="text-gray-600">Manage cylinder return credits and deadlines</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExpireOverdue}
            disabled={loading}
            className="flex items-center space-x-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>{loading ? 'Processing...' : 'Expire Overdue'}</span>
          </button>
          <button className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
          <button className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Pending</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(mockSummary.total_pending_credits)}
              </p>
              <p className="text-sm text-gray-500">{mockSummary.total_pending_quantity} cylinders</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Expiring Soon</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(mockSummary.credits_expiring_soon)}
              </p>
              <p className="text-sm text-gray-500">Within 7 days</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <Package className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Overdue</h3>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(mockSummary.credits_overdue)}
              </p>
              <p className="text-sm text-gray-500">Past deadline</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Completed Today</h3>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-500">Returns processed</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-medium text-gray-700">Filter by Status:</h3>
          <div className="flex items-center space-x-2">
            {['all', 'pending', 'returned', 'cancelled', 'expired'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Credits Table */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Empty Return Credits</h2>
          <EmptyReturnCreditsTable
            credits={filteredCredits}
            loading={loading}
            onProcessReturn={handleProcessReturn}
            onCancelCredit={handleCancelCredit}
            showCustomerInfo={true}
          />
        </div>
      </Card>
    </div>
  );
}; 