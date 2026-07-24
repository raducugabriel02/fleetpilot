import { z } from 'zod';

export const tripStatusSchema = z.enum([
  'REQUEST',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type TripStatus = z.infer<typeof tripStatusSchema>;

const addressSchema = z.string().trim().min(3, 'Adresa e prea scurtă').max(200);

const tripDetailsSchema = z.object({
  clientId: z.cuid('Id de client invalid'),
  originAddress: addressSchema,
  destAddress: addressSchema,
  cargoDescription: z.string().trim().min(2, 'Descrie pe scurt marfa').max(300),
  pallets: z.coerce
    .number()
    .int()
    .positive('Numărul de paleți trebuie să fie pozitiv')
    // aliniat cu limita vehiculului; o comandă mai mare se sparge în mai multe curse
    .max(66, 'Maxim 66 de paleți (megatrailer)')
    .optional(),
  // multipleOf(0.01): coloana e Decimal(6,2) — fără limită, Postgres ar rotunji silențios
  weightTons: z.coerce
    .number()
    .positive('Tonajul trebuie să fie pozitiv')
    .max(60, 'Peste limita legală de tonaj')
    .multipleOf(0.01, 'Maxim două zecimale')
    .optional(),
  windowStart: z.coerce.date('Dată invalidă'),
  windowEnd: z.coerce.date('Dată invalidă'),
});

// fără paleți ȘI fără tonaj nu se poate verifica nicio capacitate — cerem măcar una
export const createTripSchema = tripDetailsSchema
  .refine((value) => value.pallets !== undefined || value.weightTons !== undefined, {
    message: 'Specifică paleții sau tonajul (măcar una)',
    path: ['pallets'],
  })
  .refine((value) => value.windowStart < value.windowEnd, {
    message: 'Fereastra trebuie să se termine după ce începe',
    path: ['windowEnd'],
  });

// statusul nu se editează direct — doar prin tranzițiile dedicate (assign/start/complete/cancel).
// pallets/weightTons nu acceptă null la update: odată setate, se pot doar corecta, nu șterge —
// altfel s-ar pierde invariantul „măcar una există" garantat la creare
export const updateTripSchema = tripDetailsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nimic de actualizat')
  .refine(
    (value) =>
      value.windowStart === undefined ||
      value.windowEnd === undefined ||
      value.windowStart < value.windowEnd,
    { message: 'Fereastra trebuie să se termine după ce începe', path: ['windowEnd'] },
  );

export const assignTripSchema = z.object({
  vehicleId: z.cuid('Id de vehicul invalid'),
  driverId: z.cuid('Id de șofer invalid'),
});

// „accelerated": simulare GPS 3h -> 3min, pentru demo-uri
export const startTripSchema = z.object({
  accelerated: z.boolean().optional().default(false),
});

export const listTripsQuerySchema = z
  .object({
    status: tripStatusSchema.optional(),
    clientId: z.cuid('Id de client invalid').optional(),
    // interval pe fereastra cursei: "curse care se suprapun cu [from, to]"
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'Intervalul e inversat',
    path: ['to'],
  });

// geometria rutei, exact cum o dă OSRM (GeoJSON LineString) — o consumă harta și simulatorul GPS
export const routeGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
});
export type RouteGeometry = z.infer<typeof routeGeometrySchema>;

export const tripSchema = z.object({
  id: z.string(),
  client: z.object({ id: z.string(), name: z.string() }),
  vehicle: z.object({ id: z.string(), plateNumber: z.string() }).nullable(),
  driver: z.object({ id: z.string(), name: z.string() }).nullable(),
  originAddress: z.string(),
  destAddress: z.string(),
  // null = geocodarea n-a reușit (serviciu picat sau adresă negăsită); UI-ul arată „—"
  originLat: z.number().nullable(),
  originLng: z.number().nullable(),
  destLat: z.number().nullable(),
  destLng: z.number().nullable(),
  cargoDescription: z.string(),
  pallets: z.number().int().nullable(),
  weightTons: z.number().nullable(),
  windowStart: z.iso.datetime(),
  windowEnd: z.iso.datetime(),
  status: tripStatusSchema,
  distanceKm: z.number().nullable(),
  durationMin: z.number().int().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

// geometria doar pe detaliu: e mare (sute de puncte) și listările n-au nevoie de ea
export const tripDetailSchema = tripSchema.extend({
  routeGeometry: routeGeometrySchema.nullable(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export type AssignTripInput = z.infer<typeof assignTripSchema>;
export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
export type TripDto = z.infer<typeof tripSchema>;
export type TripDetailDto = z.infer<typeof tripDetailSchema>;
