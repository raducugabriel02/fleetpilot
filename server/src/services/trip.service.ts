import { Prisma } from '@prisma/client';
import type {
  AssignTripInput,
  CreateTripInput,
  ListTripsQuery,
  TripDto,
  UpdateTripInput,
} from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';
import { isPrismaError } from '../lib/prisma-errors';
import { HttpError } from '../middleware/error';

const tripInclude = {
  client: true,
  vehicle: true,
  driver: { include: { user: true } },
} satisfies Prisma.TripInclude;

type TripWithRelations = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

function toTripDto(trip: TripWithRelations): TripDto {
  return {
    id: trip.id,
    client: { id: trip.client.id, name: trip.client.name },
    vehicle: trip.vehicle ? { id: trip.vehicle.id, plateNumber: trip.vehicle.plateNumber } : null,
    driver: trip.driver ? { id: trip.driver.id, name: trip.driver.user.name } : null,
    originAddress: trip.originAddress,
    destAddress: trip.destAddress,
    cargoDescription: trip.cargoDescription,
    pallets: trip.pallets,
    weightTons: trip.weightTons?.toNumber() ?? null,
    windowStart: trip.windowStart.toISOString(),
    windowEnd: trip.windowEnd.toISOString(),
    status: trip.status,
    distanceKm: trip.distanceKm,
    durationMin: trip.durationMin,
    startedAt: trip.startedAt?.toISOString() ?? null,
    completedAt: trip.completedAt?.toISOString() ?? null,
    createdAt: trip.createdAt.toISOString(),
  };
}

async function findOwnedTrip(companyId: string, id: string): Promise<TripWithRelations> {
  const trip = await prisma.trip.findFirst({ where: { id, companyId }, include: tripInclude });
  if (!trip) {
    throw new HttpError(404, 'Cursa nu există', 'TRIP_NOT_FOUND');
  }
  return trip;
}

async function assertOwnedClient(
  tx: Prisma.TransactionClient,
  companyId: string,
  clientId: string,
): Promise<void> {
  const client = await tx.client.findFirst({ where: { id: clientId, companyId } });
  if (!client) {
    throw new HttpError(404, 'Clientul nu există', 'CLIENT_NOT_FOUND');
  }
}

// două ferestre [aStart, aEnd) și [bStart, bEnd) se suprapun dacă fiecare începe înaintea sfârșitului celeilalte
function overlapsWindow(windowStart: Date, windowEnd: Date): Prisma.TripWhereInput {
  return { windowStart: { lt: windowEnd }, windowEnd: { gt: windowStart } };
}

/*
 * Absențele sunt @db.Date (miezul nopții UTC), deci comparăm pe zile întregi.
 * Trunchierea în UTC ignoră fusul României — acceptabil în v1: diferența contează
 * doar pentru curse programate în primele 2-3 ore ale zilei de graniță.
 * Comparația pe zile e inclusivă la ambele capete (spre deosebire de ferestrele
 * half-open): o fereastră care doar atinge miezul nopții blochează pe absența acelei
 * zile — conservator intenționat, mai bine un refuz în plus decât un șofer lipsă.
 */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function listTrips(companyId: string, query: ListTripsQuery): Promise<TripDto[]> {
  const trips = await prisma.trip.findMany({
    where: {
      companyId,
      status: query.status,
      clientId: query.clientId,
      // "curse care ating intervalul [from, to]" — filtrele merg și separat
      ...(query.from ? { windowEnd: { gte: query.from } } : {}),
      ...(query.to ? { windowStart: { lte: query.to } } : {}),
    },
    include: tripInclude,
    orderBy: { windowStart: 'desc' },
  });
  return trips.map(toTripDto);
}

export async function getTrip(companyId: string, id: string): Promise<TripDto> {
  return toTripDto(await findOwnedTrip(companyId, id));
}

export async function createTrip(
  companyId: string,
  createdById: string,
  input: CreateTripInput,
): Promise<TripDto> {
  await assertOwnedClient(prisma, companyId, input.clientId);
  try {
    const trip = await prisma.trip.create({
      data: { companyId, createdById, ...input },
      include: tripInclude,
    });
    return toTripDto(trip);
  } catch (err) {
    // clientul poate dispărea între verificare și create; FK-ul îl prinde
    if (isPrismaError(err, 'P2003')) {
      throw new HttpError(404, 'Clientul nu există', 'CLIENT_NOT_FOUND');
    }
    throw err;
  }
}

export async function updateTrip(
  companyId: string,
  id: string,
  input: UpdateTripInput,
): Promise<TripDto> {
  const current = await findOwnedTrip(companyId, id);
  if (current.status !== 'REQUEST' && current.status !== 'PLANNED') {
    throw new HttpError(409, 'Doar cursele neîncepute se pot edita', 'TRIP_LOCKED');
  }
  // PLANNED = alocare validată (fereastră, capacitate, absențe); schimbarea acestor câmpuri
  // ar invalida-o pe ușa din spate, deci pe PLANNED ele se schimbă doar prin re-assign
  const allocationFields = ['windowStart', 'windowEnd', 'pallets', 'weightTons'] as const;
  if (
    current.status === 'PLANNED' &&
    allocationFields.some((field) => input[field] !== undefined)
  ) {
    throw new HttpError(
      409,
      'Cursa e planificată: fereastra și încărcătura se schimbă doar prin re-alocare',
      'TRIP_PLANNED',
    );
  }
  if (input.clientId) {
    await assertOwnedClient(prisma, companyId, input.clientId);
  }
  // fereastra validată încrucișat cu valorile existente când vine doar un capăt
  const windowStart = input.windowStart ?? current.windowStart;
  const windowEnd = input.windowEnd ?? current.windowEnd;
  if (windowStart >= windowEnd) {
    throw new HttpError(400, 'Fereastra trebuie să se termine după ce începe', 'INVALID_WINDOW');
  }
  try {
    // statusul rămâne în where: blocăm atomic editarea dacă între timp cursa a pornit
    const trip = await prisma.trip.update({
      where: { id: current.id, status: { in: ['REQUEST', 'PLANNED'] } },
      data: input,
      include: tripInclude,
    });
    return toTripDto(trip);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Doar cursele neîncepute se pot edita', 'TRIP_LOCKED');
    }
    throw err;
  }
}

export async function assignTrip(
  companyId: string,
  id: string,
  input: AssignTripInput,
): Promise<TripDto> {
  // Serializable: verificările de conflict și scrierea trebuie să fie un tot atomic,
  // altfel două alocări concurente pot rezerva același vehicul/șofer pe aceeași fereastră
  try {
    const trip = await prisma.$transaction(
      async (tx) => {
        // cursa se citește ÎN tranzacție: fereastra/încărcătura validate mai jos trebuie să fie
        // exact cele scrise; un PATCH concurent ar face un snapshot din afara tx-ului mincinos
        const current = await tx.trip.findFirst({ where: { id, companyId } });
        if (!current) {
          throw new HttpError(404, 'Cursa nu există', 'TRIP_NOT_FOUND');
        }
        if (current.status !== 'REQUEST' && current.status !== 'PLANNED') {
          throw new HttpError(409, 'Doar cursele neîncepute se pot aloca', 'TRIP_LOCKED');
        }
        // vehiculul IN_SERVICE se poate aloca intenționat (planificare în avans);
        // start-ul refuză oricum pornirea până nu redevine AVAILABLE
        const vehicle = await tx.vehicle.findFirst({
          where: { id: input.vehicleId, companyId },
        });
        if (!vehicle) {
          throw new HttpError(404, 'Vehiculul nu există', 'VEHICLE_NOT_FOUND');
        }
        const driver = await tx.driver.findFirst({
          where: { id: input.driverId, companyId },
          include: { user: true },
        });
        if (!driver) {
          throw new HttpError(404, 'Șoferul nu există', 'DRIVER_NOT_FOUND');
        }
        if (!driver.user.isActive) {
          throw new HttpError(409, 'Șoferul e dezactivat', 'DRIVER_INACTIVE');
        }

        if (current.pallets !== null && current.pallets > vehicle.capacityPallets) {
          throw new HttpError(409, 'Vehiculul nu are loc de atâția paleți', 'CAPACITY_EXCEEDED');
        }
        if (current.weightTons !== null && current.weightTons.gt(vehicle.capacityTons)) {
          throw new HttpError(409, 'Marfa depășește tonajul vehiculului', 'CAPACITY_EXCEEDED');
        }

        const absence = await tx.driverAbsence.findFirst({
          where: {
            driverId: driver.id,
            startsAt: { lte: utcDay(current.windowEnd) },
            endsAt: { gte: utcDay(current.windowStart) },
          },
        });
        if (absence) {
          throw new HttpError(409, 'Șoferul e în concediu în fereastra cursei', 'DRIVER_ABSENT');
        }

        const busy: Prisma.TripWhereInput = {
          companyId,
          id: { not: current.id },
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          ...overlapsWindow(current.windowStart, current.windowEnd),
        };
        if (await tx.trip.findFirst({ where: { ...busy, vehicleId: vehicle.id } })) {
          throw new HttpError(409, 'Vehiculul are altă cursă în acea fereastră', 'VEHICLE_BUSY');
        }
        if (await tx.trip.findFirst({ where: { ...busy, driverId: driver.id } })) {
          throw new HttpError(409, 'Șoferul are altă cursă în acea fereastră', 'DRIVER_BUSY');
        }

        return tx.trip.update({
          where: { id: current.id, status: { in: ['REQUEST', 'PLANNED'] } },
          data: { vehicleId: vehicle.id, driverId: driver.id, status: 'PLANNED' },
          include: tripInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toTripDto(trip);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Doar cursele neîncepute se pot aloca', 'TRIP_LOCKED');
    }
    if (isPrismaError(err, 'P2034')) {
      throw new HttpError(409, 'Altă alocare era în curs; reîncearcă', 'TX_CONFLICT');
    }
    throw err;
  }
}

export async function startTrip(companyId: string, id: string): Promise<TripDto> {
  const current = await findOwnedTrip(companyId, id);
  if (current.status !== 'PLANNED') {
    throw new HttpError(409, 'Doar cursele planificate se pot porni', 'TRIP_NOT_PLANNED');
  }
  // șoferul poate dispărea după assign (onDelete: SetNull la ștergerea contului)
  if (!current.vehicleId || !current.driverId) {
    throw new HttpError(409, 'Cursa nu mai are vehicul și șofer alocați', 'TRIP_UNASSIGNED');
  }
  const vehicleId = current.vehicleId;
  const driverId = current.driverId;

  try {
    const trip = await prisma.$transaction(
      async (tx) => {
        // assign a verificat șoferul la planificare, dar între timp putea fi dezactivat
        // sau blocat într-o cursă precedentă care a depășit fereastra
        const driver = await tx.driver.findFirst({
          where: { id: driverId, companyId },
          include: { user: true },
        });
        if (!driver || !driver.user.isActive) {
          throw new HttpError(409, 'Șoferul nu mai e activ', 'DRIVER_INACTIVE');
        }
        const driverBusy = await tx.trip.findFirst({
          where: { companyId, driverId, status: 'IN_PROGRESS' },
        });
        if (driverBusy) {
          throw new HttpError(409, 'Șoferul e deja într-o cursă în desfășurare', 'DRIVER_BUSY');
        }
        // statusul AVAILABLE în where prinde atomic vehiculul plecat între timp în altă cursă sau în service
        await tx.vehicle.update({
          where: { id: vehicleId, companyId, status: 'AVAILABLE' },
          data: { status: 'ON_TRIP' },
        });
        return tx.trip.update({
          where: { id: current.id, status: 'PLANNED' },
          data: { status: 'IN_PROGRESS', startedAt: new Date() },
          include: tripInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return toTripDto(trip);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(
        409,
        'Vehiculul nu e disponibil acum (în altă cursă sau în service)',
        'VEHICLE_UNAVAILABLE',
      );
    }
    if (isPrismaError(err, 'P2034')) {
      throw new HttpError(409, 'Altă operație era în curs; reîncearcă', 'TX_CONFLICT');
    }
    throw err;
  }
}

export async function completeTrip(companyId: string, id: string): Promise<TripDto> {
  const current = await findOwnedTrip(companyId, id);
  if (current.status !== 'IN_PROGRESS') {
    throw new HttpError(409, 'Doar cursele în desfășurare se pot finaliza', 'TRIP_NOT_IN_PROGRESS');
  }

  try {
    const trip = await prisma.$transaction(async (tx) => {
      const completed = await tx.trip.update({
        where: { id: current.id, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
        include: tripInclude,
      });
      if (current.vehicleId) {
        // updateMany, tolerant: dacă vehiculul nu mai e ON_TRIP (caz anormal), finalizarea nu pică
        await tx.vehicle.updateMany({
          where: { id: current.vehicleId, companyId, status: 'ON_TRIP' },
          data: { status: 'AVAILABLE' },
        });
      }
      return completed;
    });
    return toTripDto(trip);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Cursa nu mai e în desfășurare', 'TRIP_NOT_IN_PROGRESS');
    }
    throw err;
  }
}

export async function cancelTrip(companyId: string, id: string): Promise<TripDto> {
  const current = await findOwnedTrip(companyId, id);
  try {
    const trip = await prisma.trip.update({
      where: { id: current.id, status: { in: ['REQUEST', 'PLANNED'] } },
      data: { status: 'CANCELLED' },
      include: tripInclude,
    });
    return toTripDto(trip);
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Doar cursele neîncepute se pot anula', 'TRIP_LOCKED');
    }
    throw err;
  }
}

export async function deleteTrip(companyId: string, id: string): Promise<void> {
  const current = await findOwnedTrip(companyId, id);
  try {
    // doar cererile greșite se șterg; cursele planificate se anulează, ca să rămână istoric
    await prisma.trip.delete({ where: { id: current.id, status: 'REQUEST' } });
  } catch (err) {
    if (isPrismaError(err, 'P2025')) {
      throw new HttpError(409, 'Doar cererile nealocate se pot șterge; anuleaz-o', 'TRIP_LOCKED');
    }
    throw err;
  }
}
