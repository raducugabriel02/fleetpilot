import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { TripDetailDto } from '@fleetpilot/shared';

// Vite mută asset-urile Leaflet la build (hash în URL); iconul default caută
// căile hardcodate din CSS și nu le găsește dacă nu le legăm explicit aici.
const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function FitToBounds({ bounds }: { bounds: LatLngBoundsExpression }) {
  const map = useMap();
  map.fitBounds(bounds, { padding: [32, 32] });
  return null;
}

export function TripRouteMap({ trip }: { trip: TripDetailDto }) {
  const points = useMemo(() => {
    const origin: LatLngTuple | null =
      trip.originLat != null && trip.originLng != null ? [trip.originLat, trip.originLng] : null;
    const dest: LatLngTuple | null =
      trip.destLat != null && trip.destLng != null ? [trip.destLat, trip.destLng] : null;
    // GeoJSON dă [lng, lat]; Leaflet vrea [lat, lng]
    const route: LatLngTuple[] =
      trip.routeGeometry?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [];
    return { origin, dest, route };
  }, [trip]);

  if (!points.origin && !points.dest && points.route.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Rută indisponibilă — geocodarea adreselor n-a reușit.
      </div>
    );
  }

  const allPoints: LatLngTuple[] = [
    ...(points.origin ? [points.origin] : []),
    ...(points.dest ? [points.dest] : []),
    ...points.route,
  ];
  const bounds: LatLngBoundsExpression = allPoints;

  return (
    <div className="h-72 overflow-hidden rounded-md border">
      <MapContainer
        center={allPoints[0]}
        zoom={7}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.route.length >= 2 && (
          <Polyline positions={points.route} pathOptions={{ color: '#f59e0b', weight: 4 }} />
        )}
        {points.origin && (
          <Marker position={points.origin} icon={defaultIcon}>
            <Popup>Origine: {trip.originAddress}</Popup>
          </Marker>
        )}
        {points.dest && (
          <Marker position={points.dest} icon={defaultIcon}>
            <Popup>Destinație: {trip.destAddress}</Popup>
          </Marker>
        )}
        <FitToBounds bounds={bounds} />
      </MapContainer>
    </div>
  );
}
