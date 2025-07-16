import React from 'react';
import { trpc } from '../../lib/trpc-client';

export const TRPCDebug: React.FC = () => {
  // Test basic tRPC connectivity
  const testQuery = trpc.accessories.getCategories.useQuery(undefined, {
    enabled: false, // Don't run automatically
  });

  const testListQuery = trpc.accessories.list.useQuery(undefined, {
    enabled: false, // Don't run automatically
  });

  // Test a simple endpoint that should always work
  const testProductsQuery = trpc.products.list.useQuery(undefined, {
    enabled: false,
  });

  const handleTestCategories = () => {
    console.log('Testing accessories.getCategories...');
    testQuery.refetch();
  };

  const handleTestList = () => {
    console.log('Testing accessories.list...');
    testListQuery.refetch();
  };

  const handleTestProducts = () => {
    console.log('Testing products.list...');
    testProductsQuery.refetch();
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">tRPC Debug Panel</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2">Accessories Categories Test</h4>
          <button
            onClick={handleTestCategories}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test getCategories
          </button>
          <div className="mt-2">
            <p>Status: {testQuery.status}</p>
            <p>Error: {testQuery.error?.message || 'None'}</p>
            <p>Data: {JSON.stringify(testQuery.data, null, 2)}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Accessories List Test</h4>
          <button
            onClick={handleTestList}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test list
          </button>
          <div className="mt-2">
            <p>Status: {testListQuery.status}</p>
            <p>Error: {testListQuery.error?.message || 'None'}</p>
            <p>Data: {JSON.stringify(testListQuery.data, null, 2)}</p>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">tRPC Client Info</h4>
          <p>trpc.accessories: {typeof trpc.accessories}</p>
          <p>trpc.accessories.getCategories: {typeof trpc.accessories.getCategories}</p>
          <p>trpc.accessories.list: {typeof trpc.accessories.list}</p>
        </div>
      </div>
    </div>
  );
}; 