interface AvailableStock {
  qty_full: number;
  qty_empty: number;
}

interface TransferQuantities {
  qty_full: number;
  qty_empty: number;
}

export interface QuantityValidationResult {
  isValid: boolean;
  errorMessage?: string;
  maxFullAvailable: number;
  maxEmptyAvailable: number;
}

export const validateTransferQuantity = (
  requestedQuantities: TransferQuantities,
  availableStock: AvailableStock
): QuantityValidationResult => {
  const { qty_full: requestedFull, qty_empty: requestedEmpty } = requestedQuantities;
  const { qty_full: availableFull, qty_empty: availableEmpty } = availableStock;

  // Validate full cylinders
  if (requestedFull > availableFull) {
    return {
      isValid: false,
      errorMessage: `Cannot transfer ${requestedFull} full cylinders. Only ${availableFull} available.`,
      maxFullAvailable: availableFull,
      maxEmptyAvailable: availableEmpty,
    };
  }

  // Validate empty cylinders
  if (requestedEmpty > availableEmpty) {
    return {
      isValid: false,
      errorMessage: `Cannot transfer ${requestedEmpty} empty cylinders. Only ${availableEmpty} available.`,
      maxFullAvailable: availableFull,
      maxEmptyAvailable: availableEmpty,
    };
  }

  // Validate that at least one quantity is positive
  if (requestedFull <= 0 && requestedEmpty <= 0) {
    return {
      isValid: false,
      errorMessage: 'Please specify at least one cylinder to transfer (full or empty).',
      maxFullAvailable: availableFull,
      maxEmptyAvailable: availableEmpty,
    };
  }

  return {
    isValid: true,
    maxFullAvailable: availableFull,
    maxEmptyAvailable: availableEmpty,
  };
};

export const clampQuantityToMax = (value: number, max: number): number => {
  return Math.min(Math.max(0, value), max);
}; 