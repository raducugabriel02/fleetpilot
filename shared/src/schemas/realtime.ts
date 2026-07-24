import { z } from 'zod';

// payload-ul evenimentului 'vehicle:position' emis de simulatorul GPS prin Socket.io —
// clientul îl validează la primire, ca orice date venite prin rețea
export const vehiclePositionEventSchema = z.object({
  vehicleId: z.string(),
  tripId: z.string(),
  lat: z.number(),
  lng: z.number(),
  speedKmh: z.number(),
  // simulatorul GPS emite mereu un heading calculat din bearing — nullable e pentru
  // o sursă viitoare de poziții reale (GPS hardware), care poate raporta fără heading
  heading: z.number().nullable(),
  recordedAt: z.iso.datetime(),
});
export type VehiclePositionEvent = z.infer<typeof vehiclePositionEventSchema>;
