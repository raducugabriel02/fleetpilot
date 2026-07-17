import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { vehicleTypeSchema } from '@fleetpilot/shared';
import type { VehicleDto, VehicleStatus, VehicleType } from '@fleetpilot/shared';
import { Plate } from '@/components/plate';
import { StatusBadge } from '@/components/status-badge';
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
import { apiFetch, ApiError } from '@/lib/api';
import { expiryLevel, formatDate, toDateInputValue } from '@/lib/format';
import { cn } from '@/lib/utils';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  VAN: 'Dubă',
  TRUCK: 'Camion',
  SEMI: 'TIR',
};

const STATUS_META: Record<VehicleStatus, { kind: StatusKind; label: string }> = {
  AVAILABLE: { kind: 'available', label: 'Disponibil' },
  ON_TRIP: { kind: 'on-trip', label: 'În cursă' },
  IN_SERVICE: { kind: 'in-service', label: 'În service' },
};

/*
 * Formularul lucrează cu string-uri (ce produc input-urile); validarea de format
 * completă o face serverul cu schema partajată — aici doar ce ține de UX.
 */
const vehicleFormSchema = z.object({
  plateNumber: z.string().trim().min(1, 'Numărul e obligatoriu'),
  type: vehicleTypeSchema,
  capacityTons: z.string().trim().min(1, 'Capacitatea e obligatorie'),
  capacityPallets: z.string().trim().min(1, 'Numărul de paleți e obligatoriu'),
  itpExpiresAt: z.string(),
  rcaExpiresAt: z.string(),
  vignetteExpiresAt: z.string(),
});
type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

function toPayload(values: VehicleFormValues) {
  return {
    plateNumber: values.plateNumber,
    type: values.type,
    capacityTons: values.capacityTons,
    capacityPallets: values.capacityPallets,
    itpExpiresAt: values.itpExpiresAt || null,
    rcaExpiresAt: values.rcaExpiresAt || null,
    vignetteExpiresAt: values.vignetteExpiresAt || null,
  };
}

function formDefaults(vehicle?: VehicleDto): VehicleFormValues {
  return {
    plateNumber: vehicle?.plateNumber ?? '',
    type: vehicle?.type ?? 'TRUCK',
    capacityTons: vehicle ? String(vehicle.capacityTons) : '',
    capacityPallets: vehicle ? String(vehicle.capacityPallets) : '',
    itpExpiresAt: toDateInputValue(vehicle?.itpExpiresAt ?? null),
    rcaExpiresAt: toDateInputValue(vehicle?.rcaExpiresAt ?? null),
    vignetteExpiresAt: toDateInputValue(vehicle?.vignetteExpiresAt ?? null),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Ceva n-a mers. Încearcă din nou.';
}

const EXPIRY_CLASSES = {
  ok: '',
  none: 'text-muted-foreground',
  soon: 'font-medium text-status-in-service',
  expired: 'font-medium text-status-alert',
} as const;

function ExpiryCell({ iso }: { iso: string | null }) {
  const level = expiryLevel(iso);
  return <span className={cn('font-mono text-sm', EXPIRY_CLASSES[level])}>{formatDate(iso)}</span>;
}

function VehicleFormDialog({
  vehicle,
  open,
  onOpenChange,
}: {
  vehicle: VehicleDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    values: formDefaults(vehicle ?? undefined),
  });

  const mutation = useMutation({
    mutationFn: (values: VehicleFormValues) =>
      vehicle
        ? apiFetch<VehicleDto>(`/api/vehicles/${vehicle.id}`, {
            method: 'PATCH',
            body: toPayload(values),
          })
        : apiFetch<VehicleDto>('/api/vehicles', { method: 'POST', body: toPayload(values) }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success(vehicle ? `${saved.plateNumber} actualizat` : `${saved.plateNumber} adăugat`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Editează vehiculul' : 'Vehicul nou'}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? 'Modifici datele vehiculului; statusul „În cursă" e gestionat de sistem.'
              : 'Adaugi un vehicul în flota firmei.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="plateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Număr înmatriculare</FormLabel>
                    <FormControl>
                      <Input placeholder="B 123 ABC" className="font-mono uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tip</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vehicleTypeSchema.options.map((type) => (
                          <SelectItem key={type} value={type}>
                            {VEHICLE_TYPE_LABELS[type]}
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
                name="capacityTons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacitate (tone)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" placeholder="21.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capacityPallets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacitate (paleți)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" placeholder="33" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  ['itpExpiresAt', 'ITP până la'],
                  ['rcaExpiresAt', 'RCA până la'],
                  ['vignetteExpiresAt', 'Rovinietă până la'],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
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

function DeleteVehicleDialog({
  vehicle,
  onOpenChange,
}: {
  vehicle: VehicleDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/vehicles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      toast.success('Vehicul șters');
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={vehicle !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ștergi vehiculul?</DialogTitle>
          <DialogDescription>
            {vehicle?.plateNumber} dispare definitiv din flotă, împreună cu istoricul lui de
            poziții. Acțiunea nu poate fi anulată.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => vehicle && mutation.mutate(vehicle.id)}
          >
            {mutation.isPending ? 'Se șterge…' : 'Șterge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VehiclesPage() {
  const { data: vehicles, isPending } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiFetch<VehicleDto[]>('/api/vehicles'),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleDto | null>(null);
  const [deleting, setDeleting] = useState<VehicleDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (vehicle: VehicleDto) => {
    setEditing(vehicle);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vehicule</h1>
          <p className="text-sm text-muted-foreground">Flota firmei și documentele ei</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Vehicul nou
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !vehicles || vehicles.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Truck className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nicio mașină în flotă. Adaugă primul vehicul ca să poți planifica curse.
          </p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" />
            Adaugă vehicul
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Număr</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="text-right">Tone</TableHead>
                <TableHead className="text-right">Paleți</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>ITP</TableHead>
                <TableHead>RCA</TableHead>
                <TableHead>Rovinietă</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((vehicle) => {
                const status = STATUS_META[vehicle.status];
                return (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <Plate plateNumber={vehicle.plateNumber} />
                    </TableCell>
                    <TableCell>{VEHICLE_TYPE_LABELS[vehicle.type]}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {vehicle.capacityTons.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {vehicle.capacityPallets}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind={status.kind} label={status.label} />
                    </TableCell>
                    <TableCell>
                      <ExpiryCell iso={vehicle.itpExpiresAt} />
                    </TableCell>
                    <TableCell>
                      <ExpiryCell iso={vehicle.rcaExpiresAt} />
                    </TableCell>
                    <TableCell>
                      <ExpiryCell iso={vehicle.vignetteExpiresAt} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Editează ${vehicle.plateNumber}`}
                          onClick={() => openEdit(vehicle)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Șterge ${vehicle.plateNumber}`}
                          onClick={() => setDeleting(vehicle)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <VehicleFormDialog
        vehicle={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
      <DeleteVehicleDialog vehicle={deleting} onOpenChange={() => setDeleting(null)} />
    </div>
  );
}
