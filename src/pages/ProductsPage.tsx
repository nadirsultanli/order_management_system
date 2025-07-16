import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Package, Search } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useUpdateParentProduct, useUpdateVariant, useDeleteProduct, useCreateVariant, useCreateParentProduct, useGroupedProducts } from '../hooks/useProducts';
import { useCreateAccessory, useAccessories, useDeleteAccessory, useUpdateAccessory } from '../hooks/useAccessories';
import { GroupedProductTable } from '../components/products/GroupedProductTable';
import { UnifiedItemsTable } from '../components/products/UnifiedItemsTable';
import { ProductFilters } from '../components/products/ProductFilters';
import { ProductForm } from '../components/products/ProductForm';
import { AddVariantForm } from '../components/products/AddVariantForm';
import { UnifiedItemForm } from '../components/products/UnifiedItemForm';
import { ProductStats } from '../components/products/ProductStats';
import { UnifiedStats } from '../components/products/UnifiedStats';
import { BulkActions } from '../components/products/BulkActions';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Product, ProductFilters as FilterType, CreateProductData } from '../types/product';
import { CreateAccessoryData, Accessory } from '../types/accessory';
import { trpc } from '../lib/trpc-client';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<FilterType>({ 
    page: 1,
    show_obsolete: false // Hide obsolete products and variants by default
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isUnifiedFormOpen, setIsUnifiedFormOpen] = useState(false);
  const [isVariantFormOpen, setIsVariantFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deletingAccessory, setDeletingAccessory] = useState<Accessory | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [accessorySearchTerm, setAccessorySearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'products' | 'accessories'>('products');

  const { data: groupedData, isLoading: groupedLoading, error: groupedError, refetch } = useGroupedProducts(filters);
  const { data: accessoriesData, isLoading: accessoriesLoading, error: accessoriesError } = useAccessories(undefined, {
    enabled: viewMode === 'accessories' && !!localStorage.getItem('auth_token'), // Only fetch when authenticated and in accessories view
  });

  // Debug logging for filters
  useEffect(() => {
    console.log('ProductsPage filters:', filters);
  }, [filters]);

  // Handle URL query parameters for view mode
  useEffect(() => {
    const viewParam = searchParams.get('view');
    const editParam = searchParams.get('edit');
    
    if (viewParam === 'accessories') {
      setViewMode('accessories');
      
      // Handle edit parameter for accessories
      if (editParam && accessoriesData?.accessories) {
        const accessoryToEdit = accessoriesData.accessories.find((acc: Accessory) => acc.id === editParam);
        if (accessoryToEdit) {
          handleEditAccessory(accessoryToEdit);
        }
      }
    } else {
      setViewMode('products');
    }
  }, [searchParams, accessoriesData]);

  // Update URL when view mode changes
  const handleViewModeChange = (mode: 'products' | 'accessories') => {
    setViewMode(mode);
    if (mode === 'accessories') {
      setSearchParams({ view: 'accessories' });
    } else {
      setSearchParams({});
    }
  };

  const createProduct = useCreateProduct();
  const createParentProduct = useCreateParentProduct();
  const createAccessory = useCreateAccessory();
  const updateAccessory = useUpdateAccessory();
  const updateProduct = useUpdateProduct();
  const updateParentProduct = useUpdateParentProduct();
  const updateVariant = useUpdateVariant();
  const deleteProduct = useDeleteProduct();
  const deleteAccessory = useDeleteAccessory();
  const createVariant = useCreateVariant();

  // Debug logging
  useEffect(() => {
    console.log('ProductsPage state:', {
      filters,
      groupedData,
      groupedLoading,
      groupedError,
      isFormOpen,
      editingProduct,
      selectedProducts,
    });
  }, [filters, groupedData, groupedLoading, groupedError, isFormOpen, editingProduct, selectedProducts]);

  const handleAddProduct = () => {
    console.log('Adding new product');
    setEditingProduct(null);
    setIsUnifiedFormOpen(true);
  };

  const handleAddVariant = () => {
    console.log('Adding new variant');
    setIsVariantFormOpen(true);
  };


  const handleEditProduct = (product: Product) => {
    console.log('Editing product:', product);
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const handleEditAccessory = (accessory: Accessory) => {
    console.log('Editing accessory:', accessory);
    setEditingAccessory(accessory);
  };

  const handleViewProduct = (product: Product) => {
    console.log('Viewing product:', product);
    navigate(`/products/${product.id}`);
  };

  const handleViewAccessory = (accessory: Accessory) => {
    console.log('Viewing accessory:', accessory);
    navigate(`/accessories/${accessory.id}`);
  };

  const handleDeleteProduct = (product: Product) => {
    console.log('Marking product as obsolete:', product);
    setDeletingProduct(product);
  };

  const handleDeleteAccessory = (accessory: Accessory) => {
    console.log('Deleting accessory:', accessory);
    setDeletingAccessory(accessory);
  };

  const handleUnifiedFormSubmit = async (data: { item_type: 'product' | 'accessory'; product_data?: CreateProductData; accessory_data?: CreateAccessoryData }) => {
    console.log('Unified form submit:', data);
    try {
      if (data.item_type === 'product' && data.product_data) {
        await createProduct.mutateAsync(data.product_data);
      } else if (data.item_type === 'accessory' && data.accessory_data) {
        await createAccessory.mutateAsync(data.accessory_data);
      }
      setIsUnifiedFormOpen(false);
    } catch (error) {
      console.error('Unified form submit error:', error);
      // Error handling is done in the hook
    }
  };

  const handleFormSubmit = async (data: CreateProductData) => {
    console.log('Form submit:', data);
    try {
      if (editingProduct) {
        // Check if this is a parent product by looking for parent_products_id field
        // If parent_products_id is null or undefined, it's a parent product
        const isParentProduct = !editingProduct.parent_products_id;
        
        if (isParentProduct) {
          // For parent products, send all relevant fields that exist in parent_products table
          const parentProductData = {
            id: editingProduct.id,
            name: data.name,
            sku: data.sku,
            description: data.description,
            status: data.status,
            capacity_kg: data.capacity_kg,
            tare_weight_kg: data.tare_weight_kg,
            gross_weight_kg: data.gross_weight_kg,
            valve_type: data.valve_type,
            barcode_uid: data.barcode_uid,
            tax_category: data.tax_category,
            tax_rate: data.tax_rate,
            variant: data.variant,
          };
          await updateParentProduct.mutateAsync(parentProductData);
        } else {
          // For variant products, use the updateVariant endpoint which only allows specific fields
          const variantData = {
            id: editingProduct.id,
            name: data.name,
            description: data.description,
            status: data.status,
          };
          await updateVariant.mutateAsync(variantData);
        }
      } else {
        await createProduct.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Form submit error:', error);
      // Error handling is done in the hook
    }
  };

  const handleVariantFormSubmit = async (data: any) => {
    console.log('Variant form submit:', data);
    try {
      await createVariant.mutateAsync(data);
      setIsVariantFormOpen(false);
      // Refresh the grouped data to show the new variant
      refetch();
    } catch (error) {
      console.error('Variant form submit error:', error);
      // Error handling is done in the mutation - it will show toast notifications
    }
  };


  const handleConfirmDelete = async () => {
    if (deletingProduct) {
      console.log('Confirming mark as obsolete:', deletingProduct);
      try {
        // Check if this is a parent product by looking for parent_products_id field
        // If parent_products_id is null or undefined, it's a parent product
        const isParentProduct = !deletingProduct.parent_products_id;
        
        await deleteProduct.mutateAsync({ 
          id: deletingProduct.id,
          is_parent_product: isParentProduct
        });
        setDeletingProduct(null);
      } catch (error) {
        console.error('Mark obsolete error:', error);
        // Error handling is done in the hooks
      }
    }
  };

  const handlePageChange = (page: number) => {
    console.log('Page change:', page);
    setFilters(prev => ({ ...prev, page }));
  };



  const handleSelectionChange = (productIds: string[]) => {
    setSelectedProducts(productIds);
  };

  const handleClearSelection = () => {
    setSelectedProducts([]);
  };

  // Filter accessories based on search term
  const filteredAccessories = accessoriesData?.accessories?.filter((accessory: Accessory) => {
    if (!accessorySearchTerm) return true;
    const searchLower = accessorySearchTerm.toLowerCase();
    return (
      accessory.name.toLowerCase().includes(searchLower) ||
      accessory.sku.toLowerCase().includes(searchLower) ||
      (accessory.description && accessory.description.toLowerCase().includes(searchLower))
    );
  }) || [];

  const getDeleteDialogContent = () => {
    if (!deletingProduct) return { title: '', message: '' };

    const isObsolete = deletingProduct.status === 'obsolete';
    const isParentProduct = !deletingProduct.parent_products_id;
    
    if (isObsolete) {
      return {
        title: 'Product Already Obsolete',
        message: `"${deletingProduct.name}" is already marked as obsolete and hidden from active lists.`,
      };
    }

    if (isParentProduct) {
      return {
        title: 'Mark Product as Obsolete',
        message: `Are you sure you want to mark "${deletingProduct.name}" as obsolete? All its variants will also be marked obsolete.
    
    ⚠️ Action blocked if the product or any variant has inventory. Please clear all stock first.
    
    This will hide the product and variants from active lists. Historical data remains. You can reactivate later if needed.`,
      };
    }
    
    return {
      title: 'Mark Variant as Obsolete',
      message: `Are you sure you want to mark "${deletingProduct.name}" as obsolete?
    
    ⚠️ Action blocked if this variant has inventory. Please clear stock first.
    
    The variant will be hidden from active lists. Historical data remains. Reactivation is possible.`,
    };
    
  };

  const dialogContent = getDeleteDialogContent();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Items & Accessories
            {filters.show_obsolete && (
              <span className="ml-2 text-sm font-normal text-orange-600 bg-orange-100 px-2 py-1 rounded">
                Showing Obsolete
              </span>
            )}
          </h1>
          <p className="text-gray-600">Manage your LPG items and equipment catalog</p>
          
          {/* View Mode Switcher */}
          <div className="mt-4">
            <div className="inline-flex bg-white border border-gray-200 rounded-lg shadow-sm">
              <button
                onClick={() => handleViewModeChange('products')}
                className={`px-6 py-2.5 text-sm font-medium rounded-l-lg transition-all duration-200 ${
                  viewMode === 'products'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Products
              </button>
              <button
                onClick={() => handleViewModeChange('accessories')}
                className={`px-6 py-2.5 text-sm font-medium rounded-r-lg transition-all duration-200 ${
                  viewMode === 'accessories'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Accessories
              </button>
            </div>
          </div>
          
          {groupedError && (
            <p className="text-red-600 text-sm mt-1">
              Products Error: {groupedError.message}
            </p>
          )}
          {accessoriesError && (
            <p className="text-red-600 text-sm mt-1">
              Accessories Error: {(accessoriesError as any).message}
            </p>
          )}
          {accessoriesError && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800 text-sm font-medium">Accessories Error Details:</p>
              <pre className="text-red-700 text-xs mt-1 overflow-auto">
                {JSON.stringify(accessoriesError, null, 2)}
              </pre>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddProduct}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Item</span>
          </button>
          {viewMode === 'products' && (
            <button
              onClick={handleAddVariant}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Package className="h-4 w-4" />
              <span>Add Variant</span>
            </button>
          )}
        </div>
      </div>

      <UnifiedStats viewMode={viewMode} />

      {viewMode === 'products' ? (
        <>
          <ProductFilters filters={filters} onFiltersChange={setFilters} />
          
          <BulkActions 
            selectedProducts={selectedProducts}
            onClearSelection={handleClearSelection}
          />
          <GroupedProductTable
            products={groupedData?.products || []}
            loading={groupedLoading || accessoriesLoading}
            onView={handleViewProduct}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            selectedProducts={selectedProducts}
            onSelectionChange={handleSelectionChange}
          />
        </>
      ) : (
        <>
          {/* Accessory Search */}
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search accessories by SKU, name, or description..."
                    value={accessorySearchTerm}
                    onChange={(e) => setAccessorySearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              {accessorySearchTerm && (
                <button
                  onClick={() => setAccessorySearchTerm('')}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <BulkActions 
            selectedProducts={selectedProducts}
            onClearSelection={handleClearSelection}
          />

          {/* Search Results Info */}
          {accessorySearchTerm && (
            <div className="text-sm text-gray-600">
              Showing {filteredAccessories.length} of {accessoriesData?.accessories?.length || 0} accessories
              {filteredAccessories.length === 0 && (
                <span className="text-red-600 ml-2">No accessories found matching "{accessorySearchTerm}"</span>
              )}
            </div>
          )}

          <UnifiedItemsTable
            products={[]}
            accessories={filteredAccessories}
            loading={accessoriesLoading}
            viewMode="accessories"
            onViewProduct={handleViewProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onViewAccessory={handleViewAccessory}
            onEditAccessory={handleEditAccessory}
            onDeleteAccessory={handleDeleteAccessory}
            selectedItems={selectedProducts}
            onSelectionChange={handleSelectionChange}
          />
        </>
      )}

      {groupedData && groupedData.totalPages > 1 && (
        <CustomerPagination
          currentPage={groupedData.currentPage || 1}
          totalPages={groupedData.totalPages || 1}
          totalCount={groupedData.totalCount || 0}
          onPageChange={handlePageChange}
          itemsPerPage={15}
        />
      )}

      <ProductForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleFormSubmit}
        product={editingProduct || undefined}
        loading={editingProduct && !editingProduct.parent_products_id ? updateParentProduct.isPending : editingProduct && editingProduct.parent_products_id ? updateVariant.isPending : updateProduct.isPending || createProduct.isPending}
        title={editingProduct ? (editingProduct.parent_products_id ? 'Edit Variant' : 'Edit Parent Product') : 'Add Product'}
      />

      <AddVariantForm
        isOpen={isVariantFormOpen}
        onClose={() => {
          console.log('Closing variant form');
          setIsVariantFormOpen(false);
        }}
        onSubmit={handleVariantFormSubmit}
        loading={createVariant.isPending}
      />

      <UnifiedItemForm
        isOpen={isUnifiedFormOpen}
        onClose={() => {
          setIsUnifiedFormOpen(false);
        }}
        onSubmit={handleUnifiedFormSubmit}
        loading={createProduct.isPending || createAccessory.isPending}
        title="Create New Item"
      />

      {/* Accessory Edit Modal */}
      {editingAccessory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Accessory</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editingAccessory.name}
                  onChange={(e) => setEditingAccessory({ ...editingAccessory, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <input
                  type="text"
                  value={editingAccessory.sku}
                  disabled
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input
                  type="text"
                  value={editingAccessory.price === 0 ? '' : editingAccessory.price.toFixed(2)}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow empty string, numbers, and decimal points
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      if (value === '') {
                        setEditingAccessory({ ...editingAccessory, price: 0 });
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue >= 0) {
                          setEditingAccessory({ ...editingAccessory, price: numValue });
                        }
                      }
                    }
                  }}
                  placeholder="0.00"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={editingAccessory.description || ''}
                  onChange={(e) => setEditingAccessory({ ...editingAccessory, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingAccessory(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await updateAccessory.mutateAsync({
                      id: editingAccessory.id,
                      name: editingAccessory.name,
                      description: editingAccessory.description,
                      price: editingAccessory.price,
                    });
                    setEditingAccessory(null);
                  } catch (error) {
                    console.error('Update error:', error);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={updateAccessory.isPending}
              >
                {updateAccessory.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}


      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
        title={dialogContent.title}
        message={dialogContent.message}
        confirmText={
          deletingProduct?.status === 'obsolete' 
            ? 'OK' 
            : !deletingProduct?.parent_products_id 
              ? 'Mark Parent & Children as Obsolete'
              : 'Mark as Obsolete'
        }
        type={deletingProduct?.status === 'obsolete' ? 'info' : 'warning'}
        loading={deleteProduct.isPending}
      />

      <ConfirmDialog
        isOpen={!!deletingAccessory}
        onClose={() => setDeletingAccessory(null)}
        onConfirm={async () => {
          if (deletingAccessory) {
            try {
              await deleteAccessory.mutateAsync(deletingAccessory.id);
              setDeletingAccessory(null);
            } catch (error) {
              console.error('Delete error:', error);
            }
          }
        }}
        title="Delete Accessory"
        message={`Are you sure you want to delete "${deletingAccessory?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        type="warning"
        loading={deleteAccessory.isPending}
      />

    </div>
  );
};