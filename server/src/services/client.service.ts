import type { Client } from '@prisma/client';
import type {
  ClientDto,
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';
import { normalizeForSearch } from '../lib/normalize';
import { isPrismaError } from '../lib/prisma-errors';
import { HttpError } from '../middleware/error';

function toClientDto(client: Client): ClientDto {
  return {
    id: client.id,
    name: client.name,
    contactName: client.contactName,
    phone: client.phone,
    email: client.email,
    address: client.address,
  };
}

async function findOwnedClient(companyId: string, id: string): Promise<Client> {
  const client = await prisma.client.findFirst({ where: { id, companyId } });
  if (!client) {
    throw new HttpError(404, 'Clientul nu există', 'CLIENT_NOT_FOUND');
  }
  return client;
}

// @@unique([companyId, name]) e case-sensitive ȘI diacritic-sensitive în Postgres, dar
// search-ul și get_client_by_name (Faza 4) caută insensitiv la ambele — „AGROFRIG" sau
// „Panificatie" (fără diacritice) lângă „Agrofrig"/„Panificație" ar fi duplicate pe care
// agentul le-ar putea confunda (2 potriviri pentru aceeași cerere, fără cale să aleagă).
// Constraint-ul rămâne backstop pentru race-urile exacte (P2002); verificarea asta
// acoperă variantele de casing/diacritice, la fel ca listClients/get_client_by_name.
async function assertNameFree(companyId: string, name: string, excludeId?: string): Promise<void> {
  const needle = normalizeForSearch(name);
  const candidates = await prisma.client.findMany({
    where: { companyId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { name: true },
  });
  const taken = candidates.some((c) => normalizeForSearch(c.name) === needle);
  if (taken) {
    throw new HttpError(409, 'Există deja un client cu acest nume', 'CLIENT_NAME_TAKEN');
  }
}

export async function listClients(
  companyId: string,
  query: ListClientsQuery,
): Promise<ClientDto[]> {
  // filtrare în JS, nu `contains` la nivel de Postgres: `mode: 'insensitive'` normalizează
  // doar case-ul, nu diacriticele ("Panificatie" nu ar găsi "Panificație" din DB). Volum
  // mic pe scara firmelor țintă (2-20 camioane => zeci de clienți), deci acceptabil —
  // același raționament ca agregarea in-memory din report.service.ts.
  const clients = await prisma.client.findMany({
    where: { companyId },
    orderBy: { name: 'asc' },
  });
  if (!query.search) return clients.map(toClientDto);
  const needle = normalizeForSearch(query.search);
  return clients
    .filter((client) => normalizeForSearch(client.name).includes(needle))
    .map(toClientDto);
}

export async function getClient(companyId: string, id: string): Promise<ClientDto> {
  return toClientDto(await findOwnedClient(companyId, id));
}

export async function createClient(
  companyId: string,
  input: CreateClientInput,
): Promise<ClientDto> {
  await assertNameFree(companyId, input.name);
  try {
    const client = await prisma.client.create({
      data: {
        companyId,
        name: input.name,
        contactName: input.contactName ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
      },
    });
    return toClientDto(client);
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      throw new HttpError(409, 'Există deja un client cu acest nume', 'CLIENT_NAME_TAKEN');
    }
    throw err;
  }
}

export async function updateClient(
  companyId: string,
  id: string,
  input: UpdateClientInput,
): Promise<ClientDto> {
  const current = await findOwnedClient(companyId, id);
  if (input.name !== undefined) {
    await assertNameFree(companyId, input.name, current.id);
  }
  try {
    const client = await prisma.client.update({ where: { id: current.id }, data: input });
    return toClientDto(client);
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      throw new HttpError(409, 'Există deja un client cu acest nume', 'CLIENT_NAME_TAKEN');
    }
    throw err;
  }
}

export async function deleteClient(companyId: string, id: string): Promise<void> {
  const current = await findOwnedClient(companyId, id);
  // Trip.clientId are onDelete: Restrict — baza refuză ștergerea unui client cu curse,
  // deci nu e nevoie de pre-check care ar putea fi ocolit de un insert concurent
  try {
    await prisma.client.delete({ where: { id: current.id } });
  } catch (err) {
    if (isPrismaError(err, 'P2003')) {
      throw new HttpError(
        409,
        'Clientul are curse înregistrate; nu poate fi șters',
        'CLIENT_HAS_TRIPS',
      );
    }
    throw err;
  }
}
