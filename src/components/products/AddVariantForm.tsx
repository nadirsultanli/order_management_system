import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Loader2, Search, Check } from 'lucide-react';
import { trpc } from '../../lib/trpc-client';

interface AddVariantFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: VariantFormData) => void;
  loading?: boolean;
}

interface VariantFormData {
  parent_products_id: string;
  sku_variant: 'EMPTY' | 'FULL-XCH' | 'FULL-OUT' | 'DAMAGED';
  name: string;
  description?: string;
  status: 'active' | 'obsolete';
  barcode_uid?: string;
  is_damaged?: boolean;
}

interface ParentProduct {
  id: string;
  sku: string;
  name: string;
  variant_count?: number;
}

export const AddVariantForm: React.FC<AddVariantFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const [parentProducts, setParentProducts] = useState<ParentProduct[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [generatedSku, setGeneratedSku] = useState('');
  const [existingVariants, setExistingVariants] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<VariantFormData>({
    defaultValues: {
      parent_products_id: '',
      sku_variant: 'EMPTY', // This will be updated dynamically
      name: '',
      description: '',
      status: 'active',
      barcode_uid: '',
      is_damaged: false,
    },
  });

  const watchedSkuVariant = watch('sku_variant');
  const watchedIsDamaged = watch('is_damaged');

  // Fetch parent products
  const { data: parentProductsData, isLoading: loadingParents, refetch: refetchParentProducts } = trpc.products.listParentProducts.useQuery({
    page: 1,
    limit: 100,
    include_variant_counts: true,
  }, {
    staleTime: 0, // Always refetch to get latest data
    refetchOnWindowFocus: true,
  });

  // Fetch existing variants for selected parent
  const { data: variantsData } = trpc.products.getVariants.useQuery(
    { parent_products_id: selectedParent?.id || '' },
    { enabled: !!selectedParent?.id }
  );

  // Get SKU variants options
  const { data: skuVariantsData } = trpc.products.getSkuVariants.useQuery({});

  useEffect(() => {
    if (parentProductsData?.products) {
      setParentProducts(parentProductsData.products);
    }
  }, [parentProductsData]);

  useEffect(() => {
    if (variantsData) {
      setExistingVariants(variantsData.map((v: any) => v.sku_variant));
    }
  }, [variantsData]);

  const canCreateVariant = (variant: string) => {
    if (!selectedParent) return false;
    
    // Check if variant already exists (only one of each variant type allowed)
    if (existingVariants.includes(variant)) return false;
    
    return true;
  };

  // Set default variant to first available option when parent is selected
  useEffect(() => {
    if (selectedParent && existingVariants.length >= 0 && skuVariantsData?.variants) {
      const availableVariants = skuVariantsData.variants.filter((variant: any) => 
        canCreateVariant(variant.value)
      );
      
      if (availableVariants.length > 0) {
        const firstAvailable = availableVariants[0].value;
        if (watchedSkuVariant !== firstAvailable) {
          setValue('sku_variant', firstAvailable);
        }
      }
    }
  }, [selectedParent, existingVariants, skuVariantsData, setValue]);

  useEffect(() => {
    if (selectedParent && watchedSkuVariant) {
      const sku = watchedIsDamaged ? `${selectedParent.sku}-DAMAGED` : `${selectedParent.sku}-${watchedSkuVariant}`;
      setGeneratedSku(sku);
    }
  }, [selectedParent, watchedSkuVariant, watchedIsDamaged]);

  // Reset form when modal closes, refetch parent products when modal opens
  useEffect(() => {
    if (!isOpen) {
      reset();
      setSelectedParent(null);
      setSearchTerm('');
      setShowDropdown(false);
      setGeneratedSku('');
      setExistingVariants([]);
    } else {
      // Refetch parent products when modal opens to get latest data
      refetchParentProducts();
    }
  }, [isOpen, reset, refetchParentProducts]);

  const filteredParentProducts = parentProducts.filter(product =>
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleParentSelect = (product: ParentProduct) => {
    setSelectedParent(product);
    setValue('parent_products_id', product.id);
    setSearchTerm(`${product.sku} - ${product.name}`);
    setShowDropdown(false);
  };

  const handleFormSubmit = async (data: VariantFormData) => {
    if (!selectedParent) return;

    // Only send fields that are expected by CreateVariantSchema
    const variantData = {
      parent_products_id: selectedParent.id,
      sku_variant: watchedIsDamaged ? 'DAMAGED' as const : data.sku_variant,
      name: data.name,
      description: data.description || undefined,
      status: data.status,
      barcode_uid: data.barcode_uid || undefined,
    };

    try {
      onSubmit(variantData);
    } catch (error) {
      console.error('Error creating variant:', error);
      // Let the parent component handle the error display
    }
  };

  const getVariantValidationRules = () => {
    if (!selectedParent) return {};
    
    const hasEmpty = existingVariants.includes('EMPTY');
    const hasFullXch = existingVariants.includes('FULL-XCH');
    const hasFullOut = existingVariants.includes('FULL-OUT');
    
    // If first variant is EMPTY, no second variant options available
    if (hasEmpty && existingVariants.length === 1) {
      return { disableFullOptions: true };
    }
    
    // If first variant is FULL, second variant can be XCH or OUT
    if (hasFullXch || hasFullOut) {
      return { disableEmpty: true };
    }
    
    return {};
  };

  const validationRules = getVariantValidationRules();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
        
        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit(handleFormSubmit)}>
            <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold leading-6 text-gray-900">
                  Add Product Variant
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Parent Product Selector */}
                <div>
                  <label htmlFor="parent_search" className="block text-sm font-medium text-gray-700">
                    Parent Product *
                  </label>
                  <div className="relative">
                    <div className="relative">
                      <input
                        type="text"
                        id="parent_search"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search parent products..."
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    </div>
                    
                    {showDropdown && (
                      <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                        {loadingParents ? (
                          <div className="px-3 py-2 text-sm text-gray-500">Loading...</div>
                        ) : filteredParentProducts.length > 0 ? (
                          filteredParentProducts.map((product) => (
                            <div
                              key={product.id}
                              onClick={() => handleParentSelect(product)}
                              className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-100"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{product.sku}</div>
                                  <div className="text-gray-500">{product.name}</div>
                                </div>
                                <div className="text-xs text-gray-400">
                                  {product.variant_count || 0} variants
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No parent products found</div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.parent_products_id && (
                    <p className="mt-1 text-sm text-red-600">Please select a parent product</p>
                  )}
                </div>

                {/* Selected Parent Info */}
                {selectedParent && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                    <div className="flex items-center space-x-2">
                      <Check className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-sm font-medium text-blue-900">{selectedParent.sku}</div>
                        <div className="text-sm text-blue-700">{selectedParent.name}</div>
                        <div className="text-xs text-blue-600">
                          {selectedParent.variant_count || 0} variants created
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Damaged Checkbox */}
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="is_damaged"
                      {...register('is_damaged')}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="is_damaged" className="ml-2 block text-sm text-gray-700">
                      This is a damaged variant
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Damaged variants bypass normal variant options and use DAMAGED SKU
                  </p>
                </div>

                {/* SKU Variant Selection */}
                {!watchedIsDamaged && (
                  <div>
                    <label htmlFor="sku_variant" className="block text-sm font-medium text-gray-700">
                      Variant Type *
                    </label>
                    <select
                      id="sku_variant"
                      {...register('sku_variant', { required: 'Variant type is required' })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {skuVariantsData?.variants?.map((variant: any) => (
                        <option 
                          key={variant.value} 
                          value={variant.value}
                          disabled={
                            !canCreateVariant(variant.value) || 
                            (validationRules.disableEmpty && variant.value === 'EMPTY') ||
                            (validationRules.disableFullOptions && (variant.value === 'FULL-XCH' || variant.value === 'FULL-OUT'))
                          }
                        >
                          {variant.label} {!canCreateVariant(variant.value) ? '(Already exists)' : ''}
                        </option>
                      ))}
                    </select>
                    {errors.sku_variant && (
                      <p className="mt-1 text-sm text-red-600">{errors.sku_variant.message}</p>
                    )}
                  </div>
                )}

                {/* Generated SKU Preview */}
                {generatedSku && (
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Generated SKU
                    </label>
                    <div className="font-mono text-sm text-gray-900">{generatedSku}</div>
                  </div>
                )}

                {/* Basic Information */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Variant Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        {...register('name', { required: 'Variant name is required' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., 50kg Empty Cylinder"
                      />
                      {errors.name && (
                        <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        rows={3}
                        {...register('description')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Variant description..."
                      />
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                        Status
                      </label>
                      <select
                        id="status"
                        {...register('status')}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="obsolete">Obsolete</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Barcode UID */}
                <div>
                  <label htmlFor="barcode_uid" className="block text-sm font-medium text-gray-700">
                    Barcode/RFID UID
                  </label>
                  <input
                    type="text"
                    id="barcode_uid"
                    {...register('barcode_uid')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Optional unique identifier"
                  />
                </div>

              </div>
            </div>

            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
              <button
                type="submit"
                disabled={
                  loading || 
                  !selectedParent || 
                  (!watchedIsDamaged && !canCreateVariant(watchedSkuVariant))
                }
                className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : (
                  'Create Variant'
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};