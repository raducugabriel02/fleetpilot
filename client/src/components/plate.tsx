import { cn } from '@/lib/utils';

// desparte "B123ABC" / "CT45XYZ" în segmentele vizuale de pe plăcuța reală
function formatPlate(plateNumber: string): string {
  const match = /^([A-Z]{1,2})(\d{2,3})([A-Z]{3})$/.exec(plateNumber);
  if (!match) return plateNumber;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

/**
 * Număr de înmatriculare randat ca plăcuță românească: banda albastră RO
 * + font mono. Elementul de identitate vizuală al aplicației.
 */
export function Plate({ plateNumber, className }: { plateNumber: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-[4px] border border-slate-400 bg-white font-mono text-sm font-medium text-slate-900 shadow-xs dark:border-slate-500',
        className,
      )}
    >
      <span className="flex items-center bg-[#003399] px-1 text-[8px] font-bold leading-none text-white">
        RO
      </span>
      <span className="px-1.5 py-0.5 tracking-wide">{formatPlate(plateNumber)}</span>
    </span>
  );
}
