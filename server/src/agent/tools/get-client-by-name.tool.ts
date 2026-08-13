import { z } from 'zod';
import { prisma } from '../../lib/prisma';
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
    const clients = await prisma.client.findMany({
      where: { companyId, name: { contains: input.name, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      take: 5,
    });
    return clients.map((client) => ({
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      phone: client.phone,
    }));
  },
});
