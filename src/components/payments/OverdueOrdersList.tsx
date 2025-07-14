import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  Calendar,
  DollarSign,
  User,
  Phone,
  Mail,
  CreditCard,
  Smartphone,
  Banknote,
  RefreshCw,
  Filter,
  Download,
  ExternalLink,
  ChevronRight,
  Building,
  MapPin,
  Receipt,
  Send,
  TrendingUp,
  AlertCircle,
  Zap
} from 'lucide-react';
import { Card } from '../ui/Card';
import { StatusBadge } from '../ui/StatusBadge';
import { OverdueOrderItem, OverdueOrdersSummary, PaymentMethod } from '../../types/payment';
import { formatCurrencySync } from '../../utils/pricing';
import { formatDateSync } from '../../utils/order';

interface OverdueOrdersListProps {
  orders: OverdueOrderItem[];
  summary: OverdueOrdersSummary;
  loading?: boolean;
  onOrderClick?: (order: OverdueOrderItem) => void;
  onCreatePayment?: (orderId: string, method: PaymentMethod) => void;
  onContactCustomer?: (customerId: string, type: 'email' | 'phone') => void;
  onRefresh?: () => void;
  onExport?: () => void;
  daysOverdueFilter?: number;
  onDaysFilterChange?: (days: number) => void;
}

// Urgency level configurations
const getUrgencyConfig = (urgencyLevel: string) => {
  switch (urgencyLevel) {
    case 'critical':
      return {
        color: 'text-red-600',
        bg: 'bg-red-100',
        border: 'border-red-200',
        icon: <Zap className="h-4 w-4" />,
        label: 'Critical',
        description: 'Immediate attention required'
      };
    case 'high':
      return {
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        border: 'border-orange-200',
        icon: <AlertTriangle className="h-4 w-4" />,
        label: 'High',
        description: 'Urgent action needed'
      };
    case 'medium':
      return {
        color: 'text-yellow-600',
        bg: 'bg-yellow-100',
        border: 'border-yellow-200',
        icon: <Clock className="h-4 w-4" />,
        label: 'Medium',
        description: 'Follow up soon'
      };
    default:
      return {
        color: 'text-gray-600',
        bg: 'bg-gray-100',
        border: 'border-gray-200',
        icon: <AlertCircle className="h-4 w-4" />,
        label: 'Low',
        description: 'Monitor status'
      };
  }
};

// Calculate days overdue
const calculateDaysOverdue = (paymentDueDate: string): number => {
  const dueDate = new Date(paymentDueDate);
  const today = new Date();
  const diffTime = today.getTime() - dueDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Payment method options for quick actions
const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'Cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'Mpesa', label: 'M-Pesa', icon: <Smartphone className="h-4 w-4" /> },
  { value: 'Card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
];

export const OverdueOrdersList: React.FC<OverdueOrdersListProps> = ({
  orders,
  summary,
  loading = false,
  onOrderClick,
  onCreatePayment,
  onContactCustomer,
  onRefresh,
  onExport,
  daysOverdueFilter = 1,
  onDaysFilterChange,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'days_overdue' | 'amount' | 'urgency'>('days_overdue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Sort orders
  const sortedOrders = [...orders].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'days_overdue':
        aValue = a.days_overdue;
        bValue = b.days_overdue;
        break;
      case 'amount':
        aValue = a.total_amount;
        bValue = b.total_amount;
        break;
      case 'urgency':
        const urgencyOrder = { critical: 3, high: 2, medium: 1 };
        aValue = urgencyOrder[a.urgency_level as keyof typeof urgencyOrder] || 0;
        bValue = urgencyOrder[b.urgency_level as keyof typeof urgencyOrder] || 0;
        break;
      default:
        return 0;
    }

    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  // Group orders by urgency for display
  const ordersByUrgency = {
    critical: sortedOrders.filter(order => order.urgency_level === 'critical'),
    high: sortedOrders.filter(order => order.urgency_level === 'high'),
    medium: sortedOrders.filter(order => order.urgency_level === 'medium'),
  };

  // Handle selection
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedOrders(checked ? orders.map(order => order.id) : []);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <div className="p-6">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </Card>
        
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <div className="p-6">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[1, 2].map((j) => (
                  <div key={j} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Overdue Orders</h2>
              <p className="text-sm text-gray-500 mt-1">
                Orders requiring immediate attention for payment collection
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              )}

              {onExport && (
                <button
                  onClick={onExport}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  showFilters ? 'border-blue-300 text-blue-700 bg-blue-50' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Zap className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-red-900">Critical</p>
                  <p className="text-2xl font-bold text-red-900">{summary.critical_count}</p>
                </div>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-orange-900">High Priority</p>
                  <p className="text-2xl font-bold text-orange-900">{summary.high_count}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Receipt className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-blue-900">Total Overdue</p>
                  <p className="text-2xl font-bold text-blue-900">{summary.total_overdue}</p>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-green-900">Total Amount</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrencySync(summary.total_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Days Overdue
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={daysOverdueFilter}
                    onChange={(e) => onDaysFilterChange?.(parseInt(e.target.value) || 1)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="days_overdue">Days Overdue</option>
                    <option value="amount">Amount</option>
                    <option value="urgency">Urgency Level</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sort Direction
                  </label>
                  <select
                    value={sortDirection}
                    onChange={(e) => setSortDirection(e.target.value as typeof sortDirection)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="desc">Highest First</option>
                    <option value="asc">Lowest First</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Orders by Urgency */}
      {Object.entries(ordersByUrgency).map(([urgency, urgencyOrders]) => {
        if (urgencyOrders.length === 0) return null;

        const urgencyConfig = getUrgencyConfig(urgency);

        return (
          <Card key={urgency}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${urgencyConfig.bg}`}>
                    <div className={urgencyConfig.color}>
                      {urgencyConfig.icon}
                    </div>
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-lg font-semibold ${urgencyConfig.color}`}>
                      {urgencyConfig.label} Priority ({urgencyOrders.length})
                    </h3>
                    <p className="text-sm text-gray-500">{urgencyConfig.description}</p>
                  </div>
                </div>

                {selectedOrders.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">
                      {selectedOrders.length} selected
                    </span>
                    {/* Add bulk action buttons here if needed */}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {urgencyOrders.map((order) => {
                  const isSelected = selectedOrders.includes(order.id);
                  
                  return (
                    <div
                      key={order.id}
                      className={`border rounded-lg p-4 transition-all ${
                        isSelected ? 'border-blue-300 bg-blue-50' : `${urgencyConfig.border} hover:bg-gray-50`
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectOrder(order.id, e.target.checked)}
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />

                          <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Order Info */}
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-gray-900">
                                Order #{order.id.slice(0, 8)}...
                              </p>
                              <p className="text-lg font-bold text-gray-900">
                                {formatCurrencySync(order.total_amount)}
                              </p>
                              <StatusBadge status={order.status} size="sm" />
                            </div>

                            {/* Customer Info */}
                            <div className="space-y-1">
                              {order.customer ? (
                                <>
                                  <div className="flex items-center text-sm text-gray-900">
                                    <User className="h-4 w-4 mr-1 text-gray-400" />
                                    {order.customer.name}
                                  </div>
                                  <div className="flex items-center text-sm text-gray-500">
                                    <Mail className="h-4 w-4 mr-1 text-gray-400" />
                                    {order.customer.email}
                                  </div>
                                  {order.customer.phone && (
                                    <div className="flex items-center text-sm text-gray-500">
                                      <Phone className="h-4 w-4 mr-1 text-gray-400" />
                                      {order.customer.phone}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="text-sm text-gray-400">No customer info</span>
                              )}
                            </div>

                            {/* Overdue Info */}
                            <div className="space-y-1">
                              <div className="flex items-center text-sm">
                                <Clock className={`h-4 w-4 mr-1 ${urgencyConfig.color}`} />
                                <span className={`font-medium ${urgencyConfig.color}`}>
                                  {order.days_overdue} days overdue
                                </span>
                              </div>
                              {order.payment_due_date && (
                                <div className="flex items-center text-sm text-gray-500">
                                  <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                                  Due: {formatDateSync(order.payment_due_date)}
                                </div>
                              )}
                              {order.payment_status_cache && (
                                <StatusBadge status={order.payment_status_cache} size="sm" />
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end space-x-2">
                              {onOrderClick && (
                                <button
                                  onClick={() => onOrderClick(order)}
                                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View
                                </button>
                              )}

                              {/* Quick Payment Actions */}
                              <div className="flex space-x-1">
                                {paymentMethods.map((method) => (
                                  <button
                                    key={method.value}
                                    onClick={() => onCreatePayment?.(order.id, method.value)}
                                    className={`inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500`}
                                    title={`Process ${method.label} payment`}
                                  >
                                    {method.icon}
                                  </button>
                                ))}
                              </div>

                              {/* Contact Actions */}
                              {order.customer && (
                                <div className="flex space-x-1">
                                  {order.customer.email && onContactCustomer && (
                                    <button
                                      onClick={() => onContactCustomer(order.customer!.id, 'email')}
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      title="Send email reminder"
                                    >
                                      <Mail className="h-3 w-3" />
                                    </button>
                                  )}
                                  
                                  {order.customer.phone && onContactCustomer && (
                                    <button
                                      onClick={() => onContactCustomer(order.customer!.id, 'phone')}
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 rounded text-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      title="Call customer"
                                    >
                                      <Phone className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}

      {/* No Orders State */}
      {orders.length === 0 && !loading && (
        <Card>
          <div className="p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Overdue Orders
            </h3>
            <p className="text-gray-500">
              Great! All orders are up to date with their payments.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};