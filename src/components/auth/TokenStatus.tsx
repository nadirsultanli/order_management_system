import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TokenManager } from '../../utils/tokenManager';
import { RefreshCw, Eye, EyeOff, Clock, Shield, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export const TokenStatus: React.FC = () => {
  const { refreshToken, getTokenStatus } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [tokenStatus, setTokenStatus] = useState(() => TokenManager.getTokenInfo());
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Update token status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTokenStatus(TokenManager.getTokenInfo());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Manual token refresh initiated');
      const success = await refreshToken();
      if (success) {
        setTokenStatus(TokenManager.getTokenInfo());
        setLastRefresh(new Date());
        console.log('✅ Manual token refresh successful');
      } else {
        console.error('❌ Manual token refresh failed');
      }
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDebugTokens = () => {
    console.log('🔍 Debug: Current token status');
    TokenManager.debugTokenStatus();
    
    const expirationInfo = TokenManager.getExpirationInfo();
    console.log('🔍 Debug: Expiration info', expirationInfo);
    
    const refreshToken = TokenManager.getRefreshToken();
    console.log('🔍 Debug: Has refresh token', !!refreshToken);
    
    if (refreshToken) {
      console.log('🔍 Debug: Refresh token length', refreshToken.length);
    }
  };

  const getStatusColor = () => {
    if (!tokenStatus) return 'text-gray-500';
    if (tokenStatus.isExpired) return 'text-red-600';
    if (tokenStatus.needsRefresh) return 'text-amber-600';
    return 'text-green-600';
  };

  const getStatusIcon = () => {
    if (!tokenStatus) return <Shield className="h-4 w-4" />;
    if (tokenStatus.isExpired) return <AlertTriangle className="h-4 w-4" />;
    if (tokenStatus.needsRefresh) return <Clock className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!tokenStatus) return 'No token';
    if (tokenStatus.isExpired) return 'Expired';
    if (tokenStatus.needsRefresh) return 'Needs refresh';
    return 'Valid';
  };

  const getStatusBadge = () => {
    if (!tokenStatus) return 'bg-gray-100 text-gray-800';
    if (tokenStatus.isExpired) return 'bg-red-100 text-red-800';
    if (tokenStatus.needsRefresh) return 'bg-amber-100 text-amber-800';
    return 'bg-green-100 text-green-800';
  };

  if (!tokenStatus) {
    return null; // Don't show component if no token
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge()}`}>
            {tokenStatus.expiresInMinutes > 0 ? `${tokenStatus.expiresInMinutes}m left` : 'Expired'}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleDebugTokens}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Debug token info (check console)"
          >
            <Info className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Toggle details"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded transition-colors disabled:opacity-50"
            title="Manually refresh token"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Expires at:</span>
              <div className="font-mono text-xs">
                {tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt).toLocaleString() : 'Unknown'}
              </div>
            </div>
            <div>
              <span className="text-gray-500">Time remaining:</span>
              <div className="font-mono text-xs">
                {TokenManager.getTimeUntilExpiry()}
              </div>
            </div>
          </div>

          {lastRefresh && (
            <div className="text-sm">
              <span className="text-gray-500">Last refresh:</span>
              <div className="font-mono text-xs">
                {lastRefresh.toLocaleString()}
              </div>
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-700 mb-1">Token Refresh Info:</div>
            <div className="text-gray-600">
              • Automatic refresh starts 3 minutes before expiration<br />
              • Refresh check runs every minute when signed in<br />
              • Failed API calls (401) trigger automatic refresh<br />
              • Manual refresh available above<br />
              • Debug button logs detailed token info to console
            </div>
          </div>

          <div className="mt-3 p-3 bg-blue-50 rounded text-xs">
            <div className="font-medium text-blue-700 mb-1">Current Status:</div>
            <div className="text-blue-600 space-y-1">
              <div>✓ Has access token: {tokenStatus.token ? 'Yes' : 'No'}</div>
              <div>✓ Has refresh token: {TokenManager.getRefreshToken() ? 'Yes' : 'No'}</div>
              <div>✓ Is expired: {tokenStatus.isExpired ? 'Yes' : 'No'}</div>
              <div>✓ Needs refresh: {tokenStatus.needsRefresh ? 'Yes' : 'No'}</div>
              <div>✓ Minutes until expiry: {tokenStatus.expiresInMinutes}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 