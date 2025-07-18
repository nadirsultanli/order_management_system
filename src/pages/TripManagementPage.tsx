import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter } from 'lucide-react';
import { TripCard } from '../components/trips/TripCard';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { useTrips, useUpdateTripStatus } from '../hooks/useTrips';
import { TripFilters as TripFiltersType, TripStatus } from '../types/trip';
import { useLocation } from 'react-router-dom';

export const TripManagementPage: React.FC = () => {
  const location = useLocation();
  const [filters, setFilters] = useState<TripFiltersType>({ 
    page: 1,
    limit: 12,
    sort_by: 'created_at',
    sort_order: 'desc'
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState<string>(filters.search || '');
  const [newTripIds, setNewTripIds] = useState<Set<string>>(new Set());

  const { data, isLoading: loading, error } = useTrips(filters);
  
  // Debug: Log the API response
  React.useEffect(() => {
    console.log('Trip Management Debug:', { data, loading, error, filters });
  }, [data, loading, error, filters]);
  
  // Check for newly created trips from URL state
  useEffect(() => {
    if (location.state?.newTripId) {
      setNewTripIds(prev => new Set([...prev, location.state.newTripId]));
      
      // Remove the highlight after 3 seconds
      setTimeout(() => {
        setNewTripIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(location.state.newTripId);
          return newSet;
        });
      }, 3000);
      
      // Clear the URL state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const updateTripStatus = useUpdateTripStatus();

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== filters.search) {
        handleFiltersChange({ search: searchInput || undefined });
      }
    }, 500); // 500ms debounce delay

    return () => clearTimeout(timeoutId);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = async (tripId: string, newStatus: string) => {
    // Validate that the status is a valid TripStatus
    const validStatuses = ['planned', 'unloaded', 'loaded', 'in_transit', 'unloading', 'completed', 'cancelled'];
    if (!validStatuses.includes(newStatus)) {
      setStatusUpdateError(`Invalid status: ${newStatus}`);
      return;
    }

    try {
      setStatusUpdateError(null);
      await updateTripStatus.mutateAsync({
        trip_id: tripId,
        status: newStatus
      });
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to update trip status';
      console.error('Error updating trip status:', err);
      setStatusUpdateError(errorMessage);
    }
  };

  const handleFiltersChange = (newFilters: Partial<TripFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const trips = data?.trips || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = data?.totalPages || 1;
  const currentPage = data?.currentPage || 1;

  // Quick stats
  const stats = useMemo(() => {
    return {
      total: totalCount,
      planned: trips.filter(t => t.route_status === 'planned').length,
      loaded: trips.filter(t => t.route_status === 'loaded').length,
      in_transit: trips.filter(t => t.route_status === 'in_transit').length,
      offloaded: trips.filter(t => t.route_status === 'offloaded').length,
      completed: trips.filter(t => t.route_status === 'completed').length,
      cancelled: trips.filter(t => t.route_status === 'cancelled').length,
    };
  }, [trips, totalCount]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trip Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage delivery trips, loading progress, and capacity optimization
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/trips/new"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Create Trip
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-600">Total Trips</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.planned}</div>
          <div className="text-sm text-gray-600">Planned</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-indigo-600">{stats.loaded}</div>
          <div className="text-sm text-gray-600">Loaded</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">{stats.in_transit}</div>
          <div className="text-sm text-gray-600">In Transit</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-amber-600">{stats.offloaded}</div>
          <div className="text-sm text-gray-600">Offloaded</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
          <div className="text-sm text-gray-600">Cancelled</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div>
              <input
                type="text"
                placeholder="Search trips..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="block w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            
            <div>
              <select
                value={filters.status || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const status = value === '' ? undefined : value as TripFiltersType['status'];
                  handleFiltersChange({ status });
                }}
                className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="">All Statuses</option>
                <option value="planned">Planned</option>
                <option value="loaded">Loaded</option>
                <option value="in_transit">In Transit</option>
                <option value="offloaded">Offloaded</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <input
                type="date"
                value={filters.date_from || ''}
                onChange={(e) => handleFiltersChange({ date_from: e.target.value || undefined })}
                className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <input
                type="date"
                value={filters.date_to || ''}
                onChange={(e) => handleFiltersChange({ date_to: e.target.value || undefined })}
                className="block px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
            
            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm font-medium ${
                  viewMode === 'grid' 
                    ? 'bg-blue-50 text-blue-700 border-blue-500' 
                    : 'text-gray-700 hover:text-gray-500'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm font-medium border-l ${
                  viewMode === 'list' 
                    ? 'bg-blue-50 text-blue-700 border-blue-500' 
                    : 'text-gray-700 hover:text-gray-500'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sort_by || 'trip_date'}
                  onChange={(e) => handleFiltersChange({ sort_by: e.target.value as TripFiltersType['sort_by'] })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="trip_date">Trip Date</option>
                  <option value="created_at">Created Date</option>
                  <option value="status">Status</option>
                  <option value="truck_fleet_number">Truck</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort Order
                </label>
                <select
                  value={filters.sort_order || 'desc'}
                  onChange={(e) => handleFiltersChange({ sort_order: e.target.value as TripFiltersType['sort_order'] })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Items per Page
                </label>
                <select
                  value={filters.limit || 12}
                  onChange={(e) => handleFiltersChange({ limit: parseInt(e.target.value) })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value={6}>6</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">{error.message}</h3>
              <p className="text-xs text-red-600 mt-1">
                Debug: Check browser console for more details. Make sure backend server is running.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 rounded-md bg-blue-50 p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Debug Information:</h3>
          <div className="text-xs text-blue-600 space-y-1">
            <p>Loading: {loading ? 'Yes' : 'No'}</p>
            <p>Error: {error ? error.message : 'None'}</p>
            <p>Data: {data ? `${data.trips?.length || 0} trips loaded` : 'No data'}</p>
            <p>Total Count: {data?.totalCount || 0}</p>
            <p>Current Page: {data?.currentPage || 1}</p>
            <p>Backend URL: Check if backend server is running on correct port</p>
          </div>
        </div>
      )}

      {/* Status Update Error */}
      {statusUpdateError && (
        <div className="rounded-md bg-red-50 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Status Update Error</h3>
              <p className="text-sm text-red-700 mt-1">{statusUpdateError}</p>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setStatusUpdateError(null)}
                className="text-red-800 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      )}

      {/* Trips Grid/List */}
      {!loading && trips.length > 0 && (
        <>
          <div className={
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
              : 'space-y-4'
          }>
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                compact={viewMode === 'list'}
                onStatusChange={handleStatusChange}
                isNew={newTripIds.has(trip.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <CustomerPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                itemsPerPage={filters.limit || 12}
              />
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!loading && trips.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No trips found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.search || filters.status || filters.date_from || filters.date_to
              ? 'Try adjusting your filters to see more results.'
              : 'Get started by creating your first trip.'
            }
          </p>
          {!filters.search && !filters.status && !filters.date_from && !filters.date_to && (
            <div className="mt-6">
              <Link
                to="/trips/new"
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="-ml-1 mr-2 h-5 w-5" />
                Create Trip
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
};