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

// payload-ul evenimentului 'trip:notification' — cursă finalizată sau care a depășit
// fereastra de livrare fără să fi fost finalizată
export const tripNotificationEventSchema = z.object({
  tripId: z.string(),
  kind: z.enum(['COMPLETED', 'LATE']),
  message: z.string(),
});
export type TripNotificationEvent = z.infer<typeof tripNotificationEventSchema>;

// payload-ul evenimentului 'vehicle:alert' — rezumat zilnic al documentelor de vehicul
// (ITP/RCA/rovinietă) expirate sau care expiră curând; spre deosebire de trip:notification,
// se repetă zilnic cât timp problema persistă (nu e un eveniment unic legat de o cursă)
export const vehicleAlertEventSchema = z.object({
  message: z.string(),
  expiredCount: z.number().int(),
  soonCount: z.number().int(),
});
export type VehicleAlertEvent = z.infer<typeof vehicleAlertEventSchema>;
