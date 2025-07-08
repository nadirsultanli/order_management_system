import React, { createContext, useContext, useEffect, useState } from 'react';
import { trpc, trpcClient } from '../lib/trpc-client';
import { TokenManager, TokenData } from '../utils/tokenManager';
import { useTokenRefresh } from '../hooks/useTokenRefresh';

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
  refreshToken: () => Promise<boolean>;
  getTokenStatus: () => any;
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

  // tRPC mutations for auth - use proper mutation syntax
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Token refresh hook with callbacks
  const { 
    refreshToken: manualRefreshToken, 
    getTokenStatus,
    startRefreshInterval,
    stopRefreshInterval,
  } = useTokenRefresh({
    onTokenRefreshed: (tokens: TokenData) => {
      console.log('Token refreshed successfully in AuthContext');
      // Token is already stored by TokenManager, no need to update state
      // The user state remains the same, only the token is refreshed
    },
    onRefreshError: (error: Error) => {
      console.error('Token refresh error in AuthContext:', error);
      // Don't immediately sign out on refresh error, let the user continue
      // They will be signed out when they try to make an authenticated request
    },
    onTokenExpired: () => {
      console.log('Token expired, signing out user');
      handleTokenExpired();
    },
    enabled: !!state.user, // Only enable refresh when user is signed in
  });

  const handleTokenExpired = () => {
    console.log('Handling token expiration - clearing auth state');
    TokenManager.clearTokens();
    setState({
      user: null,
      adminUser: null,
      loading: false,
      error: null,
    });
    
    // Redirect to login if not already there
    const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
    if (!isLoginPage) {
      window.location.href = '/login';
    }
  };

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await loginMutation.mutateAsync({
        email,
        password,
      });

      // Store tokens using TokenManager
      const tokenData: TokenData = {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at,
        expires_in: result.session.expires_in,
      };
      
      TokenManager.storeTokens(tokenData);

      setState({
        user: result.user,
        adminUser: result.user, // Backend returns admin user data in the user object
        loading: false,
        error: null,
      });

      console.log('User signed in successfully, token refresh will start automatically');

      // Redirect to dashboard after successful login
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error('Login error:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error?.message || 'Authentication failed',
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
        error: error?.message || 'Registration failed',
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

    // Clear tokens using TokenManager
    TokenManager.clearTokens();
    
    setState({
      user: null,
      adminUser: null,
      loading: false,
      error: null,
    });

    console.log('User signed out, token refresh stopped');
  };

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      // Try to migrate old token formats first
      TokenManager.migrateOldTokens();
      
      const tokenInfo = TokenManager.getTokenInfo();
      
      // Don't redirect if we're already on the login page
      const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
      
      if (!tokenInfo || tokenInfo.isExpired) {
        setState(prev => ({ ...prev, user: null, adminUser: null, loading: false }));
        if (!isLoginPage) {
          window.location.href = '/login';
        }
        return;
      }

      try {
        // Use the token to verify user identity
        const response = await fetch('https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1/trpc/auth.me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenInfo.token}`,
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

          console.log('Auth initialized successfully, token refresh starting');
          
          // Log token status for debugging
          TokenManager.debugTokenStatus();
        } else {
          throw new Error('Invalid response format from auth.me');
        }
      } catch (error: any) {
        console.error('Auth initialization failed:', error?.message || 'Unknown error');
        
        // Token is invalid, clear it
        TokenManager.clearTokens();
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
    refreshToken: manualRefreshToken,
    getTokenStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};