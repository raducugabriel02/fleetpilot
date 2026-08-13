import { z } from 'zod';
import { resolveTripRoute } from '../../services/routing.service';
import { defineTool } from './types';

const inputSchema = z.object({
  originAddress: z.string().trim().min(3).max(200),
  destAddress: z.string().trim().min(3).max(200),
});

export const calculateRouteTool = defineTool({
  name: 'calculate_route',
  description:
    'Calculează distanța (km) și durata estimată (minute) de condus între două adrese din România, prin geocodare + rutare rutieră reală. Dacă adresele nu pot fi găsite sau serviciul e temporar indisponibil, întoarce found: false — agentul nu trebuie să inventeze o distanță în acest caz.',
  inputSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      originAddress: { type: 'string', description: 'Adresa/orașul de plecare' },
      destAddress: { type: 'string', description: 'Adresa/orașul de destinație' },
    },
    required: ['originAddress', 'destAddress'],
  },
  async execute(_companyId, input) {
    const route = await resolveTripRoute(input.originAddress, input.destAddress);
    if (route.distanceKm === null || route.durationMin === null) {
      return { found: false };
    }
    return { found: true, distanceKm: route.distanceKm, durationMin: route.durationMin };
  },
});
