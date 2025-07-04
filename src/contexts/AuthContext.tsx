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
  adminUser: User | null;
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
    adminUser: null,
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

      // Store tokens in localStorage
      localStorage.setItem('auth_token', result.session.access_token);
      localStorage.setItem('refresh_token', result.session.refresh_token);

      setState({
        user: result.user,
        adminUser: result.user, // Backend returns admin user data in the user object
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
      adminUser: null,
      loading: false,
      error: null,
    });
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      // Try multiple ways to get the token
      let token = localStorage.getItem('auth_token');
      
      // If auth_token doesn't exist, try to get from session object
      if (!token) {
        const keys = Object.keys(localStorage);
        
        for (const key of keys) {
          const value = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(value);
            if (parsed && parsed.access_token) {
              token = parsed.access_token;
              break;
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
      
      // Don't redirect if we're already on the login page
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      
      if (!token) {
        setState(prev => ({ ...prev, user: null, adminUser: null, loading: false }));
        if (!isLoginPage) {
          window.location.href = '/login';
        }
        return;
      }

      try {
        // Use GET request for tRPC query procedure
        const tokenForHeader = token;
        const baseUrl = import.meta.env.VITE_BACKEND_URL || 'https://ordermanagementsystem-production-3ed7.up.railway.app';
        const response = await fetch(`${baseUrl}/api/v1/trpc/auth.me`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenForHeader}`,
          },
        });
        
        const data = await response.json();
        
        if (data && data.result && data.result.data) {
          const result = data.result.data;
          setState({
            user: result.user,
            adminUser: result.user, // Backend returns admin user data in the user object
            loading: false,
            error: null,
          });
        } else {
          throw new Error('Invalid response format from auth.me');
        }
      } catch (error) {
        // Keep only essential error logging for production debugging
        console.error('Auth initialization failed:', error?.message);
        
        // Token is invalid, clear it
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        setState({
          user: null,
          adminUser: null,
          loading: false,
          error: null,
        });
        if (!isLoginPage) {
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