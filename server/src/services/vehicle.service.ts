import { Prisma } from '@prisma/client';
import type { Vehicle } from '@prisma/client';
import type {
  CreateVehicleInput,
  ListVehiclesQuery,
  UpdateVehicleInput,
  VehicleDto,
} from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';

// Prisma Decimal și Date nu se serializează cum vrem în JSON; DTO-ul e contractul cu clientul
function toVehicleDto(vehicle: Vehicle): VehicleDto {
  return {
    id: vehicle.id,
    plateNumber: vehicle.plateNumber,
    type: vehicle.type,
    capacityTons: vehicle.capacityTons.toNumber(),
    capacityPallets: vehicle.capacityPallets,
    status: vehicle.status,
    itpExpiresAt: vehicle.itpExpiresAt?.toISOString() ?? null,
    rcaExpiresAt: vehicle.rcaExpiresAt?.toISOString() ?? null,
    vignetteExpiresAt: vehicle.vignetteExpiresAt?.toISOString() ?? null,
  };
}

function isPrismaError(err: unknown, code: 'P2002' | 'P2025'): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === code;
}

async function findOwnedVehicle(companyId: string, id: string): Promise<Vehicle> {
  // filtrarea pe companyId garantează că un tenant nu poate atinge vehiculele altuia,
  // nici măcar dacă ghicește un id valid
  const vehicle = await prisma.vehicle.findFirst({ where: { id, companyId } });
  if (!vehicle) {
    throw new HttpError(404, 'Vehiculul nu există', 'VEHICLE_NOT_FOUND');
  }
  return vehicle;
}

export async function listVehicles(
  companyId: string,
  query: ListVehiclesQuery,
): Promise<VehicleDto[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { companyId, status: query.status },
    orderBy: { plateNumber: 'asc' },
  });
  return vehicles.map(toVehicleDto);
}

export async function getVehicle(companyId: string, id: string): Promise<VehicleDto> {
  return toVehicleDto(await findOwnedVehicle(companyId, id));
}

export async function createVehicle(
  companyId: string,
  input: CreateVehicleInput,
): Promise<VehicleDto> {
  // fără pre-check: unicitatea o garantează doar constraint-ul @@unique([companyId, plateNumber]),
  // altfel două request-uri concurente ar trece amândouă de verificare
  try {
    const vehicle = await prisma.vehicle.create({ data: { companyId, ...input } });
    return toVehicleDto(vehicle);
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      throw new HttpError(409, 'Există deja un vehicul cu acest număr', 'PLATE_TAKEN');
    }
    throw err;
  }
}

export async function updateVehicle(
  companyId: string,
  id: string,
  input: UpdateVehicleInput,
): Promise<VehicleDto> {
  const current = await findOwnedVehicle(companyId, id);
  // statusul ON_TRIP e gestionat de sistem: schimbarea manuală e blocată atomic, în where,
  // ca să nu existe fereastră între citire și scriere în care vehiculul intră în cursă
  const where: Prisma.VehicleWhereUniqueInput = input.status
    ? { id: current.id, status: { not: 'ON_TRIP' } }
    : { id: current.id };
  try {
    const vehicle = await prisma.vehicle.update({ where, data: input });
    return toVehicleDto(vehicle);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(
        409,
        'Vehiculul e în cursă; statusul se schimbă la finalul ei',
        'VEHICLE_ON_TRIP',
      );
    }
    if (isPrismaError(err, 'P2002')) {
      throw new HttpError(409, 'Există deja un vehicul cu acest număr', 'PLATE_TAKEN');
    }
    throw err;
  }
}

export async function deleteVehicle(companyId: string, id: string): Promise<void> {
  const current = await findOwnedVehicle(companyId, id);
  try {
    await prisma.vehicle.delete({ where: { id: current.id, status: { not: 'ON_TRIP' } } });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Nu poți șterge un vehicul aflat în cursă', 'VEHICLE_ON_TRIP');
    }
    throw err;
  }
}
