import type { AgentAction, Prisma } from '@prisma/client';
import { agentTripDraftSchema } from '@fleetpilot/shared';
import type {
  AgentActionDto,
  AgentChatTurn,
  AgentReply,
  ApproveAgentActionInput,
} from '@fleetpilot/shared';
import { runAgentLoop } from '../agent/loop';
import type { AgentToolCallLog } from '../agent/loop';
import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import * as tripService from './trip.service';

function toAgentActionDto(action: AgentAction): AgentActionDto {
  return {
    id: action.id,
    requestText: action.requestText,
    // scrisă de create_trip_draft (server-side) — un safeParse eșuat ar însemna coloană
    // coruptă, nu input netrusted; dacă totuși se întâmplă, mai bine crash vizibil decât null tăcut
    proposal: agentTripDraftSchema.parse(action.proposal),
    decision: action.decision,
    decisionNote: action.decisionNote,
    tripId: action.tripId,
    createdAt: action.createdAt.toISOString(),
    decidedAt: action.decidedAt?.toISOString() ?? null,
  };
}

function isTripDraftOutput(output: unknown): boolean {
  return (
    typeof output === 'object' &&
    output !== null &&
    (output as { kind?: unknown }).kind === 'trip_draft'
  );
}

async function findOwnedAction(companyId: string, id: string): Promise<AgentAction> {
  const action = await prisma.agentAction.findFirst({ where: { id, companyId } });
  if (!action) {
    throw new HttpError(404, 'Acțiunea nu există', 'AGENT_ACTION_NOT_FOUND');
  }
  return action;
}

async function createPendingAction(
  companyId: string,
  userId: string,
  requestText: string,
  toolCalls: AgentToolCallLog[],
  rawProposal: unknown,
): Promise<AgentActionDto> {
  // rawProposal vine din output-ul tool-ului create_trip_draft — construit de noi server-side,
  // dar validăm oricum ca să evităm `any` la granița loop -> service
  const proposal = agentTripDraftSchema.parse(rawProposal);
  const action = await prisma.agentAction.create({
    data: {
      companyId,
      userId,
      requestText,
      toolCalls: toolCalls as unknown as Prisma.InputJsonValue,
      proposal: proposal as unknown as Prisma.InputJsonValue,
      decision: 'PENDING',
    },
  });
  return toAgentActionDto(action);
}

// orchestrarea conversației + persistarea propunerii, dacă a rezultat una — locul unde trăiește
// regula "ce anume devine AgentAction", nu în controller
export async function sendMessage(
  companyId: string,
  userId: string,
  message: string,
  history: AgentChatTurn[],
): Promise<AgentReply> {
  const result = await runAgentLoop(companyId, message, history);

  // ultima propunere reușită din conversație — dacă modelul a mai încercat și a eșuat
  // înainte (capacitate/conflict), acelea nu ajung propunere, doar reformularea finală
  const draftCall = [...result.toolCalls]
    .reverse()
    .find((call) => call.name === 'create_trip_draft' && isTripDraftOutput(call.output));

  const action = draftCall
    ? await createPendingAction(companyId, userId, message, result.toolCalls, draftCall.output)
    : null;

  return { reply: result.reply, action, toolCalls: result.toolCalls };
}

export async function listActions(companyId: string): Promise<AgentActionDto[]> {
  const actions = await prisma.agentAction.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });
  return actions.map(toAgentActionDto);
}

export async function approveAction(
  companyId: string,
  id: string,
  userId: string,
  overrides: ApproveAgentActionInput,
): Promise<AgentActionDto> {
  const current = await findOwnedAction(companyId, id);
  const draft = agentTripDraftSchema.parse(current.proposal);
  const isModified = Object.keys(overrides).length > 0;
  const finalDecision = isModified ? 'MODIFIED' : 'APPROVED';

  // claim atomic ÎNAINTE de a crea cursa: where-ul pe decision:'PENDING' garantează că
  // dintre două aprobări concurente pe aceeași acțiune (dublu-click, retry de rețea),
  // doar una trece mai departe — altfel s-ar putea crea două curse pentru o singură propunere
  const claim = await prisma.agentAction.updateMany({
    where: { id: current.id, companyId, decision: 'PENDING' },
    data: { decision: finalDecision },
  });
  if (claim.count === 0) {
    throw new HttpError(409, 'Acțiunea a fost deja decisă', 'AGENT_ACTION_DECIDED');
  }

  try {
    const trip = await tripService.createTrip(companyId, userId, {
      clientId: overrides.clientId ?? draft.clientId,
      originAddress: overrides.originAddress ?? draft.originAddress,
      destAddress: overrides.destAddress ?? draft.destAddress,
      cargoDescription: overrides.cargoDescription ?? draft.cargoDescription,
      pallets: overrides.pallets ?? draft.pallets ?? undefined,
      weightTons: overrides.weightTons ?? draft.weightTons ?? undefined,
      windowStart: overrides.windowStart ?? new Date(draft.windowStart),
      windowEnd: overrides.windowEnd ?? new Date(draft.windowEnd),
    });

    // alocarea e best-effort: dacă vehiculul/șoferul propus a devenit între timp indisponibil
    // (altă alocare concurentă), cursa tot există (status REQUEST) — dispecerul o alocă manual
    // din pagina Curse. Nu lăsăm un race pe candidatul vechi să blocheze aprobarea în sine.
    const vehicleId = overrides.vehicleId ?? draft.vehicleId ?? undefined;
    const driverId = overrides.driverId ?? draft.driverId ?? undefined;
    let assignNote: string | undefined;
    if (vehicleId && driverId) {
      try {
        await tripService.assignTrip(companyId, trip.id, { vehicleId, driverId });
      } catch (err) {
        assignNote =
          err instanceof HttpError
            ? `Cursa a rămas nealocată: ${err.message}`
            : 'Cursa a rămas nealocată (eroare neașteptată la alocare)';
      }
    }

    const decisionNote = [isModified ? 'Propunere modificată de dispecer' : null, assignNote]
      .filter(Boolean)
      .join(' — ');

    const updated = await prisma.agentAction.update({
      where: { id: current.id },
      data: { decisionNote: decisionNote || null, decidedAt: new Date(), tripId: trip.id },
    });
    return toAgentActionDto(updated);
  } catch (err) {
    // claim-ul a apucat deja să scrie decizia finală; dacă totuși crearea cursei a eșuat
    // (ex. clientul a dispărut între timp), readucem acțiunea la PENDING ca să poată fi reîncercată
    await prisma.agentAction
      .updateMany({
        where: { id: current.id, decision: finalDecision },
        data: { decision: 'PENDING' },
      })
      .catch(() => {});
    throw err;
  }
}

export async function rejectAction(
  companyId: string,
  id: string,
  note: string | undefined,
): Promise<AgentActionDto> {
  const current = await findOwnedAction(companyId, id);
  const claim = await prisma.agentAction.updateMany({
    where: { id: current.id, companyId, decision: 'PENDING' },
    data: { decision: 'REJECTED', decisionNote: note ?? null, decidedAt: new Date() },
  });
  if (claim.count === 0) {
    throw new HttpError(409, 'Acțiunea a fost deja decisă', 'AGENT_ACTION_DECIDED');
  }
  return toAgentActionDto(await findOwnedAction(companyId, id));
}
