const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : '—';
}

export type ExpiryLevel = 'ok' | 'soon' | 'expired' | 'none';

const SOON_THRESHOLD_DAYS = 30;

/** ITP/RCA/rovinietă: expirat = alertă, sub 30 de zile = atenție */
export function expiryLevel(iso: string | null): ExpiryLevel {
  if (!iso) return 'none';
  const days = (new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (days < 0) return 'expired';
  if (days <= SOON_THRESHOLD_DAYS) return 'soon';
  return 'ok';
}

/** pentru <input type="date">: ISO complet → YYYY-MM-DD */
export function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}
