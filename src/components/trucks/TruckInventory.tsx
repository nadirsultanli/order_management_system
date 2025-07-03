import React, { useEffect, useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc-client';

// Define type locally since it was removed from lib/transfers
interface TruckInventoryItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  qty_full: number;
  qty_empty: number;
  updated_at: string;
}

interface TruckInventoryProps {
  truckId: string;
}

export const TruckInventory: React.FC<TruckInventoryProps> = ({ truckId }) => {
  // Use tRPC to get truck details with inventory
  const { data: truck, isLoading: loading, error: truckError } = trpc.trucks.get.useQuery({ id: truckId });
  
  const error = truckError?.message || null;
  const inventory = truck?.inventory || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">{error}</h3>
          </div>
        </div>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No Inventory</h3>
        <p className="mt-1 text-sm text-gray-500">This truck has no inventory yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Product
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              SKU
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Full Cylinders
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Empty Cylinders
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Updated
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {inventory.map((item: any) => (
            <tr key={item.product_id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">{item.product_sku}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="text-sm text-gray-900">{item.qty_full}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="text-sm text-gray-900">{item.qty_empty}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-500">
                  {new Date(item.updated_at).toLocaleString()}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}; 