import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { TruckTable } from '../components/trucks/TruckTable';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { useTrucks, useUpdateTruck } from '../hooks/useTrucks';

export const TrucksPage: React.FC = () => {
  const [filters, setFilters] = useState({ page: 1 });
  const { data, isLoading: loading, error } = useTrucks(filters);
  const updateTruck = useUpdateTruck();

  const trucks = data?.trucks || [];

  const handleStatusChange = async (truck: any, newStatus: boolean) => {
    try {
      await updateTruck.mutateAsync({
        id: truck.id,
        active: newStatus
      });
    } catch (err: any) {
      console.error('Error updating truck status:', err);
      alert('Failed to update truck status. Please try again.');
    }
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trucks</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your fleet and monitor truck inventory
          </p>
        </div>
        <Link
          to="/trucks/new"
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Add Truck
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error.message}</h3>
            </div>
          </div>
        </div>
      )}

      <TruckTable 
        trucks={trucks} 
        loading={loading} 
        onStatusChange={handleStatusChange}
      />

      {data && data.totalPages > 1 && (
        <CustomerPagination
          currentPage={data.currentPage}
          totalPages={data.totalPages}
          totalCount={data.totalCount}
          onPageChange={handlePageChange}
          itemsPerPage={15}
        />
      )}
    </div>
  );
}; 