import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { overlappingActiveTrips, utcDay } from '../lib/schedule';
import { defineTool } from './types';

const inputSchema = z
  .object({
    windowStart: z.coerce.date('windowStart invalid'),
    windowEnd: z.coerce.date('windowEnd invalid'),
  })
  .refine((value) => value.windowStart < value.windowEnd, 'windowEnd trebuie după windowStart');

export const getAvailableDriversTool = defineTool({
  name: 'get_available_drivers',
  description:
    'Găsește șoferii activi ai firmei care NU sunt în concediu/absență și nu au nicio cursă PLANIFICATĂ sau ÎN DESFĂȘURARE care se suprapune cu fereastra de timp dată. Șoferii dezactivați sau în concediu în acea perioadă nu apar deloc în rezultat.',
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
    },
    required: ['windowStart', 'windowEnd'],
  },
  async execute(companyId, input) {
    const drivers = await prisma.driver.findMany({
      where: {
        companyId,
        user: { isActive: true },
        absences: {
          none: {
            startsAt: { lte: utcDay(input.windowEnd) },
            endsAt: { gte: utcDay(input.windowStart) },
          },
        },
        trips: { none: overlappingActiveTrips(input.windowStart, input.windowEnd) },
      },
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });
    return drivers.map((driver) => ({
      id: driver.id,
      name: driver.user.name,
      phone: driver.phone,
      licenseCategories: driver.licenseCategories,
    }));
  },
});
