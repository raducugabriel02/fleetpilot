const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

// Postgres `contains`/`mode: 'insensitive'` normalizează doar case-ul, nu diacriticele —
// „Panificatie" (fără diacritice) nu găsește „Panificație" din DB. Folosit la căutarea
// de clienți (UI + tool-ul agentului), unde dispecerul scrie des fără diacritice.
// Aceeași abordare ca `normalize()` din client/src/components/city-autocomplete.tsx.
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(DIACRITICS_PATTERN, '');
}
