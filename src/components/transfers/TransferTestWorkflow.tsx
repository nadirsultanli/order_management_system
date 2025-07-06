import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Square, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Database,
  Send,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { trpc } from '../../lib/trpc-client';
import { useTransferDebug } from './TransferDebugPanel';
import toast from 'react-hot-toast';

interface TestStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  result?: any;
  metadata?: any;
}

interface TestSuite {
  id: string;
  name: string;
  description: string;
  steps: TestStep[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

interface TransferTestWorkflowProps {
  onComplete?: (results: TestSuite[]) => void;
  className?: string;
}

export const TransferTestWorkflow: React.FC<TransferTestWorkflowProps> = ({
  onComplete,
  className = ''
}) => {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<{ suiteId: string; stepId: string } | null>(null);
  const [testResults, setTestResults] = useState<any>({});
  const [debugEnabled, setDebugEnabled] = useState(true);
  
  const { captureRequest, captureResponse, captureError, captureValidation } = useTransferDebug(debugEnabled);

  // Initialize test suites
  useEffect(() => {
    setTestSuites([
      {
        id: 'validation_tests',
        name: 'Transfer Validation Tests',
        description: 'Test validation functions and error handling',
        status: 'pending',
        steps: [
          {
            id: 'valid_single_item',
            name: 'Valid Single Item Transfer',
            description: 'Test validation with a valid single-item transfer',
            status: 'pending'
          },
          {
            id: 'insufficient_stock',
            name: 'Insufficient Stock Validation',
            description: 'Test validation with insufficient stock',
            status: 'pending'
          },
          {
            id: 'same_warehouse',
            name: 'Same Warehouse Validation',
            description: 'Test validation with same source and destination',
            status: 'pending'
          },
          {
            id: 'multi_item_validation',
            name: 'Multi-Item Validation',
            description: 'Test validation with multiple items',
            status: 'pending'
          }
        ]
      },
      {
        id: 'creation_tests',
        name: 'Transfer Creation Tests',
        description: 'Test transfer creation workflow',
        status: 'pending',
        steps: [
          {
            id: 'create_valid_transfer',
            name: 'Create Valid Transfer',
            description: 'Create a valid transfer with proper validation',
            status: 'pending'
          },
          {
            id: 'create_with_validation_errors',
            name: 'Create with Validation Errors',
            description: 'Attempt to create transfer with validation errors',
            status: 'pending'
          },
          {
            id: 'create_multi_item_transfer',
            name: 'Create Multi-Item Transfer',
            description: 'Create transfer with multiple items',
            status: 'pending'
          }
        ]
      },
      {
        id: 'status_tests',
        name: 'Transfer Status Tests',
        description: 'Test transfer status updates and workflow',
        status: 'pending',
        steps: [
          {
            id: 'status_transitions',
            name: 'Valid Status Transitions',
            description: 'Test valid status transitions',
            status: 'pending'
          },
          {
            id: 'invalid_transitions',
            name: 'Invalid Status Transitions',
            description: 'Test invalid status transitions are rejected',
            status: 'pending'
          },
          {
            id: 'complete_transfer',
            name: 'Complete Transfer',
            description: 'Test transfer completion and stock movement',
            status: 'pending'
          }
        ]
      },
      {
        id: 'integration_tests',
        name: 'End-to-End Integration Tests',
        description: 'Full workflow from creation to completion',
        status: 'pending',
        steps: [
          {
            id: 'full_workflow',
            name: 'Complete Transfer Workflow',
            description: 'Test complete workflow: validate → create → approve → transit → complete',
            status: 'pending'
          },
          {
            id: 'stock_verification',
            name: 'Stock Movement Verification',
            description: 'Verify stock levels are correctly updated after transfer',
            status: 'pending'
          },
          {
            id: 'audit_trail',
            name: 'Audit Trail Verification',
            description: 'Verify audit trail is properly maintained',
            status: 'pending'
          }
        ]
      }
    ]);
  }, []);

  const updateStepStatus = (suiteId: string, stepId: string, updates: Partial<TestStep>) => {
    setTestSuites(prev => prev.map(suite => {
      if (suite.id !== suiteId) return suite;
      
      return {
        ...suite,
        steps: suite.steps.map(step => 
          step.id === stepId ? { ...step, ...updates } : step
        )
      };
    }));
  };

  const updateSuiteStatus = (suiteId: string, updates: Partial<TestSuite>) => {
    setTestSuites(prev => prev.map(suite => 
      suite.id === suiteId ? { ...suite, ...updates } : suite
    ));
  };

  // Get test data (warehouses, products)
  const getTestData = async () => {
    try {
      const warehousesQuery = trpc.warehouses.list.useQuery();
      const productsQuery = trpc.transfers.searchProducts.useQuery({ limit: 5 });
      
      // Wait for both queries to complete
      await Promise.all([warehousesQuery.refetch(), productsQuery.refetch()]);
      
      const warehouses = warehousesQuery.data?.warehouses || [];
      const products = productsQuery.data || [];
      
      if (warehouses.length < 2) {
        throw new Error('Need at least 2 warehouses for testing');
      }
      
      if (products.length < 1) {
        throw new Error('Need at least 1 product for testing');
      }
      
      return {
        sourceWarehouse: warehouses[0],
        destinationWarehouse: warehouses[1],
        product: products[0],
        products: products.slice(0, 3) // For multi-item tests
      };
    } catch (error) {
      throw new Error(`Failed to get test data: ${error}`);
    }
  };

  // Test implementation functions
  const runValidationTests = async (suiteId: string, testData: any) => {
    const suite = testSuites.find(s => s.id === suiteId);
    if (!suite) return;

    // Valid single item transfer test
    setCurrentTest({ suiteId, stepId: 'valid_single_item' });
    updateStepStatus(suiteId, 'valid_single_item', { status: 'running' });
    
    try {
      const startTime = Date.now();
      captureRequest('validation_test', {
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        items: [{ product_id: testData.product.id, quantity_to_transfer: 1 }]
      });
      
      const validationResult = await trpc.transfers.validate.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        transfer_date: new Date().toISOString().split('T')[0],
        items: [{
          product_id: testData.product.id,
          quantity_to_transfer: 1
        }]
      });
      
      const duration = Date.now() - startTime;
      captureValidation('validation_test', validationResult);
      
      updateStepStatus(suiteId, 'valid_single_item', {
        status: validationResult.is_valid ? 'success' : 'failed',
        duration,
        result: validationResult,
        error: validationResult.is_valid ? undefined : validationResult.errors.join(', ')
      });
    } catch (error) {
      captureError('validation_test', error);
      updateStepStatus(suiteId, 'valid_single_item', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Insufficient stock test
    setCurrentTest({ suiteId, stepId: 'insufficient_stock' });
    updateStepStatus(suiteId, 'insufficient_stock', { status: 'running' });
    
    try {
      const startTime = Date.now();
      const validationResult = await trpc.transfers.validate.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        transfer_date: new Date().toISOString().split('T')[0],
        items: [{
          product_id: testData.product.id,
          quantity_to_transfer: 999999 // Unreasonably high quantity
        }]
      });
      
      const duration = Date.now() - startTime;
      captureValidation('insufficient_stock_test', validationResult);
      
      updateStepStatus(suiteId, 'insufficient_stock', {
        status: !validationResult.is_valid ? 'success' : 'failed', // Should be invalid
        duration,
        result: validationResult,
        error: validationResult.is_valid ? 'Expected validation to fail with insufficient stock' : undefined
      });
    } catch (error) {
      captureError('insufficient_stock_test', error);
      updateStepStatus(suiteId, 'insufficient_stock', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Same warehouse test
    setCurrentTest({ suiteId, stepId: 'same_warehouse' });
    updateStepStatus(suiteId, 'same_warehouse', { status: 'running' });
    
    try {
      const startTime = Date.now();
      const validationResult = await trpc.transfers.validate.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.sourceWarehouse.id, // Same warehouse
        transfer_date: new Date().toISOString().split('T')[0],
        items: [{
          product_id: testData.product.id,
          quantity_to_transfer: 1
        }]
      });
      
      const duration = Date.now() - startTime;
      captureValidation('same_warehouse_test', validationResult);
      
      updateStepStatus(suiteId, 'same_warehouse', {
        status: !validationResult.is_valid ? 'success' : 'failed', // Should be invalid
        duration,
        result: validationResult,
        error: validationResult.is_valid ? 'Expected validation to fail with same warehouse' : undefined
      });
    } catch (error) {
      captureError('same_warehouse_test', error);
      updateStepStatus(suiteId, 'same_warehouse', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Multi-item validation test
    if (testData.products.length >= 2) {
      setCurrentTest({ suiteId, stepId: 'multi_item_validation' });
      updateStepStatus(suiteId, 'multi_item_validation', { status: 'running' });
      
      try {
        const startTime = Date.now();
        const validationResult = await trpc.transfers.validate.mutate({
          source_warehouse_id: testData.sourceWarehouse.id,
          destination_warehouse_id: testData.destinationWarehouse.id,
          transfer_date: new Date().toISOString().split('T')[0],
          items: testData.products.slice(0, 2).map((product: any) => ({
            product_id: product.id,
            quantity_to_transfer: 1
          }))
        });
        
        const duration = Date.now() - startTime;
        captureValidation('multi_item_test', validationResult);
        
        updateStepStatus(suiteId, 'multi_item_validation', {
          status: 'success',
          duration,
          result: validationResult
        });
      } catch (error) {
        captureError('multi_item_test', error);
        updateStepStatus(suiteId, 'multi_item_validation', {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      updateStepStatus(suiteId, 'multi_item_validation', {
        status: 'skipped',
        error: 'Insufficient products for multi-item test'
      });
    }
  };

  const runCreationTests = async (suiteId: string, testData: any) => {
    // Create valid transfer test
    setCurrentTest({ suiteId, stepId: 'create_valid_transfer' });
    updateStepStatus(suiteId, 'create_valid_transfer', { status: 'running' });
    
    try {
      const startTime = Date.now();
      captureRequest('create_transfer', {
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        items: [{ product_id: testData.product.id, quantity_to_transfer: 1 }]
      });
      
      const transfer = await trpc.transfers.create.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        transfer_date: new Date().toISOString().split('T')[0],
        priority: 'normal',
        items: [{
          product_id: testData.product.id,
          quantity_to_transfer: 1
        }]
      });
      
      const duration = Date.now() - startTime;
      captureResponse('create_transfer', transfer, duration);
      
      updateStepStatus(suiteId, 'create_valid_transfer', {
        status: 'success',
        duration,
        result: transfer
      });
      
      // Store created transfer for status tests
      setTestResults(prev => ({ ...prev, createdTransfer: transfer }));
    } catch (error) {
      captureError('create_transfer', error);
      updateStepStatus(suiteId, 'create_valid_transfer', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const runStatusTests = async (suiteId: string) => {
    const createdTransfer = testResults.createdTransfer;
    if (!createdTransfer) {
      updateStepStatus(suiteId, 'status_transitions', {
        status: 'skipped',
        error: 'No transfer available for status testing'
      });
      return;
    }

    // Test valid status transitions
    setCurrentTest({ suiteId, stepId: 'status_transitions' });
    updateStepStatus(suiteId, 'status_transitions', { status: 'running' });
    
    try {
      const startTime = Date.now();
      
      // Transition to pending
      const pendingTransfer = await trpc.transfers.updateStatus.mutate({
        transfer_id: createdTransfer.id,
        new_status: 'pending'
      });
      
      // Transition to approved
      const approvedTransfer = await trpc.transfers.updateStatus.mutate({
        transfer_id: createdTransfer.id,
        new_status: 'approved'
      });
      
      const duration = Date.now() - startTime;
      captureResponse('status_transitions', { pendingTransfer, approvedTransfer }, duration);
      
      updateStepStatus(suiteId, 'status_transitions', {
        status: 'success',
        duration,
        result: { pendingTransfer, approvedTransfer }
      });
      
      setTestResults(prev => ({ ...prev, approvedTransfer }));
    } catch (error) {
      captureError('status_transitions', error);
      updateStepStatus(suiteId, 'status_transitions', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const runIntegrationTests = async (suiteId: string, testData: any) => {
    // Full workflow test
    setCurrentTest({ suiteId, stepId: 'full_workflow' });
    updateStepStatus(suiteId, 'full_workflow', { status: 'running' });
    
    try {
      const startTime = Date.now();
      
      // Complete workflow: validate → create → approve → transit → complete
      const validation = await trpc.transfers.validate.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        transfer_date: new Date().toISOString().split('T')[0],
        items: [{ product_id: testData.product.id, quantity_to_transfer: 1 }]
      });
      
      if (!validation.is_valid) {
        throw new Error('Validation failed for integration test');
      }
      
      const transfer = await trpc.transfers.create.mutate({
        source_warehouse_id: testData.sourceWarehouse.id,
        destination_warehouse_id: testData.destinationWarehouse.id,
        transfer_date: new Date().toISOString().split('T')[0],
        priority: 'normal',
        items: [{ product_id: testData.product.id, quantity_to_transfer: 1 }]
      });
      
      // Progress through statuses
      await trpc.transfers.updateStatus.mutate({
        transfer_id: transfer.id,
        new_status: 'pending'
      });
      
      await trpc.transfers.updateStatus.mutate({
        transfer_id: transfer.id,
        new_status: 'approved'
      });
      
      await trpc.transfers.updateStatus.mutate({
        transfer_id: transfer.id,
        new_status: 'in_transit'
      });
      
      const completedTransfer = await trpc.transfers.updateStatus.mutate({
        transfer_id: transfer.id,
        new_status: 'completed'
      });
      
      const duration = Date.now() - startTime;
      captureResponse('full_workflow', completedTransfer, duration);
      
      updateStepStatus(suiteId, 'full_workflow', {
        status: 'success',
        duration,
        result: completedTransfer
      });
    } catch (error) {
      captureError('full_workflow', error);
      updateStepStatus(suiteId, 'full_workflow', {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    
    try {
      // Get test data
      const testData = await getTestData();
      
      // Run test suites sequentially
      for (const suite of testSuites) {
        updateSuiteStatus(suite.id, { status: 'running', startTime: Date.now() });
        
        switch (suite.id) {
          case 'validation_tests':
            await runValidationTests(suite.id, testData);
            break;
          case 'creation_tests':
            await runCreationTests(suite.id, testData);
            break;
          case 'status_tests':
            await runStatusTests(suite.id);
            break;
          case 'integration_tests':
            await runIntegrationTests(suite.id, testData);
            break;
        }
        
        updateSuiteStatus(suite.id, { 
          status: 'completed', 
          endTime: Date.now() 
        });
      }
      
      toast.success('All tests completed!');
    } catch (error) {
      toast.error(`Test execution failed: ${error}`);
    } finally {
      setIsRunning(false);
      setCurrentTest(null);
    }
  };

  const stopTests = () => {
    setIsRunning(false);
    setCurrentTest(null);
  };

  const downloadResults = () => {
    const results = {
      timestamp: new Date().toISOString(),
      testSuites,
      summary: {
        total_suites: testSuites.length,
        completed_suites: testSuites.filter(s => s.status === 'completed').length,
        total_steps: testSuites.reduce((acc, s) => acc + s.steps.length, 0),
        passed_steps: testSuites.reduce((acc, s) => acc + s.steps.filter(step => step.status === 'success').length, 0),
        failed_steps: testSuites.reduce((acc, s) => acc + s.steps.filter(step => step.status === 'failed').length, 0),
        skipped_steps: testSuites.reduce((acc, s) => acc + s.steps.filter(step => step.status === 'skipped').length, 0)
      }
    };

    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transfer-test-results-${new Date().toISOString().slice(0, 19)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'skipped': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transfer Test Workflow</h2>
          <p className="text-gray-600">Comprehensive end-to-end testing of transfer functionality</p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={debugEnabled}
              onChange={(e) => setDebugEnabled(e.target.checked)}
              className="mr-2"
            />
            Debug Mode
          </label>
          <Button
            onClick={downloadResults}
            variant="outline"
            size="sm"
            disabled={isRunning}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Results
          </Button>
          {!isRunning ? (
            <Button onClick={runAllTests}>
              <Play className="w-4 h-4 mr-2" />
              Run All Tests
            </Button>
          ) : (
            <Button onClick={stopTests} variant="destructive">
              <Square className="w-4 h-4 mr-2" />
              Stop Tests
            </Button>
          )}
        </div>
      </div>

      {/* Test Suites */}
      <div className="grid gap-6">
        {testSuites.map((suite) => (
          <Card key={suite.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  {getStatusIcon(suite.status)}
                  <span className="ml-2">{suite.name}</span>
                  {suite.startTime && suite.endTime && (
                    <span className="ml-2 text-sm text-gray-500">
                      ({formatDuration(suite.endTime - suite.startTime)})
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {suite.steps.filter(s => s.status === 'success').length} / {suite.steps.length} passed
                </div>
              </CardTitle>
              <p className="text-sm text-gray-600">{suite.description}</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {suite.steps.map((step) => (
                  <div key={step.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center">
                      {getStatusIcon(step.status)}
                      <div className="ml-3">
                        <div className="font-medium text-sm">{step.name}</div>
                        <div className="text-xs text-gray-500">{step.description}</div>
                        {step.error && (
                          <div className="text-xs text-red-600 mt-1">{step.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      {step.duration && formatDuration(step.duration)}
                      {currentTest?.suiteId === suite.id && currentTest?.stepId === step.id && (
                        <div className="text-blue-600 font-medium">Running...</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};