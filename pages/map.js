import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar'

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  const router = useRouter();
  const { lat, lng, label, waypoints, pick, from, returnTo } = router.query;

  const isPickMode = pick === '1' || pick === 'true';

  // Parse single venue coords (skipped in pick mode so the map starts clean for pinning)
  const venueCoords = !isPickMode && lat && lng
    ? { lat: parseFloat(lat), lng: parseFloat(lng), label: label || 'Event Venue' }
    : null;

  // Parse multi-waypoint array
  let parsedWaypoints = null;
  if (waypoints) {
    try {
      parsedWaypoints = JSON.parse(waypoints);
    } catch (e) {
      console.error('Failed to parse waypoints:', e);
    }
  }

  return (
    <main className="dashboard">
      <Sidebar />
      <div className="dashboard-content" style={{ padding: '1rem', height: '100vh' }}>
        <div style={{ height: 'calc(100vh - 2rem)', width: '100%' }}>
          <MapScreen
            venueCoords={venueCoords}
            itineraryWaypoints={parsedWaypoints}
            searchLabel={!isPickMode && !venueCoords && label ? label : null}
            pickMode={isPickMode}
            pickContext={typeof from === 'string' ? from : 'event'}
            pickInitialCoords={
              isPickMode && lat && lng && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))
                ? { lat: parseFloat(lat), lng: parseFloat(lng) }
                : null
            }
            pickHintLabel={typeof label === 'string' ? label : ''}
            returnPath={typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/plan'}
          />
        </div>
      </div>
    </main>
  )
}