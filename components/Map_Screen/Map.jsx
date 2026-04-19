import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GEOAPIFY_API_KEY = '6e3efd748a384a27baf68a0621732be5';
const WEATHER_API_KEY = '177d6b3e957bb1d34b28bf7bdf9d1360';
const mapStyle = 'osm-bright';

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50% 50% 50% 0;
    background:${color};border:2px solid white;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const userLocationIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:12px;height:12px;background:#2C5282;
    border:2px solid white;border-radius:50%;
    box-shadow:0 0 0 2px #2C5282;
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const originIcon = createIcon('#2C5282');
const destIcon = createIcon('#E53E3E');
const placeIcon = createIcon('#E53E3E');

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 15, { duration: 1.2 });
  }, [coords, map]);
  return null;
}

function MapPickClickHandler({ enabled, onLatLngClick }) {
  useMapEvents({
    click(e) {
      if (enabled) onLatLngClick(e.latlng);
    },
  });
  return null;
}

async function reverseGeocodeLatLng(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }
}

// Weather Widget Component
function WeatherWidget({ location }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWeather = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
      );
      const data = await response.json();

      if (data.cod === 200) {
        setWeather({
          temp: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          condition: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed * 3.6),
          location: data.name
        });
      } else {
        setError('Unable to fetch weather data');
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Weather service unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (location) {
      fetchWeather(location.lat, location.lng);
    }
  }, [location, fetchWeather]);

  const getWeatherIcon = (condition) => {
    const icons = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Drizzle': '🌦️',
      'Thunderstorm': '⛈️',
      'Snow': '🌨️',
      'Mist': '🌫️',
      'Fog': '🌫️',
      'Haze': '🌫️',
    };
    return icons[condition] || '🌤️';
  };

  const getWeatherBackground = (condition) => {
    const backgrounds = {
      'Clear': 'linear-gradient(135deg, #FFD700, #FFA500)',
      'Clouds': 'linear-gradient(135deg, #B0BEC5, #78909C)',
      'Rain': 'linear-gradient(135deg, #4FC3F7, #0288D1)',
      'Drizzle': 'linear-gradient(135deg, #81D4FA, #4FC3F7)',
      'Thunderstorm': 'linear-gradient(135deg, #5C6BC0, #283593)',
      'Snow': 'linear-gradient(135deg, #E1F5FE, #B3E5FC)',
      'Mist': 'linear-gradient(135deg, #CFD8DC, #90A4AE)',
    };
    return backgrounds[condition] || 'linear-gradient(135deg, #87CEEB, #4682B4)';
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: '8px 14px',
        borderRadius: '25px',
        gap: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        whiteSpace: 'nowrap',
        opacity: 0.7
      }}>
        <span>⏳</span>
        <span style={{ fontWeight: '600', color: '#333', fontSize: '13px' }}>Loading weather...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: '8px 14px',
        borderRadius: '25px',
        gap: '8px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        whiteSpace: 'nowrap'
      }}>
        <span>🌤️</span>
        <span style={{ fontWeight: '600', color: '#333', fontSize: '13px' }}>--°C · Weather</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: getWeatherBackground(weather.condition),
      padding: '8px 14px',
      borderRadius: '25px',
      gap: '10px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      whiteSpace: 'nowrap',
      color: weather.condition === 'Snow' ? '#333' : 'white',
      cursor: 'pointer',
      transition: 'transform 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      title={`${weather.description} • Humidity: ${weather.humidity}% • Wind: ${weather.windSpeed} km/h`}
    >
      <span style={{ fontSize: '20px' }}>{getWeatherIcon(weather.condition)}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontWeight: '700', fontSize: '14px' }}>
          {weather.temp}°C
        </span>
        <span style={{ fontSize: '10px', opacity: 0.9 }}>
          Feels {weather.feelsLike}°C
        </span>
      </div>
      <div style={{
        width: '1px',
        height: '25px',
        background: 'rgba(255,255,255,0.3)',
        margin: '0 2px'
      }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '11px', fontWeight: '600' }}>
          {weather.condition}
        </span>
        <span style={{ fontSize: '9px', opacity: 0.9 }}>
          {weather.location || 'Current Location'}
        </span>
      </div>
    </div>
  );
}

function SearchInput({ placeholder, value, onChange, onSelect, icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (text) => {
    if (text.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${GEOAPIFY_API_KEY}&limit=5`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch { setSuggestions([]); }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 350);
  };

  const handleSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    onSelect({ lat, lng, label: feature.properties.formatted });
    onChange(feature.properties.formatted);
    setSuggestions([]);
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '12px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', gap: '8px' }}>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <input
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1, color: '#1A365D', background: 'transparent' }}
        />
        {loading && <span style={{ fontSize: '11px', color: '#aaa' }}>⏳</span>}
      </div>
      {suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'white', borderRadius: '12px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => handleSelect(s)}
              style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none', color: '#333' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EBF4FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >📍 {s.properties.formatted}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Function to get traffic color based on segment position and time
const getTrafficColor = (segmentIndex, totalSegments) => {
  const currentHour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());

  const positionFactor = Math.abs((segmentIndex / totalSegments) - 0.5) * 2;

  if (!isWeekend) {
    if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
      if (positionFactor < 0.3) {
        return { color: '#C62828', level: 'heavy', delayFactor: 1.6 };
      } else if (positionFactor < 0.6) {
        return { color: '#F57F17', level: 'moderate', delayFactor: 1.3 };
      } else {
        return { color: '#4CAF50', level: 'light', delayFactor: 1 };
      }
    }
    else if (currentHour >= 10 && currentHour <= 16) {
      if (positionFactor < 0.4) {
        return { color: '#F57F17', level: 'moderate', delayFactor: 1.2 };
      } else {
        return { color: '#4CAF50', level: 'light', delayFactor: 1 };
      }
    }
    else {
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    }
  } else {
    if (currentHour >= 10 && currentHour <= 18) {
      if (positionFactor < 0.3) {
        return { color: '#F57F17', level: 'moderate', delayFactor: 1.1 };
      } else {
        return { color: '#4CAF50', level: 'light', delayFactor: 1 };
      }
    } else {
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    }
  }
};

// Function to split route into colored segments based on traffic
const getRouteSegmentsWithTraffic = (routeCoords) => {
  if (!routeCoords || routeCoords.length < 2) return [];

  const segments = [];
  const totalSegments = routeCoords.length - 1;

  for (let i = 0; i < totalSegments; i++) {
    const traffic = getTrafficColor(i, totalSegments);
    segments.push({
      start: routeCoords[i],
      end: routeCoords[i + 1],
      color: traffic.color,
      level: traffic.level,
      delayFactor: traffic.delayFactor
    });
  }

  return segments;
};

// Custom map controls component
function MapControls({ onZoomIn, onZoomOut, onLocation, onRoute }) {
  const map = useMap();

  const handleZoomIn = () => {
    map.zoomIn();
    if (onZoomIn) onZoomIn();
  };

  const handleZoomOut = () => {
    map.zoomOut();
    if (onZoomOut) onZoomOut();
  };

  const handleLocation = () => {
    if (onLocation) onLocation();
  };

  const handleRoute = () => {
    if (onRoute) onRoute();
  };

  return (
    <div style={{
      position: 'absolute',
      right: '14px',
      top: '14px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      zIndex: 1000
    }}>
      <button
        onClick={handleZoomIn}
        style={{
          backgroundColor: 'white',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        +
      </button>
      <button
        onClick={handleZoomOut}
        style={{
          backgroundColor: 'white',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '18px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        -
      </button>
      <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>
      <button
        onClick={handleLocation}
        style={{
          backgroundColor: 'white',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        🧭
      </button>
      <button
        onClick={handleRoute}
        style={{
          backgroundColor: 'white',
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          border: '1px solid #ddd',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        📍
      </button>
    </div>
  );
}

// Function to get traffic summary for the route
const getTrafficSummary = (segments) => {
  if (!segments || segments.length === 0) {
    return {
      level: 'Light',
      color: '#4CAF50',
      heavySegments: 0,
      moderateSegments: 0,
      lightSegments: 0,
      avgDelayFactor: 1
    };
  }

  let heavyCount = 0;
  let moderateCount = 0;
  let lightCount = 0;
  let totalDelayFactor = 0;

  segments.forEach(segment => {
    if (segment.level === 'heavy') heavyCount++;
    else if (segment.level === 'moderate') moderateCount++;
    else lightCount++;
    totalDelayFactor += segment.delayFactor;
  });

  const avgDelayFactor = totalDelayFactor / segments.length;

  let overallLevel = 'Light';
  let overallColor = '#4CAF50';

  if (heavyCount > segments.length * 0.3) {
    overallLevel = 'Heavy';
    overallColor = '#C62828';
  } else if (moderateCount > segments.length * 0.4) {
    overallLevel = 'Moderate';
    overallColor = '#F57F17';
  }

  return {
    level: overallLevel,
    color: overallColor,
    heavySegments: heavyCount,
    moderateSegments: moderateCount,
    lightSegments: lightCount,
    avgDelayFactor: avgDelayFactor
  };
};

// Mock places data for Cebu City (fallback if API fails)
const getMockPlaces = (routeCoords) => {
  if (!routeCoords || routeCoords.length === 0) return [];

  const refPoint = routeCoords[0];

  return [
    { name: 'AYALA Center Cebu', lat: 10.3189, lng: 123.9053, type: 'shopping', distance: 200, rating: 4.5 },
    { name: 'SM City Cebu', lat: 10.3106, lng: 123.8936, type: 'shopping', distance: 350, rating: 4.3 },
    { name: 'Jollibee - Fuente', lat: 10.3100, lng: 123.8950, type: 'restaurant', distance: 150, rating: 4.2 },
    { name: 'McDonald\'s - Osmeña Blvd', lat: 10.3120, lng: 123.8980, type: 'restaurant', distance: 180, rating: 4.1 },
    { name: 'Parking - Ayala Mall', lat: 10.3195, lng: 123.9058, type: 'parking', distance: 100, rating: null },
    { name: 'Parking - SM City', lat: 10.3110, lng: 123.8940, type: 'parking', distance: 120, rating: null },
    { name: 'Magellan\'s Cross', lat: 10.2932, lng: 123.9017, type: 'attraction', distance: 500, rating: 4.7 },
    { name: 'Basilica Minore del Santo Niño', lat: 10.2945, lng: 123.9015, type: 'attraction', distance: 520, rating: 4.8 },
    { name: 'Cebu IT Park', lat: 10.3270, lng: 123.9050, type: 'park', distance: 400, rating: 4.4 },
    { name: 'Waterfront Hotel', lat: 10.3050, lng: 123.8880, type: 'hotel', distance: 300, rating: 4.3 },
    { name: 'Marco Polo Plaza Hotel', lat: 10.3250, lng: 123.8890, type: 'hotel', distance: 450, rating: 4.6 },
    { name: 'Starbucks - Ayala', lat: 10.3192, lng: 123.9055, type: 'restaurant', distance: 220, rating: 4.4 },
    { name: 'Bo\'s Coffee - IT Park', lat: 10.3275, lng: 123.9053, type: 'restaurant', distance: 410, rating: 4.3 },
    { name: 'Ramen Yushoken', lat: 10.3185, lng: 123.9048, type: 'restaurant', distance: 190, rating: 4.6 }
  ];
};

// Function to find places along the route
const findPlacesAlongRoute = async (routeCoords) => {
  if (!routeCoords || routeCoords.length === 0) return [];

  const places = [];
  const seenNames = new Set();

  try {
    const sampleSize = Math.min(10, routeCoords.length);
    const step = Math.max(1, Math.floor(routeCoords.length / sampleSize));
    const samplePoints = routeCoords.filter((_, index) => index % step === 0);

    const categories = [
      'catering.restaurant',
      'catering.cafe',
      'parking',
      'tourism.attraction',
      'leisure.park',
      'shopping.mall',
      'accommodation.hotel'
    ];

    for (const point of samplePoints) {
      const url = `https://api.geoapify.com/v2/places?categories=${categories.join(',')}&filter=circle:${point[1]},${point[0]},1000&limit=10&apiKey=${GEOAPIFY_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        data.features.forEach(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const name = feature.properties.name;

          if (!name || seenNames.has(name)) return;

          const category = feature.properties.categories?.[0] || '';
          let placeType = 'other';

          if (category.includes('restaurant') || category.includes('cafe')) placeType = 'restaurant';
          else if (category.includes('parking')) placeType = 'parking';
          else if (category.includes('attraction')) placeType = 'attraction';
          else if (category.includes('park')) placeType = 'park';
          else if (category.includes('mall')) placeType = 'shopping';
          else if (category.includes('hotel')) placeType = 'hotel';

          const distance = Math.sqrt(
            Math.pow(lat - point[0], 2) +
            Math.pow(lng - point[1], 2)
          ) * 111000;

          seenNames.add(name);
          places.push({
            name: name,
            lat, lng,
            type: placeType,
            address: feature.properties.address_line1 || '',
            distance: Math.round(distance),
            rating: feature.properties.rating || null
          });
        });
      }
    }
  } catch (error) {
    console.error('API error, using mock data:', error);
  }

  if (places.length === 0) {
    console.log('No places from API, using mock data');
    const mockPlaces = getMockPlaces(routeCoords);
    mockPlaces.forEach(place => {
      if (!seenNames.has(place.name)) {
        seenNames.add(place.name);
        places.push(place);
      }
    });
  }

  places.sort((a, b) => a.distance - b.distance);

  return places.slice(0, 25);
};

const MapScreen = ({
  venueCoords,
  itineraryWaypoints,
  searchLabel,
  pickMode = false,
  pickContext = 'event',
  pickInitialCoords = null,
  pickHintLabel = '',
  returnPath = '/plan',
}) => {
  const router = useRouter();
  const [pickedPoint, setPickedPoint] = useState(null);
  const [pickedLabel, setPickedLabel] = useState('');
  const [pickLoading, setPickLoading] = useState(false);

  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeSegments, setRouteSegments] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeMode, setRouteMode] = useState('drive');
  const [flyTo, setFlyTo] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [trafficSummary, setTrafficSummary] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState(null);

  const [originalDestination, setOriginalDestination] = useState(null);
  const [isRerouted, setIsRerouted] = useState(false);
  const [reroutedPlace, setReroutedPlace] = useState(null);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeRouteCoords, setPlaceRouteCoords] = useState(null);
  const [placeRouteInfo, setPlaceRouteInfo] = useState(null);
  const [placeTypeFilter, setPlaceTypeFilter] = useState('all');

  const defaultPosition = [10.3204, 123.9242];

  // Itinerary waypoints state
  const [waypointsList, setWaypointsList] = useState([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);

  // Auto-navigate to venue when venueCoords prop is provided (from itinerary)
  useEffect(() => {
    if (venueCoords && venueCoords.lat && venueCoords.lng) {
      const venueDest = {
        lat: venueCoords.lat,
        lng: venueCoords.lng,
        label: venueCoords.label || 'Event Venue'
      };
      setDestination(venueDest);
      setDestText(venueDest.label);
      setFlyTo([venueDest.lat, venueDest.lng]);
    }
  }, [venueCoords]);

  // Auto-fill destination text when searchLabel is provided (activity location without coords)
  useEffect(() => {
    if (searchLabel) {
      setDestText(searchLabel);
    }
  }, [searchLabel]);

  // Auto-load itinerary waypoints
  useEffect(() => {
    if (itineraryWaypoints && itineraryWaypoints.length > 0) {
      setWaypointsList(itineraryWaypoints);
      setCurrentWaypointIndex(0);
      // Set first waypoint with coordinates as destination
      const first = itineraryWaypoints.find(w => w.lat && w.lng);
      if (first) {
        const dest = { lat: first.lat, lng: first.lng, label: first.label || 'Waypoint 1' };
        setDestination(dest);
        setDestText(dest.label);
        setFlyTo([dest.lat, dest.lng]);
      }
    }
  }, [itineraryWaypoints]);

  useEffect(() => {
    if (!pickMode || pickInitialCoords?.lat == null || pickInitialCoords?.lng == null) return;
    let cancelled = false;
    (async () => {
      setPickLoading(true);
      const { lat, lng } = pickInitialCoords;
      setPickedPoint({ lat, lng });
      setFlyTo([lat, lng]);
      const name = await reverseGeocodeLatLng(lat, lng);
      if (!cancelled) {
        setPickedLabel(pickHintLabel || name);
        setPickLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickMode, pickInitialCoords?.lat, pickInitialCoords?.lng, pickHintLabel]);

  const handlePickMapClick = async (latlng) => {
    setPickLoading(true);
    setPickedPoint({ lat: latlng.lat, lng: latlng.lng });
    setFlyTo([latlng.lat, latlng.lng]);
    const name = await reverseGeocodeLatLng(latlng.lat, latlng.lng);
    setPickedLabel(name);
    setPickLoading(false);
  };

  const confirmPick = () => {
    if (!pickedPoint) return;
    try {
      sessionStorage.setItem(
        'scheduleSkies_mapPick',
        JSON.stringify({
          context: pickContext,
          lat: pickedPoint.lat,
          lng: pickedPoint.lng,
          label: pickedLabel || `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`,
          ts: Date.now(),
        })
      );
    } catch (e) {
      console.error(e);
    }
    router.push(returnPath);
  };

  const cancelPick = () => {
    router.push(returnPath);
  };

  // Navigate to next waypoint
  const goToNextWaypoint = () => {
    const nextIdx = currentWaypointIndex + 1;
    if (nextIdx < waypointsList.length) {
      setCurrentWaypointIndex(nextIdx);
      const wp = waypointsList[nextIdx];
      if (wp.lat && wp.lng) {
        const dest = { lat: wp.lat, lng: wp.lng, label: wp.label || `Stop ${nextIdx + 1}` };
        setDestination(dest);
        setDestText(dest.label);
        setFlyTo([dest.lat, dest.lng]);
        // Route from current destination to next
        if (destination) {
          setOrigin(destination);
          setOriginText(destination.label);
        }
      }
    }
  };

  // Get user's current location
  const getUserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (pickMode) {
            handlePickMapClick({ lat, lng });
            return;
          }
          const userLoc = {
            lat,
            lng,
            label: "Your Location"
          };
          setUserLocation(userLoc);
          setOrigin(userLoc);
          setOriginText("Your Location");
          setFlyTo([userLoc.lat, userLoc.lng]);
          setWeatherLocation(userLoc);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Unable to get your location. Please enter it manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const fetchPlacesAlongRoute = async (coords) => {
    setIsLoadingPlaces(true);
    const places = await findPlacesAlongRoute(coords);
    setNearbyPlaces(places);
    setIsLoadingPlaces(false);
  };

  const handleOriginSelect = (place) => {
    setOrigin(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setNearbyPlaces([]);
    setTrafficSummary(null);
    setSelectedPlace(null);
    setPlaceRouteCoords(null);
    setPlaceRouteInfo(null);
    setIsRerouted(false);
    setReroutedPlace(null);
  };

  const handleDestSelect = (place) => {
    setDestination(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setNearbyPlaces([]);
    setTrafficSummary(null);
    setSelectedPlace(null);
    setPlaceRouteCoords(null);
    setPlaceRouteInfo(null);
    setIsRerouted(false);
    setReroutedPlace(null);
  };

  const fetchRoute = async (org, dst, mode, isReroute = false) => {
    if (!org || !dst) {
      setRouteError('Please set both origin and destination.');
      return;
    }
    setIsRouting(true);
    setRouteError('');
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setNearbyPlaces([]);
    setTrafficSummary(null);

    try {
      const url = `https://api.geoapify.com/v1/routing?waypoints=${org.lat},${org.lng}|${dst.lat},${dst.lng}&mode=${mode}&apiKey=${GEOAPIFY_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.features?.length) {
        setRouteError('No route found.');
        setIsRouting(false);
        return;
      }

      const feature = data.features[0];
      let coords = [];
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach(l => l.forEach(([lng, lat]) => coords.push([lat, lng])));
      } else if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach(([lng, lat]) => coords.push([lat, lng]));
      }

      setRouteCoords(coords);

      const segments = getRouteSegmentsWithTraffic(coords);
      setRouteSegments(segments);

      const summary = getTrafficSummary(segments);
      setTrafficSummary(summary);

      const baseTime = Math.round(feature.properties.time / 60);
      const adjustedTime = Math.round(baseTime * (summary.avgDelayFactor || 1));

      setRouteInfo({
        distance: (feature.properties.distance / 1000).toFixed(1),
        time: baseTime,
        adjustedTime: adjustedTime,
        trafficDelay: adjustedTime - baseTime
      });

      if (coords.length) {
        setFlyTo(coords[Math.floor(coords.length / 2)]);
        if (!isReroute) {
          await fetchPlacesAlongRoute(coords);
        }
      }
    } catch (error) {
      console.error('Route fetch error:', error);
      setRouteError('Failed to fetch route.');
    }
    setIsRouting(false);
  };

  const handleRerouteToPlace = async (place) => {
    if (!origin && !userLocation) {
      alert('Please set an origin first (use "My Location" or enter a starting point)');
      return;
    }

    const currentOrigin = origin || userLocation;

    if (!isRerouted && destination) {
      setOriginalDestination(destination);
    }

    setDestination(place);
    setDestText(place.name);
    setReroutedPlace(place);
    setIsRerouted(true);

    await fetchRoute(currentOrigin, place, routeMode, true);

    setSelectedPlace(null);
    setPlaceRouteCoords(null);
    setPlaceRouteInfo(null);
    setFlyTo([place.lat, place.lng]);
  };

  const undoReroute = async () => {
    if (originalDestination) {
      const currentOrigin = origin || userLocation;
      setDestination(originalDestination);
      setDestText(originalDestination.label);
      setIsRerouted(false);
      setReroutedPlace(null);

      await fetchRoute(currentOrigin, originalDestination, routeMode, false);

      setFlyTo([originalDestination.lat, originalDestination.lng]);
    }
  };

  const getPlaceIcon = (type) => {
    switch (type) {
      case 'restaurant': return '🍽️';
      case 'parking': return '🅿️';
      case 'attraction': return '🏛️';
      case 'park': return '🌳';
      case 'shopping': return '🛍️';
      case 'hotel': return '🏨';
      default: return '📍';
    }
  };

  const getFilteredPlaces = () => {
    if (placeTypeFilter === 'all') return nearbyPlaces;
    return nearbyPlaces.filter(place => place.type === placeTypeFilter);
  };

  const clearAll = () => {
    setOrigin(null);
    setDestination(null);
    setOriginText('');
    setDestText('');
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setNearbyPlaces([]);
    setTrafficSummary(null);
    setSelectedPlace(null);
    setPlaceRouteCoords(null);
    setPlaceRouteInfo(null);
    setIsRerouted(false);
    setReroutedPlace(null);
    setOriginalDestination(null);
    setFlyTo(defaultPosition);
  };

  useEffect(() => {
    if (origin) {
      setWeatherLocation(origin);
    } else if (userLocation) {
      setWeatherLocation(userLocation);
    }
  }, [origin, userLocation]);

  useEffect(() => {
    setWeatherLocation({ lat: 10.3204, lng: 123.9242 });
  }, []);

  const modeOptions = [
    { key: 'drive', icon: '🚗', label: 'Drive' },
    { key: 'walk', icon: '🚶', label: 'Walk' },
    { key: 'transit', icon: '🚌', label: 'Transit' },
  ];

  const placeFilterOptions = [
    { key: 'all', label: 'All', icon: '📍' },
    { key: 'restaurant', label: 'Restaurants', icon: '🍽️' },
    { key: 'parking', label: 'Parking', icon: '🅿️' },
    { key: 'attraction', label: 'Attractions', icon: '🏛️' },
    { key: 'park', label: 'Parks', icon: '🌳' },
    { key: 'shopping', label: 'Shopping', icon: '🛍️' },
    { key: 'hotel', label: 'Hotels', icon: '🏨' },
  ];

  return (
    <div style={{
      height: '100%',
      width: '100%',
      display: 'flex',
      fontFamily: "'Segoe UI', sans-serif",
      overflow: 'hidden',
      position: 'relative',

      pointerEvents: 'none'
    }}>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        gap: '10px',
        minWidth: 0,
        overflow: 'hidden',
        paddingLeft: '10px',
        marginRight: !pickMode && nearbyPlaces.length > 0 ? '40px' : '0',
        pointerEvents: 'auto'
      }}>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap', flexShrink: 0, zIndex: 2 }}>
          {pickMode ? (
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.97)', borderRadius: '18px', padding: '14px 16px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)', minWidth: '280px' }}>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', marginBottom: '8px' }}>
                📍 Pin your {pickContext === 'activity' ? 'activity' : 'event'} location
              </div>
              <p style={{ fontSize: '12px', color: '#4A5568', margin: '0 0 10px', lineHeight: 1.45 }}>
                Tap anywhere on the map to place or move the pin. The address field will use this location.
                {pickHintLabel ? (
                  <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', opacity: 0.85 }}>
                    Hint: {pickHintLabel}
                  </span>
                ) : null}
              </p>
              {pickLoading && <div style={{ fontSize: '11px', color: '#718096', marginBottom: '8px' }}>Resolving address…</div>}
              {pickedLabel && (
                <div style={{ fontSize: '11px', color: '#2C5282', marginBottom: '10px', padding: '8px 10px', background: '#EBF8FF', borderRadius: '10px', maxHeight: '72px', overflowY: 'auto' }}>
                  {pickedLabel}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={confirmPick}
                  disabled={!pickedPoint || pickLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: !pickedPoint || pickLoading ? '#A0AEC0' : '#15A862',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: !pickedPoint || pickLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Use this location
                </button>
                <button
                  type="button"
                  onClick={cancelPick}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E0',
                    background: 'white',
                    color: '#4A5568',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={getUserLocation}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#2C5282',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    marginLeft: 'auto',
                  }}
                >
                  My location
                </button>
              </div>
            </div>
          ) : (
            <>
              <WeatherWidget location={weatherLocation} />

              <div style={{ flex: 1, background: 'rgba(255,255,255,0.97)', borderRadius: '18px', padding: '12px 14px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)', minWidth: '280px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <SearchInput
                      placeholder="From — origin location"
                      value={originText}
                      onChange={setOriginText}
                      onSelect={handleOriginSelect}
                      icon="🟦"
                    />
                    <button
                      onClick={getUserLocation}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#2C5282',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      My Location
                    </button>
                  </div>

                  <SearchInput
                    placeholder="To — destination"
                    value={destText}
                    onChange={setDestText}
                    onSelect={handleDestSelect}
                    icon="🔴"
                  />

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {modeOptions.map(({ key, icon, label }) => (
                      <button key={key} onClick={() => setRouteMode(key)} title={label}
                        style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', background: routeMode === key ? '#2C5282' : '#EDF2F7', transform: routeMode === key ? 'scale(1.12)' : 'scale(1)' }}
                      >{icon}</button>
                    ))}
                    <button onClick={() => fetchRoute(origin || userLocation, destination, routeMode, false)} disabled={isRouting}
                      style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: '10px', border: 'none', background: '#2C5282', color: 'white', fontWeight: '700', fontSize: '13px', cursor: isRouting ? 'not-allowed' : 'pointer', opacity: isRouting ? 0.6 : 1 }}
                    >{isRouting ? 'Routing...' : 'Go'}</button>

                    {isRerouted && (
                      <button onClick={undoReroute}
                        style={{ padding: '7px 10px', borderRadius: '10px', border: 'none', background: '#FF9800', color: 'white', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}
                      >
                        Undo
                      </button>
                    )}

                    {(origin || destination || routeCoords) && (
                      <button onClick={clearAll} style={{ padding: '7px 10px', borderRadius: '10px', border: 'none', background: '#FED7D7', color: '#C53030', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>Clear</button>
                    )}
                  </div>

                  {routeError && <div style={{ fontSize: '12px', color: '#E53E3E', padding: '5px 10px', background: '#FFF5F5', borderRadius: '8px' }}>⚠️ {routeError}</div>}

                  {routeInfo && (
                    <div style={{ display: 'flex', gap: '12px', padding: '7px 12px', background: '#EBF8FF', borderRadius: '10px', fontSize: '12px', fontWeight: '700', color: '#2C5282' }}>
                      <span>📏 {routeInfo.distance} km</span>
                      <span>⏱ Base: {routeInfo.time} min</span>
                      <span>⏱ Est: {routeInfo.adjustedTime} min</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!pickMode && nearbyPlaces.length > 0 && !isRerouted && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', zIndex: 2, flexShrink: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '6px', color: '#666' }}>Filter places:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {placeFilterOptions.map(option => (
                <button
                  key={option.key}
                  onClick={() => setPlaceTypeFilter(option.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '15px',
                    border: 'none',
                    background: placeTypeFilter === option.key ? '#2C5282' : '#EDF2F7',
                    color: placeTypeFilter === option.key ? 'white' : '#333',
                    cursor: 'pointer',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, borderRadius: '24px', border: '6px solid #2C5282', overflow: 'hidden', position: 'relative', minHeight: 0, zIndex: 1 }}>
          <MapContainer
            center={defaultPosition}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/${mapStyle}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`}
              attribution='Powered by Geoapify | OpenStreetMap'
            />
            {flyTo && <FlyTo coords={flyTo} />}

            {pickMode && (
              <MapPickClickHandler enabled={pickMode} onLatLngClick={handlePickMapClick} />
            )}

            <MapControls
              onZoomIn={() => { }}
              onZoomOut={() => { }}
              onLocation={getUserLocation}
              onRoute={() => fetchRoute(origin || userLocation, destination, routeMode, false)}
            />

            {pickMode && pickedPoint && (
              <Marker position={[pickedPoint.lat, pickedPoint.lng]} icon={destIcon}>
                <Popup>
                  <strong>Pinned location</strong>
                  <br />
                  {pickedLabel || `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`}
                </Popup>
              </Marker>
            )}

            {userLocation && !origin && !pickMode && (
              <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                <Popup><strong>Your Location</strong></Popup>
              </Marker>
            )}

            {!pickMode && origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon}><Popup><strong>Origin</strong><br />{origin.label}</Popup></Marker>}

            {!pickMode && destination && <Marker position={[destination.lat, destination.lng]} icon={destIcon}>
              <Popup>
                <strong>Destination</strong><br />
                {destination.label}
                {isRerouted && <div style={{ color: '#FF9800', marginTop: '5px' }}>Rerouted</div>}
              </Popup>
            </Marker>}

            {!pickMode && routeSegments.map((segment, idx) => (
              <Polyline
                key={idx}
                positions={[segment.start, segment.end]}
                pathOptions={{
                  color: segment.color,
                  weight: 6,
                  opacity: 0.9,
                  lineCap: 'round',
                  lineJoin: 'round'
                }}
              />
            ))}

            {!pickMode && !isRerouted && getFilteredPlaces().map((place, idx) => (
              <Marker
                key={idx}
                position={[place.lat, place.lng]}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="
                    width: 28px; height: 28px; background: ${place.type === 'restaurant' ? '#FF5722' : place.type === 'parking' ? '#2196F3' : place.type === 'hotel' ? '#9C27B0' : '#9C27B0'};
                    border: 2px solid white; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    cursor: pointer;
                  ">${getPlaceIcon(place.type)}</div>`,
                  iconSize: [28, 28],
                  iconAnchor: [14, 14],
                })}
              >
                <Popup>
                  <strong>{place.name}</strong><br />
                  {place.rating && <span>⭐ Rating: {place.rating}/5<br /></span>}
                  <span>Type: {place.type}<br /></span>
                  {place.address && <span>{place.address}<br /></span>}
                  <span>Distance: {place.distance}m</span><br />
                  <button
                    onClick={() => handleRerouteToPlace(place)}
                    style={{
                      marginTop: '8px',
                      padding: '5px 10px',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Reroute Here
                  </button>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {isLoadingPlaces && (
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', zIndex: 1000 }}>
              Finding places along your route...
            </div>
          )}
        </div>
      </div>

      {/* Itinerary Waypoints Panel */}
      {!pickMode && waypointsList.length > 0 && (
        <div style={{
          width: '280px',
          backgroundColor: '#EDE7F6',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          overflowY: 'auto'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#4A148C', margin: '0 0 4px', textAlign: 'center' }}>
            🗺️ Itinerary Navigation
          </h3>
          <p style={{ fontSize: '10px', color: '#6A1B9A', textAlign: 'center', margin: '0 0 8px', opacity: 0.8 }}>
            Stop {currentWaypointIndex + 1} of {waypointsList.length}
          </p>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
            {waypointsList.map((_, i) => (
              <div key={i} style={{
                width: i === currentWaypointIndex ? '20px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: i < currentWaypointIndex ? '#7B1FA2' : i === currentWaypointIndex ? '#AB47BC' : '#D1C4E9',
                transition: 'all 0.3s ease'
              }}></div>
            ))}
          </div>

          {/* Waypoints list */}
          {waypointsList.map((wp, i) => (
            <div key={i} style={{
              backgroundColor: i === currentWaypointIndex ? 'white' : i < currentWaypointIndex ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)',
              borderRadius: '12px',
              padding: '10px',
              border: i === currentWaypointIndex ? '2px solid #AB47BC' : '1px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s',
              opacity: i < currentWaypointIndex ? 0.6 : 1
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: i < currentWaypointIndex ? '#7B1FA2' : i === currentWaypointIndex ? '#AB47BC' : '#D1C4E9',
                color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '700', flexShrink: 0
              }}>
                {i < currentWaypointIndex ? '✓' : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A365D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {wp.label || wp.activityName || `Stop ${i + 1}`}
                </div>
                {wp.activityName && wp.label !== wp.activityName && (
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{wp.activityName}</div>
                )}
              </div>
            </div>
          ))}

          {/* Next Stop Button */}
          {currentWaypointIndex < waypointsList.length - 1 && (
            <button
              onClick={goToNextWaypoint}
              style={{
                marginTop: '8px',
                padding: '10px',
                background: 'linear-gradient(135deg, #7B1FA2, #AB47BC)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '700',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Next Stop →
            </button>
          )}

          {currentWaypointIndex === waypointsList.length - 1 && (
            <div style={{
              marginTop: '8px',
              padding: '10px',
              background: '#E8F5E9',
              borderRadius: '12px',
              textAlign: 'center',
              fontSize: '12px',
              fontWeight: '700',
              color: '#2E7D32'
            }}>
              ✅ Final Destination Reached
            </div>
          )}
        </div>
      )}
      {!pickMode && nearbyPlaces.length > 0 && !isRerouted && (
        <div style={{
          width: '280px',
          backgroundColor: '#81D4FA',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          gap: '8px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 2,
          pointerEvents: 'auto'
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', margin: '0 0 4px', textAlign: 'center' }}>
            Places Along Route
          </h3>
          <p style={{ fontSize: '10px', color: '#2C5282', textAlign: 'center', margin: '0 0 6px', opacity: 0.8 }}>
            {getFilteredPlaces().length} places found
          </p>

          {getFilteredPlaces().map((place, i) => (
            <div key={i}
              style={{
                backgroundColor: 'white',
                borderRadius: '14px',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.18s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '45px', height: '40px', borderRadius: '10px', background: '#EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', flexShrink: 0 }}>
                  {getPlaceIcon(place.type)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A365D', marginBottom: '4px' }}>
                    {place.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{place.type}</span>
                    {place.rating && <span>⭐ {place.rating}</span>}
                    <span>{place.distance}m</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRerouteToPlace(place)}
                style={{
                  padding: '6px 10px',
                  background: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  width: '100%'
                }}
              >
                Reroute Here
              </button>
            </div>
          ))}

          {isRerouted && reroutedPlace && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: '#FFF3E0',
              borderRadius: '12px',
              border: '1px solid #FF9800'
            }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#E65100', marginBottom: '8px' }}>
                Currently Rerouted
              </div>
              <div style={{ fontSize: '11px', color: '#BF360C', marginBottom: '8px' }}>
                To: <strong>{reroutedPlace.name}</strong>
              </div>
              <button
                onClick={undoReroute}
                style={{
                  padding: '6px 12px',
                  background: '#FF9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  width: '100%'
                }}
              >
                Undo
              </button>
            </div>
          )}

          {trafficSummary && routeInfo && (
            <div style={{
              marginTop: 'auto',
              padding: '12px',
              background: trafficSummary.level === 'Heavy' ? '#FFEBEE' : trafficSummary.level === 'Moderate' ? '#FFF3E0' : '#E8F5E9',
              borderRadius: '12px',
              borderTop: `3px solid ${trafficSummary.color}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>
                  {trafficSummary.level === 'Heavy' ? '🔴' : trafficSummary.level === 'Moderate' ? '🟠' : '🟢'}
                </span>
                <span style={{ fontWeight: '700', fontSize: '12px', color: trafficSummary.color }}>
                  {trafficSummary.level} Traffic
                </span>
              </div>

              <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>
                {trafficSummary.heavySegments > 0 && `🔴 ${trafficSummary.heavySegments} heavy • `}
                {trafficSummary.moderateSegments > 0 && `🟠 ${trafficSummary.moderateSegments} moderate • `}
                🟢 {trafficSummary.lightSegments} light
              </div>

              <div style={{ fontSize: '11px', fontWeight: '600', color: trafficSummary.color }}>
                Est. delay: {routeInfo.trafficDelay} min
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapScreen;