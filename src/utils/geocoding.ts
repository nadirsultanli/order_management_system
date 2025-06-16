import axios from 'axios';
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

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
      const getContext = (id) => context.find((c) => c.id.startsWith(id)) || {};
      // Extract 2-letter country code
      let countryCode = getContext('country').short_code || '';
      countryCode = countryCode ? countryCode.toUpperCase() : '';
      return {
        display_name: feature.place_name,
        address_line1: feature.text || '',
        address_line2: '',
        city: getContext('place').text || '',
        state: getContext('region').text || '',
        postal_code: getContext('postcode').text || '',
        country: countryCode,
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
      };
    });
  } finally {
    setIsSearching(false);
  }
}

export function useMap(latitude, longitude) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);

  useEffect(() => {
    if (mapContainer.current && latitude && longitude) {
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_API_KEY;
      let newMap = map.current;
      if (!newMap) {
        newMap = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: [longitude, latitude],
          zoom: 14,
        });
        newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.current = newMap;
        // Wait for the map to load before adding marker and centering
        newMap.on('load', () => {
          if (marker.current) marker.current.remove();
          const newMarker = new mapboxgl.Marker({ anchor: 'center' })
            .setLngLat([longitude, latitude])
            .addTo(newMap);
          marker.current = newMarker;
          newMap.setCenter([longitude, latitude]);
          newMap.setZoom(14);
          newMap.resize();
        });
      } else {
        newMap.setCenter([longitude, latitude]);
        newMap.setZoom(14);
        if (marker.current) marker.current.remove();
        const newMarker = new mapboxgl.Marker({ anchor: 'center' })
          .setLngLat([longitude, latitude])
          .addTo(newMap);
        marker.current = newMarker;
        newMap.resize();
      }
    }
    // Clean up map and marker on unmount
    return () => {
      if (newMap) newMap.remove();
      if (marker.current) marker.current.remove();
    };
  }, [latitude, longitude]);

  return { mapContainer, map, marker };
} 