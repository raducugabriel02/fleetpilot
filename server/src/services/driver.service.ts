import { Prisma } from '@prisma/client';
import type { Driver, DriverAbsence, User } from '@prisma/client';
import type {
  AbsenceDto,
  CreateAbsenceInput,
  CreateDriverInput,
  DriverDetailDto,
  DriverDto,
  ListDriversQuery,
  UpdateDriverInput,
} from '@fleetpilot/shared';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { isPrismaError } from '../lib/prisma-errors';
import { HttpError } from '../middleware/error';

type DriverWithUser = Driver & { user: User };

function toDriverDto(driver: DriverWithUser): DriverDto {
  return {
    id: driver.id,
    userId: driver.userId,
    name: driver.user.name,
    email: driver.user.email,
    phone: driver.phone,
    // coloana e String[] în DB, dar valorile intră exclusiv prin schema Zod
    licenseCategories: driver.licenseCategories as DriverDto['licenseCategories'],
    licenseExpiresAt: driver.licenseExpiresAt?.toISOString() ?? null,
    isActive: driver.user.isActive,
  };
}

function toAbsenceDto(absence: DriverAbsence): AbsenceDto {
  return {
    id: absence.id,
    type: absence.type,
    // coloana e @db.Date — expunem doar partea de dată, fără oră fictivă
    startsAt: absence.startsAt.toISOString().slice(0, 10),
    endsAt: absence.endsAt.toISOString().slice(0, 10),
    note: absence.note,
  };
}

async function findOwnedDriver(companyId: string, id: string): Promise<Driver> {
  const driver = await prisma.driver.findFirst({ where: { id, companyId } });
  if (!driver) {
    throw new HttpError(404, 'Șoferul nu există', 'DRIVER_NOT_FOUND');
  }
  return driver;
}

export async function listDrivers(
  companyId: string,
  query: ListDriversQuery,
): Promise<DriverDto[]> {
  const drivers = await prisma.driver.findMany({
    where: {
      companyId,
      ...(query.active === undefined ? {} : { user: { isActive: query.active } }),
    },
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  });
  return drivers.map(toDriverDto);
}

export async function getDriver(companyId: string, id: string): Promise<DriverDetailDto> {
  const driver = await prisma.driver.findFirst({
    where: { id, companyId },
    include: { user: true, absences: { orderBy: { startsAt: 'desc' } } },
  });
  if (!driver) {
    throw new HttpError(404, 'Șoferul nu există', 'DRIVER_NOT_FOUND');
  }
  return { ...toDriverDto(driver), absences: driver.absences.map(toAbsenceDto) };
}

export async function createDriver(
  companyId: string,
  input: CreateDriverInput,
): Promise<DriverDto> {
  const passwordHash = await hashPassword(input.password);
  // create imbricat = o singură tranzacție: dacă emailul e luat, nu rămâne profil orfan
  try {
    const driver = await prisma.driver.create({
      data: {
        company: { connect: { id: companyId } },
        phone: input.phone ?? null,
        licenseCategories: input.licenseCategories,
        licenseExpiresAt: input.licenseExpiresAt ?? null,
        user: {
          create: {
            email: input.email,
            passwordHash,
            name: input.name,
            role: 'DRIVER',
            company: { connect: { id: companyId } },
          },
        },
      },
      include: { user: true },
    });
    return toDriverDto(driver);
  } catch (err) {
    if (isPrismaError(err, 'P2002')) {
      throw new HttpError(409, 'Există deja un cont cu acest email', 'EMAIL_TAKEN');
    }
    throw err;
  }
}

export async function updateDriver(
  companyId: string,
  id: string,
  input: UpdateDriverInput,
): Promise<DriverDto> {
  const current = await findOwnedDriver(companyId, id);
  const driver = await prisma.driver.update({
    where: { id: current.id },
    data: {
      // undefined = câmp neatins; null = golit explicit (semantica PATCH)
      phone: input.phone,
      licenseCategories: input.licenseCategories,
      licenseExpiresAt: input.licenseExpiresAt,
      user: input.name === undefined ? undefined : { update: { name: input.name } },
    },
    include: { user: true },
  });
  return toDriverDto(driver);
}

export async function deactivateDriver(companyId: string, id: string): Promise<void> {
  const current = await findOwnedDriver(companyId, id);
  // Serializable: fără el, între count și update i se poate aloca o cursă șoferului
  // și am dezactiva un cont cu cursă activă. Operație rară, costul izolării nu contează.
  await prisma.$transaction(
    async (tx) => {
      const activeTrips = await tx.trip.count({
        where: { companyId, driverId: current.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      });
      if (activeTrips > 0) {
        throw new HttpError(
          409,
          'Șoferul are curse planificate sau în desfășurare',
          'DRIVER_HAS_ACTIVE_TRIPS',
        );
      }
      // dezactivare + revocarea sesiunilor împreună: un cont dezactivat nu mai poate
      // obține access token-uri noi din refresh token-urile rămase valide
      await tx.user.update({ where: { id: current.userId }, data: { isActive: false } });
      await tx.refreshToken.updateMany({
        where: { userId: current.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function activateDriver(companyId: string, id: string): Promise<DriverDto> {
  const current = await findOwnedDriver(companyId, id);
  const driver = await prisma.driver.update({
    where: { id: current.id },
    data: { user: { update: { isActive: true } } },
    include: { user: true },
  });
  return toDriverDto(driver);
}

export async function addAbsence(
  companyId: string,
  driverId: string,
  input: CreateAbsenceInput,
): Promise<AbsenceDto> {
  const current = await findOwnedDriver(companyId, driverId);
  // două intervale se suprapun dacă fiecare începe înainte să se termine celălalt
  const overlapping = await prisma.driverAbsence.findFirst({
    where: {
      driverId: current.id,
      startsAt: { lte: new Date(input.endsAt) },
      endsAt: { gte: new Date(input.startsAt) },
    },
  });
  if (overlapping) {
    throw new HttpError(409, 'Se suprapune cu o absență existentă', 'ABSENCE_OVERLAP');
  }
  const absence = await prisma.driverAbsence.create({
    data: {
      driverId: current.id,
      type: input.type,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      note: input.note ?? null,
    },
  });
  return toAbsenceDto(absence);
}

export async function removeAbsence(
  companyId: string,
  driverId: string,
  absenceId: string,
): Promise<void> {
  // deleteMany cu filtrarea pe tenant în where: ștergerea și verificarea sunt un singur pas
  const result = await prisma.driverAbsence.deleteMany({
    where: { id: absenceId, driver: { id: driverId, companyId } },
  });
  if (result.count === 0) {
    throw new HttpError(404, 'Absența nu există', 'ABSENCE_NOT_FOUND');
  }
}
