import React, { useState } from 'react';
import { Plus, MapPin } from 'lucide-react';
import { useAddresses, useCreateAddress, useUpdateAddress, useDeleteAddress, useSetPrimaryAddress } from '../../hooks/useAddresses';
import { AddressCard } from './AddressCard';
import { AddressForm } from './AddressForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Address, CreateAddressData } from '../../types/address';
import toast from 'react-hot-toast';

interface AddressListProps {
  customerId: string;
}

export const AddressList: React.FC<AddressListProps> = ({ customerId }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<Address | null>(null);

  const { data: addresses = [], isLoading } = useAddresses(customerId);
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();
  const setPrimaryAddress = useSetPrimaryAddress();

  const handleAddAddress = () => {
    setEditingAddress(null);
    setIsFormOpen(true);
  };

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setIsFormOpen(true);
  };

  const handleDeleteAddress = (address: Address) => {
    if (address.is_primary) {
      toast.error('Primary address cannot be deleted. Please set another address as primary before deleting.');
      return;
    }
    setDeletingAddress(address);
  };

  const handleSetPrimary = async (address: Address) => {
    if (!address.is_primary) {
      try {
        await setPrimaryAddress.mutateAsync(address);
      } catch (error) {
        // Error handling is done in the hook
      }
    }
  };

  const handleFormSubmit = async (data: CreateAddressData) => {
    try {
      if (editingAddress) {
        await updateAddress.mutateAsync({ ...data, address_id: editingAddress.id });
      } else {
        await createAddress.mutateAsync(data);
      }
      setIsFormOpen(false);
      setEditingAddress(null);
    } catch (error) {
      // Error handling is done in the hooks
    }
  };

  const handleConfirmDelete = async () => {
    if (deletingAddress) {
      try {
        await deleteAddress.mutateAsync({ address_id: deletingAddress.id });
        setDeletingAddress(null);
      } catch (error) {
        // Error handling is done in the hooks
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <MapPin className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900">
            Delivery Addresses ({addresses.length})
          </h3>
        </div>
        <button
          onClick={handleAddAddress}
          className="flex items-center space-x-2 bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add Address</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-8">
          <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No delivery addresses added yet</p>
          <button
            onClick={handleAddAddress}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Add the first address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {addresses.map((address: Address, idx: number) => (
            <AddressCard
              key={address.id}
              address={{ ...address, label: address.label || `Address #${idx + 1}` }}
              onEdit={handleEditAddress}
              onDelete={handleDeleteAddress}
              onSetPrimary={handleSetPrimary}
            />
          ))}
        </div>
      )}

      <AddressForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAddress(null);
        }}
        onSubmit={handleFormSubmit}
        address={editingAddress || undefined}
        customerId={customerId}
        loading={createAddress.isPending || updateAddress.isPending}
        title={editingAddress ? 'Edit Address' : 'Add New Address'}
        isFirstAddress={addresses.length === 0}
      />

      <ConfirmDialog
        isOpen={!!deletingAddress}
        onClose={() => setDeletingAddress(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Address"
        message={`Are you sure you want to delete this address? ${
          deletingAddress?.is_primary ? 'This is the primary address for this customer.' : ''
        }`}
        confirmText="Delete"
        type="danger"
        loading={deleteAddress.isPending}
      />
    </div>
  );
};