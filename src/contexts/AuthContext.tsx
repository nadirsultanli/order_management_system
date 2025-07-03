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
      
      // Try multiple ways to get the token
      let token = localStorage.getItem('auth_token');
      
      // If auth_token doesn't exist, try to get from session object
      if (!token) {
        const keys = Object.keys(localStorage);
        console.log('📱 LocalStorage keys:', keys);
        
        for (const key of keys) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.access_token) {
              token = parsed.access_token;
              console.log('📱 Found token in key:', key);
              break;
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
      
      console.log('📱 Token from localStorage:', token ? 'EXISTS' : 'NOT_FOUND');
      
      // Don't redirect if we're already on the login page
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      
      if (!token) {
        console.log('❌ No token found');
        setState(prev => ({ ...prev, loading: false }));
        if (!isLoginPage) {
          console.log('🔄 Redirecting to login');
          window.location.href = '/login';
        }
        return;
      }

      try {
        console.log('🔍 Checking auth with backend...');
        
        // Use fetch directly since trpcClient.auth is undefined
        const tokenForHeader = token;
        const response = await fetch('https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1/trpc/auth.me?batch=1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenForHeader}`,
          },
          body: JSON.stringify([]),
        });
        
        const data = await response.json();
        console.log('✅ Auth check response:', data);
        
        if (data && data[0] && data[0].result && data[0].result.data) {
          const result = data[0].result.data;
          console.log('✅ Auth check successful:', result);
          setState({
            user: result.user,
            loading: false,
            error: null,
          });
        } else {
          throw new Error('Invalid response format from auth.me');
        }
      } catch (error) {
        console.log('❌ Auth check failed with error:', error);
        console.log('❌ Error details:', {
          message: error?.message,
          status: error?.status,
          code: error?.code
        });
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setState({
          user: null,
          loading: false,
          error: null,
        });
        if (!isLoginPage) {
          console.log('🔄 Redirecting back to login due to auth failure');
          window.location.href = '/login';
        }
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