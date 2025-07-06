import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Download, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Send,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import toast from 'react-hot-toast';

export interface TransferDebugData {
  timestamp: string;
  type: 'request' | 'response' | 'validation' | 'error';
  operation: string;
  data: any;
  duration?: number;
  success?: boolean;
  error?: string;
  metadata?: {
    transferId?: string;
    userId?: string;
    warehouse_ids?: string[];
    item_count?: number;
  };
}

interface TransferDebugPanelProps {
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
  className?: string;
  maxEntries?: number;
}

export const TransferDebugPanel: React.FC<TransferDebugPanelProps> = ({
  enabled = false,
  onToggle,
  className = '',
  maxEntries = 50
}) => {
  const [isVisible, setIsVisible] = useState(enabled);
  const [debugEntries, setDebugEntries] = useState<TransferDebugData[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<TransferDebugData | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Global debug collector function
  useEffect(() => {
    if (!enabled) return;

    // Create global debug function
    (window as any).captureTransferDebug = (data: TransferDebugData) => {
      const entry: TransferDebugData = {
        ...data,
        timestamp: new Date().toISOString()
      };
      
      setDebugEntries(prev => {
        const newEntries = [entry, ...prev];
        return newEntries.slice(0, maxEntries);
      });
    };

    return () => {
      delete (window as any).captureTransferDebug;
    };
  }, [enabled, maxEntries]);

  const copyToClipboard = (data: any) => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  const downloadDebugData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      entries: debugEntries,
      summary: {
        total_entries: debugEntries.length,
        requests: debugEntries.filter(e => e.type === 'request').length,
        responses: debugEntries.filter(e => e.type === 'response').length,
        errors: debugEntries.filter(e => e.type === 'error').length,
        validations: debugEntries.filter(e => e.type === 'validation').length
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-debug-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearDebugData = () => {
    setDebugEntries([]);
    setSelectedEntry(null);
    toast.success('Debug data cleared');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'request': return <Send className="w-4 h-4 text-blue-500" />;
      case 'response': return <ArrowRight className="w-4 h-4 text-green-500" />;
      case 'validation': return <CheckCircle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Database className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (entry: TransferDebugData) => {
    if (entry.type === 'error') return 'border-l-red-500 bg-red-50';
    if (entry.success === false) return 'border-l-orange-500 bg-orange-50';
    if (entry.type === 'validation') return 'border-l-yellow-500 bg-yellow-50';
    if (entry.type === 'response') return 'border-l-green-500 bg-green-50';
    return 'border-l-blue-500 bg-blue-50';
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  if (!enabled) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          onClick={() => onToggle?.(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Enable Debug
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      {!isVisible && (
        <Button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          Debug ({debugEntries.length})
        </Button>
      )}

      {isVisible && (
        <Card className="w-96 h-96 shadow-xl border-2 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center">
                <Database className="w-4 h-4 mr-2" />
                Transfer Debug
                <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {debugEntries.length}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Button
                  onClick={() => setAutoScroll(!autoScroll)}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                  title={`Auto-scroll: ${autoScroll ? 'ON' : 'OFF'}`}
                >
                  <RefreshCw className={`w-3 h-3 ${autoScroll ? 'text-green-500' : 'text-gray-400'}`} />
                </Button>
                <Button
                  onClick={downloadDebugData}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                  title="Download debug data"
                >
                  <Download className="w-3 h-3" />
                </Button>
                <Button
                  onClick={clearDebugData}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                  title="Clear debug data"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
                <Button
                  onClick={() => setIsVisible(false)}
                  variant="ghost"
                  size="sm"
                  className="p-1 h-6 w-6"
                >
                  <EyeOff className="w-3 h-3" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-2 h-80 overflow-hidden flex flex-col">
            {/* Debug Entries List */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {debugEntries.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No debug data yet
                </div>
              ) : (
                debugEntries.map((entry, index) => (
                  <div
                    key={index}
                    className={`p-2 border-l-4 rounded-r cursor-pointer hover:shadow-sm transition-shadow ${getStatusColor(entry)}`}
                    onClick={() => setSelectedEntry(selectedEntry === entry ? null : entry)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getTypeIcon(entry.type)}
                        <span className="text-xs font-medium">
                          {entry.operation}
                        </span>
                        {entry.duration && (
                          <span className="text-xs text-gray-500">
                            {formatDuration(entry.duration)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {entry.metadata && (
                      <div className="mt-1 text-xs text-gray-600">
                        {entry.metadata.transferId && (
                          <span className="mr-2">ID: {entry.metadata.transferId.slice(-8)}</span>
                        )}
                        {entry.metadata.item_count && (
                          <span className="mr-2">Items: {entry.metadata.item_count}</span>
                        )}
                        {entry.error && (
                          <span className="text-red-600">Error: {entry.error.slice(0, 30)}...</span>
                        )}
                      </div>
                    )}
                    
                    {selectedEntry === entry && (
                      <div className="mt-2 p-2 bg-white rounded border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium">Details</span>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(entry);
                            }}
                            variant="ghost"
                            size="sm"
                            className="p-1 h-5 w-5"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            
            {/* Debug Controls */}
            <div className="mt-2 pt-2 border-t">
              <div className="flex justify-between items-center">
                <label className="flex items-center text-xs">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => onToggle?.(e.target.checked)}
                    className="mr-1"
                  />
                  Active
                </label>
                <Button
                  onClick={() => onToggle?.(false)}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Disable Debug
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Utility hook for capturing debug data
export const useTransferDebug = (enabled: boolean = false) => {
  const captureDebug = (data: Omit<TransferDebugData, 'timestamp'>) => {
    if (!enabled) return;
    
    if ((window as any).captureTransferDebug) {
      (window as any).captureTransferDebug(data);
    }
  };

  const captureRequest = (operation: string, data: any, metadata?: TransferDebugData['metadata']) => {
    captureDebug({
      type: 'request',
      operation,
      data,
      metadata
    });
  };

  const captureResponse = (operation: string, data: any, duration?: number, metadata?: TransferDebugData['metadata']) => {
    captureDebug({
      type: 'response',
      operation,
      data,
      duration,
      success: true,
      metadata
    });
  };

  const captureError = (operation: string, error: any, data?: any, metadata?: TransferDebugData['metadata']) => {
    captureDebug({
      type: 'error',
      operation,
      data: data || {},
      error: error?.message || String(error),
      success: false,
      metadata
    });
  };

  const captureValidation = (operation: string, result: any, metadata?: TransferDebugData['metadata']) => {
    captureDebug({
      type: 'validation',
      operation,
      data: result,
      success: result?.is_valid !== false,
      metadata
    });
  };

  return {
    captureRequest,
    captureResponse,
    captureError,
    captureValidation
  };
};

// Enhanced TRPC client wrapper with debugging
export const withTransferDebug = (client: any, debugEnabled: boolean) => {
  if (!debugEnabled) return client;

  return new Proxy(client, {
    get(target, prop) {
      const originalValue = target[prop];
      
      if (typeof originalValue === 'object' && originalValue !== null) {
        return new Proxy(originalValue, {
          get(nestedTarget, nestedProp) {
            const nestedValue = nestedTarget[nestedProp];
            
            if (typeof nestedValue === 'function') {
              return function(...args: any[]) {
                const operation = `transfers.${String(prop)}.${String(nestedProp)}`;
                const startTime = Date.now();
                
                // Capture request
                if ((window as any).captureTransferDebug) {
                  (window as any).captureTransferDebug({
                    type: 'request',
                    operation,
                    data: args[0] || {},
                    metadata: {
                      transferId: args[0]?.transfer_id || args[0]?.id,
                      item_count: args[0]?.items?.length
                    }
                  });
                }
                
                const result = nestedValue.apply(nestedTarget, args);
                
                if (result && typeof result.then === 'function') {
                  return result
                    .then((response: any) => {
                      const duration = Date.now() - startTime;
                      
                      // Capture successful response
                      if ((window as any).captureTransferDebug) {
                        (window as any).captureTransferDebug({
                          type: 'response',
                          operation,
                          data: response,
                          duration,
                          success: true,
                          metadata: {
                            transferId: response?.id || args[0]?.transfer_id,
                            item_count: response?.items?.length || response?.transfers?.length
                          }
                        });
                      }
                      
                      return response;
                    })
                    .catch((error: any) => {
                      const duration = Date.now() - startTime;
                      
                      // Capture error response
                      if ((window as any).captureTransferDebug) {
                        (window as any).captureTransferDebug({
                          type: 'error',
                          operation,
                          data: { error: error.message, input: args[0] },
                          duration,
                          success: false,
                          error: error.message,
                          metadata: {
                            transferId: args[0]?.transfer_id || args[0]?.id
                          }
                        });
                      }
                      
                      throw error;
                    });
                }
                
                return result;
              };
            }
            
            return nestedValue;
          }
        });
      }
      
      return originalValue;
    }
  });
};