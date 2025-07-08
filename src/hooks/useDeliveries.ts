import { useState, useCallback } from 'react';
import { trpc } from '../lib/trpc-client';
import { 
  ProcessDeliveryData, 
  ProcessPickupData,
  CompleteDeliveryData,
  CompletePickupData,
  DeliveryView,
  PickupView,
  CustomerBalance,
  CustomerTransaction
} from '../types/delivery';

// Hook for listing deliveries
export const useDeliveries = (filters?: {
  customer_id?: string;
  truck_id?: string;
  status?: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}) => {
  return trpc.deliveries.listDeliveries.useQuery(filters || {});
};

// Hook for listing pickups
export const usePickups = (filters?: {
  customer_id?: string;
  truck_id?: string;
  status?: 'pending' | 'in_transit' | 'completed' | 'failed' | 'cancelled';
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}) => {
  return trpc.deliveries.listPickups.useQuery(filters || {});
};

// Hook for getting delivery details
export const useDelivery = (deliveryId: string | undefined) => {
  return trpc.deliveries.getDelivery.useQuery(
    { delivery_id: deliveryId! },
    { enabled: !!deliveryId }
  );
};

// Hook for getting pickup details
export const usePickup = (pickupId: string | undefined) => {
  return trpc.deliveries.getPickup.useQuery(
    { pickup_id: pickupId! },
    { enabled: !!pickupId }
  );
};

// Hook for getting customer balance
export const useCustomerBalance = (customerId: string | undefined, productId?: string) => {
  return trpc.deliveries.getCustomerBalance.useQuery(
    { customer_id: customerId!, product_id: productId },
    { enabled: !!customerId }
  );
};

// Hook for getting customer transactions
export const useCustomerTransactions = (filters: {
  customer_id: string;
  product_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}) => {
  return trpc.deliveries.getCustomerTransactions.useQuery(filters);
};

// Hook for processing delivery
export const useProcessDelivery = () => {
  const utils = trpc.useContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const processDelivery = trpc.deliveries.process.useMutation({
    onSuccess: () => {
      // Invalidate related queries
      utils.deliveries.listDeliveries.invalidate();
      utils.deliveries.getCustomerBalance.invalidate();
      utils.trucks.get.invalidate();
      utils.inventory.list.invalidate();
    },
  });

  const execute = useCallback(async (data: ProcessDeliveryData) => {
    setIsProcessing(true);
    try {
      const result = await processDelivery.mutateAsync({
        type: 'delivery',
        data,
      });
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [processDelivery]);

  return {
    processDelivery: execute,
    isProcessing,
    error: processDelivery.error,
  };
};

// Hook for processing pickup
export const useProcessPickup = () => {
  const utils = trpc.useContext();
  const [isProcessing, setIsProcessing] = useState(false);

  const processPickup = trpc.deliveries.process.useMutation({
    onSuccess: () => {
      // Invalidate related queries
      utils.deliveries.listPickups.invalidate();
      utils.deliveries.getCustomerBalance.invalidate();
      utils.trucks.get.invalidate();
      utils.inventory.list.invalidate();
    },
  });

  const execute = useCallback(async (data: ProcessPickupData) => {
    setIsProcessing(true);
    try {
      const result = await processPickup.mutateAsync({
        type: 'pickup',
        data,
      });
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [processPickup]);

  return {
    processPickup: execute,
    isProcessing,
    error: processPickup.error,
  };
};

// Hook for completing delivery
export const useCompleteDelivery = () => {
  const utils = trpc.useContext();
  const [isCompleting, setIsCompleting] = useState(false);

  const completeDelivery = trpc.deliveries.complete.useMutation({
    onSuccess: () => {
      utils.deliveries.listDeliveries.invalidate();
      utils.deliveries.getDelivery.invalidate();
      utils.orders.get.invalidate();
    },
  });

  const execute = useCallback(async (data: CompleteDeliveryData) => {
    setIsCompleting(true);
    try {
      const result = await completeDelivery.mutateAsync({
        type: 'delivery',
        data,
      });
      return result;
    } finally {
      setIsCompleting(false);
    }
  }, [completeDelivery]);

  return {
    completeDelivery: execute,
    isCompleting,
    error: completeDelivery.error,
  };
};

// Hook for completing pickup
export const useCompletePickup = () => {
  const utils = trpc.useContext();
  const [isCompleting, setIsCompleting] = useState(false);

  const completePickup = trpc.deliveries.complete.useMutation({
    onSuccess: () => {
      utils.deliveries.listPickups.invalidate();
      utils.deliveries.getPickup.invalidate();
    },
  });

  const execute = useCallback(async (data: CompletePickupData) => {
    setIsCompleting(true);
    try {
      const result = await completePickup.mutateAsync({
        type: 'pickup',
        data,
      });
      return result;
    } finally {
      setIsCompleting(false);
    }
  }, [completePickup]);

  return {
    completePickup: execute,
    isCompleting,
    error: completePickup.error,
  };
}; 