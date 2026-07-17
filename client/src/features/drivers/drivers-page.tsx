import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarOff, Pencil, Plus, RotateCcw, Trash2, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { absenceTypeSchema, licenseCategorySchema } from '@fleetpilot/shared';
import type { AbsenceDto, AbsenceType, DriverDetailDto, DriverDto } from '@fleetpilot/shared';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
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

const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  VACATION: 'Concediu',
  SICK_LEAVE: 'Medical',
  OTHER: 'Altele',
};

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Ceva n-a mers. Încearcă din nou.';
}

/* formular pe string-uri; validarea de format completă rămâne pe server */
const driverFormSchema = z.object({
  name: z.string().trim().min(1, 'Numele e obligatoriu'),
  email: z.string().trim().min(1, 'Emailul e obligatoriu'),
  password: z.string(),
  phone: z.string().trim(),
  licenseCategories: z.array(licenseCategorySchema).min(1, 'Alege cel puțin o categorie'),
  licenseExpiresAt: z.string(),
});
type DriverFormValues = z.infer<typeof driverFormSchema>;

function formDefaults(driver?: DriverDto): DriverFormValues {
  return {
    name: driver?.name ?? '',
    email: driver?.email ?? '',
    password: '',
    phone: driver?.phone ?? '',
    licenseCategories: driver?.licenseCategories ?? ['C'],
    licenseExpiresAt: toDateInputValue(driver?.licenseExpiresAt ?? null),
  };
}

function DriverFormDialog({
  driver,
  open,
  onOpenChange,
}: {
  driver: DriverDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    values: formDefaults(driver ?? undefined),
  });

  const mutation = useMutation({
    mutationFn: (values: DriverFormValues) => {
      if (driver) {
        return apiFetch<DriverDto>(`/api/drivers/${driver.id}`, {
          method: 'PATCH',
          body: {
            name: values.name,
            phone: values.phone || null,
            licenseCategories: values.licenseCategories,
            licenseExpiresAt: values.licenseExpiresAt || null,
          },
        });
      }
      return apiFetch<DriverDto>('/api/drivers', {
        method: 'POST',
        body: {
          name: values.name,
          email: values.email,
          password: values.password,
          phone: values.phone || null,
          licenseCategories: values.licenseCategories,
          licenseExpiresAt: values.licenseExpiresAt || null,
        },
      });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(driver ? `${saved.name} actualizat` : `${saved.name} adăugat`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{driver ? 'Editează șoferul' : 'Șofer nou'}</DialogTitle>
          <DialogDescription>
            {driver
              ? 'Emailul e identitatea contului și nu se schimbă de aici.'
              : 'Șoferul primește un cont cu care se va loga în aplicație.'}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nume complet</FormLabel>
                  <FormControl>
                    <Input placeholder="Ion Popescu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!driver && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="sofer@firma.ro" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parolă inițială</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="0722 123 456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseExpiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Permis valabil până la</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="licenseCategories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categorii permis</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {licenseCategorySchema.options.map((category) => {
                        const active = field.value.includes(category);
                        return (
                          <Button
                            key={category}
                            type="button"
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            className="font-mono"
                            aria-pressed={active}
                            onClick={() =>
                              field.onChange(
                                active
                                  ? field.value.filter((c) => c !== category)
                                  : [...field.value, category],
                              )
                            }
                          >
                            {category}
                          </Button>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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

const absenceFormSchema = z
  .object({
    type: absenceTypeSchema,
    startsAt: z.string().min(1, 'Data de început e obligatorie'),
    endsAt: z.string().min(1, 'Data de sfârșit e obligatorie'),
    note: z.string().trim(),
  })
  .refine((v) => v.startsAt <= v.endsAt, {
    message: 'Sfârșitul nu poate fi înaintea începutului',
    path: ['endsAt'],
  });
type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

function AbsencesDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({
    queryKey: ['drivers', driver?.id],
    queryFn: () => apiFetch<DriverDetailDto>(`/api/drivers/${driver?.id}`),
    enabled: driver !== null,
  });

  const form = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: { type: 'VACATION', startsAt: '', endsAt: '', note: '' },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['drivers'] });
  };

  const addMutation = useMutation({
    mutationFn: (values: AbsenceFormValues) =>
      apiFetch<AbsenceDto>(`/api/drivers/${driver?.id}/absences`, {
        method: 'POST',
        body: { ...values, note: values.note || undefined },
      }),
    onSuccess: () => {
      invalidate();
      form.reset();
      toast.success('Absență adăugată');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (absenceId: string) =>
      apiFetch<void>(`/api/drivers/${driver?.id}/absences/${absenceId}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidate();
      toast.success('Absență ștearsă');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={driver !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Absențe — {driver?.name}</DialogTitle>
          <DialogDescription>
            Perioadele în care șoferul nu poate primi curse; dispecerul AI le respectă la alocare.
          </DialogDescription>
        </DialogHeader>

        {detailQuery.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : detailQuery.data && detailQuery.data.absences.length > 0 ? (
          <ul className="space-y-2">
            {detailQuery.data.absences.map((absence) => (
              <li
                key={absence.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{ABSENCE_TYPE_LABELS[absence.type]}</span>{' '}
                  <span className="font-mono text-muted-foreground">
                    {formatDate(absence.startsAt)} – {formatDate(absence.endsAt)}
                  </span>
                  {absence.note && <p className="text-xs text-muted-foreground">{absence.note}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Șterge absența"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(absence.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nicio absență înregistrată.</p>
        )}

        <Separator />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => addMutation.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="grid grid-cols-3 gap-3">
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
                        {absenceTypeSchema.options.map((type) => (
                          <SelectItem key={type} value={type}>
                            {ABSENCE_TYPE_LABELS[type]}
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
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>De la</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Până la</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notă (opțional)</FormLabel>
                  <FormControl>
                    <Input placeholder="concediu de vară" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" variant="secondary" disabled={addMutation.isPending}>
                <Plus className="size-4" />
                {addMutation.isPending ? 'Se adaugă…' : 'Adaugă absență'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleActiveDialog({
  driver,
  onOpenChange,
}: {
  driver: DriverDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const deactivating = driver?.isActive ?? false;
  const mutation = useMutation({
    mutationFn: async (target: DriverDto) => {
      if (target.isActive) {
        await apiFetch<void>(`/api/drivers/${target.id}`, { method: 'DELETE' });
      } else {
        await apiFetch<DriverDto>(`/api/drivers/${target.id}/activate`, { method: 'POST' });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['drivers'] });
      toast.success(deactivating ? 'Cont dezactivat' : 'Cont reactivat');
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={driver !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{deactivating ? 'Dezactivezi contul?' : 'Reactivezi contul?'}</DialogTitle>
          <DialogDescription>
            {deactivating
              ? `${driver?.name} nu se va mai putea loga și nu va mai primi curse. Istoricul rămâne.`
              : `${driver?.name} se va putea loga din nou și va putea primi curse.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button
            variant={deactivating ? 'destructive' : 'default'}
            disabled={mutation.isPending}
            onClick={() => driver && mutation.mutate(driver)}
          >
            {mutation.isPending ? 'Se aplică…' : deactivating ? 'Dezactivează' : 'Reactivează'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DriversPage() {
  const { data: drivers, isPending } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiFetch<DriverDto[]>('/api/drivers'),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DriverDto | null>(null);
  const [absencesFor, setAbsencesFor] = useState<DriverDto | null>(null);
  const [togglingActive, setTogglingActive] = useState<DriverDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Șoferi</h1>
          <p className="text-sm text-muted-foreground">
            Conturile șoferilor și disponibilitatea lor
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Șofer nou
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !drivers || drivers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Users className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Niciun șofer înregistrat. Adaugă șoferii ca să le poți aloca curse.
          </p>
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" />
            Adaugă șofer
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nume</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Categorii</TableHead>
                <TableHead>Permis expiră</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id} className={cn(!driver.isActive && 'opacity-60')}>
                  <TableCell className="font-medium">{driver.name}</TableCell>
                  <TableCell>
                    <p className="text-sm">{driver.email}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {driver.phone ?? 'fără telefon'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {driver.licenseCategories.map((category) => (
                        <Badge key={category} variant="secondary" className="font-mono">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'font-mono text-sm',
                        expiryLevel(driver.licenseExpiresAt) === 'expired' &&
                          'font-medium text-status-alert',
                        expiryLevel(driver.licenseExpiresAt) === 'soon' &&
                          'font-medium text-status-in-service',
                      )}
                    >
                      {formatDate(driver.licenseExpiresAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {driver.isActive ? (
                      <StatusBadge kind="available" label="Activ" />
                    ) : (
                      <StatusBadge kind="inactive" label="Dezactivat" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Absențele lui ${driver.name}`}
                        onClick={() => setAbsencesFor(driver)}
                      >
                        <CalendarOff className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editează ${driver.name}`}
                        onClick={() => {
                          setEditing(driver);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={
                          driver.isActive
                            ? `Dezactivează ${driver.name}`
                            : `Reactivează ${driver.name}`
                        }
                        onClick={() => setTogglingActive(driver)}
                      >
                        {driver.isActive ? (
                          <UserX className="size-4 text-destructive" />
                        ) : (
                          <RotateCcw className="size-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DriverFormDialog
        driver={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
      <AbsencesDialog driver={absencesFor} onOpenChange={() => setAbsencesFor(null)} />
      <ToggleActiveDialog driver={togglingActive} onOpenChange={() => setTogglingActive(null)} />
    </div>
  );
}
