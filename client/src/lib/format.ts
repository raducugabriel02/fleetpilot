import { VEHICLE_DOCUMENT_SOON_THRESHOLD_DAYS } from '@fleetpilot/shared';

const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

const dateTimeFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateTime(iso: string | null): string {
  return iso ? dateTimeFormatter.format(new Date(iso)) : '—';
}

/** pentru <input type="datetime-local">: ISO complet → YYYY-MM-DDTHH:mm, în ora locală */
export function toDateTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type ExpiryLevel = 'ok' | 'soon' | 'expired' | 'none';

/** ITP/RCA/rovinietă: expirat = alertă, sub prag = atenție (prag comun cu verificarea de fond de pe server) */
export function expiryLevel(iso: string | null): ExpiryLevel {
  if (!iso) return 'none';
  const days = (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 0) return 'expired';
  if (days <= VEHICLE_DOCUMENT_SOON_THRESHOLD_DAYS) return 'soon';
  return 'ok';
}

/** pentru <input type="date">: ISO complet → YYYY-MM-DD */
export function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
