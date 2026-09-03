import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { routeLabel } from '../lib/route-label';
import { companyRoom, getIo } from '../realtime/socket';

const CHECK_INTERVAL_MS = 15_000;

// independent de simulatorul GPS: o cursă fără geometrie de rută cunoscută (geocodare
// eșuată) tot trebuie semnalată ca întârziată dacă îi trece fereastra — detecția nu
// poate depinde de faptul că simularea a putut sau nu să pornească
const notifiedLate = new Set<string>();

async function checkLateTrips(): Promise<void> {
  const late = await prisma.trip.findMany({
    where: { status: 'IN_PROGRESS', windowEnd: { lt: new Date() } },
    select: { id: true, companyId: true, originAddress: true, destAddress: true },
  });

  for (const trip of late) {
    if (notifiedLate.has(trip.id)) continue;
    notifiedLate.add(trip.id);
    getIo()
      .to(companyRoom(trip.companyId))
      .emit('trip:notification', {
        tripId: trip.id,
        kind: 'LATE',
        message: `Cursa ${routeLabel(trip)} a depășit fereastra de livrare`,
      });
  }
}

/** o cursă poate redeveni „nouă" din perspectiva verificării dacă vreodată se repornește
 * (nu e cazul azi), sau pur și simplu ca să nu creștem Set-ul la nesfârșit după finalizare */
export function clearNotifiedLate(tripId: string): void {
  notifiedLate.delete(tripId);
}

let timer: NodeJS.Timeout | null = null;

export function startLateTripChecker(): void {
  if (timer) return;
  timer = setInterval(() => {
    checkLateTrips().catch((err: unknown) => {
      logger.error({ err }, '[late-trip-checker] eroare la verificare');
    });
  }, CHECK_INTERVAL_MS);
}

export function stopLateTripChecker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
