import { z } from 'zod';
import { routeGeometrySchema } from '@fleetpilot/shared';
import type { RouteGeometry } from '@fleetpilot/shared';
import { env } from '../lib/env';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  geometry: RouteGeometry;
}

// câmpurile de rută ale unui Trip, calculate best-effort: null = serviciul extern n-a răspuns
export interface TripRouteFields {
  originLat: number | null;
  originLng: number | null;
  destLat: number | null;
  destLng: number | null;
  distanceKm: number | null;
  durationMin: number | null;
  routeGeometry: RouteGeometry | null;
}

const nominatimResponseSchema = z.array(
  z.object({ lat: z.coerce.number(), lon: z.coerce.number() }),
);

const osrmResponseSchema = z.object({
  code: z.string(),
  routes: z
    .array(
      z.object({
        distance: z.number(), // metri
        duration: z.number(), // secunde
        geometry: routeGeometrySchema,
      }),
    )
    .optional(),
});

// Nominatim cere User-Agent identificabil; politica lor blochează clienții anonimi
const USER_AGENT = 'FleetPilot/0.1 (proiect portofoliu; raduquaresma@gmail.com)';
const REQUEST_TIMEOUT_MS = 5000;

/*
 * Cache simplu în memorie: aceleași orașe revin constant în curse, iar Nominatim
 * are limită de 1 request/secundă. Se golește la restart — suficient pentru v1.
 */
const geocodeCache = new Map<string, GeoPoint | null>();
const GEOCODE_CACHE_MAX = 500;

/*
 * Nominatim blochează pe IP la peste 1 request/secundă, iar un ban lovește tot
 * serverul. Lanțul de promisiuni serializează TOATE geocodările necachate
 * (inclusiv din request-uri HTTP concurente) cu o pauză minimă între ele;
 * apelantul curent nu așteaptă pauza — ea doar amână următoarea geocodare.
 */
const NOMINATIM_MIN_INTERVAL_MS = 1100;
let nominatimChain: Promise<void> = Promise.resolve();

function throttleNominatim<T>(task: () => Promise<T>): Promise<T> {
  const result = nominatimChain.then(task);
  const pause = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS));
  nominatimChain = result.then(pause, pause);
  return result;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    // timeout / rețea picată: rutarea e best-effort, apelantul tratează null
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = address.trim().toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const url = new URL('/search', env.NOMINATIM_BASE_URL);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  // flotele noastre operează în România; fără bias, "Oltenița" poate ateriza oriunde
  url.searchParams.set('countrycodes', 'ro');

  const raw = await throttleNominatim(() => fetchJson(url.toString()));
  const parsed = nominatimResponseSchema.safeParse(raw);
  if (raw === null || !parsed.success) {
    // eșec de transport SAU răspuns neașteptat: niciunul nu e un verdict despre adresă,
    // deci nu se cachează — altfel ar otrăvi adresa până la restart
    return null;
  }
  const first = parsed.data[0];
  const point = first ? { lat: first.lat, lng: first.lon } : null;

  // se cachează doar verdictele definitive: coordonate sau „adresa nu există" (array gol)
  if (geocodeCache.size >= GEOCODE_CACHE_MAX) {
    // Map-ul păstrează ordinea de inserție — ștergerea primei chei e un FIFO decent
    const oldest = geocodeCache.keys().next();
    if (!oldest.done) {
      geocodeCache.delete(oldest.value);
    }
  }
  geocodeCache.set(key, point);
  return point;
}

export async function calculateRoute(
  origin: GeoPoint,
  dest: GeoPoint,
): Promise<RouteResult | null> {
  const coords = `${origin.lng},${origin.lat};${dest.lng},${dest.lat}`;
  const url = new URL(`/route/v1/driving/${coords}`, env.OSRM_BASE_URL);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');

  const parsed = osrmResponseSchema.safeParse(await fetchJson(url.toString()));
  if (!parsed.success || parsed.data.code !== 'Ok') {
    return null;
  }
  const route = parsed.data.routes?.[0];
  if (!route) {
    return null;
  }
  return {
    distanceKm: Math.round((route.distance / 1000) * 10) / 10,
    durationMin: Math.round(route.duration / 60),
    geometry: route.geometry,
  };
}

export async function resolveTripRoute(
  originAddress: string,
  destAddress: string,
): Promise<TripRouteFields> {
  // secvențial, nu Promise.all: Nominatim impune max 1 request/secundă per client
  const origin = await geocodeAddress(originAddress);
  const dest = await geocodeAddress(destAddress);
  const route = origin && dest ? await calculateRoute(origin, dest) : null;

  return {
    originLat: origin?.lat ?? null,
    originLng: origin?.lng ?? null,
    destLat: dest?.lat ?? null,
    destLng: dest?.lng ?? null,
    distanceKm: route?.distanceKm ?? null,
    durationMin: route?.durationMin ?? null,
    routeGeometry: route?.geometry ?? null,
  };
}
