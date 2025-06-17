import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User, AdminUser, AuthState } from '../types';
import type { Address } from './address';

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
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

  const checkAdminUser = async (user: User): Promise<AdminUser | null> => {
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  };

  const signIn = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (data.user) {
        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          created_at: data.user.created_at,
        };

        const adminUser = await checkAdminUser(user);
        
        if (!adminUser) {
          await supabase.auth.signOut();
          throw new Error('Unauthorized: You do not have admin access');
        }

        setState({
          user,
          adminUser,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
      throw error;
    }
  };

  const signOut = async () => {
    setState(prev => ({ ...prev, loading: true }));
    await supabase.auth.signOut();
    setState({
      user: null,
      adminUser: null,
      loading: false,
      error: null,
    });
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email!,
          created_at: session.user.created_at,
        };

        const adminUser = await checkAdminUser(user);
        
        if (!adminUser) {
          await supabase.auth.signOut();
          setState({
            user: null,
            adminUser: null,
            loading: false,
            error: 'Unauthorized: You do not have admin access',
          });
          return;
        }

        setState({
          user,
          adminUser,
          loading: false,
          error: null,
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setState({
            user: null,
            adminUser: null,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    ...state,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const getAddressSummary = (address?: Address): string => {
  if (
    !address ||
    !address.line1 ||
    !address.city ||
    !address.country ||
    !address.postal_code
  ) {
    return 'Address incomplete';
  }
  return formatAddress(address);
};