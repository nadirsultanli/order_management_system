import React from 'react';
import { Helmet } from 'react-helmet-async';
import { BarChart3, CreditCard, TrendingUp, AlertCircle } from 'lucide-react';
import PaymentSummaryDashboard from '../components/payments/PaymentSummaryDashboard';
import { useOverdueOrders } from '../hooks/usePayments';
import { formatCurrencySync } from '../utils/pricing';

const OverdueOrdersAlert: React.FC = () => {
  const { data: overdueData, isLoading } = useOverdueOrders({ limit: 5 });

  if (isLoading || !overdueData || overdueData.summary.total_overdue === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800 mb-1">
            Overdue Payments Alert
          </h3>
          <p className="text-sm text-red-700 mb-2">
            You have {overdueData.summary.total_overdue} overdue order{overdueData.summary.total_overdue > 1 ? 's' : ''} 
            totaling {formatCurrencySync(overdueData.summary.total_amount)}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {overdueData.summary.critical_count > 0 && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full">
                {overdueData.summary.critical_count} Critical
              </span>
            )}
            {overdueData.summary.high_count > 0 && (
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                {overdueData.summary.high_count} High Priority
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuickStatsCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}> = ({ title, value, subtitle, icon: Icon, color, bgColor }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="flex items-center">
      <div className={`p-3 rounded-full ${bgColor} mr-4`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const PaymentsDashboardPage: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Payment Analytics Dashboard - Order Management System</title>
        <meta 
          name="description" 
          content="Comprehensive payment analytics and statistics dashboard with real-time data visualization, payment method breakdown, and revenue insights." 
        />
      </Helmet>

      <div className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      Payment Analytics Dashboard
                    </h1>
                    <p className="text-gray-600 mt-1">
                      Monitor payment performance, analyze trends, and track revenue metrics
                    </p>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex items-center space-x-3">
                  <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Create Payment
                  </button>
                  <a 
                    href="/orders" 
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <TrendingUp className="h-4 w-4 mr-2" />
                    View Orders
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Overdue Orders Alert */}
          <OverdueOrdersAlert />

          {/* Main Dashboard */}
          <PaymentSummaryDashboard 
            showHeader={false}
            className="space-y-8"
          />

          {/* Footer Information */}
          <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Need Help with Payments?
              </h3>
              <p className="text-gray-600 mb-4">
                Access comprehensive payment guides, troubleshooting tips, and integration documentation.
              </p>
              <div className="flex justify-center space-x-4">
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Payment Guide
                </button>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  M-Pesa Integration
                </button>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Support
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="text-center text-sm text-gray-500">
              <p>
                Payment Analytics Dashboard - Last updated {new Date().toLocaleString()}
              </p>
              <p className="mt-1">
                Real-time payment monitoring and comprehensive analytics for your business.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export { PaymentsDashboardPage };
export default PaymentsDashboardPage;