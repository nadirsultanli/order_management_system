import { createTRPCReact } from '@trpc/react-query';
import { httpLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '../../backend/src/routes';
import { TokenManager, TokenData } from '../utils/tokenManager';

export const trpc = createTRPCReact<AppRouter>();

// Token refresh function
const refreshTokens = async (): Promise<boolean> => {
  try {
    const refreshToken = TokenManager.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const apiUrl = import.meta.env.VITE_BACKEND_URL || 
                   (import.meta.env.PROD ? 'https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1/trpc' : 'http://localhost:3001/api/v1/trpc');

    const response = await fetch(`${apiUrl}/auth.refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.result?.data?.session) {
      throw new Error('Invalid refresh response format');
    }

    const session = data.result.data.session;
    const tokenData: TokenData = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
    };
    
    TokenManager.storeTokens(tokenData);
    console.log('Token refreshed successfully in tRPC client');
    return true;
  } catch (error) {
    console.error('Token refresh failed in tRPC client:', error);
    return false;
  }
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: import.meta.env.VITE_BACKEND_URL || 
           (import.meta.env.PROD ? 'https://ordermanagementsystem-production-3ed7.up.railway.app/api/v1/trpc' : 'http://localhost:3001/api/v1/trpc'),
      headers: async () => {
        try {
          // Use TokenManager to get the current token
          const tokenInfo = TokenManager.getTokenInfo();
          
          if (tokenInfo && !tokenInfo.isExpired) {
            return {
              Authorization: `Bearer ${tokenInfo.token}`,
            };
          }

          // If no token or expired, try to get from old format (backwards compatibility)
          const oldToken = localStorage.getItem('auth_token');
          if (oldToken) {
            return {
              Authorization: `Bearer ${oldToken}`,
            };
          }

          // Try to find tokens in other formats
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.includes('auth-token') || key.includes('session')) {
              const value = localStorage.getItem(key);
              try {
                const parsed = JSON.parse(value || '');
                if (parsed && parsed.access_token) {
                  return {
                    Authorization: `Bearer ${parsed.access_token}`,
                  };
                }
              } catch (e) {
                // Not JSON, skip
              }
            }
          }
          
          return {};
        } catch (error) {
          console.warn('Failed to get auth token for tRPC:', error);
          return {};
        }
      },
      fetch: async (input, init) => {
        // Make the initial request
        let response = await fetch(input, init);
        
        // If we get a 401 (Unauthorized), try to refresh the token and retry
        if (response.status === 401) {
          console.log('Received 401, attempting token refresh...');
          
          const refreshSuccess = await refreshTokens();
          
          if (refreshSuccess) {
            // Get the new token and retry the request
            const tokenInfo = TokenManager.getTokenInfo();
            if (tokenInfo && !tokenInfo.isExpired) {
              const newHeaders = {
                ...init?.headers,
                Authorization: `Bearer ${tokenInfo.token}`,
              };
              
              console.log('Retrying request with refreshed token...');
              response = await fetch(input, {
                ...init,
                headers: newHeaders,
              });
            }
          } else {
            // Token refresh failed, clear tokens and redirect to login
            console.log('Token refresh failed, clearing tokens');
            TokenManager.clearTokens();
            
            // Only redirect if not already on login page
            const isLoginPage = window.location.pathname === '/login' || window.location.pathname === '/';
            if (!isLoginPage) {
              window.location.href = '/login';
            }
          }
        }
        
        return response;
      },
    }),
  ],
});