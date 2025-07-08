import { useEffect, useRef, useCallback } from 'react';
import { TokenManager, TokenData } from '../utils/tokenManager';

interface UseTokenRefreshOptions {
  onTokenRefreshed?: (tokens: TokenData) => void;
  onRefreshError?: (error: Error) => void;
  onTokenExpired?: () => void;
  enabled?: boolean;
}

interface RefreshResponse {
  result: {
    data: {
      session: {
        access_token: string;
        refresh_token: string;
        expires_at: number;
        expires_in: number;
      };
    };
  };
}

export const useTokenRefresh = (options: UseTokenRefreshOptions = {}) => {
  const {
    onTokenRefreshed,
    onRefreshError,
    onTokenExpired,
    enabled = true,
  } = options;

  const refreshInProgress = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * Call the refresh token API
   */
  const callRefreshAPI = useCallback(async (refreshToken: string): Promise<TokenData> => {
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
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const data: RefreshResponse = await response.json();
    
    if (!data.result?.data?.session) {
      throw new Error('Invalid refresh response format');
    }

    const session = data.result.data.session;
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      expires_in: session.expires_in,
    };
  }, []);

  /**
   * Refresh the access token
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (refreshInProgress.current) {
      // If refresh is already in progress, wait for it
      if (refreshPromiseRef.current) {
        try {
          await refreshPromiseRef.current;
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    refreshInProgress.current = true;

    const refreshPromise = (async () => {
      try {
        const refreshTokenValue = TokenManager.getRefreshToken();
        if (!refreshTokenValue) {
          throw new Error('No refresh token available');
        }

        console.log('🔄 Refreshing access token...');
        const newTokens = await callRefreshAPI(refreshTokenValue);
        
        // Store the new tokens
        TokenManager.storeTokens(newTokens);
        
        console.log('✅ Access token refreshed successfully');
        
        // Log the new expiration info
        const expirationInfo = TokenManager.getExpirationInfo();
        console.log('New token expires at:', expirationInfo.expiresAt?.toISOString());
        console.log('New token expires in:', expirationInfo.expiresInMinutes, 'minutes');
        
        onTokenRefreshed?.(newTokens);
        
      } catch (error) {
        console.error('❌ Token refresh failed:', error);
        
        const refreshError = error instanceof Error ? error : new Error('Token refresh failed');
        onRefreshError?.(refreshError);
        
        // Check if this is a token expiration issue
        const tokenInfo = TokenManager.getTokenInfo();
        if (!tokenInfo || tokenInfo.isExpired) {
          console.log('🔒 Token expired, triggering onTokenExpired');
          onTokenExpired?.();
        }
        
        throw refreshError;
      } finally {
        refreshInProgress.current = false;
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    
    try {
      await refreshPromise;
      return true;
    } catch {
      return false;
    }
  }, [callRefreshAPI, onTokenRefreshed, onRefreshError, onTokenExpired]);

  /**
   * Check if token needs refresh and do it
   */
  const checkAndRefreshToken = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    const tokenInfo = TokenManager.getTokenInfo();
    
    if (!tokenInfo) {
      console.log('⚠️ No token found, skipping refresh check');
      return;
    }

    if (tokenInfo.isExpired) {
      console.log('⏰ Token is expired, triggering onTokenExpired');
      onTokenExpired?.();
      return;
    }

    if (tokenInfo.needsRefresh) {
      console.log(`🔔 Token expires in ${tokenInfo.expiresInMinutes} minutes, refreshing...`);
      await refreshToken();
    } else {
      console.log(`⏱️ Token check: ${tokenInfo.expiresInMinutes} minutes remaining`);
    }
  }, [enabled, refreshToken, onTokenExpired]);

  /**
   * Start the automatic refresh interval
   */
  const startRefreshInterval = useCallback(() => {
    if (!enabled) return;

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Check if we have tokens before starting
    const tokenInfo = TokenManager.getTokenInfo();
    if (!tokenInfo) {
      console.log('⚠️ No tokens found, cannot start refresh interval');
      return;
    }

    console.log('🚀 Starting token refresh interval');
    console.log('Current token status:', {
      expiresInMinutes: tokenInfo.expiresInMinutes,
      needsRefresh: tokenInfo.needsRefresh,
      isExpired: tokenInfo.isExpired
    });

    // Check immediately
    checkAndRefreshToken();

    // Set up interval to check every minute
    intervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 60 * 1000); // Check every minute

    console.log('✅ Token refresh interval started');
  }, [enabled, checkAndRefreshToken]);

  /**
   * Stop the automatic refresh interval
   */
  const stopRefreshInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('🛑 Token refresh interval stopped');
    }
  }, []);

  /**
   * Manual refresh trigger
   */
  const manualRefresh = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    return await refreshToken();
  }, [enabled, refreshToken]);

  /**
   * Get current token status
   */
  const getTokenStatus = useCallback(() => {
    return TokenManager.getTokenInfo();
  }, []);

  /**
   * Initialize and start refresh interval when tokens are available
   */
  useEffect(() => {
    if (!enabled) {
      stopRefreshInterval();
      return;
    }

    // Start interval immediately if we have tokens
    const tokenInfo = TokenManager.getTokenInfo();
    if (tokenInfo && !tokenInfo.isExpired) {
      startRefreshInterval();
    }

    // Also listen for storage changes to start/stop interval
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'refresh_token') {
        const newTokenInfo = TokenManager.getTokenInfo();
        if (newTokenInfo && !newTokenInfo.isExpired) {
          startRefreshInterval();
        } else {
          stopRefreshInterval();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      stopRefreshInterval();
    };
  }, [enabled, startRefreshInterval, stopRefreshInterval]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRefreshInterval();
      refreshInProgress.current = false;
      refreshPromiseRef.current = null;
    };
  }, [stopRefreshInterval]);

  return {
    refreshToken: manualRefresh,
    checkAndRefreshToken,
    startRefreshInterval,
    stopRefreshInterval,
    getTokenStatus,
    isRefreshing: refreshInProgress.current,
  };
}; 