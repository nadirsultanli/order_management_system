import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, DollarSign, Calendar, Package, Trash2 } from 'lucide-react';
import { usePriceListNew, useUpdatePriceListNew } from '../hooks/usePricing';
import { usePriceListItemsNew, useCreatePriceListItemNew } from '../hooks/usePricing';
import { PriceListForm } from '../components/pricing/PriceListForm';
import { AddProductsToPriceListModal } from '../components/pricing/AddProductsToPriceListModal';
import { EditPriceListItemModal } from '../components/pricing/EditPriceListItemModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatDateRange, getPriceListStatusSync, formatCurrencySync, calculateFinalPriceSync } from '../utils/pricing';
import { PriceList, PriceListItem, CreatePriceListData } from '../types/pricing';

export const PriceListDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isAddProductsOpen, setIsAddProductsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PriceListItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<PriceListItem | null>(null);

  const { data: priceList, isLoading, error } = usePriceListNew(id!);
  const { data: priceListItems = [], refetch: refetchItems } = usePriceListItemsNew(id!);
  const updatePriceList = useUpdatePriceListNew();
  const createPriceListItem = useCreatePriceListItemNew();
  // Note: useUpdatePriceListItem and useDeletePriceListItem not available - functionality disabled
  // const updatePriceListItem = useUpdatePriceListItem();
  // const deletePriceListItem = useDeletePriceListItem();

  const handleEditSubmit = async (data: CreatePriceListData) => {
    if (priceList) {
      try {
        await updatePriceList.mutateAsync({ id: priceList.id, ...data });
        setIsEditFormOpen(false);
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };

  const handleAddProducts = async (productPrices: any[]) => {
    try {
      for (const productPrice of productPrices) {
        await createPriceListItem.mutateAsync({
          price_list_id: id!,
          product_id: productPrice.productId,
          unit_price: productPrice.unitPrice,
          min_qty: productPrice.minQty || 1,
          surcharge_pct: productPrice.surchargeRate || undefined,
        });
      }
      setIsAddProductsOpen(false);
      refetchItems();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleEditItem = (item: PriceListItem) => {
    setEditingItem(item);
  };

  const handleEditItemSubmit = async (data: any) => {
    if (editingItem) {
      // Note: updatePriceListItem functionality disabled
      alert('Update price list item functionality is temporarily disabled');
      setEditingItem(null);
    }
  };

  const handleDeleteItem = (item: PriceListItem) => {
    setDeletingItem(item);
  };

  const handleConfirmDelete = async () => {
    if (deletingItem) {
      // Note: deletePriceListItem functionality disabled
      alert('Delete price list item functionality is temporarily disabled');
      setDeletingItem(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const calculateFinalPrice = (unitPrice: number, surchargeRate?: number) => {
    return calculateFinalPriceSync(unitPrice, surchargeRate);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Price Lists</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !priceList) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Price Lists</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-red-600">Price list not found or error loading details.</p>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getPriceListStatusSync(priceList.start_date, priceList.end_date);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Price Lists</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">{priceList.name}</h1>
        </div>
        <button
          onClick={() => setIsEditFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit Price List</span>
        </button>
      </div>

      {/* Price List Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Price List Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Name
                </label>
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{priceList.name}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Currency
                </label>
                <span className="text-gray-900 font-mono">{priceList.currency_code}</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Status
                </label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Date Range
                </label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">
                    {formatDateRange(priceList.start_date, priceList.end_date)}
                  </span>
                </div>
              </div>

              {priceList.description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Description
                  </label>
                  <p className="text-gray-900">{priceList.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Price List Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Details</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Created
                </label>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {formatDate(priceList.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Products
                </label>
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">
                    {priceListItems.length} products
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products in Price List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Products in this Price List ({priceListItems.length})
          </h3>
          <button
            onClick={() => setIsAddProductsOpen(true)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Products</span>
          </button>
        </div>

        {priceListItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit Price
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Min Qty
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Surcharge
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Final Price
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {priceListItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {item.product?.name || 'Unknown Product'}
                        </div>
                        <div className="text-sm text-gray-500">
                          SKU: {item.product?.sku || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrencySync(item.unit_price, priceList.currency_code)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-900">
                        {item.min_qty}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-sm text-gray-900">
                        {item.surcharge_pct ? `${item.surcharge_pct}%` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrencySync(calculateFinalPrice(item.unit_price, item.surcharge_pct), priceList.currency_code)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Edit price"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Remove from list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products added yet</h3>
            <p className="text-gray-500 mb-4">
              Add products to this price list to set their pricing.
            </p>
            <button
              onClick={() => setIsAddProductsOpen(true)}
              className="inline-flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Add Products</span>
            </button>
          </div>
        )}
      </div>

      {/* Edit Form Modal */}
      <PriceListForm
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={handleEditSubmit}
        priceList={priceList}
        loading={updatePriceList.isPending}
        title="Edit Price List"
      />

      {/* Add Products Modal */}
      <AddProductsToPriceListModal
        isOpen={isAddProductsOpen}
        onClose={() => setIsAddProductsOpen(false)}
        onSubmit={handleAddProducts}
        priceList={priceList}
        loading={createPriceListItem.isPending}
      />

      {/* Edit Item Modal */}
      {editingItem && (
        <EditPriceListItemModal
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={handleEditItemSubmit}
          item={editingItem}
          currencyCode={priceList.currency_code}
          loading={false}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Product"
        message={`Are you sure you want to remove "${deletingItem?.product?.name}" from this price list?`}
        confirmText="Remove"
        type="danger"
        loading={false}
      />
    </div>
  );
};