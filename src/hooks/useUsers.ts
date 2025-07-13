import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// Hook for listing users with filters
export const useUsers = (filters: {
  search?: string;
  role?: 'admin' | 'driver' | 'manager' | 'user';
  active?: boolean;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.users.list.useQuery({
    search: filters.search,
    role: filters.role,
    active: filters.active,
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Users fetch error:', error);
      toast.error('Failed to load users');
    }
  });
};

// Hook for getting a single user
export const useUser = (userId: string) => {
  return trpc.users.getById.useQuery({
    user_id: userId,
  }, {
    enabled: !!userId && userId !== 'null' && userId !== 'undefined',
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('User fetch error:', error);
      toast.error('Failed to load user details');
    }
  });
};

// Hook for getting drivers only (for dropdowns)
export const useDrivers = (filters: {
  search?: string;
  active?: boolean;
  available?: boolean;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.users.getDrivers.useQuery({
    search: filters.search,
    active: filters.active,
    available: filters.available,
    page: filters.page || 1,
    limit: filters.limit || 50,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Drivers fetch error:', error);
      toast.error('Failed to load drivers');
    }
  });
};

// Hook for creating users
export const useCreateUser = () => {
  const utils = trpc.useContext();
  
  return trpc.users.create.useMutation({
    onSuccess: (newUser) => {
      console.log('User created successfully:', newUser);
      
      // Invalidate users list to refetch
      utils.users.list.invalidate();
      
      // If it's a driver, also invalidate drivers list
      if (newUser.role === 'driver') {
        utils.users.getDrivers.invalidate();
      }
      
      toast.success('User created successfully');
    },
    onError: (error) => {
      console.error('Create user error:', error);
      toast.error(error.message || 'Failed to create user');
    },
  });
};

// Hook for updating users
export const useUpdateUser = () => {
  const utils = trpc.useContext();
  
  return trpc.users.update.useMutation({
    onSuccess: (updatedUser) => {
      console.log('User updated successfully:', updatedUser);
      
      // Invalidate queries to refetch updated data
      utils.users.list.invalidate();
      utils.users.getById.invalidate({ user_id: updatedUser.id });
      
      // If it's a driver or was updated to/from driver, invalidate drivers list
      if (updatedUser.role === 'driver') {
        utils.users.getDrivers.invalidate();
      }
      
      toast.success('User updated successfully');
    },
    onError: (error) => {
      console.error('Update user error:', error);
      toast.error(error.message || 'Failed to update user');
    },
  });
};

// Hook for deleting users
export const useDeleteUser = () => {
  const utils = trpc.useContext();
  
  return trpc.users.delete.useMutation({
    onSuccess: (result, variables) => {
      console.log('User deleted successfully:', variables.user_id);
      
      // Invalidate users list to refetch
      utils.users.list.invalidate();
      utils.users.getDrivers.invalidate();
      
      const message = variables.permanent ? 'User deleted permanently' : 'User deactivated successfully';
      toast.success(message);
    },
    onError: (error) => {
      console.error('Delete user error:', error);
      toast.error(error.message || 'Failed to delete user');
    },
  });
};

// Hook for changing user password
export const useChangeUserPassword = () => {
  return trpc.users.changePassword.useMutation({
    onSuccess: () => {
      console.log('Password changed successfully');
      toast.success('Password changed successfully');
    },
    onError: (error) => {
      console.error('Change password error:', error);
      toast.error(error.message || 'Failed to change password');
    },
  });
};

// Hook for validating user data
export const useValidateUser = () => {
  return trpc.users.validate.useMutation({
    onSuccess: (validation) => {
      console.log('User validation completed:', validation);
      
      if (validation.errors.length > 0) {
        validation.errors.forEach(error => toast.error(error));
      }
      
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => toast.warning(warning));
      }
      
      if (validation.valid && validation.errors.length === 0) {
        toast.success('User data is valid');
      }
    },
    onError: (error) => {
      console.error('User validation error:', error);
      toast.error(error.message || 'User validation failed');
    },
  });
};

// Utility hook to get users context
export const useUsersContext = () => {
  return trpc.useContext().users;
};