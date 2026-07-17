import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import type { ClientDto } from '@fleetpilot/shared';
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

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Ceva n-a mers. Încearcă din nou.';
}

const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Numele e obligatoriu'),
  contactName: z.string().trim(),
  phone: z.string().trim(),
  email: z.string().trim(),
  address: z.string().trim(),
});
type ClientFormValues = z.infer<typeof clientFormSchema>;

function formDefaults(client?: ClientDto): ClientFormValues {
  return {
    name: client?.name ?? '',
    contactName: client?.contactName ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
  };
}

function toPayload(values: ClientFormValues) {
  return {
    name: values.name,
    contactName: values.contactName || null,
    phone: values.phone || null,
    email: values.email || null,
    address: values.address || null,
  };
}

function ClientFormDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    values: formDefaults(client ?? undefined),
  });

  const mutation = useMutation({
    mutationFn: (values: ClientFormValues) =>
      client
        ? apiFetch<ClientDto>(`/api/clients/${client.id}`, {
            method: 'PATCH',
            body: toPayload(values),
          })
        : apiFetch<ClientDto>('/api/clients', { method: 'POST', body: toPayload(values) }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success(client ? `${saved.name} actualizat` : `${saved.name} adăugat`);
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{client ? 'Editează clientul' : 'Client nou'}</DialogTitle>
          <DialogDescription>Firma care comandă transporturi.</DialogDescription>
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
                  <FormLabel>Numele firmei</FormLabel>
                  <FormControl>
                    <Input placeholder="Agrofrig SRL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Persoană de contact</FormLabel>
                    <FormControl>
                      <Input placeholder="Vasile Ionescu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefon</FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="021 318 14 25" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="comenzi@firma.ro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresă</FormLabel>
                  <FormControl>
                    <Input placeholder="Str. Depozitelor 5, Oltenița" {...field} />
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

function DeleteClientDialog({
  client,
  onOpenChange,
}: {
  client: ClientDto | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client șters');
      onOpenChange(false);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Dialog open={client !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ștergi clientul?</DialogTitle>
          <DialogDescription>
            {client?.name} dispare din listă. Clienții cu curse înregistrate nu pot fi șterși.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Renunță
          </Button>
          <Button
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => client && mutation.mutate(client.id)}
          >
            {mutation.isPending ? 'Se șterge…' : 'Șterge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientsPage() {
  const [search, setSearch] = useState('');
  const { data: clients, isPending } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => apiFetch<ClientDto[]>(`/api/clients?search=${encodeURIComponent(search)}`),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDto | null>(null);
  const [deleting, setDeleting] = useState<ClientDto | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clienți</h1>
          <p className="text-sm text-muted-foreground">Firmele care comandă transporturi</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Client nou
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Caută după nume…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <Building2 className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {search
              ? `Niciun client care să conțină „${search}".`
              : 'Niciun client încă. Adaugă firmele pentru care transporti.'}
          </p>
          {!search && (
            <Button variant="outline" onClick={openCreate}>
              <Plus className="size-4" />
              Adaugă client
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firmă</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Adresă</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.contactName ?? '—'}</TableCell>
                  <TableCell className="font-mono text-sm">{client.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm">{client.email ?? '—'}</TableCell>
                  <TableCell className="max-w-56 truncate text-sm text-muted-foreground">
                    {client.address ?? '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editează ${client.name}`}
                        onClick={() => {
                          setEditing(client);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Șterge ${client.name}`}
                        onClick={() => setDeleting(client)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ClientFormDialog
        client={editing}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
      />
      <DeleteClientDialog client={deleting} onOpenChange={() => setDeleting(null)} />
    </div>
  );
}
