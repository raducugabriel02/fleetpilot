import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Map, Pencil, Play, Plus, Route, Trash2, UserCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import type {
  ClientDto,
  DriverDto,
  TripDetailDto,
  TripDto,
  TripStatus,
  VehicleDto,
} from '@fleetpilot/shared';
import { CityAutocomplete } from '@/components/city-autocomplete';
import { StatusBadge } from '@/components/status-badge';
import { TripRouteMap } from '@/components/trip-route-map';
import { useVehiclePosition } from './use-vehicle-position';
import type { StatusKind } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-context';
import { apiFetch, ApiError } from '@/lib/api';
import { formatDateTime, toDateTimeInputValue } from '@/lib/format';

export const TRIP_STATUS_META: Record<TripStatus, { kind: StatusKind; label: string }> = {
  REQUEST: { kind: 'inactive', label: 'Cerere' },
  PLANNED: { kind: 'in-service', label: 'Planificată' },
  IN_PROGRESS: { kind: 'on-trip', label: 'În desfășurare' },
  COMPLETED: { kind: 'available', label: 'Finalizată' },
  CANCELLED: { kind: 'alert', label: 'Anulată' },
};

function isZodIssueLike(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).message === 'string'
  );
}

function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Ceva n-a mers. Încearcă din nou.';
  // "Date invalide" e umbrela generică pentru orice eșec Zod pe server — issue-ul concret
  // (ce câmp, de ce) stă în details, altfel utilizatorul nu află niciodată motivul real
  if (
    err.code === 'VALIDATION_ERROR' &&
    Array.isArray(err.details) &&
    isZodIssueLike(err.details[0])
  ) {
    return err.details[0].message;
  }
  return err.message;
}

/*
 * Formularul lucrează cu string-uri; validarea de format completă (fereastră,
 * capacitate) rămâne pe server cu schema partajată — aici doar ce ține de UX.
 */
const tripFormSchema = z.object({
  clientId: z.string().trim().min(1, 'Alege un client'),
  originAddress: z.string().trim().min(3, 'Adresa e prea scurtă'),
  destAddress: z.string().trim().min(3, 'Adresa e prea scurtă'),
  cargoDescription: z.string().trim().min(2, 'Descrie pe scurt marfa'),
  pallets: z.string().trim(),
  weightTons: z.string().trim(),
  windowStart: z.string().min(1, 'Data e obligatorie'),
  windowEnd: z.string().min(1, 'Data e obligatorie'),
});
type TripFormValues = z.infer<typeof tripFormSchema>;

function formDefaults(trip?: TripDto): TripFormValues {
  return {
    clientId: trip?.client.id ?? '',
    originAddress: trip?.originAddress ?? '',
    destAddress: trip?.destAddress ?? '',
    cargoDescription: trip?.cargoDescription ?? '',
    pallets: trip?.pallets != null ? String(trip.pallets) : '',
    weightTons: trip?.weightTons != null ? String(trip.weightTons) : '',
    windowStart: toDateTimeInputValue(trip?.windowStart ?? null),
    windowEnd: toDateTimeInputValue(trip?.windowEnd ?? null),
  };
}

function TripFormDialog({
  trip,
  open,
  onOpenChange,
}: {
  trip: TripDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  // PLANNED = alocare validată; fereastra și încărcătura se schimbă doar prin re-alocare
  const locked = trip !== null && trip.status === 'PLANNED';
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiFetch<ClientDto[]>('/api/clients'),
    enabled: open,
  });
  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    values: formDefaults(trip ?? undefined),
  });

  const mutation = useMutation({
    mutationFn: (values: TripFormValues) => {
      const payload = {
        clientId: values.clientId,
        originAddress: values.originAddress,
        destAddress: values.destAddress,
        cargoDescription: values.cargoDescription,
        // omise complet (nu doar goale) când e locked — server respinge orice prezență a lor pe PLANNED
        pallets: locked ? undefined : values.pallets ? Number(values.pallets) : undefined,
        weightTons: locked ? undefined : values.weightTons ? Number(values.weightTons) : undefined,
        windowStart: locked ? undefined : new Date(values.windowStart).toISOString(),
        windowEnd: locked ? undefined : new Date(values.windowEnd).toISOString(),
      };
      return trip
        ? apiFetch<TripDto>(`/api/trips/${trip.id}`, { method: 'PATCH', body: payload })
        : apiFetch<TripDto>('/api/trips', { method: 'POST', body: payload });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success(trip ? 'Cursă actualizată' : 'Cursă creată');
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!locked && !values.pallets.trim() && !values.weightTons.trim()) {
      form.setError('pallets', { message: 'Specifică paleții sau tonajul (măcar una)' });
      return;
    }
    mutation.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{trip ? 'Editează cursa' : 'Cursă nouă'}</DialogTitle>
          <DialogDescription>
            {locked
              ? 'Cursa e planificată — fereastra și încărcătura se schimbă doar prin re-alocare.'
              : 'Ruta se calculează automat din adrese (OSRM).'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Alege clientul" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clientsQuery.data?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="originAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origine</FormLabel>
                    <FormControl>
                      <CityAutocomplete placeholder="Oltenița, Călărași" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destinație</FormLabel>
                    <FormControl>
                      <CityAutocomplete placeholder="Constanța" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="cargoDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marfă</FormLabel>
                  <FormControl>
                    <Input placeholder="Produse congelate" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!locked && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pallets"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Paleți</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" step="1" placeholder="4" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="weightTons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tonaj</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="3.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="windowStart"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fereastră de la</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="windowEnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fereastră până la</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Renunță
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Se salvează…' : 'Salvează'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const assignFormSchema = z.object({
  vehicleId: z.string().trim().min(1, 'Alege un vehicul'),
  driverId: z.string().trim().min(1, 'Alege un șofer'),
});
type AssignFormValues = z.infer<typeof assignFormSchema>;

function AssignDialog({ trip, onOpenChange }: { trip: TripDto | null; onOpenChange: () => void }) {
  const queryClient = useQueryClient();
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiFetch<VehicleDto[]>('/api/vehicles'),
    enabled: trip !== null,
  });
  const driversQuery = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiFetch<DriverDto[]>('/api/drivers'),
    enabled: trip !== null,
  });
  const form = useForm<AssignFormValues>({
    resolver: zodResolver(assignFormSchema),
    values: { vehicleId: trip?.vehicle?.id ?? '', driverId: trip?.driver?.id ?? '' },
  });

  const mutation = useMutation({
    mutationFn: (values: AssignFormValues) =>
      apiFetch<TripDto>(`/api/trips/${trip?.id}/assign`, { method: 'POST', body: values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success('Cursă alocată');
      onOpenChange();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const activeDrivers = driversQuery.data?.filter((d) => d.isActive) ?? [];

  return (
    <Dialog open={trip !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alocă cursa</DialogTitle>
          <DialogDescription>
            {trip?.client.name}: {trip?.originAddress} → {trip?.destAddress}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <FormField
              control={form.control}
              name="vehicleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicul</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Alege vehiculul" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehiclesQuery.data?.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="driverId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Șofer</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Alege șoferul" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeDrivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onOpenChange}>
                Renunță
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Se alocă…' : 'Alocă'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type TripAction = 'start' | 'complete' | 'cancel' | 'delete';

const ACTION_META: Record<
  TripAction,
  {
    title: string;
    description: (trip: TripDto) => string;
    confirmLabel: string;
    pendingLabel: string;
    variant: 'default' | 'destructive';
    method: 'POST' | 'DELETE';
    path: (id: string) => string;
    successMessage: string;
  }
> = {
  start: {
    title: 'Pornești cursa?',
    description: (t) => `${t.client.name}: cursa trece în „${TRIP_STATUS_META.IN_PROGRESS.label}".`,
    confirmLabel: 'Pornește',
    pendingLabel: 'Se pornește…',
    variant: 'default',
    method: 'POST',
    path: (id) => `/api/trips/${id}/start`,
    successMessage: 'Cursă pornită',
  },
  complete: {
    title: 'Finalizezi cursa?',
    description: (t) => `${t.client.name}: vehiculul redevine disponibil.`,
    confirmLabel: 'Finalizează',
    pendingLabel: 'Se finalizează…',
    variant: 'default',
    method: 'POST',
    path: (id) => `/api/trips/${id}/complete`,
    successMessage: 'Cursă finalizată',
  },
  cancel: {
    title: 'Anulezi cursa?',
    description: (t) => `${t.client.name}: cursa nu se mai poate relua.`,
    confirmLabel: 'Anulează',
    pendingLabel: 'Se anulează…',
    variant: 'destructive',
    method: 'POST',
    path: (id) => `/api/trips/${id}/cancel`,
    successMessage: 'Cursă anulată',
  },
  delete: {
    title: 'Ștergi cursa?',
    description: (t) =>
      `${t.client.name}: cererea dispare definitiv. Acțiunea nu poate fi anulată.`,
    confirmLabel: 'Șterge',
    pendingLabel: 'Se șterge…',
    variant: 'destructive',
    method: 'DELETE',
    path: (id) => `/api/trips/${id}`,
    successMessage: 'Cursă ștearsă',
  },
};

function TripActionDialog({
  pending,
  onOpenChange,
}: {
  pending: { trip: TripDto; action: TripAction } | null;
  onOpenChange: () => void;
}) {
  const queryClient = useQueryClient();
  const meta = pending ? ACTION_META[pending.action] : null;
  const mutation = useMutation({
    mutationFn: (trip: TripDto) => apiFetch<void>(meta!.path(trip.id), { method: meta!.method }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trips'] });
      toast.success(meta!.successMessage);
      onOpenChange();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={pending !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{meta?.title}</DialogTitle>
          <DialogDescription>
            {pending && meta ? meta.description(pending.trip) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>
            Renunță
          </Button>
          <Button
            variant={meta?.variant}
            disabled={mutation.isPending}
            onClick={() => pending && mutation.mutate(pending.trip)}
          >
            {mutation.isPending ? meta?.pendingLabel : meta?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TripRouteDialog({
  tripId,
  onOpenChange,
}: {
  tripId: string | null;
  onOpenChange: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => apiFetch<TripDetailDto>(`/api/trips/${tripId}`),
    enabled: tripId !== null,
  });
  // doar cursele în desfășurare au simulator GPS activ pe server — pentru orice alt
  // status hook-ul rămâne conectat degeaba, dar nu primește niciodată evenimente
  const livePosition = useVehiclePosition(
    detailQuery.data?.status === 'IN_PROGRESS' ? tripId : null,
  );

  return (
    <Dialog open={tripId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ruta cursei</DialogTitle>
          <DialogDescription>
            {detailQuery.data
              ? `${detailQuery.data.originAddress} → ${detailQuery.data.destAddress}`
              : 'Se încarcă…'}
          </DialogDescription>
        </DialogHeader>
        {detailQuery.data ? (
          <TripRouteMap trip={detailQuery.data} livePosition={livePosition} />
        ) : (
          <Skeleton className="h-72 w-full" />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TripsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data: trips, isPending } = useQuery({
    queryKey: ['trips'],
    queryFn: () => apiFetch<TripDto[]>('/api/trips'),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TripDto | null>(null);
  const [assigning, setAssigning] = useState<TripDto | null>(null);
  const [pendingAction, setPendingAction] = useState<{ trip: TripDto; action: TripAction } | null>(
    null,
  );
  const [viewingRouteId, setViewingRouteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (trip: TripDto) => {
    setEditing(trip);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Curse</h1>
          <p className="text-sm text-muted-foreground">Cererile de transport și alocarea lor</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Cursă nouă
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !trips || trips.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <ClipboardList className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nicio cursă înregistrată. Adaugă prima cerere de transport.
          </p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" />
            Adaugă cursă
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Traseu</TableHead>
                <TableHead>Fereastră</TableHead>
                <TableHead className="text-right">Rută</TableHead>
                <TableHead>Alocare</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => {
                const status = TRIP_STATUS_META[trip.status];
                const editable = trip.status === 'REQUEST' || trip.status === 'PLANNED';
                return (
                  <TableRow key={trip.id}>
                    <TableCell className="font-medium">{trip.client.name}</TableCell>
                    <TableCell>
                      <p className="text-sm">{trip.originAddress}</p>
                      <p className="text-sm text-muted-foreground">→ {trip.destAddress}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{formatDateTime(trip.windowStart)}</p>
                      <p className="text-muted-foreground">{formatDateTime(trip.windowEnd)}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trip.distanceKm != null ? (
                        <>
                          <p>{trip.distanceKm.toFixed(1)} km</p>
                          <p className="text-muted-foreground">{trip.durationMin} min</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {trip.vehicle && trip.driver ? (
                        <>
                          <p className="font-mono">{trip.vehicle.plateNumber}</p>
                          <p className="text-muted-foreground">{trip.driver.name}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">nealocată</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind={status.kind} label={status.label} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Vezi ruta cursei ${trip.client.name}`}
                          onClick={() => setViewingRouteId(trip.id)}
                        >
                          <Map className="size-4" />
                        </Button>
                        {(trip.status === 'REQUEST' || trip.status === 'PLANNED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Alocă cursa ${trip.client.name}`}
                            onClick={() => setAssigning(trip)}
                          >
                            <UserCog className="size-4" />
                          </Button>
                        )}
                        {trip.status === 'PLANNED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Pornește cursa ${trip.client.name}`}
                            onClick={() => setPendingAction({ trip, action: 'start' })}
                          >
                            <Play className="size-4" />
                          </Button>
                        )}
                        {trip.status === 'IN_PROGRESS' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Finalizează cursa ${trip.client.name}`}
                            onClick={() => setPendingAction({ trip, action: 'complete' })}
                          >
                            <Route className="size-4" />
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editează cursa ${trip.client.name}`}
                            onClick={() => openEdit(trip)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Anulează cursa ${trip.client.name}`}
                            onClick={() => setPendingAction({ trip, action: 'cancel' })}
                          >
                            <X className="size-4 text-destructive" />
                          </Button>
                        )}
                        {isAdmin && trip.status === 'REQUEST' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Șterge cursa ${trip.client.name}`}
                            onClick={() => setPendingAction({ trip, action: 'delete' })}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TripFormDialog
        trip={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
      <AssignDialog trip={assigning} onOpenChange={() => setAssigning(null)} />
      <TripActionDialog pending={pendingAction} onOpenChange={() => setPendingAction(null)} />
      <TripRouteDialog tripId={viewingRouteId} onOpenChange={() => setViewingRouteId(null)} />
    </div>
  );
}
