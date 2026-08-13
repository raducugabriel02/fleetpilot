import type { Prisma } from '@prisma/client';

// aceeași regulă ca la alocarea curselor (trip.service.ts): ferestre half-open,
// se suprapun dacă fiecare începe înainte de sfârșitul celeilalte
export function overlappingActiveTrips(windowStart: Date, windowEnd: Date): Prisma.TripWhereInput {
  return {
    status: { in: ['PLANNED', 'IN_PROGRESS'] },
    windowStart: { lt: windowEnd },
    windowEnd: { gt: windowStart },
  };
}

// vezi trip.service.ts: absențele sunt @db.Date, comparăm pe zile UTC întregi,
// inclusiv la ambele capete (conservator — mai bine un refuz în plus decât un șofer lipsă)
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
