import React, { useState, ErrorBoundary } from 'react';
import { LoadTransferForm } from '../components/transfers/LoadTransferForm';
import { ReturnTransferForm } from '../components/transfers/ReturnTransferForm';
import { MultiSkuTransferForm } from '../components/transfers/MultiSkuTransferForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { Truck, ArrowLeftRight, Package, AlertCircle } from 'lucide-react';

// Error Boundary Component
class TransferErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Transfer page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Something went wrong
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>There was an error loading this section. Please refresh the page or try again later.</p>
                {this.state.error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">Error details</summary>
                    <pre className="mt-1 text-xs">{this.state.error.message}</pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const TransfersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('load');

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Transfers</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage inventory transfers between warehouses and trucks
        </p>
      </div>

      <TransferErrorBoundary>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="load" className="flex items-center space-x-2">
              <Truck className="h-4 w-4" />
              <span>Load Truck</span>
            </TabsTrigger>
            <TabsTrigger value="return" className="flex items-center space-x-2">
              <ArrowLeftRight className="h-4 w-4" />
              <span>Return to Warehouse</span>
            </TabsTrigger>
            <TabsTrigger value="multi-sku" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Multi-SKU Transfer</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Load Truck</h2>
                <TransferErrorBoundary>
                  <LoadTransferForm />
                </TransferErrorBoundary>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="return">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Return to Warehouse</h2>
                <TransferErrorBoundary>
                  <ReturnTransferForm />
                </TransferErrorBoundary>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="multi-sku">
            <TransferErrorBoundary>
              <MultiSkuTransferForm
                onTransferCreated={(transferId) => {
                  console.log('Transfer created:', transferId);
                  // Could navigate to transfer details or show success message
                }}
              />
            </TransferErrorBoundary>
          </TabsContent>
        </Tabs>
      </TransferErrorBoundary>
    </div>
  );
}; 