import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { overlappingActiveTrips } from '../lib/schedule';
import { defineTool } from './types';

const inputSchema = z
  .object({
    windowStart: z.coerce.date('windowStart invalid'),
    windowEnd: z.coerce.date('windowEnd invalid'),
    minPallets: z.number().int().positive().optional(),
    minWeightTons: z.number().positive().optional(),
  })
  .refine((value) => value.windowStart < value.windowEnd, 'windowEnd trebuie după windowStart');

export const getAvailableVehiclesTool = defineTool({
  name: 'get_available_vehicles',
  description:
    'Găsește vehiculele firmei fără nicio cursă PLANIFICATĂ sau ÎN DESFĂȘURARE care se suprapune cu fereastra de timp dată, opțional filtrate după capacitate minimă (paleți și/sau tone). Nu exclude vehiculele status IN_SERVICE — sunt returnate cu statusul lor curent, ca informație, pentru că alocarea (assign) le permite intenționat (planificare în avans); doar pornirea cursei (start) va refuza dacă la momentul ăla vehiculul tot nu e AVAILABLE.',
  inputSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      windowStart: {
        type: 'string',
        description: 'Începutul ferestrei cerute, ISO 8601 (ex. 2026-07-30T06:00:00.000Z)',
      },
      windowEnd: {
        type: 'string',
        description: 'Sfârșitul ferestrei cerute, ISO 8601',
      },
      minPallets: {
        type: 'integer',
        description: 'Paleți minimi necesari (opțional, omite dacă nu se cunoaște)',
      },
      minWeightTons: {
        type: 'number',
        description: 'Tonaj minim necesar (opțional, omite dacă nu se cunoaște)',
      },
    },
    required: ['windowStart', 'windowEnd'],
  },
  async execute(companyId, input) {
    const vehicles = await prisma.vehicle.findMany({
      where: {
        companyId,
        ...(input.minPallets ? { capacityPallets: { gte: input.minPallets } } : {}),
        ...(input.minWeightTons ? { capacityTons: { gte: input.minWeightTons } } : {}),
        trips: { none: overlappingActiveTrips(input.windowStart, input.windowEnd) },
      },
      orderBy: { plateNumber: 'asc' },
    });
    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      plateNumber: vehicle.plateNumber,
      type: vehicle.type,
      capacityTons: vehicle.capacityTons.toNumber(),
      capacityPallets: vehicle.capacityPallets,
      status: vehicle.status,
    }));
  },
});
