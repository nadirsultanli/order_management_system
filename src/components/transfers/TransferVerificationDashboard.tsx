import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  Download, 
  Eye, 
  RefreshCw, 
  Search,
  Settings,
  Shield,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { TransferDebugPanel } from './TransferDebugPanel';
import { TransferTestWorkflow } from './TransferTestWorkflow';
import { 
  checkSystemHealth, 
  verifyTransferIntegrity, 
  generateIntegrityReport,
  monitorTransferWorkflow,
  type SystemHealthMetrics, 
  type TransferVerificationResult,
  type TransferIntegrityCheck
} from '../../utils/transfer-verification';
import { trpc } from '../../lib/trpc-client';
import toast from 'react-hot-toast';

interface TransferVerificationDashboardProps {
  className?: string;
}

export const TransferVerificationDashboard: React.FC<TransferVerificationDashboardProps> = ({
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'testing' | 'monitoring' | 'debug'>('overview');
  const [systemHealth, setSystemHealth] = useState<SystemHealthMetrics | null>(null);
  const [selectedTransferId, setSelectedTransferId] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<TransferVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Get recent transfers for monitoring
  const { data: transfersData, refetch: refetchTransfers } = trpc.transfers.list.useQuery({
    page: 1,
    limit: 20,
    sort_by: 'created_at',
    sort_order: 'desc'
  });

  const transfers = transfersData?.transfers || [];

  useEffect(() => {
    // Load initial system health
    loadSystemHealth();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadSystemHealth();
        if (selectedTransferId) {
          verifyTransfer(selectedTransferId);
        }
      }, 30000); // Refresh every 30 seconds
      
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, selectedTransferId]);

  const loadSystemHealth = async () => {
    try {
      const health = await checkSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      toast.error('Failed to load system health');
      console.error('System health check failed:', error);
    }
  };

  const verifyTransfer = async (transferId: string) => {
    if (!transferId) return;
    
    setIsVerifying(true);
    try {
      const result = await verifyTransferIntegrity(transferId);
      setVerificationResult(result);
      
      const status = result.overallStatus;
      if (status === 'failed') {
        toast.error('Transfer verification failed');
      } else if (status === 'degraded') {
        toast.warning('Transfer has issues');
      } else {
        toast.success('Transfer verified successfully');
      }
    } catch (error) {
      toast.error('Failed to verify transfer');
      console.error('Transfer verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const downloadHealthReport = async () => {
    if (!systemHealth) return;
    
    try {
      const recentTransferIds = transfers.slice(0, 10).map(t => t.id);
      const report = await generateIntegrityReport(recentTransferIds);
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transfer-integrity-report-${new Date().toISOString().slice(0, 19)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Health report downloaded');
    } catch (error) {
      toast.error('Failed to generate health report');
      console.error('Health report generation failed:', error);
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'failed': 
      case 'unavailable':
      case 'critical': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'failed': 
      case 'unavailable':
      case 'critical': return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {systemHealth && (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Transfer Functions</p>
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getHealthStatusColor(systemHealth.transfer_functions_status)}`}>
                      {getHealthIcon(systemHealth.transfer_functions_status)}
                      <span className="ml-1 capitalize">{systemHealth.transfer_functions_status}</span>
                    </div>
                  </div>
                  <Database className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-2xl font-bold">{systemHealth.recent_transfer_success_rate.toFixed(1)}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Transfers</p>
                    <p className="text-2xl font-bold">{systemHealth.active_transfers}</p>
                  </div>
                  <Activity className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">API Response</p>
                    <p className="text-2xl font-bold">{systemHealth.api_response_time}ms</p>
                  </div>
                  <Database className="w-8 h-8 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Transfer Verification Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Transfer Verification</span>
            <div className="flex items-center space-x-2">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-2"
                />
                Auto-refresh
              </label>
              <Button onClick={loadSystemHealth} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <select
                value={selectedTransferId}
                onChange={(e) => setSelectedTransferId(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select a transfer to verify...</option>
                {transfers.map((transfer) => (
                  <option key={transfer.id} value={transfer.id}>
                    {transfer.transfer_reference || transfer.id.slice(-8)} - {transfer.status}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => verifyTransfer(selectedTransferId)}
                disabled={!selectedTransferId || isVerifying}
              >
                {isVerifying ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Verify
              </Button>
            </div>

            {verificationResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg ${getHealthStatusColor(verificationResult.overallStatus)}`}>
                  <div className="flex items-center">
                    {getHealthIcon(verificationResult.overallStatus)}
                    <span className="ml-2 font-medium">
                      Overall Status: {verificationResult.overallStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-2 text-sm">
                    {verificationResult.summary.passed_checks} passed, {' '}
                    {verificationResult.summary.failed_checks} failed, {' '}
                    {verificationResult.summary.warning_checks} warnings
                  </div>
                </div>

                {verificationResult.checks.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Verification Details:</h4>
                    {verificationResult.checks.map((check, index) => (
                      <div 
                        key={index}
                        className={`p-2 rounded border-l-4 ${
                          check.status === 'passed' ? 'border-green-500 bg-green-50' :
                          check.status === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                          'border-red-500 bg-red-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{check.id}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            check.status === 'passed' ? 'bg-green-100 text-green-800' :
                            check.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {check.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-1">{check.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {verificationResult.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Recommendations:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {verificationResult.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-gray-700">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transfers */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {transfers.slice(0, 10).map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-medium">{transfer.transfer_reference || `Transfer ${transfer.id.slice(-8)}`}</div>
                  <div className="text-sm text-gray-500">
                    {transfer.total_items} items • {new Date(transfer.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    transfer.status === 'completed' ? 'bg-green-100 text-green-800' :
                    transfer.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                    transfer.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {transfer.status}
                  </span>
                  <Button
                    onClick={() => {
                      setSelectedTransferId(transfer.id);
                      verifyTransfer(transfer.id);
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <Shield className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transfer Verification Dashboard</h1>
          <p className="text-gray-600">Monitor and verify transfer system integrity</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={downloadHealthReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button
            onClick={() => setDebugEnabled(!debugEnabled)}
            variant={debugEnabled ? "default" : "outline"}
          >
            <Eye className="w-4 h-4 mr-2" />
            {debugEnabled ? 'Disable' : 'Enable'} Debug
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: Activity },
            { id: 'testing', name: 'Testing', icon: Settings },
            { id: 'monitoring', name: 'Monitoring', icon: TrendingUp },
            { id: 'debug', name: 'Debug', icon: Eye }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 inline-block mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'testing' && (
          <TransferTestWorkflow />
        )}
        
        {activeTab === 'monitoring' && (
          <Card>
            <CardHeader>
              <CardTitle>Transfer Monitoring</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Real-time monitoring features would be implemented here, including:
              </p>
              <ul className="list-disc list-inside mt-4 space-y-2 text-gray-600">
                <li>Live transfer status tracking</li>
                <li>Performance metrics over time</li>
                <li>Alert management</li>
                <li>Historical trend analysis</li>
                <li>Automated health checks</li>
              </ul>
            </CardContent>
          </Card>
        )}
        
        {activeTab === 'debug' && (
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                Debug mode captures detailed information about transfer operations for troubleshooting.
              </p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Debug Mode</span>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={debugEnabled}
                      onChange={(e) => setDebugEnabled(e.target.checked)}
                      className="mr-2"
                    />
                    {debugEnabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
                {debugEnabled && (
                  <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                    Debug mode is active. All transfer operations will be logged for analysis.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Debug Panel */}
      <TransferDebugPanel 
        enabled={debugEnabled} 
        onToggle={setDebugEnabled}
      />
    </div>
  );
};