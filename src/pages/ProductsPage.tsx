import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useUpdateParentProduct, useUpdateVariant, useDeleteProduct, useCreateVariant, useCreateParentProduct } from '../hooks/useProducts';
import { GroupedProductTable } from '../components/products/GroupedProductTable';
import { ProductFilters } from '../components/products/ProductFilters';
import { ProductForm } from '../components/products/ProductForm';
import { AddVariantForm } from '../components/products/AddVariantForm';
import { ProductStats } from '../components/products/ProductStats';
import { BulkActions } from '../components/products/BulkActions';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Product, ProductFilters as FilterType, CreateProductData } from '../types/product';
import { trpc } from '../lib/trpc-client';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVariantFormOpen, setIsVariantFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const { data: groupedData, isLoading: groupedLoading, error: groupedError, refetch } = trpc.products.getGroupedProducts.useQuery(filters);
  const createProduct = useCreateProduct();
  const createParentProduct = useCreateParentProduct();
  const updateProduct = useUpdateProduct();
  const updateParentProduct = useUpdateParentProduct();
  const updateVariant = useUpdateVariant();
  const deleteProduct = useDeleteProduct();
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
    setIsFormOpen(true);
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

  const handleViewProduct = (product: Product) => {
    console.log('Viewing product:', product);
    navigate(`/products/${product.id}`);
  };

  const handleDeleteProduct = (product: Product) => {
    console.log('Marking product as obsolete:', product);
    setDeletingProduct(product);
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
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your LPG product catalog</p>
          {groupedError && (
            <p className="text-red-600 text-sm mt-1">
              Error: {groupedError.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddProduct}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
          <button
            onClick={handleAddVariant}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Package className="h-4 w-4" />
            <span>Add Variant</span>
          </button>
        </div>
      </div>

      <ProductStats />

      <ProductFilters filters={filters} onFiltersChange={setFilters} />

      <BulkActions 
        selectedProducts={selectedProducts}
        onClearSelection={handleClearSelection}
      />

      <GroupedProductTable
        products={groupedData?.products || []}
        loading={groupedLoading}
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        selectedProducts={selectedProducts}
        onSelectionChange={handleSelectionChange}
      />

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
        product={editingProduct}
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
    </div>
  );
};