import { Address } from '../types/address';

export const formatAddress = (address: Address): string => {
  const parts = [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postal_code,
  ].filter(Boolean);

  return parts.join(', ');
};

export const formatAddressForSelect = (address: Address): string => {
  const label = address.label || `Address #${address.id.slice(-4)}`;
  const formattedAddress = formatAddress(address);
  return `${label} - ${formattedAddress}`;
};

export const formatDeliveryWindow = (start?: string, end?: string): string => {
  if (!start || !end) return '';
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return `${formatTime(start)} - ${formatTime(end)}`;
};

export const validateDeliveryWindow = (start?: string, end?: string): boolean => {
  if (!start || !end) return true;
  
  const startTime = new Date(`1970-01-01T${start}`);
  const endTime = new Date(`1970-01-01T${end}`);
  
  return startTime < endTime;
};

export const getCountryOptions = () => [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'MX', label: 'Mexico' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'IN', label: 'India' },
  { value: 'KE', label: 'Kenya' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'ZA', label: 'South Africa' },
];

// Simple geocoding using OpenStreetMap Nominatim (free alternative to Google Maps)
export const geocodeAddress = async (address: Partial<Address>): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const addressString = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postal_code,
    ].filter(Boolean).join(', ');

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressString)}&limit=1`
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const getAddressSummary = (address?: Address): string => {
  if (!address) return 'No address';
  return formatAddress(address) || 'Address incomplete';
};