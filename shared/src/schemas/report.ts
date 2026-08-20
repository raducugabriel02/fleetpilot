import { z } from 'zod';

export const monthlyReportQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format lună invalid (ex: 2026-08)'),
});

export const monthlyReportSchema = z.object({
  month: z.string(),
  completedTrips: z.number().int(),
  totalDistanceKm: z.number(),
  // null = nicio cursă finalizată în lună — procentul n-are sens pe zero curse
  onTimePercent: z.number().nullable(),
  topClients: z.array(
    z.object({ clientId: z.string(), name: z.string(), tripCount: z.number().int() }),
  ),
  vehicleUtilization: z.array(
    z.object({
      vehicleId: z.string(),
      plateNumber: z.string(),
      tripCount: z.number().int(),
      distanceKm: z.number(),
    }),
  ),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
export type MonthlyReportDto = z.infer<typeof monthlyReportSchema>;
