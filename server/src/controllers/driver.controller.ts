import type { Request, Response } from 'express';
import {
  absenceParamsSchema,
  createAbsenceSchema,
  createDriverSchema,
  idParamSchema,
  listDriversQuerySchema,
  updateDriverSchema,
} from '@fleetpilot/shared';
import type { AbsenceDto, DriverDetailDto, DriverDto } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as driverService from '../services/driver.service';

export async function list(req: Request, res: Response<DriverDto[]>): Promise<void> {
  const { companyId } = getAuth(req);
  const query = listDriversQuerySchema.parse(req.query);
  res.json(await driverService.listDrivers(companyId, query));
}

export async function getById(req: Request, res: Response<DriverDetailDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await driverService.getDriver(companyId, id));
}

export async function create(req: Request, res: Response<DriverDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const input = createDriverSchema.parse(req.body);
  res.status(201).json(await driverService.createDriver(companyId, input));
}

export async function update(req: Request, res: Response<DriverDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = updateDriverSchema.parse(req.body);
  res.json(await driverService.updateDriver(companyId, id, input));
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  await driverService.deactivateDriver(companyId, id);
  res.status(204).end();
}

export async function activate(req: Request, res: Response<DriverDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await driverService.activateDriver(companyId, id));
}

export async function addAbsence(req: Request, res: Response<AbsenceDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = createAbsenceSchema.parse(req.body);
  res.status(201).json(await driverService.addAbsence(companyId, id, input));
}

export async function removeAbsence(req: Request, res: Response): Promise<void> {
  const { companyId } = getAuth(req);
  const { id, absenceId } = absenceParamsSchema.parse(req.params);
  await driverService.removeAbsence(companyId, id, absenceId);
  res.status(204).end();
}
