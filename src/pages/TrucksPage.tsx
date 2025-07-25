import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Truck } from 'lucide-react';
import { TruckTable } from '../components/trucks/TruckTable';
import { TruckFilters } from '../components/trucks/TruckFilters';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { useTrucks, useUpdateTruck } from '../hooks/useTrucks';
import { TruckFilters as TruckFiltersType } from '../types/truck';

export const TrucksPage: React.FC = () => {
  const [filters, setFilters] = useState<TruckFiltersType>({ page: 1 });
  const { data, isLoading: loading, error } = useTrucks(filters);
  const updateTruck = useUpdateTruck();

  // Sort trucks by capacity on frontend if sort_by filter is applied
  const trucks = useMemo(() => {
    const rawTrucks = data?.trucks || [];
    
    if (!filters.sort_by) {
      return rawTrucks;
    }
    
    const sortedTrucks = [...rawTrucks].sort((a, b) => {
      const aCapacity = a.capacity_cylinders || 0;
      const bCapacity = b.capacity_cylinders || 0;
      
      if (filters.sort_by === 'capacity_asc') {
        return aCapacity - bCapacity;
      } else if (filters.sort_by === 'capacity_desc') {
        return bCapacity - aCapacity;
      }
      
      return 0;
    });
    
    return sortedTrucks;
  }, [data?.trucks, filters.sort_by]);

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

  const handleFiltersChange = (newFilters: TruckFiltersType) => {
    setFilters(newFilters);
  };

  const handlePageChange = (page: number) => {
    setFilters((prev: TruckFiltersType) => ({ ...prev, page }));
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
        <div className="flex items-center space-x-3">
          <Link
            to="/trucks/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Truck
          </Link>
        </div>
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

      <TruckFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

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