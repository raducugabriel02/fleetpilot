import type { RouteGeometry } from '@fleetpilot/shared';
import { prisma } from '../lib/prisma';
import { companyRoom, getIo } from '../realtime/socket';

export interface SimulationParams {
  tripId: string;
  companyId: string;
  vehicleId: string;
  route: RouteGeometry;
  durationMin: number;
  accelerated: boolean;
}

const TICK_MS = 5_000;
// „accelerare": o cursă de 3h simulată în 3 min => timpul simulat curge de 60x mai repede
const ACCELERATED_FACTOR = 60;
// șansă de pauză exprimată per oră de condus SIMULAT (nu per tick real) — altfel modul
// accelerat (tick-uri rare, dar late de timp simulat) și cel normal ar avea frecvențe
// de pauză complet diferite pentru aceeași cursă
const STOP_CHANCE_PER_SIM_HOUR = 0.5;
const STOP_DURATION_MIN_MS = 2 * 60_000;
const STOP_DURATION_MAX_MS = 5 * 60_000;

const activeSimulations = new Map<string, NodeJS.Timeout>();

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const R = 6371;
  const dLat = ((latB - latA) * Math.PI) / 180;
  const dLng = ((lngB - lngA) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((latA * Math.PI) / 180) * Math.cos((latB * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function bearing(a: [number, number], b: [number, number]): number {
  const [lngA, latA] = a;
  const [lngB, latB] = b;
  const y = Math.sin(((lngB - lngA) * Math.PI) / 180) * Math.cos((latB * Math.PI) / 180);
  const x =
    Math.cos((latA * Math.PI) / 180) * Math.sin((latB * Math.PI) / 180) -
    Math.sin((latA * Math.PI) / 180) *
      Math.cos((latB * Math.PI) / 180) *
      Math.cos(((lngB - lngA) * Math.PI) / 180);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * interpolează [lng, lat] + heading la o distanță cumulată dată de-a lungul rutei.
 * indexările sunt garantat valide (coords.length >= 2, target clamped în [0, total]) —
 * verificările explicite sunt doar pentru noUncheckedIndexedAccess, nu cazuri reale.
 */
function pointAtDistance(
  coords: [number, number][],
  cumulative: number[],
  totalKm: number,
  targetKm: number,
): { point: [number, number]; heading: number } {
  const clamped = Math.min(Math.max(targetKm, 0), totalKm);
  let i = 1;
  while (i < cumulative.length - 1 && (cumulative[i] ?? 0) < clamped) i++;

  const from = coords[i - 1];
  const to = coords[i];
  if (!from || !to) {
    return { point: coords[0] ?? [0, 0], heading: 0 };
  }
  const segStart = cumulative[i - 1] ?? 0;
  const segEnd = cumulative[i] ?? segStart;
  const segLen = segEnd - segStart;
  const ratio = segLen > 0 ? (clamped - segStart) / segLen : 0;
  const point: [number, number] = [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
  ];
  return { point, heading: bearing(from, to) };
}

export function startSimulation(params: SimulationParams): void {
  // idempotent: un restart accidental al aceleiași curse nu pornește o a doua buclă
  if (activeSimulations.has(params.tripId)) return;
  const coords = params.route.coordinates;
  if (coords.length < 2 || params.durationMin <= 0) return;

  let totalDistanceKm = 0;
  const cumulative: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    if (!prev || !curr) break; // inatins: bucla e mărginită de coords.length
    totalDistanceKm += haversineKm(prev, curr);
    cumulative.push(totalDistanceKm);
  }

  const speedup = params.accelerated ? ACCELERATED_FACTOR : 1;
  // durata cursei ÎN LUMEA SIMULATĂ (nu se împarte la speedup — viteza vehiculului
  // rămâne realistă; doar timpul real necesar s-o parcurgem se comprimă)
  const totalSimDurationMs = params.durationMin * 60_000;
  // timp simulat petrecut EFECTIV conducând (exclude pauzele) — poziția se calculează
  // din asta, nu din timpul real scurs, altfel vehiculul ar continua să avanseze pe
  // rută în timpul unei „pauze de șofer" (doar viteza afișată ar fi 0)
  let drivingElapsedSimMs = 0;
  let breakRemainingSimMs = 0;

  const timer = setInterval(() => {
    tick().catch((err: unknown) => {
      console.error(`[gps-simulator] eroare la tick pentru cursa ${params.tripId}:`, err);
    });
  }, TICK_MS);
  activeSimulations.set(params.tripId, timer);

  async function tick(): Promise<void> {
    const deltaSimMs = TICK_MS * speedup;

    if (breakRemainingSimMs > 0) {
      breakRemainingSimMs = Math.max(0, breakRemainingSimMs - deltaSimMs);
    } else {
      const progressSoFar = drivingElapsedSimMs / totalSimDurationMs;
      // șansă de pauză per oră de condus simulat (nu per tick) — vezi definiția constantei
      const stopChance = STOP_CHANCE_PER_SIM_HOUR * (deltaSimMs / 3_600_000);
      if (progressSoFar < 0.95 && Math.random() < stopChance) {
        breakRemainingSimMs =
          STOP_DURATION_MIN_MS + Math.random() * (STOP_DURATION_MAX_MS - STOP_DURATION_MIN_MS);
      } else {
        drivingElapsedSimMs += deltaSimMs;
      }
    }

    const onBreak = breakRemainingSimMs > 0;
    const progress = Math.min(drivingElapsedSimMs / totalSimDurationMs, 1);

    const { point, heading } = pointAtDistance(
      coords,
      cumulative,
      totalDistanceKm,
      totalDistanceKm * progress,
    );
    const avgSpeedKmh = totalDistanceKm / (totalSimDurationMs / 3_600_000);
    const speedKmh = onBreak ? 0 : Math.max(0, avgSpeedKmh * (0.7 + Math.random() * 0.6));
    const recordedAt = new Date();

    await prisma.vehiclePosition.create({
      data: {
        vehicleId: params.vehicleId,
        tripId: params.tripId,
        lat: point[1],
        lng: point[0],
        speedKmh,
        heading,
        recordedAt,
      },
    });

    getIo().to(companyRoom(params.companyId)).emit('vehicle:position', {
      vehicleId: params.vehicleId,
      tripId: params.tripId,
      lat: point[1],
      lng: point[0],
      speedKmh,
      heading,
      recordedAt: recordedAt.toISOString(),
    });

    if (progress >= 1) {
      stopSimulation(params.tripId);
    }
  }
}

export function stopSimulation(tripId: string): void {
  const timer = activeSimulations.get(tripId);
  if (timer) {
    clearInterval(timer);
    activeSimulations.delete(tripId);
  }
}

// apelat la shutdown grațios — altfel timer-ele rămân „vii" în fereastra dintre
// semnalul de oprire și process.exit
export function stopAllSimulations(): void {
  for (const timer of activeSimulations.values()) {
    clearInterval(timer);
  }
  activeSimulations.clear();
}
