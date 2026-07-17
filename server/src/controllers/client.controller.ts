import type { Request, Response } from 'express';
import {
  createClientSchema,
  idParamSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from '@fleetpilot/shared';
import type { ClientDto } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as clientService from '../services/client.service';

export async function list(req: Request, res: Response<ClientDto[]>): Promise<void> {
  const { companyId } = getAuth(req);
  const query = listClientsQuerySchema.parse(req.query);
  res.json(await clientService.listClients(companyId, query));
}

export async function getById(req: Request, res: Response<ClientDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await clientService.getClient(companyId, id));
}

export async function create(req: Request, res: Response<ClientDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const input = createClientSchema.parse(req.body);
  res.status(201).json(await clientService.createClient(companyId, input));
}

export async function update(req: Request, res: Response<ClientDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = updateClientSchema.parse(req.body);
  res.json(await clientService.updateClient(companyId, id, input));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  await clientService.deleteClient(companyId, id);
  res.status(204).end();
}
