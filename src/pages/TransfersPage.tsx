import React, { useState, ErrorBoundary } from 'react';
import { LoadTransferForm } from '../components/transfers/LoadTransferForm';
import { ReturnTransferForm } from '../components/transfers/ReturnTransferForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { Truck, ArrowLeftRight, Package, AlertCircle } from 'lucide-react';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

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
  const utils = trpc.useContext();

  const handleTransferSuccess = (transferId: string) => {
    console.log('Transfer created successfully:', transferId);
    toast.success('Transfer created successfully!');
    
    // Invalidate all relevant queries to refresh data
    utils.inventory.list.invalidate();
    utils.inventory.getByWarehouse.invalidate();
    utils.inventory.getStats.invalidate();
    utils.trucks.list.invalidate();
    utils.trucks.get.invalidate();
    utils.transfers.list.invalidate();
  };

  const handleLoadTransferSuccess = () => {
    console.log('Load transfer completed successfully');
    toast.success('Truck loaded successfully!');
    
    // Invalidate all relevant queries to refresh data
    utils.inventory.list.invalidate();
    utils.inventory.getByWarehouse.invalidate();
    utils.inventory.getStats.invalidate();
    utils.trucks.list.invalidate();
    utils.trucks.get.invalidate();
  };

  const handleReturnTransferSuccess = () => {
    console.log('Return transfer completed successfully');
    toast.success('Return transfer completed successfully!');
    
    // Invalidate all relevant queries to refresh data
    utils.inventory.list.invalidate();
    utils.inventory.getByWarehouse.invalidate();
    utils.inventory.getStats.invalidate();
    utils.trucks.list.invalidate();
    utils.trucks.get.invalidate();
    utils.transfers.list.invalidate();
  };

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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="load" className="flex items-center space-x-2">
              <Truck className="h-4 w-4" />
              <span>Load Truck</span>
            </TabsTrigger>
            <TabsTrigger value="return" className="flex items-center space-x-2">
              <ArrowLeftRight className="h-4 w-4" />
              <span>Return to Warehouse</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="load">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Load Truck</h2>
                <TransferErrorBoundary>
                  <LoadTransferForm onSuccess={handleLoadTransferSuccess} />
                </TransferErrorBoundary>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="return">
            <Card>
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Return to Warehouse</h2>
                <TransferErrorBoundary>
                  <ReturnTransferForm onSuccess={handleReturnTransferSuccess} />
                </TransferErrorBoundary>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </TransferErrorBoundary>
    </div>
  );
}; 