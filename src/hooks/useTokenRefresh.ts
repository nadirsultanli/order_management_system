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

        console.log('Refreshing access token...');
        const newTokens = await callRefreshAPI(refreshTokenValue);
        
        // Store the new tokens
        TokenManager.storeTokens(newTokens);
        
        console.log('Access token refreshed successfully');
        onTokenRefreshed?.(newTokens);
        
      } catch (error) {
        console.error('Token refresh failed:', error);
        
        const refreshError = error instanceof Error ? error : new Error('Token refresh failed');
        onRefreshError?.(refreshError);
        
        // Check if this is a token expiration issue
        const tokenInfo = TokenManager.getTokenInfo();
        if (!tokenInfo || tokenInfo.isExpired) {
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
      console.log('No token found, skipping refresh check');
      return;
    }

    if (tokenInfo.isExpired) {
      console.log('Token is expired, triggering onTokenExpired');
      onTokenExpired?.();
      return;
    }

    if (tokenInfo.needsRefresh) {
      console.log(`Token expires in ${tokenInfo.expiresInMinutes} minutes, refreshing...`);
      await refreshToken();
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

    // Check immediately
    checkAndRefreshToken();

    // Set up interval to check every minute
    intervalRef.current = setInterval(() => {
      checkAndRefreshToken();
    }, 60 * 1000); // Check every minute

    console.log('Token refresh interval started');
  }, [enabled, checkAndRefreshToken]);

  /**
   * Stop the automatic refresh interval
   */
  const stopRefreshInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('Token refresh interval stopped');
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

  // Set up the refresh interval on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      startRefreshInterval();
    } else {
      stopRefreshInterval();
    }

    return () => {
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