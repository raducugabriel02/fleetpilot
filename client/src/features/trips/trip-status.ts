import type { TripStatus } from '@fleetpilot/shared';
import type { StatusKind } from '@/components/status-badge';

// extras din trips-page.tsx: dashboard-page.tsx are nevoie doar de asta, nu de tot
// modulul (formulare, dialoguri) — un import direct din trips-page ar anula
// code-splitting-ul pe rute, aducând tot bundle-ul de Curse și pe Dashboard
export const TRIP_STATUS_META: Record<TripStatus, { kind: StatusKind; label: string }> = {
  REQUEST: { kind: 'inactive', label: 'Cerere' },
  PLANNED: { kind: 'in-service', label: 'Planificată' },
  IN_PROGRESS: { kind: 'on-trip', label: 'În desfășurare' },
  COMPLETED: { kind: 'available', label: 'Finalizată' },
  CANCELLED: { kind: 'alert', label: 'Anulată' },
};
