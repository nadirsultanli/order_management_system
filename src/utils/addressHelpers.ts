// Consolidated address handling utilities

export interface AddressData {
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  instructions?: string | null;
  delivery_window_start?: string | null;
  delivery_window_end?: string | null;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
}

// Format address for display
export const formatFullAddress = (address: Partial<AddressData>): string => {
  if (!address.line1 || !address.city || !address.postal_code) {
    return 'Address incomplete';
  }
  
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

// Get short address summary
export const getAddressSummary = (address?: Partial<AddressData>): string => {
  if (!address?.line1 || !address?.city) {
    return 'Address incomplete';
  }
  
  return `${address.line1}, ${address.city}`;
};

// Validate address completeness
export const validateAddressCompleteness = (address: Partial<AddressData>): {
  isComplete: boolean;
  missingFields: string[];
} => {
  const required = ['line1', 'city', 'postal_code', 'country'];
  const missingFields: string[] = [];
  
  required.forEach(field => {
    if (!address[field as keyof AddressData]) {
      missingFields.push(field);
    }
  });
  
  return {
    isComplete: missingFields.length === 0,
    missingFields
  };
};

// Country options for forms
export const getCountryOptions = () => [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'KE', label: 'Kenya' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'FR', label: 'France' },
  { value: 'DE', label: 'Germany' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'CN', label: 'China' },
  { value: 'JP', label: 'Japan' },
  { value: 'BR', label: 'Brazil' }
];

// Validate delivery window
export const validateDeliveryWindow = (startTime?: string | null, endTime?: string | null): string | null => {
  if (!startTime && !endTime) return null;
  if (!startTime || !endTime) return 'Both start and end times are required for delivery window';
  
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  
  if (start >= end) {
    return 'End time must be after start time';
  }
  
  // Check if window is reasonable (at least 30 minutes, max 12 hours)
  const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  if (diffHours < 0.5) {
    return 'Delivery window must be at least 30 minutes';
  }
  if (diffHours > 12) {
    return 'Delivery window cannot exceed 12 hours';
  }
  
  return null;
};

// Format delivery window for display
export const formatDeliveryWindow = (startTime?: string | null, endTime?: string | null): string => {
  if (!startTime && !endTime) return 'Any time';
  if (!startTime) return `Before ${endTime}`;
  if (!endTime) return `After ${startTime}`;
  return `${startTime} - ${endTime}`;
};

// Geocoding utilities (simplified - replace with actual geocoding service)
export const geocodeAddress = async (address: string): Promise<GeocodeResult | null> => {
  try {
    // This is a placeholder - integrate with actual geocoding service
    // For now, return mock coordinates for major cities
    const cityCoordinates: Record<string, GeocodeResult> = {
      'nairobi': { latitude: -1.2921, longitude: 36.8219 },
      'mombasa': { latitude: -4.0435, longitude: 39.6682 },
      'kisumu': { latitude: -0.0917, longitude: 34.7680 },
      'nakuru': { latitude: -0.3031, longitude: 36.0800 },
      'eldoret': { latitude: 0.5143, longitude: 35.2698 }
    };
    
    const cityName = address.toLowerCase().split(',')[0].trim();
    return cityCoordinates[cityName] || null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Get geocoding suggestions (for autocomplete)
export const getGeocodeSuggestions = async (query: string): Promise<string[]> => {
  if (query.length < 3) return [];
  
  // Mock suggestions - replace with actual geocoding service
  const suggestions = [
    'Nairobi, Kenya',
    'Mombasa, Kenya',
    'Kisumu, Kenya',
    'Nakuru, Kenya',
    'Eldoret, Kenya',
    'Thika, Kenya',
    'Malindi, Kenya',
    'Kitale, Kenya'
  ];
  
  return suggestions.filter(suggestion => 
    suggestion.toLowerCase().includes(query.toLowerCase())
  );
};

// Distance calculation between two coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number, lon1: number, 
  lat2: number, lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Find nearest warehouse to an address
export const findNearestWarehouse = (
  deliveryAddress: { latitude: number; longitude: number },
  warehouses: Array<{ id: string; name: string; latitude?: number; longitude?: number }>
): { warehouse: any; distance: number } | null => {
  let nearest = null;
  let minDistance = Infinity;
  
  warehouses.forEach(warehouse => {
    if (warehouse.latitude && warehouse.longitude) {
      const distance = calculateDistance(
        deliveryAddress.latitude, deliveryAddress.longitude,
        warehouse.latitude, warehouse.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { warehouse, distance };
      }
    }
  });
  
  return nearest;
};

// Estimate delivery time based on distance
export const estimateDeliveryTime = (distanceKm: number): {
  hours: number;
  minutes: number;
  formatted: string;
} => {
  // Assume average speed of 40 km/h including stops
  const totalMinutes = Math.ceil((distanceKm / 40) * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  let formatted = '';
  if (hours > 0) {
    formatted += `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  if (minutes > 0) {
    if (formatted) formatted += ' ';
    formatted += `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  
  return { hours, minutes, formatted: formatted || '0 minutes' };
};

// Generate delivery route suggestions
export const generateRouteStops = (
  startLocation: { latitude: number; longitude: number },
  deliveryAddresses: Array<{ id: string; latitude: number; longitude: number; priority?: number }>
): Array<{ id: string; order: number; distance: number }> => {
  // Simple nearest-neighbor algorithm (can be improved with proper TSP solution)
  const unvisited = [...deliveryAddresses];
  const route: Array<{ id: string; order: number; distance: number }> = [];
  let currentLocation = startLocation;
  let order = 1;
  
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    unvisited.forEach((address, index) => {
      const distance = calculateDistance(
        currentLocation.latitude, currentLocation.longitude,
        address.latitude, address.longitude
      );
      
      // Consider priority (higher priority = lower effective distance)
      const effectiveDistance = address.priority ? distance / address.priority : distance;
      
      if (effectiveDistance < minDistance) {
        minDistance = distance; // Use actual distance for route
        nearestIndex = index;
      }
    });
    
    const nearest = unvisited[nearestIndex];
    route.push({
      id: nearest.id,
      order,
      distance: minDistance
    });
    
    currentLocation = { latitude: nearest.latitude, longitude: nearest.longitude };
    unvisited.splice(nearestIndex, 1);
    order++;
  }
  
  return route;
};

// Address form default values
export const getAddressFormDefaults = (address?: Partial<AddressData>) => ({
  label: address?.label || '',
  line1: address?.line1 || '',
  line2: address?.line2 || '',
  city: address?.city || '',
  state: address?.state || '',
  postal_code: address?.postal_code || '',
  country: address?.country || 'KE',
  instructions: address?.instructions || '',
  delivery_window_start: address?.delivery_window_start || '',
  delivery_window_end: address?.delivery_window_end || ''
}); 