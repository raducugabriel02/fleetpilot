import type { Request, Response } from 'express';
import {
  createVehicleSchema,
  idParamSchema,
  listVehiclesQuerySchema,
  updateVehicleSchema,
} from '@fleetpilot/shared';
import type { VehicleDto } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as vehicleService from '../services/vehicle.service';

export async function list(req: Request, res: Response<VehicleDto[]>): Promise<void> {
  const { companyId } = getAuth(req);
  const query = listVehiclesQuerySchema.parse(req.query);
  res.json(await vehicleService.listVehicles(companyId, query));
}

export async function getById(req: Request, res: Response<VehicleDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await vehicleService.getVehicle(companyId, id));
}

export async function create(req: Request, res: Response<VehicleDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const input = createVehicleSchema.parse(req.body);
  res.status(201).json(await vehicleService.createVehicle(companyId, input));
}

export async function update(req: Request, res: Response<VehicleDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = updateVehicleSchema.parse(req.body);
  res.json(await vehicleService.updateVehicle(companyId, id, input));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  await vehicleService.deleteVehicle(companyId, id);
  res.status(204).end();
}
