import { cn } from '@/lib/utils';

/**
 * Sistemul semantic de statusuri al flotei. Punct + text, nu doar culoare —
 * distinctibil și pentru daltoniști.
 */
const STATUS_STYLES = {
  available: 'text-status-available',
  'on-trip': 'text-status-on-trip',
  'in-service': 'text-status-in-service',
  inactive: 'text-status-inactive',
  alert: 'text-status-alert',
} as const;

export type StatusKind = keyof typeof STATUS_STYLES;

export function StatusBadge({
  kind,
  label,
  className,
}: {
  kind: StatusKind;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-sm font-medium',
        STATUS_STYLES[kind],
        className,
      )}
    >
      <span aria-hidden className="relative flex size-2">
        {/* pulsul e rezervat statusului "on-trip": singurul care reflectă mișcare reală (GPS live) */}
        {kind === 'on-trip' && (
          <span className="motion-safe:absolute motion-safe:inline-flex motion-safe:size-full motion-safe:animate-ping motion-safe:rounded-full motion-safe:bg-current motion-safe:opacity-75" />
        )}
        <span className="relative inline-flex size-2 rounded-full bg-current" />
      </span>
      {label}
    </span>
  );
}
