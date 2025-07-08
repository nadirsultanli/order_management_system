/**
 * Token Manager Utility
 * Handles token storage, expiration tracking, and refresh logic
 */

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  expires_in?: number;
}

export interface TokenInfo {
  token: string;
  expiresAt: number;
  isExpired: boolean;
  expiresInMinutes: number;
  needsRefresh: boolean; // true if expires in 3 minutes or less
}

const TOKEN_KEYS = {
  ACCESS_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  EXPIRES_AT: 'token_expires_at',
} as const;

// 3 minutes in milliseconds
const REFRESH_THRESHOLD_MS = 3 * 60 * 1000;

export class TokenManager {
  /**
   * Store tokens in localStorage with expiration time
   */
  static storeTokens(tokenData: TokenData): void {
    try {
      localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, tokenData.access_token);
      localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, tokenData.refresh_token);
      
      // Calculate expiration time if not provided
      let expiresAt = tokenData.expires_at;
      if (!expiresAt && tokenData.expires_in) {
        expiresAt = Date.now() + (tokenData.expires_in * 1000);
      }
      
      if (expiresAt) {
        localStorage.setItem(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString());
      }
      
      console.log('Tokens stored successfully. Expires at:', new Date(expiresAt));
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  /**
   * Get access token with expiration info
   */
  static getTokenInfo(): TokenInfo | null {
    try {
      const token = localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
      const expiresAtStr = localStorage.getItem(TOKEN_KEYS.EXPIRES_AT);
      
      if (!token) {
        return null;
      }

      const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
      const now = Date.now();
      const isExpired = expiresAt > 0 && now >= expiresAt;
      const expiresInMs = expiresAt - now;
      const expiresInMinutes = Math.max(0, Math.floor(expiresInMs / (60 * 1000)));
      const needsRefresh = expiresAt > 0 && expiresInMs <= REFRESH_THRESHOLD_MS && !isExpired;

      return {
        token,
        expiresAt,
        isExpired,
        expiresInMinutes,
        needsRefresh,
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      return null;
    }
  }

  /**
   * Get refresh token
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * Clear all tokens
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(TOKEN_KEYS.EXPIRES_AT);
      console.log('Tokens cleared');
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  /**
   * Check if tokens exist (backwards compatibility)
   */
  static hasTokens(): boolean {
    try {
      // Try multiple ways to detect tokens for backwards compatibility
      let hasToken = !!localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
      
      if (!hasToken) {
        // Check for tokens stored in different formats
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.includes('auth-token') || key.includes('session')) {
            const value = localStorage.getItem(key);
            try {
              const parsed = JSON.parse(value || '');
              if (parsed && parsed.access_token) {
                hasToken = true;
                break;
              }
            } catch (e) {
              // Not JSON, skip
            }
          }
        }
      }
      
      return hasToken;
    } catch (error) {
      console.error('Failed to check tokens:', error);
      return false;
    }
  }

  /**
   * Migrate old token formats (backwards compatibility)
   */
  static migrateOldTokens(): TokenData | null {
    try {
      // Check if we already have the new format
      if (localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN)) {
        return null;
      }

      // Look for old token formats
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        const value = localStorage.getItem(key);
        try {
          const parsed = JSON.parse(value || '');
          if (parsed && parsed.access_token && parsed.refresh_token) {
            const tokenData: TokenData = {
              access_token: parsed.access_token,
              refresh_token: parsed.refresh_token,
              expires_at: parsed.expires_at || (Date.now() + 60 * 60 * 1000), // Default 1 hour
            };
            
            // Store in new format
            this.storeTokens(tokenData);
            
            // Clean up old format
            localStorage.removeItem(key);
            
            console.log('Migrated tokens from old format');
            return tokenData;
          }
        } catch (e) {
          // Not JSON or invalid format, skip
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to migrate old tokens:', error);
      return null;
    }
  }

  /**
   * Get time until token expires (for display purposes)
   */
  static getTimeUntilExpiry(): string {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo || tokenInfo.expiresAt <= 0) {
      return 'Unknown';
    }

    const now = Date.now();
    const timeLeft = tokenInfo.expiresAt - now;
    
    if (timeLeft <= 0) {
      return 'Expired';
    }

    const minutes = Math.floor(timeLeft / (60 * 1000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m`;
    }
  }

  /**
   * Debug: Log current token status
   */
  static debugTokenStatus(): void {
    const tokenInfo = this.getTokenInfo();
    const refreshToken = this.getRefreshToken();
    
    console.log('Token Status:', {
      hasAccessToken: !!tokenInfo?.token,
      hasRefreshToken: !!refreshToken,
      isExpired: tokenInfo?.isExpired,
      needsRefresh: tokenInfo?.needsRefresh,
      expiresInMinutes: tokenInfo?.expiresInMinutes,
      expiresAt: tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt) : null,
      timeUntilExpiry: this.getTimeUntilExpiry(),
    });
  }
} 