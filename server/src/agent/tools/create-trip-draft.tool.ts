import { z } from 'zod';
import { idSchema } from '@fleetpilot/shared';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../middleware/error';
import { overlappingActiveTrips, utcDay } from '../lib/schedule';
import { defineTool } from './types';

const inputSchema = z
  .object({
    clientId: idSchema('Id de client invalid — folosește întâi get_client_by_name'),
    originAddress: z.string().trim().min(3).max(200),
    destAddress: z.string().trim().min(3).max(200),
    cargoDescription: z.string().trim().min(2).max(300),
    pallets: z.number().int().positive().max(66).optional(),
    weightTons: z.number().positive().max(60).multipleOf(0.01).optional(),
    windowStart: z.coerce.date('windowStart invalid'),
    windowEnd: z.coerce.date('windowEnd invalid'),
    vehicleId: idSchema('Id de vehicul invalid').optional(),
    driverId: idSchema('Id de șofer invalid').optional(),
    justification: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .describe('Explicație scurtă, pentru dispecer, a alegerii'),
  })
  .refine((value) => value.pallets !== undefined || value.weightTons !== undefined, {
    message: 'Specifică paleții sau tonajul (măcar una)',
  })
  .refine((value) => value.windowStart < value.windowEnd, 'windowEnd trebuie după windowStart')
  // toleranță 24h (nu "acum" strict) — o cursă pornită azi dimineața tot trebuie propusă normal;
  // găsit la testare adversarială (agent-tester): fără asta, o dată complet greșită (ex. anul
  // trecut) trecea nesemnalată într-un draft altfel valid, gata de aprobare din neatenție
  .refine((value) => value.windowStart.getTime() >= Date.now() - 24 * 3600 * 1000, {
    message:
      'Fereastra cerută e în trecut — confirmă data corectă cu dispecerul înainte să continui',
    path: ['windowStart'],
  });

// NU scrie nimic în DB — doar validează că propunerea chiar ar trece verificările de la
// alocarea reală (trip.service.assignTrip) și întoarce un draft afișabil dispecerului.
// Verificarea autoritativă, tranzacțională, se face din nou la aprobare (agent.service.approveAction).
export const createTripDraftTool = defineTool({
  name: 'create_trip_draft',
  description:
    'Construiește propunerea de cursă pe care o vede dispecerul, cu buton de Aprobă/Modifică/Respinge. NU creează nimic în sistem — e doar un draft. Cheamă-l DOAR după ce ai adunat toate datele obligatorii (client existent confirmat prin get_client_by_name, origine, destinație, marfă, cantitate, fereastră) și, dacă ai găsit, un vehicul și un șofer candidat verificați ca fiind liberi. Dacă vreo verificare eșuează (capacitate, conflict, șofer absent), tool-ul întoarce eroare — nu insista cu aceiași parametri, alege alt candidat sau raportează userului că nu ai găsit nimic potrivit.',
  inputSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'Id-ul clientului, din get_client_by_name' },
      originAddress: { type: 'string' },
      destAddress: { type: 'string' },
      cargoDescription: { type: 'string', description: 'Descrierea mărfii' },
      pallets: { type: 'integer', description: 'Număr de paleți (dă-l dacă e menționat)' },
      weightTons: { type: 'number', description: 'Tonaj (dă-l dacă e menționat)' },
      windowStart: { type: 'string', description: 'Începutul ferestrei cerute, ISO 8601' },
      windowEnd: { type: 'string', description: 'Sfârșitul ferestrei cerute, ISO 8601' },
      vehicleId: { type: 'string', description: 'Id-ul vehiculului candidat (opțional)' },
      driverId: { type: 'string', description: 'Id-ul șoferului candidat (opțional)' },
      justification: {
        type: 'string',
        description: 'De ce ai ales acest vehicul/șofer, pe scurt, pentru dispecer',
      },
    },
    required: [
      'clientId',
      'originAddress',
      'destAddress',
      'cargoDescription',
      'windowStart',
      'windowEnd',
      'justification',
    ],
  },
  async execute(companyId, input) {
    const client = await prisma.client.findFirst({ where: { id: input.clientId, companyId } });
    if (!client) {
      throw new HttpError(
        404,
        'Clientul nu există — verifică din nou cu get_client_by_name',
        'CLIENT_NOT_FOUND',
      );
    }

    let vehicle = null;
    if (input.vehicleId) {
      vehicle = await prisma.vehicle.findFirst({ where: { id: input.vehicleId, companyId } });
      if (!vehicle) {
        throw new HttpError(404, 'Vehiculul nu există', 'VEHICLE_NOT_FOUND');
      }
      if (input.pallets !== undefined && input.pallets > vehicle.capacityPallets) {
        throw new HttpError(409, 'Vehiculul nu are loc de atâția paleți', 'CAPACITY_EXCEEDED');
      }
      if (input.weightTons !== undefined && input.weightTons > vehicle.capacityTons.toNumber()) {
        throw new HttpError(409, 'Marfa depășește tonajul vehiculului', 'CAPACITY_EXCEEDED');
      }
      const busy = await prisma.trip.findFirst({
        where: {
          companyId,
          vehicleId: vehicle.id,
          ...overlappingActiveTrips(input.windowStart, input.windowEnd),
        },
      });
      if (busy) {
        throw new HttpError(409, 'Vehiculul are altă cursă în acea fereastră', 'VEHICLE_BUSY');
      }
    }

    let driver = null;
    if (input.driverId) {
      driver = await prisma.driver.findFirst({
        where: { id: input.driverId, companyId },
        include: { user: true },
      });
      if (!driver) {
        throw new HttpError(404, 'Șoferul nu există', 'DRIVER_NOT_FOUND');
      }
      if (!driver.user.isActive) {
        throw new HttpError(409, 'Șoferul e dezactivat', 'DRIVER_INACTIVE');
      }
      const absence = await prisma.driverAbsence.findFirst({
        where: {
          driverId: driver.id,
          startsAt: { lte: utcDay(input.windowEnd) },
          endsAt: { gte: utcDay(input.windowStart) },
        },
      });
      if (absence) {
        throw new HttpError(409, 'Șoferul e în concediu în fereastra cursei', 'DRIVER_ABSENT');
      }
      const busy = await prisma.trip.findFirst({
        where: {
          companyId,
          driverId: driver.id,
          ...overlappingActiveTrips(input.windowStart, input.windowEnd),
        },
      });
      if (busy) {
        throw new HttpError(409, 'Șoferul are altă cursă în acea fereastră', 'DRIVER_BUSY');
      }
    }

    return {
      kind: 'trip_draft' as const,
      clientId: client.id,
      clientName: client.name,
      originAddress: input.originAddress,
      destAddress: input.destAddress,
      cargoDescription: input.cargoDescription,
      pallets: input.pallets ?? null,
      weightTons: input.weightTons ?? null,
      windowStart: input.windowStart.toISOString(),
      windowEnd: input.windowEnd.toISOString(),
      vehicleId: vehicle?.id ?? null,
      vehiclePlate: vehicle?.plateNumber ?? null,
      driverId: driver?.id ?? null,
      driverName: driver?.user.name ?? null,
      justification: input.justification,
    };
  },
});
