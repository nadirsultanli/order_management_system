import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TokenManager } from '../../utils/tokenManager';
import { RefreshCw, Eye, EyeOff, Clock, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

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
      const success = await refreshToken();
      if (success) {
        setTokenStatus(TokenManager.getTokenInfo());
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
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
          
          {tokenStatus.expiresInMinutes > 0 && (
            <div className="text-sm text-gray-500">
              Expires in {tokenStatus.expiresInMinutes}m
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
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
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Status</div>
              <div className={`font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500">Time until expiry</div>
              <div className="font-medium">
                {TokenManager.getTimeUntilExpiry()}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500">Expires at</div>
              <div className="font-medium">
                {tokenStatus.expiresAt > 0 
                  ? new Date(tokenStatus.expiresAt).toLocaleString()
                  : 'Unknown'
                }
              </div>
            </div>
            
            <div>
              <div className="text-gray-500">Auto-refresh</div>
              <div className="font-medium">
                {tokenStatus.needsRefresh ? (
                  <span className="text-amber-600">Needed</span>
                ) : (
                  <span className="text-green-600">Active</span>
                )}
              </div>
            </div>
            
            {lastRefresh && (
              <div className="col-span-2">
                <div className="text-gray-500">Last refresh</div>
                <div className="font-medium">
                  {lastRefresh.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-700 mb-1">Token Refresh Info:</div>
            <div className="text-gray-600">
              • Automatic refresh starts 3 minutes before expiration<br />
              • Refresh check runs every minute when signed in<br />
              • Failed API calls (401) trigger automatic refresh<br />
              • Manual refresh available above
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 