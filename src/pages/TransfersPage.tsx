import React, { useState } from 'react';
import { LoadTransferForm } from '../components/transfers/LoadTransferForm';
import { ReturnTransferForm } from '../components/transfers/ReturnTransferForm';
import { MultiSkuTransferForm } from '../components/transfers/MultiSkuTransferForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { Card } from '../components/ui/Card';
import { Truck, ArrowLeftRight, Package } from 'lucide-react';

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
              <LoadTransferForm />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="return">
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Return to Warehouse</h2>
              <ReturnTransferForm />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="multi-sku">
          <MultiSkuTransferForm
            onTransferCreated={(transferId) => {
              console.log('Transfer created:', transferId);
              // Could navigate to transfer details or show success message
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}; 