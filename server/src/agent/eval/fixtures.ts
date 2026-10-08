import { randomBytes } from 'node:crypto';
import type { CreateClientInput, CreateVehicleInput, VehicleDto } from '@fleetpilot/shared';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { register } from '../../services/auth.service';
import { createVehicle } from '../../services/vehicle.service';
import { addAbsence, createDriver } from '../../services/driver.service';
import { createClient } from '../../services/client.service';

export interface EvalCompany {
  companyId: string;
  userId: string;
}

const EVAL_PASSWORD = 'EvalParola123!';

// fiecare scenariu primește o firmă nouă, izolată — altfel starea unui scenariu
// (vehicule ocupate, șoferi în concediu) ar interfera cu alt scenariu, și eval-ul
// ar murdări baza de dev/seed a userului dacă ar refolosi firma demo
export async function createEvalCompany(label: string): Promise<EvalCompany> {
  const suffix = randomBytes(4).toString('hex');
  const { user } = await register({
    companyName: `Eval ${label} ${suffix}`,
    name: 'Dispecer Eval',
    email: `eval.${label}.${suffix}@fleetpilot.local`,
    password: EVAL_PASSWORD,
  });
  return { companyId: user.companyId, userId: user.id };
}

export async function deleteEvalCompany(companyId: string): Promise<void> {
  // cascadă din schema Prisma: users, vehicles, drivers, clients, trips, agent actions.
  // NU înghițim eroarea silențios — altfel firme eval rămase (DB lock, hiccup tranzitoriu)
  // s-ar acumula nevăzute la fiecare rulare, exact opusul izolării pe care vrem s-o garantăm
  // (găsit la code-review: `prisma.company.delete` nu era exercitat nicăieri altundeva în server)
  await prisma.company.delete({ where: { id: companyId } }).catch((err: unknown) => {
    logger.error(
      { err, companyId },
      'Eval agent: ștergerea firmei de test a eșuat — firmă orfană rămasă în DB',
    );
  });
}

export async function addVehicle(
  companyId: string,
  plateNumber: string,
  overrides: Partial<CreateVehicleInput> = {},
): Promise<VehicleDto> {
  const input: CreateVehicleInput = {
    plateNumber,
    type: 'VAN',
    capacityTons: 3.5,
    capacityPallets: 8,
    ...overrides,
  };
  return createVehicle(companyId, input);
}

export async function addDriver(companyId: string, label: string) {
  const suffix = randomBytes(3).toString('hex');
  return createDriver(companyId, {
    name: `Șofer Eval ${label}`,
    email: `driver.${label}.${suffix}@fleetpilot.local`,
    password: EVAL_PASSWORD,
    licenseCategories: ['B', 'C'],
  });
}

export async function addDriverOnLeave(
  companyId: string,
  label: string,
  startsAt: string,
  endsAt: string,
) {
  const driver = await addDriver(companyId, label);
  await addAbsence(companyId, driver.id, { type: 'VACATION', startsAt, endsAt });
  return driver;
}

export async function addClient(
  companyId: string,
  name: string,
  overrides: Partial<CreateClientInput> = {},
) {
  return createClient(companyId, { name, ...overrides });
}

// inserare directă (nu prin trip.service.createTrip) — fixture-ul testează agentul,
// nu rutarea OSRM/geocodarea; o cursă PLANIFICATĂ care "blochează" un vehicul/șofer
// pe o fereastră nu are nevoie de adrese reale sau de apeluri de rețea
export async function addBlockingTrip(
  companyId: string,
  createdById: string,
  clientId: string,
  vehicleId: string,
  driverId: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  await prisma.trip.create({
    data: {
      companyId,
      clientId,
      vehicleId,
      driverId,
      createdById,
      originAddress: 'Fixture — origine',
      destAddress: 'Fixture — destinație',
      cargoDescription: 'Marfă fixture (cursă de blocaj pentru eval)',
      pallets: 1,
      windowStart,
      windowEnd,
      status: 'PLANNED',
    },
  });
}
