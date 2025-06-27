// Consolidated formatting utilities to replace scattered formatting logic

export const formatCurrency = (amount: number | null | undefined, currency = 'KES'): string => {
  if (amount == null) return `${currency} 0.00`;
  
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: currency === 'KES' ? 'KES' : 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatNumber = (num: number | null | undefined): string => {
  if (num == null) return '0';
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatDate = (dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'Not specified';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Date(dateString).toLocaleDateString('en-US', options || defaultOptions);
};

export const formatDateTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Not specified';
  
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateRange = (startDate: string, endDate?: string | null): string => {
  const start = formatDate(startDate);
  if (!endDate) return `${start} - Ongoing`;
  return `${start} - ${formatDate(endDate)}`;
};

export const formatCapacity = (capacity: number | null | undefined): string => {
  if (!capacity) return 'Not specified';
  return `${formatNumber(capacity)} cylinders`;
};

export const formatWeight = (weight: number | null | undefined, unit = 'kg'): string => {
  if (!weight) return 'Not specified';
  return `${formatNumber(weight)} ${unit}`;
};

export const formatPercentage = (value: number | null | undefined, decimals = 1): string => {
  if (value == null) return '0%';
  return `${value.toFixed(decimals)}%`;
};

export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return 'Not provided';
  
  // Simple phone formatting for display
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

export const formatAddress = (address: {
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
}): string => {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
    address.country && address.country !== 'US' ? address.country : null
  ].filter(Boolean);
  
  return parts.join(', ');
};

export const formatOrderStatus = (status: string): { label: string; color: string; bgColor: string } => {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    draft: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    confirmed: { label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-100' },
    scheduled: { label: 'Scheduled', color: 'text-purple-700', bgColor: 'bg-purple-100' },
    en_route: { label: 'En Route', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    delivered: { label: 'Delivered', color: 'text-green-700', bgColor: 'bg-green-100' },
    invoiced: { label: 'Invoiced', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
    cancelled: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100' }
  };
  
  return statusMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
};

export const formatProductStatus = (status: string): { label: string; color: string; bgColor: string } => {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
    end_of_sale: { label: 'End of Sale', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
    obsolete: { label: 'Obsolete', color: 'text-red-700', bgColor: 'bg-red-100' }
  };
  
  return statusMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
};

export const formatAccountStatus = (status: string): { label: string; color: string; bgColor: string } => {
  const statusMap: Record<string, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: 'text-green-700', bgColor: 'bg-green-100' },
    inactive: { label: 'Inactive', color: 'text-gray-700', bgColor: 'bg-gray-100' },
    suspended: { label: 'Suspended', color: 'text-red-700', bgColor: 'bg-red-100' },
    pending: { label: 'Pending', color: 'text-yellow-700', bgColor: 'bg-yellow-100' }
  };
  
  return statusMap[status] || { label: status, color: 'text-gray-700', bgColor: 'bg-gray-100' };
};

export const formatInventoryQuantity = (qtyFull: number, qtyEmpty: number): string => {
  return `${formatNumber(qtyFull)} full, ${formatNumber(qtyEmpty)} empty`;
};

export const formatDeliveryWindow = (startTime?: string | null, endTime?: string | null): string => {
  if (!startTime && !endTime) return 'Any time';
  if (!startTime) return `Before ${endTime}`;
  if (!endTime) return `After ${startTime}`;
  return `${startTime} - ${endTime}`;
};

// Utility to get relative time (e.g., "2 hours ago", "in 3 days")
export const formatRelativeTime = (dateString: string | null | undefined): string => {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  
  return formatDate(dateString);
};

// Utility for truncating text
export const truncateText = (text: string | null | undefined, maxLength = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}; 