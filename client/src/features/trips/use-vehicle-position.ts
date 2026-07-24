import { useEffect, useState } from 'react';
import { vehiclePositionEventSchema, type VehiclePositionEvent } from '@fleetpilot/shared';
import { getSocket } from '@/lib/socket';

/** ultima poziție GPS primită pentru o cursă anume, cât timp dialogul hărții e deschis */
export function useVehiclePosition(tripId: string | null): VehiclePositionEvent | null {
  const [position, setPosition] = useState<VehiclePositionEvent | null>(null);

  useEffect(() => {
    setPosition(null);
    if (!tripId) return;

    // presupunere: instanța de socket nu se schimbă cât timp tripId rămâne același
    // (adevărat azi — logout/login reface tot arborele de componente); dacă auth-flow-ul
    // se schimbă vreodată să păstreze componenta montată peste un swap de socket, hook-ul
    // ar trebui să depindă și de identitatea socket-ului, nu doar de tripId
    const socket = getSocket();
    if (!socket) return;

    function onPosition(raw: unknown) {
      const parsed = vehiclePositionEventSchema.safeParse(raw);
      if (parsed.success && parsed.data.tripId === tripId) {
        setPosition(parsed.data);
      }
    }

    socket.on('vehicle:position', onPosition);
    return () => {
      socket.off('vehicle:position', onPosition);
    };
  }, [tripId]);

  return position;
}
