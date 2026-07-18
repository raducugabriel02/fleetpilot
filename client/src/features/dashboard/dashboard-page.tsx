import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Building2, Route, Truck, Users } from 'lucide-react';
import type { DriverDto, VehicleDto, ClientDto } from '@fleetpilot/shared';
import { Plate } from '@/components/plate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetch } from '@/lib/api';
import { expiryLevel, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ExpiryAlert {
  vehicle: VehicleDto;
  document: string;
  date: string;
  level: 'soon' | 'expired';
}

// un vehicul poate genera mai multe alerte (ITP și RCA expirate simultan)
function collectAlerts(vehicles: VehicleDto[]): ExpiryAlert[] {
  const documents = [
    ['ITP', (v: VehicleDto) => v.itpExpiresAt],
    ['RCA', (v: VehicleDto) => v.rcaExpiresAt],
    ['Rovinietă', (v: VehicleDto) => v.vignetteExpiresAt],
  ] as const;
  const alerts: ExpiryAlert[] = [];
  for (const vehicle of vehicles) {
    for (const [document, get] of documents) {
      const date = get(vehicle);
      const level = expiryLevel(date);
      if (date && (level === 'soon' || level === 'expired')) {
        alerts.push({ vehicle, document, date, level });
      }
    }
  }
  return alerts.sort((a, b) => a.date.localeCompare(b.date));
}

function KpiCard({
  title,
  icon: Icon,
  value,
  detail,
  to,
  loading,
}: {
  title: string;
  icon: typeof Truck;
  value: number | undefined;
  detail: string;
  to: string;
  loading: boolean;
}) {
  return (
    <Card className="transition-colors hover:border-primary/50">
      <Link to={to} className="block">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <p className="font-mono text-2xl font-bold">{value}</p>
          )}
          <p className="text-xs text-muted-foreground">{detail}</p>
        </CardContent>
      </Link>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiFetch<VehicleDto[]>('/api/vehicles'),
  });
  const driversQuery = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiFetch<DriverDto[]>('/api/drivers'),
  });
  const clientsQuery = useQuery({
    queryKey: ['clients', ''],
    queryFn: () => apiFetch<ClientDto[]>('/api/clients?search='),
  });

  const vehicles = vehiclesQuery.data;
  const available = vehicles?.filter((v) => v.status === 'AVAILABLE').length;
  const activeDrivers = driversQuery.data?.filter((d) => d.isActive).length;
  const alerts = vehicles ? collectAlerts(vehicles) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {user ? `Salut, ${user.name.split(' ')[0]}` : 'Dashboard'}
        </h1>
        <p className="text-sm text-muted-foreground">Situația flotei pe scurt</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Vehicule disponibile"
          icon={Truck}
          value={available}
          detail={`din ${vehicles?.length ?? 0} în flotă`}
          to="/app/vehicles"
          loading={vehiclesQuery.isPending}
        />
        <KpiCard
          title="Șoferi activi"
          icon={Users}
          value={activeDrivers}
          detail={`din ${driversQuery.data?.length ?? 0} înregistrați`}
          to="/app/drivers"
          loading={driversQuery.isPending}
        />
        <KpiCard
          title="Clienți"
          icon={Building2}
          value={clientsQuery.data?.length}
          detail="firme partenere"
          to="/app/clients"
          loading={clientsQuery.isPending}
        />
        <Card className="border-dashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Curse azi</CardTitle>
            <Route className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground">vine în Faza 2, cu harta</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-status-in-service" />
            Documente care expiră
          </CardTitle>
          <Link
            to="/app/vehicles"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Toate vehiculele <ArrowRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {vehiclesQuery.isPending ? (
            <Skeleton className="h-16 w-full" />
          ) : alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nimic urgent — toate documentele sunt valabile peste 30 de zile.
            </p>
          ) : (
            <ul className="divide-y">
              {alerts.map((alert) => (
                <li
                  key={`${alert.vehicle.id}-${alert.document}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Plate plateNumber={alert.vehicle.plateNumber} />
                    <span className="text-sm">{alert.document}</span>
                  </div>
                  <span
                    className={cn(
                      'font-mono text-sm font-medium',
                      alert.level === 'expired' ? 'text-status-alert' : 'text-status-in-service',
                    )}
                  >
                    {alert.level === 'expired' ? 'expirat ' : 'expiră '}
                    {formatDate(alert.date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
