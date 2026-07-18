import type { Request, Response } from 'express';
import {
  assignTripSchema,
  createTripSchema,
  idParamSchema,
  listTripsQuerySchema,
  updateTripSchema,
} from '@fleetpilot/shared';
import type { TripDetailDto, TripDto } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as tripService from '../services/trip.service';

export async function list(req: Request, res: Response<TripDto[]>): Promise<void> {
  const { companyId } = getAuth(req);
  const query = listTripsQuerySchema.parse(req.query);
  res.json(await tripService.listTrips(companyId, query));
}

export async function getById(req: Request, res: Response<TripDetailDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await tripService.getTrip(companyId, id));
}

export async function recalcRoute(req: Request, res: Response<TripDetailDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await tripService.recalculateRoute(companyId, id));
}

export async function create(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId, userId } = getAuth(req);
  const input = createTripSchema.parse(req.body);
  res.status(201).json(await tripService.createTrip(companyId, userId, input));
}

export async function update(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = updateTripSchema.parse(req.body);
  res.json(await tripService.updateTrip(companyId, id, input));
}

export async function assign(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const input = assignTripSchema.parse(req.body);
  res.json(await tripService.assignTrip(companyId, id, input));
}

export async function start(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await tripService.startTrip(companyId, id));
}

export async function complete(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await tripService.completeTrip(companyId, id));
}

export async function cancel(req: Request, res: Response<TripDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  res.json(await tripService.cancelTrip(companyId, id));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  await tripService.deleteTrip(companyId, id);
  res.status(204).end();
}
