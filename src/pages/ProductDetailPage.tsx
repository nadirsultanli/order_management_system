import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Package, Cylinder, Weight, Barcode, Calendar, AlertTriangle, DollarSign } from 'lucide-react';
import { useProduct, useUpdateProduct, useUpdateParentProduct } from '../hooks/useProducts';
import { ProductForm } from '../components/products/ProductForm';
import { ProductPricing } from '../components/products/ProductPricing';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Product, CreateProductData } from '../types/product';
import { formatDateSync } from '../utils/order';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'pricing'>('details');

  const { data: product, isLoading, error, refetch } = useProduct(id!);
  const updateProduct = useUpdateProduct();
  const updateParentProduct = useUpdateParentProduct();

  const handleEditSubmit = async (data: CreateProductData) => {
    if (product) {
      try {
        // Check if this is a parent product by looking for parent_products_id field
        // If parent_products_id is null or undefined, it's a parent product
        const isParentProduct = !product.parent_products_id;
        
        if (isParentProduct) {
          // For parent products, only send fields that exist in parent_products table
          const parentProductData = {
            id: product.id,
            name: data.name,
            sku: data.sku,
            description: data.description,
            status: data.status,
            capacity_kg: data.capacity_kg,
          };
          await updateParentProduct.mutateAsync(parentProductData);
        } else {
          await updateProduct.mutateAsync({ id: product.id, ...data });
        }
        
        setIsEditFormOpen(false);
        refetch();
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };




  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Products</span>
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

  if (error || !product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Products</span>
          </button>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <p className="text-red-600">Product not found or error loading product details.</p>
          </div>
        </div>
      </div>
    );
  }

  const UnitIcon = product.unit_of_measure === 'cylinder' ? Cylinder : Weight;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/products')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Products</span>
          </button>
          <div className="text-gray-400">/</div>
          <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
        </div>
        <button
          onClick={() => setIsEditFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Edit className="h-4 w-4" />
          <span>Edit Product</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Product Details</span>
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pricing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              <span>Pricing</span>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Product Name
                    </label>
                    <div className="flex items-center space-x-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900">{product.name}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      SKU
                    </label>
                    <span className="text-gray-900 font-mono">{product.sku}</span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Unit of Measure
                    </label>
                    <div className="flex items-center space-x-2">
                      <UnitIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-900 capitalize">{product.unit_of_measure}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Status
                    </label>
                    <StatusBadge 
                      status={product.status}
                    />
                  </div>

                  {product.variant && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Variant
                      </label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        product.variant === 'outright' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {product.variant === 'outright' ? 'Outright' : 'Refill'}
                      </span>
                    </div>
                  )}

                  {product.unit_of_measure === 'cylinder' && (
                    <>
                      {product.capacity_kg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Capacity
                          </label>
                          <span className="text-gray-900">{product.capacity_kg} kg</span>
                        </div>
                      )}

                      {product.tare_weight_kg && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Tare Weight
                          </label>
                          <span className="text-gray-900">{product.tare_weight_kg} kg</span>
                        </div>
                      )}

                      {product.valve_type && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-500 mb-1">
                            Valve Type
                          </label>
                          <span className="text-gray-900">{product.valve_type}</span>
                        </div>
                      )}
                    </>
                  )}

                  {product.barcode_uid && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Barcode/RFID UID
                      </label>
                      <div className="flex items-center space-x-2">
                        <Barcode className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-900 font-mono">{product.barcode_uid}</span>
                      </div>
                    </div>
                  )}

                  {product.description && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Description
                      </label>
                      <p className="text-gray-900">{product.description}</p>
                    </div>
                  )}
                </div>

                {product.status === 'obsolete' && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-800">
                        This product is marked as obsolete and is no longer available for new orders.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Product Details */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Details</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Created
                      </label>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">
                          {formatDateSync(product.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <ProductPricing productId={product.id} />
          )}
        </div>
      </div>

      {/* Edit Form Modal */}
      <ProductForm
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={handleEditSubmit}
        product={product}
        loading={product && !product.parent_products_id ? updateParentProduct.isPending : updateProduct.isPending}
        title="Edit Product"
      />
    </div>
  );
};