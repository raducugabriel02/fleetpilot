import { z } from 'zod';
import { idSchema } from '@fleetpilot/shared';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middleware/error';
import { overlappingActiveTrips, utcDay } from '../lib/schedule';
import { defineTool } from './types';

const inputSchema = z
  .object({
    vehicleId: idSchema('Id de vehicul invalid').optional(),
    driverId: idSchema('Id de șofer invalid').optional(),
    windowStart: z.coerce.date('windowStart invalid'),
    windowEnd: z.coerce.date('windowEnd invalid'),
  })
  .refine((value) => value.vehicleId ?? value.driverId, 'Specifică măcar vehicleId sau driverId')
  .refine((value) => value.windowStart < value.windowEnd, 'windowEnd trebuie după windowStart');

export const checkScheduleConflictsTool = defineTool({
  name: 'check_schedule_conflicts',
  description:
    'Verifică dacă un vehicul și/sau un șofer anume (deja aleși ca și candidați) au vreun conflict de program — altă cursă planificată/în desfășurare care se suprapune cu fereastra, sau (pentru șofer) o absență în acea perioadă. Folosește-l chiar înainte de a propune alocarea finală, ca a doua verificare pe candidatul ales.',
  inputSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      vehicleId: { type: 'string', description: 'Id-ul vehiculului de verificat (opțional)' },
      driverId: { type: 'string', description: 'Id-ul șoferului de verificat (opțional)' },
      windowStart: { type: 'string', description: 'Începutul ferestrei, ISO 8601' },
      windowEnd: { type: 'string', description: 'Sfârșitul ferestrei, ISO 8601' },
    },
    required: ['windowStart', 'windowEnd'],
  },
  async execute(companyId, input) {
    const activeTrip = overlappingActiveTrips(input.windowStart, input.windowEnd);

    let vehicleConflict: { tripId: string; windowStart: string; windowEnd: string } | null = null;
    if (input.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: { id: input.vehicleId, companyId },
      });
      if (!vehicle) {
        throw new HttpError(404, 'Vehiculul nu există', 'VEHICLE_NOT_FOUND');
      }
      const conflict = await prisma.trip.findFirst({
        where: { companyId, vehicleId: vehicle.id, ...activeTrip },
      });
      vehicleConflict = conflict
        ? {
            tripId: conflict.id,
            windowStart: conflict.windowStart.toISOString(),
            windowEnd: conflict.windowEnd.toISOString(),
          }
        : null;
    }

    let driverConflict: { tripId: string; windowStart: string; windowEnd: string } | null = null;
    let driverAbsence: { type: string; startsAt: string; endsAt: string } | null = null;
    if (input.driverId) {
      const driver = await prisma.driver.findFirst({ where: { id: input.driverId, companyId } });
      if (!driver) {
        throw new HttpError(404, 'Șoferul nu există', 'DRIVER_NOT_FOUND');
      }
      const conflict = await prisma.trip.findFirst({
        where: { companyId, driverId: driver.id, ...activeTrip },
      });
      driverConflict = conflict
        ? {
            tripId: conflict.id,
            windowStart: conflict.windowStart.toISOString(),
            windowEnd: conflict.windowEnd.toISOString(),
          }
        : null;
      const absence = await prisma.driverAbsence.findFirst({
        where: {
          driverId: driver.id,
          startsAt: { lte: utcDay(input.windowEnd) },
          endsAt: { gte: utcDay(input.windowStart) },
        },
      });
      driverAbsence = absence
        ? {
            type: absence.type,
            startsAt: absence.startsAt.toISOString().slice(0, 10),
            endsAt: absence.endsAt.toISOString().slice(0, 10),
          }
        : null;
    }

    return { vehicleConflict, driverConflict, driverAbsence };
  },
});
