import type { MonthlyReportDto, MonthlyReportQuery } from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// lună ca [start, end) în UTC — aceeași simplificare acceptată ca la absențele
// șoferilor (DriverAbsence): ignoră fusul României, contează doar la marginile lunii
function monthRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export async function getMonthlyReport(
  companyId: string,
  query: MonthlyReportQuery,
): Promise<MonthlyReportDto> {
  const { start, end } = monthRange(query.month);

  const trips = await prisma.trip.findMany({
    where: { companyId, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
    select: {
      distanceKm: true,
      completedAt: true,
      windowEnd: true,
      client: { select: { id: true, name: true } },
      vehicle: { select: { id: true, plateNumber: true } },
    },
  });

  const totalDistanceKm = trips.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0);
  // completedAt e mereu setat pe COMPLETED — verificarea e doar pt. tipul strict al lui TS
  const onTimeCount = trips.filter((t) => t.completedAt && t.completedAt <= t.windowEnd).length;
  const onTimePercent =
    trips.length > 0 ? Math.round((onTimeCount / trips.length) * 1000) / 10 : null;

  const clientCounts = new Map<string, { name: string; tripCount: number }>();
  for (const t of trips) {
    const entry = clientCounts.get(t.client.id) ?? { name: t.client.name, tripCount: 0 };
    entry.tripCount++;
    clientCounts.set(t.client.id, entry);
  }
  const topClients = [...clientCounts.entries()]
    .map(([clientId, v]) => ({ clientId, ...v }))
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, 5);

  const vehicleStats = new Map<
    string,
    { plateNumber: string; tripCount: number; distanceKm: number }
  >();
  for (const t of trips) {
    if (!t.vehicle) continue;
    const entry = vehicleStats.get(t.vehicle.id) ?? {
      plateNumber: t.vehicle.plateNumber,
      tripCount: 0,
      distanceKm: 0,
    };
    entry.tripCount++;
    entry.distanceKm += t.distanceKm ?? 0;
    vehicleStats.set(t.vehicle.id, entry);
  }
  const vehicleUtilization = [...vehicleStats.entries()]
    .map(([vehicleId, v]) => ({ vehicleId, ...v, distanceKm: round1(v.distanceKm) }))
    .sort((a, b) => b.tripCount - a.tripCount);

  return {
    month: query.month,
    completedTrips: trips.length,
    totalDistanceKm: round1(totalDistanceKm),
    onTimePercent,
    topClients,
    vehicleUtilization,
  };
}
