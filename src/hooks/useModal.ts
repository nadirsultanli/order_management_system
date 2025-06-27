import { useState, useCallback } from 'react';

export interface ModalState<T = any> {
  isOpen: boolean;
  data: T | null;
}

export interface ModalActions<T = any> {
  open: (data?: T) => void;
  close: () => void;
  toggle: () => void;
  setData: (data: T | null) => void;
}

export interface UseModalReturn<T = any> extends ModalState<T>, ModalActions<T> {}

// Generic modal hook
export function useModal<T = any>(initialOpen = false): UseModalReturn<T> {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [data, setData] = useState<T | null>(null);

  const open = useCallback((modalData?: T) => {
    if (modalData !== undefined) {
      setData(modalData);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    // Don't clear data immediately to allow for close animations
    setTimeout(() => setData(null), 150);
  }, []);

  const toggle = useCallback(() => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  return {
    isOpen,
    data,
    open,
    close,
    toggle,
    setData
  };
}

// Specific modal hooks for common patterns
export function useFormModal<T = any>() {
  const modal = useModal<T>();
  
  return {
    ...modal,
    openForCreate: () => modal.open(null),
    openForEdit: (item: T) => modal.open(item),
    isEditing: modal.data !== null
  };
}

export function useConfirmModal() {
  const modal = useModal<{
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>();

  const confirm = useCallback((options: {
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
  }) => {
    modal.open(options);
  }, [modal]);

  return {
    ...modal,
    confirm
  };
}

export function useDeleteModal<T extends { id: string; name?: string }>() {
  const modal = useModal<T>();

  const confirmDelete = useCallback((item: T, onConfirm: () => void) => {
    modal.open({
      ...item,
      onConfirm
    } as T & { onConfirm: () => void });
  }, [modal]);

  return {
    ...modal,
    confirmDelete
  };
}

// Multi-modal management for complex pages
export function useMultiModal<T extends Record<string, any>>() {
  const [modals, setModals] = useState<Record<keyof T, ModalState>>({} as Record<keyof T, ModalState>);

  const openModal = useCallback(<K extends keyof T>(modalName: K, data?: T[K]) => {
    setModals(prev => ({
      ...prev,
      [modalName]: {
        isOpen: true,
        data: data || null
      }
    }));
  }, []);

  const closeModal = useCallback(<K extends keyof T>(modalName: K) => {
    setModals(prev => ({
      ...prev,
      [modalName]: {
        ...prev[modalName],
        isOpen: false
      }
    }));
    
    // Clear data after animation
    setTimeout(() => {
      setModals(prev => ({
        ...prev,
        [modalName]: {
          isOpen: false,
          data: null
        }
      }));
    }, 150);
  }, []);

  const toggleModal = useCallback(<K extends keyof T>(modalName: K, data?: T[K]) => {
    const currentModal = modals[modalName];
    if (currentModal?.isOpen) {
      closeModal(modalName);
    } else {
      openModal(modalName, data);
    }
  }, [modals, openModal, closeModal]);

  const isModalOpen = useCallback(<K extends keyof T>(modalName: K) => {
    return modals[modalName]?.isOpen || false;
  }, [modals]);

  const getModalData = useCallback(<K extends keyof T>(modalName: K) => {
    return modals[modalName]?.data || null;
  }, [modals]);

  return {
    openModal,
    closeModal,
    toggleModal,
    isModalOpen,
    getModalData,
    modals
  };
}

// Common modal configurations for the OMS
export interface OrderModalConfig {
  form: any;
  edit: any;
  status: any;
  delete: any;
}

export interface CustomerModalConfig {
  form: any;
  edit: any;
  delete: any;
}

export interface ProductModalConfig {
  form: any;
  edit: any;
  delete: any;
  selector: any;
}

export interface InventoryModalConfig {
  adjustment: any;
  transfer: any;
  addStock: any;
}

// Usage examples for common patterns:
/*
// Simple modal
const deleteModal = useModal<Customer>();
deleteModal.open(customer);
deleteModal.close();

// Form modal (create/edit)
const formModal = useFormModal<Product>();
formModal.openForCreate();
formModal.openForEdit(product);

// Confirmation modal
const confirmModal = useConfirmModal();
confirmModal.confirm({
  title: 'Delete Customer',
  message: 'Are you sure you want to delete this customer?',
  onConfirm: () => deleteCustomer(customer.id),
  type: 'danger'
});

// Multi-modal for complex pages
const modals = useMultiModal<{
  form: Product;
  delete: Product;
  selector: any;
}>();
modals.openModal('form', product);
modals.closeModal('delete');
*/ 