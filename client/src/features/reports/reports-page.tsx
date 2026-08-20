import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Clock, Gauge, Route, Truck } from 'lucide-react';
import type { MonthlyReportDto } from '@fleetpilot/shared';
import { Plate } from '@/components/plate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const KPI_TONE_STYLES = {
  primary: 'bg-primary/10 text-primary',
  available: 'bg-status-available/10 text-status-available',
  'in-service': 'bg-status-in-service/10 text-status-in-service',
  alert: 'bg-status-alert/10 text-status-alert',
} as const;

// prag identic în spirit cu expiryLevel (lib/format.ts): sub 70% e o problemă reală, nu doar atenție
function onTimeTone(percent: number | null): keyof typeof KPI_TONE_STYLES {
  if (percent === null) return 'primary';
  if (percent >= 90) return 'available';
  if (percent >= 70) return 'in-service';
  return 'alert';
}

function KpiTile({
  icon: Icon,
  label,
  value,
  unit,
  tone = 'primary',
  loading,
}: {
  icon: typeof Route;
  label: string;
  value: string;
  unit?: string;
  tone?: keyof typeof KPI_TONE_STYLES;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <span
          aria-hidden
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            KPI_TONE_STYLES[tone],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <p className="truncate font-mono text-2xl leading-tight font-bold">
              {value}
              {unit && (
                <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const query = useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: () => apiFetch<MonthlyReportDto>(`/api/reports/monthly?month=${month}`),
  });

  const report = query.data;
  const loading = query.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Raport lunar</h1>
          <p className="text-sm text-muted-foreground">Curse finalizate, distanțe, punctualitate</p>
        </div>
        <div className="w-40">
          <label htmlFor="report-month" className="mb-1 block text-xs text-muted-foreground">
            Luna
          </label>
          <Input
            id="report-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiTile
          icon={Route}
          label="Curse finalizate"
          value={String(report?.completedTrips ?? 0)}
          loading={loading}
        />
        <KpiTile
          icon={Gauge}
          label="Km parcurși"
          value={(report?.totalDistanceKm ?? 0).toLocaleString('ro-RO')}
          unit="km"
          loading={loading}
        />
        <KpiTile
          icon={Clock}
          label="Curse la timp"
          value={
            report?.onTimePercent === null || report?.onTimePercent === undefined
              ? '—'
              : report.onTimePercent.toLocaleString('ro-RO')
          }
          unit={report?.onTimePercent != null ? '%' : undefined}
          tone={onTimeTone(report?.onTimePercent ?? null)}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4 text-muted-foreground" />
            Top clienți
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : !report || report.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio cursă finalizată în luna asta.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Curse</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.topClients.map((c) => (
                  <TableRow key={c.clientId}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="text-right font-mono">{c.tripCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4 text-muted-foreground" />
            Utilizare vehicule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : !report || report.vehicleUtilization.length === 0 ? (
            <p className="text-sm text-muted-foreground">Niciun vehicul folosit în luna asta.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicul</TableHead>
                  <TableHead className="text-right">Curse</TableHead>
                  <TableHead className="text-right">Km</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.vehicleUtilization.map((v) => (
                  <TableRow key={v.vehicleId}>
                    <TableCell>
                      <Plate plateNumber={v.plateNumber} />
                    </TableCell>
                    <TableCell className="text-right font-mono">{v.tripCount}</TableCell>
                    <TableCell className="text-right font-mono">
                      {v.distanceKm.toLocaleString('ro-RO')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
