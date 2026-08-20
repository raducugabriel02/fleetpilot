import { z } from 'zod';

// sursă unică pt. pragul "expiră curând": dashboard-ul (client) și verificarea
// periodică de fond (server) trebuie să considere aceeași fereastră de 30 de zile
export const VEHICLE_DOCUMENT_SOON_THRESHOLD_DAYS = 30;

export const vehicleTypeSchema = z.enum(['VAN', 'TRUCK', 'SEMI']);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const vehicleStatusSchema = z.enum(['AVAILABLE', 'ON_TRIP', 'IN_SERVICE']);
export type VehicleStatus = z.infer<typeof vehicleStatusSchema>;

// normalizăm întâi ("b 123 abc" → "B123ABC"), apoi validăm formatul românesc:
// București B + 2-3 cifre, restul județelor 2 litere + 2 cifre, apoi 3 litere
const plateNumberSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]+/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .regex(
        /^(B\d{2,3}|[A-Z]{2}\d{2})[A-Z]{3}$/,
        'Număr de înmatriculare invalid (ex: B 123 ABC sau CT 45 XYZ)',
      ),
  );

export const createVehicleSchema = z.object({
  plateNumber: plateNumberSchema,
  type: vehicleTypeSchema,
  // multipleOf(0.01): coloana e Decimal(6,2) — fără limită, Postgres ar rotunji silențios
  capacityTons: z.coerce
    .number()
    .positive('Capacitatea trebuie să fie pozitivă')
    .max(60, 'Peste limita legală de tonaj')
    .multipleOf(0.01, 'Maxim două zecimale'),
  capacityPallets: z.coerce.number().int().min(0).max(66, 'Maxim 66 de paleți (megatrailer)'),
  itpExpiresAt: z.coerce.date().nullable().optional(),
  rcaExpiresAt: z.coerce.date().nullable().optional(),
  vignetteExpiresAt: z.coerce.date().nullable().optional(),
});

// statusul ON_TRIP e gestionat de sistem la pornirea cursei, nu se setează manual
export const updateVehicleSchema = createVehicleSchema
  .partial()
  .extend({
    status: z.enum(['AVAILABLE', 'IN_SERVICE']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nimic de actualizat');

export const listVehiclesQuerySchema = z.object({
  status: vehicleStatusSchema.optional(),
});

export const vehicleSchema = z.object({
  id: z.string(),
  plateNumber: z.string(),
  type: vehicleTypeSchema,
  capacityTons: z.number(),
  capacityPallets: z.number().int(),
  status: vehicleStatusSchema,
  itpExpiresAt: z.iso.datetime().nullable(),
  rcaExpiresAt: z.iso.datetime().nullable(),
  vignetteExpiresAt: z.iso.datetime().nullable(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
export type VehicleDto = z.infer<typeof vehicleSchema>;
