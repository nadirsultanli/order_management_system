import { trpc } from '../lib/trpc-client';
import toast from 'react-hot-toast';

// ============ COMPLIANCE ALERTS HOOKS ============

export const useComplianceAlerts = (filters: {
  cylinder_asset_id?: string;
  alert_type?: 'inspection_due' | 'pressure_test_due' | 'certification_expired' | 'regulatory_violation';
  status?: 'active' | 'resolved' | 'dismissed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  warehouse_id?: string;
  page?: number;
  limit?: number;
} = {}) => {
  return trpc.compliance.listAlerts.useQuery({
    ...filters,
    page: filters.page || 1,
    limit: filters.limit || 20,
  }, {
    enabled: true,
    staleTime: 30000,
    retry: 1,
    onError: (error: any) => {
      console.error('Compliance alerts fetch error:', error);
      toast.error('Failed to load compliance alerts');
    }
  });
};

export const useComplianceDashboard = (warehouseId?: string) => {
  return trpc.compliance.getDashboard.useQuery({
    warehouse_id: warehouseId,
  }, {
    enabled: true,
    staleTime: 60000, // 1 minute
    retry: 1,
    onError: (error: any) => {
      console.error('Compliance dashboard fetch error:', error);
      toast.error('Failed to load compliance dashboard');
    }
  });
};

export const useCreateComplianceAlert = () => {
  const utils = trpc.useContext();
  
  return trpc.compliance.createAlert.useMutation({
    onSuccess: (result, variables) => {
      console.log('Compliance alert created successfully:', result);
      
      // Invalidate related data
      utils.compliance.listAlerts.invalidate();
      utils.compliance.getDashboard.invalidate();
      
      toast.success(`${variables.alert_type.replace('_', ' ')} alert created successfully`);
    },
    onError: (error) => {
      console.error('Create compliance alert error:', error);
      toast.error(error.message || 'Failed to create compliance alert');
    },
  });
};

export const useUpdateComplianceAlert = () => {
  const utils = trpc.useContext();
  
  return trpc.compliance.updateAlert.useMutation({
    onSuccess: (result, variables) => {
      console.log('Compliance alert updated successfully:', result);
      
      // Invalidate related data
      utils.compliance.listAlerts.invalidate();
      utils.compliance.getDashboard.invalidate();
      
      const statusMessage = variables.status === 'resolved' ? 'resolved' : 'updated';
      toast.success(`Compliance alert ${statusMessage} successfully`);
    },
    onError: (error) => {
      console.error('Update compliance alert error:', error);
      toast.error(error.message || 'Failed to update compliance alert');
    },
  });
};

export const useUpdateCylinderCompliance = () => {
  const utils = trpc.useContext();
  
  return trpc.compliance.updateCylinderCompliance.useMutation({
    onSuccess: (result, variables) => {
      console.log('Cylinder compliance updated successfully:', result);
      
      // Invalidate related data
      utils.compliance.getDashboard.invalidate();
      utils.compliance.listAlerts.invalidate();
      
      toast.success('Cylinder compliance status updated successfully');
    },
    onError: (error) => {
      console.error('Update cylinder compliance error:', error);
      toast.error(error.message || 'Failed to update cylinder compliance');
    },
  });
};

export const useGenerateComplianceAlerts = () => {
  const utils = trpc.useContext();
  
  return trpc.compliance.generateAlerts.useMutation({
    onSuccess: (result) => {
      console.log('Compliance alerts generated successfully:', result);
      
      // Invalidate related data
      utils.compliance.listAlerts.invalidate();
      utils.compliance.getDashboard.invalidate();
      
      toast.success(`${result.alerts_generated} compliance alert(s) generated`);
    },
    onError: (error) => {
      console.error('Generate compliance alerts error:', error);
      toast.error(error.message || 'Failed to generate compliance alerts');
    },
  });
};

export const useOverdueComplianceReport = (filters: {
  warehouse_id?: string;
  days_overdue?: number;
} = {}) => {
  return trpc.compliance.getOverdueReport.useQuery({
    warehouse_id: filters.warehouse_id,
    days_overdue: filters.days_overdue || 0,
  }, {
    enabled: true,
    staleTime: 60000, // 1 minute
    retry: 1,
    onError: (error: any) => {
      console.error('Overdue compliance report fetch error:', error);
      toast.error('Failed to load overdue compliance report');
    }
  });
}; 