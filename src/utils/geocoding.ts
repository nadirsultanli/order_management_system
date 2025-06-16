import axios from 'axios';

export async function getGeocodeSuggestions(query, setIsSearching) {
  if (!query || query.trim().length < 3) {
    setIsSearching(false);
    return [];
  }
  setIsSearching(true);
  try {
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
      {
        params: {
          access_token: import.meta.env.VITE_MAPBOX_API_KEY,
          autocomplete: 'true',
          language: 'en',
          limit: 5,
        },
      }
    );
    return response?.data?.features?.map((feature) => {
      // Parse address components
      const context = feature.context || [];
      const getContext = (id) => context.find((c) => c.id.startsWith(id))?.text || '';
      return {
        display_name: feature.place_name,
        address_line1: feature.text || '',
        address_line2: '',
        city: getContext('place'),
        state: getContext('region'),
        postal_code: getContext('postcode'),
        country: getContext('country'),
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      };
    });
  } finally {
    setIsSearching(false);
  }
} 