import React, { createContext, useContext, useEffect, useState } from 'react';
import { trpc, trpcClient } from '../lib/trpc-client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  // tRPC mutations for auth
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await loginMutation.mutateAsync({
        email,
        password,
      });

      console.log('Login result:', result);

      // Store tokens in localStorage
      localStorage.setItem('auth_token', result.session.access_token);
      localStorage.setItem('refresh_token', result.session.refresh_token);

      console.log('Token stored:', localStorage.getItem('auth_token'));

      setState({
        user: result.user,
        loading: false,
        error: null,
      });

      // Redirect to dashboard after successful login
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Login error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Authentication failed',
      }));
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await registerMutation.mutateAsync({
        email,
        password,
        name,
      });

      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Registration failed',
      }));
      throw error;
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      // Call backend logout (optional)
      await logoutMutation.mutateAsync();
    } catch (error) {
      // Ignore logout errors
    }

    // Clear tokens
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    
    setState({
      user: null,
      loading: false,
      error: null,
    });
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🔄 Initializing auth...');
      const token = localStorage.getItem('auth_token');
      console.log('📱 Token from localStorage:', token ? 'EXISTS' : 'NOT_FOUND');
      
      if (!token) {
        console.log('❌ No token found, redirecting to login');
        setState(prev => ({ ...prev, loading: false }));
        window.location.href = '/login';
        return;
      }

      try {
        console.log('🔍 Checking auth with backend...');
        // Try to get current user from backend
        const result = await trpcClient.auth.me.query();
        console.log('✅ Auth check successful:', result);
        setState({
          user: result.user,
          loading: false,
          error: null,
        });
      } catch (error) {
        console.log('❌ Auth check failed:', error);
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setState({
          user: null,
          loading: false,
          error: null,
        });
        window.location.href = '/login';
      }
    };

    initializeAuth();
  }, []);

  const value: AuthContextType = {
    ...state,
    signIn,
    signOut,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};