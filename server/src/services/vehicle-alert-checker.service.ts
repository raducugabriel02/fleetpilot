import { VEHICLE_DOCUMENT_SOON_THRESHOLD_DAYS } from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';
import { companyRoom, getIo } from '../realtime/socket';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
// întârziere după boot înainte de prima verificare: după un restart/deploy, socket-urile
// clienților au nevoie de o clipă să se reconecteze și să se alăture camerei firmei —
// o verificare instantanee la boot ar rata aproape mereu clienții abia reconectați
const BOOT_DELAY_MS = 10_000;

/*
 * Spre deosebire de late-trip-checker (evenimente unice, deduplicate cu un Set), aici
 * nu ținem stare: fiecare rulare recalculează totul din Vehicle și retrimite un rezumat
 * dacă mai există probleme — un dispecer care ignoră alerta o zi tot trebuie s-o vadă
 * a doua zi, cât timp documentul rămâne neînnoit.
 */
async function checkExpiringDocuments(): Promise<void> {
  const soonCutoff = new Date(
    Date.now() + VEHICLE_DOCUMENT_SOON_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );
  const now = new Date();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      OR: [
        { itpExpiresAt: { lte: soonCutoff } },
        { rcaExpiresAt: { lte: soonCutoff } },
        { vignetteExpiresAt: { lte: soonCutoff } },
      ],
    },
    select: {
      companyId: true,
      itpExpiresAt: true,
      rcaExpiresAt: true,
      vignetteExpiresAt: true,
    },
  });

  const byCompany = new Map<string, { expired: number; soon: number }>();
  for (const vehicle of vehicles) {
    const dates = [vehicle.itpExpiresAt, vehicle.rcaExpiresAt, vehicle.vignetteExpiresAt];
    const counts = byCompany.get(vehicle.companyId) ?? { expired: 0, soon: 0 };
    for (const date of dates) {
      if (!date || date > soonCutoff) continue;
      if (date < now) counts.expired++;
      else counts.soon++;
    }
    byCompany.set(vehicle.companyId, counts);
  }

  for (const [companyId, { expired, soon }] of byCompany) {
    if (expired === 0 && soon === 0) continue;
    const parts: string[] = [];
    if (expired > 0)
      parts.push(`${expired} document${expired > 1 ? 'e' : ''} expirat${expired > 1 ? 'e' : ''}`);
    if (soon > 0) parts.push(`${soon} document${soon > 1 ? 'e' : ''} care expiră curând`);
    getIo()
      .to(companyRoom(companyId))
      .emit('vehicle:alert', {
        message: `Flotă: ${parts.join(', ')} (ITP/RCA/rovinietă) — verifică pagina Vehicule`,
        expiredCount: expired,
        soonCount: soon,
      });
  }
}

let bootTimer: NodeJS.Timeout | null = null;
let interval: NodeJS.Timeout | null = null;

function runCheck(): void {
  checkExpiringDocuments().catch((err: unknown) => {
    console.error('[vehicle-alert-checker] eroare la verificare:', err);
  });
}

export function startVehicleAlertChecker(): void {
  if (bootTimer || interval) return;
  // prima rulare vine după BOOT_DELAY_MS (nu instant, nu la 24h) — vezi comentariul de mai sus
  bootTimer = setTimeout(() => {
    bootTimer = null;
    runCheck();
    interval = setInterval(runCheck, CHECK_INTERVAL_MS);
  }, BOOT_DELAY_MS);
}

export function stopVehicleAlertChecker(): void {
  if (bootTimer) {
    clearTimeout(bootTimer);
    bootTimer = null;
  }
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
