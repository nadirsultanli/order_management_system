import { Address } from '../types/address';
import { getCountryOptions } from './countries';

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

// Improved delivery window validation for UI feedback
export const validateDeliveryWindow = (start?: string, end?: string): boolean => {
  if (!start || !end) return true; // Allow empty values
  
  try {
    // Parse time strings (format: "HH:MM")
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    
    // Convert to minutes for easier comparison
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // End time must be after start time
    return endMinutes > startMinutes;
  } catch (error) {
    console.error('Error validating delivery window:', error);
    return false;
  }
};

// Export the country options from the new countries utility
export { getCountryOptions };

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
  if (
    !address ||
    !address.line1 ||
    !address.city ||
    !address.country ||
    !address.postal_code ||
    address.latitude == null ||
    address.longitude == null
  ) {
    return 'Address incomplete';
  }
  return formatAddress(address);
};