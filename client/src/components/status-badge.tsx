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
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {label}
    </span>
  );
}
