import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package2 } from 'lucide-react';
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct } from '../hooks/useProducts';
import { ProductTable } from '../components/products/ProductTable';
import { ProductFilters } from '../components/products/ProductFilters';
import { ProductForm } from '../components/products/ProductForm';
import { ProductVariantForm } from '../components/products/ProductVariantForm';
import { ProductStats } from '../components/products/ProductStats';
import { BulkActions } from '../components/products/BulkActions';
import { CustomerPagination } from '../components/customers/CustomerPagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Product, ProductFilters as FilterType, CreateProductData } from '../types/product';

export const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterType>({ page: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isVariantFormOpen, setIsVariantFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const { data, isLoading, error, refetch } = useProducts(filters);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  // Debug logging
  useEffect(() => {
    console.log('ProductsPage state:', {
      filters,
      data,
      isLoading,
      error,
      isFormOpen,
      editingProduct,
      selectedProducts,
    });
  }, [filters, data, isLoading, error, isFormOpen, editingProduct, selectedProducts]);

  const handleAddProduct = () => {
    console.log('Adding new product');
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleAddVariantProduct = () => {
    console.log('Adding product with variants');
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
        await updateProduct.mutateAsync({ id: editingProduct.id, ...data });
      } else {
        await createProduct.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleVariantFormSubmit = async (productData: CreateProductData, variants?: any[]) => {
    console.log('Variant form submit:', productData, variants);
    try {
      // First create the parent product
      const parentProduct = await createProduct.mutateAsync(productData);
      
      // If variants are provided, create them too
      if (variants && variants.length > 0) {
        for (const variant of variants) {
          const variantProductData = {
            ...variant,
            parent_product_id: parentProduct.id,
          };
          await createProduct.mutateAsync(variantProductData);
        }
      }
      
      setIsVariantFormOpen(false);
      refetch();
    } catch (error) {
      console.error('Variant form submit error:', error);
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingProduct) {
      console.log('Confirming mark as obsolete:', deletingProduct);
      try {
        await deleteProduct.mutateAsync(deletingProduct.id);
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
    
    if (isObsolete) {
      return {
        title: 'Product Already Obsolete',
        message: `"${deletingProduct.name}" is already marked as obsolete and hidden from active lists.`,
      };
    }

    return {
      title: 'Mark Product as Obsolete',
      message: `Are you sure you want to mark "${deletingProduct.name}" as obsolete? This will hide it from active product lists but preserve all historical data including price lists, inventory records, and order history. The product can be reactivated later if needed.`,
    };
  };

  const dialogContent = getDeleteDialogContent();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your LPG product catalog</p>
          {error && (
            <p className="text-red-600 text-sm mt-1">
              Error: {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddVariantProduct}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            <Package2 className="h-4 w-4" />
            <span>Create with Variants</span>
          </button>
          <button
            onClick={handleAddProduct}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      <ProductStats />

      <ProductFilters filters={filters} onFiltersChange={setFilters} />

      <BulkActions 
        selectedProducts={selectedProducts}
        onClearSelection={handleClearSelection}
      />

      <ProductTable
        products={data?.products || []}
        loading={isLoading}
        onView={handleViewProduct}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        selectedProducts={selectedProducts}
        onSelectionChange={handleSelectionChange}
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

      <ProductForm
        isOpen={isFormOpen}
        onClose={() => {
          console.log('Closing form');
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSubmit={handleFormSubmit}
        product={editingProduct || undefined}
        loading={createProduct.isPending || updateProduct.isPending}
        title={editingProduct ? 'Edit Product' : 'Add New Product'}
      />

      <ProductVariantForm
        isOpen={isVariantFormOpen}
        onClose={() => setIsVariantFormOpen(false)}
        onSubmit={handleVariantFormSubmit}
        loading={createProduct.isPending}
        title="Create Product with Variants"
      />

      <ConfirmDialog
        isOpen={!!deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
        title={dialogContent.title}
        message={dialogContent.message}
        confirmText={deletingProduct?.status === 'obsolete' ? 'OK' : 'Mark as Obsolete'}
        type={deletingProduct?.status === 'obsolete' ? 'info' : 'warning'}
        loading={deleteProduct.isPending}
      />
    </div>
  );
};