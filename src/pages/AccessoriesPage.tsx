import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, Search, Filter } from 'lucide-react';
import { useAccessories, useCreateAccessory, useUpdateAccessory, useDeleteAccessory, useAccessoryStats } from '../hooks/useAccessories';
import { Accessory, AccessoryFilters } from '../types/accessory';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

export const AccessoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<AccessoryFilters>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [deletingAccessory, setDeletingAccessory] = useState<Accessory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: accessoriesData, isLoading, error, refetch } = useAccessories(filters);
  const { data: statsData } = useAccessoryStats();
  const createAccessory = useCreateAccessory();
  const updateAccessory = useUpdateAccessory();
  const deleteAccessory = useDeleteAccessory();

  const accessories = accessoriesData?.accessories || [];
  const stats = statsData?.stats;

  const handleAddAccessory = () => {
    setEditingAccessory(null);
    setIsFormOpen(true);
  };

  const handleEditAccessory = (accessory: Accessory) => {
    setEditingAccessory(accessory);
    setIsFormOpen(true);
  };

  const handleViewAccessory = (accessory: Accessory) => {
    navigate(`/accessories/${accessory.id}`);
  };

  const handleDeleteAccessory = (accessory: Accessory) => {
    setDeletingAccessory(accessory);
  };

  const handleFormSubmit = async (data: any) => {
    try {
      if (editingAccessory) {
        await updateAccessory.mutateAsync({
          id: editingAccessory.id,
          ...data,
        });
      } else {
        await createAccessory.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingAccessory(null);
    } catch (error) {
      console.error('Form submit error:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingAccessory) {
      try {
        await deleteAccessory.mutateAsync(deletingAccessory.id);
        setDeletingAccessory(null);
      } catch (error) {
        console.error('Delete error:', error);
      }
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accessories</h1>
          <p className="text-gray-600">Manage equipment and supplies</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <button
          onClick={handleAddAccessory}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Accessory</span>
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Accessories</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600">{stats.saleable}</div>
            <div className="text-sm text-gray-600">Saleable</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">{stats.categories}</div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search accessories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Accessories Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Loading accessories...
                  </td>
                </tr>
              ) : accessories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No accessories found
                  </td>
                </tr>
              ) : (
                accessories.map((accessory) => (
                  <tr key={accessory.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {accessory.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {accessory.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {accessory.category?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${accessory.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        accessory.active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {accessory.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleViewAccessory(accessory)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEditAccessory(accessory)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAccessory(accessory)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {accessoriesData && accessoriesData.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((accessoriesData.currentPage - 1) * (accessoriesData.limit || 10)) + 1} to{' '}
            {Math.min(accessoriesData.currentPage * (accessoriesData.limit || 10), accessoriesData.totalCount)} of{' '}
            {accessoriesData.totalCount} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePageChange(accessoriesData.currentPage - 1)}
              disabled={accessoriesData.currentPage <= 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-700">
              Page {accessoriesData.currentPage} of {accessoriesData.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(accessoriesData.currentPage + 1)}
              disabled={accessoriesData.currentPage >= accessoriesData.totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingAccessory}
        onClose={() => setDeletingAccessory(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Accessory"
        message={`Are you sure you want to delete "${deletingAccessory?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="warning"
        loading={deleteAccessory.isPending}
      />
    </div>
  );
}; 