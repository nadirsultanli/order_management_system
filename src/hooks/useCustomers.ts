import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Customer, CreateCustomerData, UpdateCustomerData, CustomerFilters } from '../types/customer';
import toast from 'react-hot-toast';
import { geocodeAddress } from '../utils/address';
import { CreateAddressData } from '../types/address';

const CUSTOMERS_PER_PAGE = 50;

export const useCustomers = (filters: CustomerFilters = {}) => {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      console.log('Fetching customers with filters:', filters);
      
      // First, get customers with primary addresses
      let queryWithAddress = supabase
        .from('customers')
        .select(`
          *,
          primary_address:addresses!inner(
            id,
            line1,
            line2,
            city,
            state,
            postal_code,
            country
          )
        `, { count: 'exact' })
        .eq('addresses.is_primary', true)
        .order('created_at', { ascending: false });

      // Apply search filter
      if (filters.search) {
        queryWithAddress = queryWithAddress.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,tax_id.ilike.%${filters.search}%`);
      }

      // Apply status filter
      if (filters.account_status) {
        queryWithAddress = queryWithAddress.eq('account_status', filters.account_status);
      }

      // Apply pagination
      const page = filters.page || 1;
      const limit = filters.limit || CUSTOMERS_PER_PAGE;
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      queryWithAddress = queryWithAddress.range(from, to);

      const { data: customersWithAddress, error: errorWithAddress, count: countWithAddress } = await queryWithAddress;

      console.log('Customers with address response:', { customersWithAddress, errorWithAddress, countWithAddress });

      if (errorWithAddress) {
        console.error('Supabase error (with address):', errorWithAddress);
        throw new Error(errorWithAddress.message);
      }

      // Get customers without addresses
      let queryWithoutAddress = supabase
        .from('customers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      // Exclude customers that already have primary addresses
      if (customersWithAddress && customersWithAddress.length > 0) {
        const customerIdsWithAddress = customersWithAddress.map(c => c.id).filter(id => id);
        if (customerIdsWithAddress.length > 0) {
          queryWithoutAddress = queryWithoutAddress.not('id', 'in', `(${customerIdsWithAddress.join(',')})`);
        }
      }

      // Apply same filters to customers without addresses
      if (filters.search) {
        queryWithoutAddress = queryWithoutAddress.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,tax_id.ilike.%${filters.search}%`);
      }

      if (filters.account_status) {
        queryWithoutAddress = queryWithoutAddress.eq('account_status', filters.account_status);
      }

      const { data: customersWithoutAddress, error: errorWithoutAddress, count: countWithoutAddress } = await queryWithoutAddress;

      console.log('Customers without address response:', { customersWithoutAddress, errorWithoutAddress, countWithoutAddress });

      if (errorWithoutAddress) {
        console.error('Supabase error (without address):', errorWithoutAddress);
        // Don't throw error here, just log it and continue with customers that have addresses
      }

      // Combine results
      const allCustomers = [
        ...(customersWithAddress || []),
        ...(customersWithoutAddress || []).map(c => ({ ...c, primary_address: null }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const totalCount = (countWithAddress || 0) + (countWithoutAddress || 0);

      return {
        customers: allCustomers as Customer[],
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      };
    },
    retry: 1,
    staleTime: 30000, // 30 seconds
  });
};

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      console.log('Fetching customer:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid customer ID');
      }
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      console.log('Customer fetch result:', { data, error });

      if (error) {
        console.error('Customer fetch error:', error);
        throw new Error(error.message);
      }

      return data as Customer;
    },
    enabled: !!id && id !== 'null' && id !== 'undefined',
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerData: CreateCustomerData) => {
      console.log('Creating customer with address (atomic RPC):', customerData);
      const { address, ...customerFields } = customerData;
      // Geocode address
      let latitude: number | undefined = undefined;
      let longitude: number | undefined = undefined;
      try {
        const geo = await geocodeAddress(address);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      } catch (err) {
        console.warn('Geocoding failed, proceeding without coordinates', err);
      }
      // Call the RPC
      const { data, error } = await supabase.rpc('create_customer_with_address', {
        p_name: customerFields.name,
        p_external_id: customerFields.external_id,
        p_tax_id: customerFields.tax_id,
        p_phone: customerFields.phone,
        p_email: customerFields.email,
        p_account_status: customerFields.account_status,
        p_credit_terms_days: customerFields.credit_terms_days,
        p_label: address.label,
        p_line1: address.line1,
        p_line2: address.line2,
        p_city: address.city,
        p_state: address.state,
        p_postal_code: address.postal_code,
        p_country: address.country,
        p_latitude: latitude,
        p_longitude: longitude,
        p_delivery_window_start: address.delivery_window_start,
        p_delivery_window_end: address.delivery_window_end,
        p_is_primary: true,
        p_instructions: address.instructions,
      });
      if (error) {
        console.error('Create customer+address RPC error:', error);
        throw new Error(error.message);
      }
      // Return the IDs (you can fetch the full customer/address if needed)
      return data?.[0];
    },
    onSuccess: (data) => {
      console.log('Customer and address created successfully (atomic RPC):', data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer and primary address created successfully');
    },
    onError: (error: Error) => {
      console.error('Create customer mutation error:', error);
      toast.error(error.message || 'Failed to create customer');
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updateData }: UpdateCustomerData) => {
      console.log('Updating customer:', id, updateData);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid customer ID');
      }
      
      const { data, error } = await supabase
        .from('customers')
        .update({ 
          ...updateData, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      console.log('Update customer result:', { data, error });

      if (error) {
        console.error('Update customer error:', error);
        throw new Error(error.message);
      }

      return data as Customer;
    },
    onSuccess: (data) => {
      console.log('Customer updated successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
      toast.success('Customer updated successfully');
    },
    onError: (error: Error) => {
      console.error('Update customer mutation error:', error);
      toast.error(error.message || 'Failed to update customer');
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('Deleting customer:', id);
      
      if (!id || id === 'null' || id === 'undefined') {
        throw new Error('Invalid customer ID');
      }
      
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      console.log('Delete customer result:', { error });

      if (error) {
        console.error('Delete customer error:', error);
        throw new Error(error.message);
      }

      return id;
    },
    onSuccess: (id) => {
      console.log('Customer deleted successfully:', id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Delete customer mutation error:', error);
      toast.error(error.message || 'Failed to delete customer');
    },
  });
};