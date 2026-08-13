import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bot, History, Pencil, Send, Sparkles, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import type {
  AgentActionDto,
  AgentDecision,
  AgentReply,
  ApproveAgentActionInput,
  ClientDto,
  DriverDto,
  VehicleDto,
} from '@fleetpilot/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatDateTime, toDateTimeInputValue } from '@/lib/format';

const SUGGESTIONS = [
  'Transport 4 paleți Oltenița - Constanța joi dimineața, client Agrofrig',
  'Cât costă și cât durează o cursă până la Brașov?',
  'Urgent, 2 camioane București - Cluj mâine',
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action: AgentActionDto | null;
}

const DECISION_META: Record<
  AgentDecision,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  PENDING: { label: 'În așteptare', variant: 'outline' },
  APPROVED: { label: 'Aprobată', variant: 'default' },
  MODIFIED: { label: 'Aprobată (modificată)', variant: 'secondary' },
  REJECTED: { label: 'Respinsă', variant: 'destructive' },
};

const editFormSchema = z
  .object({
    clientId: z.string().trim().min(1, 'Alege un client'),
    originAddress: z.string().trim().min(3, 'Adresa e prea scurtă'),
    destAddress: z.string().trim().min(3, 'Adresa e prea scurtă'),
    cargoDescription: z.string().trim().min(2, 'Descrie pe scurt marfa'),
    pallets: z.string().trim(),
    weightTons: z.string().trim(),
    windowStart: z.string().min(1, 'Data e obligatorie'),
    windowEnd: z.string().min(1, 'Data e obligatorie'),
    vehicleId: z.string(),
    driverId: z.string(),
  })
  .refine((value) => new Date(value.windowStart) < new Date(value.windowEnd), {
    message: 'Fereastra trebuie să se termine după ce începe',
    path: ['windowEnd'],
  });
type EditFormValues = z.infer<typeof editFormSchema>;

const UNASSIGNED = 'none';

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function draftDefaults(draft: AgentActionDto['proposal']): EditFormValues {
  return {
    clientId: draft.clientId,
    originAddress: draft.originAddress,
    destAddress: draft.destAddress,
    cargoDescription: draft.cargoDescription,
    pallets: draft.pallets != null ? String(draft.pallets) : '',
    weightTons: draft.weightTons != null ? String(draft.weightTons) : '',
    windowStart: toDateTimeInputValue(draft.windowStart),
    windowEnd: toDateTimeInputValue(draft.windowEnd),
    vehicleId: draft.vehicleId ?? UNASSIGNED,
    driverId: draft.driverId ?? UNASSIGNED,
  };
}

// suprascrieri = doar câmpurile chiar schimbate față de draft, nu toate — altfel decizia
// s-ar loga mereu ca MODIFIED în audit log, chiar dacă userul n-a atins nimic
function buildOverrides(
  values: EditFormValues,
  draft: AgentActionDto['proposal'],
): ApproveAgentActionInput {
  const overrides: ApproveAgentActionInput = {};
  if (values.clientId !== draft.clientId) overrides.clientId = values.clientId;
  if (values.originAddress !== draft.originAddress) overrides.originAddress = values.originAddress;
  if (values.destAddress !== draft.destAddress) overrides.destAddress = values.destAddress;
  if (values.cargoDescription !== draft.cargoDescription) {
    overrides.cargoDescription = values.cargoDescription;
  }
  if (values.pallets.trim()) {
    const pallets = Number(values.pallets);
    if (pallets !== draft.pallets) overrides.pallets = pallets;
  }
  if (values.weightTons.trim()) {
    const weightTons = Number(values.weightTons);
    if (weightTons !== draft.weightTons) overrides.weightTons = weightTons;
  }
  const windowStartIso = new Date(values.windowStart).toISOString();
  if (windowStartIso !== draft.windowStart) overrides.windowStart = new Date(windowStartIso);
  const windowEndIso = new Date(values.windowEnd).toISOString();
  if (windowEndIso !== draft.windowEnd) overrides.windowEnd = new Date(windowEndIso);
  // "Nealocat" în formular nu poate șterge o alocare existentă (schema de aprobare nu are
  // semantică de "golește câmpul"), doar poate alege un candidat nou
  if (values.vehicleId !== UNASSIGNED && values.vehicleId !== draft.vehicleId) {
    overrides.vehicleId = values.vehicleId;
  }
  if (values.driverId !== UNASSIGNED && values.driverId !== draft.driverId) {
    overrides.driverId = values.driverId;
  }
  return overrides;
}

function AgentProposalEditForm({
  action,
  onCancel,
  onSaved,
}: {
  action: AgentActionDto;
  onCancel: () => void;
  onSaved: (updated: AgentActionDto) => void;
}) {
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: () => apiFetch<ClientDto[]>('/api/clients'),
  });
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => apiFetch<VehicleDto[]>('/api/vehicles'),
  });
  const driversQuery = useQuery({
    queryKey: ['drivers'],
    queryFn: () => apiFetch<DriverDto[]>('/api/drivers'),
  });
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: draftDefaults(action.proposal),
  });

  const mutation = useMutation({
    mutationFn: (values: EditFormValues) =>
      apiFetch<AgentActionDto>(`/api/agent/actions/${action.id}/approve`, {
        method: 'POST',
        body: buildOverrides(values, action.proposal),
      }),
    onSuccess: (updated) => {
      toast.success('Propunere modificată și aprobată');
      onSaved(updated);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const activeDrivers = driversQuery.data?.filter((d) => d.isActive) ?? [];
  const errors = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        if (!values.pallets.trim() && !values.weightTons.trim()) {
          form.setError('pallets', { message: 'Specifică paleții sau tonajul (măcar una)' });
          return;
        }
        mutation.mutate(values);
      })}
      className="space-y-3 border-t pt-3"
      noValidate
    >
      <div>
        <label htmlFor="edit-clientId" className="text-xs font-medium text-muted-foreground">
          Client
        </label>
        <Select
          value={form.watch('clientId')}
          onValueChange={(value) => form.setValue('clientId', value, { shouldValidate: true })}
        >
          <SelectTrigger
            id="edit-clientId"
            className="mt-1 w-full"
            aria-invalid={!!errors.clientId}
            aria-describedby={errors.clientId ? 'edit-clientId-error' : undefined}
          >
            <SelectValue placeholder="Alege clientul" />
          </SelectTrigger>
          <SelectContent>
            {clientsQuery.data?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError id="edit-clientId-error" message={errors.clientId?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-originAddress" className="text-xs font-medium text-muted-foreground">
            Origine
          </label>
          <Input
            id="edit-originAddress"
            className="mt-1"
            aria-invalid={!!errors.originAddress}
            aria-describedby={errors.originAddress ? 'edit-originAddress-error' : undefined}
            {...form.register('originAddress')}
          />
          <FieldError id="edit-originAddress-error" message={errors.originAddress?.message} />
        </div>
        <div>
          <label htmlFor="edit-destAddress" className="text-xs font-medium text-muted-foreground">
            Destinație
          </label>
          <Input
            id="edit-destAddress"
            className="mt-1"
            aria-invalid={!!errors.destAddress}
            aria-describedby={errors.destAddress ? 'edit-destAddress-error' : undefined}
            {...form.register('destAddress')}
          />
          <FieldError id="edit-destAddress-error" message={errors.destAddress?.message} />
        </div>
      </div>
      <div>
        <label
          htmlFor="edit-cargoDescription"
          className="text-xs font-medium text-muted-foreground"
        >
          Marfă
        </label>
        <Input
          id="edit-cargoDescription"
          className="mt-1"
          aria-invalid={!!errors.cargoDescription}
          aria-describedby={errors.cargoDescription ? 'edit-cargoDescription-error' : undefined}
          {...form.register('cargoDescription')}
        />
        <FieldError id="edit-cargoDescription-error" message={errors.cargoDescription?.message} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-pallets" className="text-xs font-medium text-muted-foreground">
            Paleți
          </label>
          <Input
            id="edit-pallets"
            className="mt-1"
            type="number"
            min="0"
            step="1"
            aria-invalid={!!errors.pallets}
            aria-describedby={errors.pallets ? 'edit-pallets-error' : undefined}
            {...form.register('pallets')}
          />
          <FieldError id="edit-pallets-error" message={errors.pallets?.message} />
        </div>
        <div>
          <label htmlFor="edit-weightTons" className="text-xs font-medium text-muted-foreground">
            Tonaj
          </label>
          <Input
            id="edit-weightTons"
            className="mt-1"
            type="number"
            min="0"
            step="0.01"
            aria-invalid={!!errors.weightTons}
            aria-describedby={errors.weightTons ? 'edit-weightTons-error' : undefined}
            {...form.register('weightTons')}
          />
          <FieldError id="edit-weightTons-error" message={errors.weightTons?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-windowStart" className="text-xs font-medium text-muted-foreground">
            Fereastră de la
          </label>
          <Input
            id="edit-windowStart"
            className="mt-1"
            type="datetime-local"
            aria-invalid={!!errors.windowStart}
            aria-describedby={errors.windowStart ? 'edit-windowStart-error' : undefined}
            {...form.register('windowStart')}
          />
          <FieldError id="edit-windowStart-error" message={errors.windowStart?.message} />
        </div>
        <div>
          <label htmlFor="edit-windowEnd" className="text-xs font-medium text-muted-foreground">
            Fereastră până la
          </label>
          <Input
            id="edit-windowEnd"
            className="mt-1"
            type="datetime-local"
            aria-invalid={!!errors.windowEnd}
            aria-describedby={errors.windowEnd ? 'edit-windowEnd-error' : undefined}
            {...form.register('windowEnd')}
          />
          <FieldError id="edit-windowEnd-error" message={errors.windowEnd?.message} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="edit-vehicleId" className="text-xs font-medium text-muted-foreground">
            Vehicul
          </label>
          <Select
            value={form.watch('vehicleId')}
            onValueChange={(value) => form.setValue('vehicleId', value)}
          >
            <SelectTrigger id="edit-vehicleId" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nealocat</SelectItem>
              {vehiclesQuery.data?.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.plateNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="edit-driverId" className="text-xs font-medium text-muted-foreground">
            Șofer
          </label>
          <Select
            value={form.watch('driverId')}
            onValueChange={(value) => form.setValue('driverId', value)}
          >
            <SelectTrigger id="edit-driverId" className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Nealocat</SelectItem>
              {activeDrivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Renunță
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? 'Se salvează…' : 'Confirmă modificarea'}
        </Button>
      </div>
    </form>
  );
}

function AgentProposalCard({
  action,
  onChanged,
}: {
  action: AgentActionDto;
  onChanged: (updated: AgentActionDto) => void;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit' | 'reject'>('view');
  const [rejectNote, setRejectNote] = useState('');
  const { proposal: draft, decision } = action;
  const meta = DECISION_META[decision];

  const invalidateHistory = () =>
    void queryClient.invalidateQueries({ queryKey: ['agent', 'actions'] });
  // aprobarea creează (și uneori alocă) o cursă reală — dacă dispecerul are deschis
  // Trips/Dashboard, cache-ul lor (staleTime 30s) ar arăta date vechi altfel
  const invalidateAfterApprove = () => {
    invalidateHistory();
    void queryClient.invalidateQueries({ queryKey: ['trips'] });
  };

  const approveMutation = useMutation({
    mutationFn: () =>
      apiFetch<AgentActionDto>(`/api/agent/actions/${action.id}/approve`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: (updated) => {
      toast.success('Cursă creată din propunere');
      onChanged(updated);
      invalidateAfterApprove();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiFetch<AgentActionDto>(`/api/agent/actions/${action.id}/reject`, {
        method: 'POST',
        body: { note: rejectNote.trim() || undefined },
      }),
    onSuccess: (updated) => {
      toast.success('Propunere respinsă');
      onChanged(updated);
      setMode('view');
      invalidateHistory();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card className="mt-2 gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Propunere de cursă</CardTitle>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-4 text-sm">
        <p className="font-medium">{draft.clientName}</p>
        <p>
          {draft.originAddress} → {draft.destAddress}
        </p>
        <p className="text-muted-foreground">{draft.cargoDescription}</p>
        <p className="text-muted-foreground">
          {draft.pallets != null ? `${draft.pallets} paleți` : null}
          {draft.pallets != null && draft.weightTons != null ? ' · ' : null}
          {draft.weightTons != null ? `${draft.weightTons} t` : null}
        </p>
        <p className="text-muted-foreground">
          {formatDateTime(draft.windowStart)} → {formatDateTime(draft.windowEnd)}
        </p>
        <p>
          {draft.vehiclePlate && draft.driverName ? (
            <span className="font-mono">
              {draft.vehiclePlate} · {draft.driverName}
            </span>
          ) : (
            <span className="text-muted-foreground">nealocată</span>
          )}
        </p>
        <p className="border-t pt-2 text-xs text-muted-foreground italic">{draft.justification}</p>
        {action.decisionNote && (
          <p className="text-xs text-muted-foreground">{action.decisionNote}</p>
        )}

        {decision === 'PENDING' && mode === 'view' && (
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              disabled={approveMutation.isPending}
              onClick={() => approveMutation.mutate()}
            >
              {approveMutation.isPending ? 'Se aprobă…' : 'Aprobă'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
              <Pencil className="size-3.5" />
              Modifică
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setMode('reject')}
            >
              <X className="size-3.5" />
              Respinge
            </Button>
          </div>
        )}

        {decision === 'PENDING' && mode === 'reject' && (
          <div className="space-y-2 border-t pt-3">
            <Input
              placeholder="Motiv (opțional)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode('view')}>
                Renunță
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending ? 'Se respinge…' : 'Confirmă respingerea'}
              </Button>
            </div>
          </div>
        )}

        {decision === 'PENDING' && mode === 'edit' && (
          <AgentProposalEditForm
            action={action}
            onCancel={() => setMode('view')}
            onSaved={(updated) => {
              onChanged(updated);
              invalidateAfterApprove();
              setMode('view');
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AgentHistoryPanel() {
  const historyQuery = useQuery({
    queryKey: ['agent', 'actions'],
    queryFn: () => apiFetch<AgentActionDto[]>('/api/agent/actions'),
  });

  return (
    <Card className="h-fit gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <History className="size-4" />
          Istoric decizii
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {historyQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !historyQuery.data || historyQuery.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nicio propunere încă.</p>
        ) : (
          <ul className="space-y-3">
            {historyQuery.data.map((item) => (
              <li key={item.id} className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.proposal.clientName}</p>
                  <Badge variant={DECISION_META[item.decision].variant} className="shrink-0">
                    {DECISION_META[item.decision].label}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {item.proposal.originAddress} → {item.proposal.destAddress}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AgentMessageBubble({
  message,
  onActionChanged,
}: {
  message: ChatMessage;
  onActionChanged: (updated: AgentActionDto) => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        }`}
        aria-hidden
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </span>
      <div className={`max-w-[85%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            isUser
              ? 'rounded-tr-sm bg-primary text-primary-foreground'
              : 'rounded-tl-sm border bg-card'
          }`}
        >
          {message.content}
        </div>
        {message.action && (
          <AgentProposalCard action={message.action} onChanged={onActionChanged} />
        )}
      </div>
    </div>
  );
}

export function AgentChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (text: string) =>
      apiFetch<AgentReply>('/api/agent/message', {
        method: 'POST',
        body: {
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        },
      }),
    onSuccess: (reply) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: reply.reply, action: reply.action },
      ]);
      if (reply.action) {
        void queryClient.invalidateQueries({ queryKey: ['agent', 'actions'] });
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || mutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: trimmed, action: null },
    ]);
    setInput('');
    mutation.mutate(trimmed);
  };

  const updateAction = (updated: AgentActionDto) => {
    setMessages((prev) =>
      prev.map((m) => (m.action?.id === updated.id ? { ...m, action: updated } : m)),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" />
          Dispecer AI
        </h1>
        <p className="text-sm text-muted-foreground">
          Descrie cererea de transport în limbaj natural — propunerea rezultată tot tu o aprobi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="flex h-[70vh] flex-col gap-0 py-0">
          <div
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Bot className="size-8 text-muted-foreground" />
                <p className="max-w-sm text-sm text-muted-foreground">
                  Scrie o cerere de transport, la fel cum ai suna dispecerul — agentul verifică
                  disponibilitatea și propune o alocare. Nimic nu se creează fără aprobarea ta.
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s} variant="outline" size="sm" onClick={() => send(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <AgentMessageBubble key={m.id} message={m} onActionChanged={updateAction} />
              ))
            )}
            {mutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bot className="size-4" />
                Dispecerul se gândește…
              </div>
            )}
            <div ref={scrollRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t p-3"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="ex: transport 4 paleți Oltenița - Constanța joi dimineața, client Agrofrig"
              className="max-h-40 flex-1 resize-none"
              rows={1}
            />
            <Button type="submit" size="icon" disabled={mutation.isPending || !input.trim()}>
              <Send className="size-4" />
              <span className="sr-only">Trimite</span>
            </Button>
          </form>
        </Card>

        <AgentHistoryPanel />
      </div>
    </div>
  );
}
