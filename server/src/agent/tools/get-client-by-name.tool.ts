import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { normalizeForSearch } from '../../lib/normalize';
import { defineTool } from './types';

const inputSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const getClientByNameTool = defineTool({
  name: 'get_client_by_name',
  description:
    'Caută clienți ai firmei după nume (potrivire parțială, fără sensibilitate la majuscule). Întoarce lista de potriviri (maxim 5) — dacă e goală, clientul nu există în sistem și agentul trebuie să întrebe dacă e client nou, NU să-l inventeze sau să aleagă alt client asemănător fără confirmare.',
  inputSchema,
  jsonSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Numele (sau parte din nume) clientului menționat de dispecer',
      },
    },
    required: ['name'],
  },
  async execute(companyId, input) {
    // dispecerul scrie des fără diacritice ("Panificatie") — `contains insensitive` din
    // Postgres normalizează case-ul, nu diacriticele, deci filtrăm în JS (vezi normalize.ts)
    const needle = normalizeForSearch(input.name);
    const clients = await prisma.client.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    const matches = clients
      .filter((client) => normalizeForSearch(client.name).includes(needle))
      .slice(0, 5);
    return matches.map((client) => ({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      phone: client.phone,
    }));
  },
});
