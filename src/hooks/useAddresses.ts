import { CreateAddressData, UpdateAddressData } from '../types/address';
import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

export const useAddresses = (customerId: string) => {
  return trpc.customers.getAddresses.useQuery(
    { customer_id: customerId },
    {
      enabled: !!customerId && customerId !== 'null' && customerId !== 'undefined',
      retry: 1,
      staleTime: 30000,
      // Refetch when customerId changes
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );
};

export const useCreateAddress = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.createAddress.useMutation({
    onSuccess: (data) => {
      console.log('Address created successfully:', data);
      // Invalidate the addresses query for the customer
      utils.customers.getAddresses.invalidate({ customer_id: data.customer_id });
      toast.success('Address created successfully');
    },
    onError: (error: Error) => {
      console.error('Create address mutation error:', error);
      toast.error(error.message || 'Failed to create address');
    },
  });
};

export const useUpdateAddress = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.updateAddress.useMutation({
    onSuccess: (data) => {
      console.log('Address updated successfully:', data);
      // Invalidate the addresses query for the customer
      utils.customers.getAddresses.invalidate({ customer_id: data.customer_id });
      toast.success('Address updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update address mutation error:', error);
      toast.error(error.message || 'Failed to update address');
    },
  });
};

export const useDeleteAddress = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.deleteAddress.useMutation({
    onSuccess: (_, variables) => {
      console.log('Address deleted successfully:', variables.address_id);
      // Invalidate all customer addresses queries since we don't have customer_id in variables
      utils.customers.getAddresses.invalidate();
      toast.success('Address deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete address mutation error:', error);
      toast.error(error.message || 'Failed to delete address');
    },
  });
};

export const useSetPrimaryAddress = () => {
  const utils = trpc.useContext();
  
  return trpc.customers.setPrimaryAddress.useMutation({
    onSuccess: (data, variables) => {
      console.log('Primary address set successfully:', variables.address_id);
      // Invalidate addresses for the customer
      if (data?.customer_id) {
        utils.customers.getAddresses.invalidate({ customer_id: data.customer_id });
      } else {
        // Fallback to invalidate all if customer_id not available
        utils.customers.getAddresses.invalidate();
      }
      toast.success('Primary address updated successfully');
    },
    onError: (error: Error) => {
      console.error('Set primary address mutation error:', error);
      toast.error(error.message || 'Failed to set primary address');
    },
  });
};

export const useGeocodeAddress = () => {
  return trpc.customers.geocodeAddress.useMutation({
    onSuccess: (data) => {
      console.log('Address geocoded successfully:', data);
      toast.success('Address location found');
    },
    onError: (error: Error) => {
      console.error('Geocode address mutation error:', error);
      toast.error(error.message || 'Failed to geocode address');
    },
  });
};

export const useValidateAddress = () => {
  return trpc.customers.validateAddress.useMutation({
    onSuccess: (data) => {
      console.log('Address validated successfully:', data);
      if (data.valid) {
        toast.success('Address is valid');
      } else {
        toast.warning('Address validation found issues');
      }
    },
    onError: (error: Error) => {
      console.error('Validate address mutation error:', error);
      toast.error(error.message || 'Failed to validate address');
    },
  });
};