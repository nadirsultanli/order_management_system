import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Accessory, CreateAccessoryData, UpdateAccessoryData, AccessoryFilters, AccessoryStats, AccessoryOptions, AccessoryCategory } from '../types/accessory';
import toast from 'react-hot-toast';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 
  (import.meta.env.PROD ? 'https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1' : 'http://localhost:3001/api/v1');

// Ensure the base URL doesn't end with /trpc to avoid duplication
const getBaseUrl = () => {
  const baseUrl = API_BASE_URL.endsWith('/trpc') 
    ? API_BASE_URL.slice(0, -5) // Remove /trpc if it exists
    : API_BASE_URL;
  return baseUrl;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const useAccessories = (filters?: AccessoryFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['accessories', filters],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const queryParams = filters ? `?input=${encodeURIComponent(JSON.stringify(filters))}` : '';
      const url = `${baseUrl}/trpc/accessories.list${queryParams}`;
      
      // Debug logging
      console.log('Accessories API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data || { accessories: [], totalCount: 0 };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled !== false, // Default to true unless explicitly disabled
  });
};

export const useAccessory = (id: string) => {
  return useQuery({
    queryKey: ['accessory', id],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.getById?input=${encodeURIComponent(JSON.stringify({ id }))}`;
      
      // Debug logging
      console.log('Accessory API URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data || { accessory: null };
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAccessoryStats = () => {
  return useQuery({
    queryKey: ['accessory-stats'],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.getStats`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data || { total: 0, active: 0, obsolete: 0, saleable: 0, serialized: 0, categories: 0 };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAccessoryOptions = (filters?: { status?: string; category_id?: string; saleable_only?: boolean }) => {
  return useQuery({
    queryKey: ['accessory-options', filters],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.getOptions?input=${encodeURIComponent(JSON.stringify(filters || {}))}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data || { accessories: [] };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAccessoryCategories = () => {
  return useQuery({
    queryKey: ['accessory-categories'],
    queryFn: async () => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.getCategories`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.result?.data || { categories: [], totalCount: 0 };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateAccessory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateAccessoryData) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.create`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: (data) => {
      console.log('Accessory created successfully:', data);
      toast.success('Accessory created successfully');
      
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-options'] });
    },
    onError: (error: Error) => {
      console.error('Create accessory mutation error:', error);
      toast.error(error.message || 'Failed to create accessory');
    },
  });
};

export const useUpdateAccessory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateAccessoryData) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.update`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-options'] });
    },
  });
};

export const useDeleteAccessory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.delete`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-options'] });
    },
  });
};

export const useCreateAccessoryCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; slug: string; description?: string }) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.createCategory`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessory-categories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
    },
  });
};

export const useUpdateAccessoryCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; slug?: string; description?: string }) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.updateCategory`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessory-categories'] });
    },
  });
};

export const useDeleteAccessoryCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.deleteCategory`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessory-categories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
    },
  });
};

export const useBulkAccessoryStatusUpdate = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { accessory_ids: string[]; active: boolean }) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.bulkStatusUpdate`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['accessory-options'] });
    },
  });
};

export const useValidateAccessory = () => {
  return useMutation({
    mutationFn: async (data: { sku: string; name: string; exclude_id?: string }) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.validate`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
  });
};

export const useValidateAccessorySku = () => {
  return useMutation({
    mutationFn: async (data: { sku: string; exclude_id?: string }) => {
      const baseUrl = getBaseUrl();
      const url = `${baseUrl}/trpc/accessories.validateSku`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.result?.data;
    },
  });
}; 