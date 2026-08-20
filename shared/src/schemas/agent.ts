import { z } from 'zod';

// server-ul nu ține nicio sesiune de conversație — clientul retrimite turele anterioare
// la fiecare mesaj nou, ca agentul să-și amintească ce a întrebat deja (ex. S2 din
// test-dispecer/scenarios.md: cerere incompletă -> întrebare -> completare)
export const agentChatTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});
export type AgentChatTurn = z.infer<typeof agentChatTurnSchema>;

export const agentMessageSchema = z.object({
  message: z.string().trim().min(1, 'Mesajul e gol').max(2000),
  history: z.array(agentChatTurnSchema).max(20).optional(),
});
export type AgentMessageInput = z.infer<typeof agentMessageSchema>;

// forma propunerii construite de tool-ul create_trip_draft — NU e o cursă reală, doar
// un draft afișat dispecerului pentru Aprobă/Modifică/Respinge; numele/plăcuța sunt incluse
// ca să UI-ul nu mai facă alte cereri doar ca să afișeze propunerea
export const agentTripDraftSchema = z.object({
  kind: z.literal('trip_draft'),
  clientId: z.string(),
  clientName: z.string(),
  originAddress: z.string(),
  destAddress: z.string(),
  cargoDescription: z.string(),
  pallets: z.number().int().nullable(),
  weightTons: z.number().nullable(),
  windowStart: z.iso.datetime(),
  windowEnd: z.iso.datetime(),
  vehicleId: z.string().nullable(),
  vehiclePlate: z.string().nullable(),
  driverId: z.string().nullable(),
  driverName: z.string().nullable(),
  justification: z.string(),
});
export type AgentTripDraft = z.infer<typeof agentTripDraftSchema>;

export const agentDecisionSchema = z.enum(['PENDING', 'APPROVED', 'MODIFIED', 'REJECTED']);
export type AgentDecision = z.infer<typeof agentDecisionSchema>;

export const agentActionSchema = z.object({
  id: z.string(),
  requestText: z.string(),
  proposal: agentTripDraftSchema,
  decision: agentDecisionSchema,
  decisionNote: z.string().nullable(),
  tripId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});
export type AgentActionDto = z.infer<typeof agentActionSchema>;

// un pas din bucla agentului (vezi server/src/agent/loop.ts) — input/output sunt
// generate server-side (nu input netrusted de validat), doar afișate ca trace în UI
export const agentToolCallSchema = z.object({
  name: z.string(),
  input: z.unknown(),
  output: z.unknown(),
});
export type AgentToolCall = z.infer<typeof agentToolCallSchema>;

// pas 1 al Fazei 4: agentul poate răspunde doar conversațional, sau conversațional + o
// propunere structurată (dacă a apucat să cheme create_trip_draft cu succes)
export const agentReplySchema = z.object({
  reply: z.string(),
  action: agentActionSchema.nullable(),
  toolCalls: z.array(agentToolCallSchema),
});
export type AgentReply = z.infer<typeof agentReplySchema>;

// suprascrieri opționale la aprobare — dispecerul poate corecta draftul înainte să confirme
// (ex. alt vehicul decât cel propus); orice câmp lipsă rămâne cel din propunere
export const approveAgentActionSchema = z.object({
  clientId: z.cuid('Id de client invalid').optional(),
  originAddress: z.string().trim().min(3).max(200).optional(),
  destAddress: z.string().trim().min(3).max(200).optional(),
  cargoDescription: z.string().trim().min(2).max(300).optional(),
  pallets: z.number().int().positive().max(66).optional(),
  weightTons: z.number().positive().max(60).multipleOf(0.01).optional(),
  windowStart: z.coerce.date('Dată invalidă').optional(),
  windowEnd: z.coerce.date('Dată invalidă').optional(),
  vehicleId: z.cuid('Id de vehicul invalid').optional(),
  driverId: z.cuid('Id de șofer invalid').optional(),
});
export type ApproveAgentActionInput = z.infer<typeof approveAgentActionSchema>;

export const rejectAgentActionSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type RejectAgentActionInput = z.infer<typeof rejectAgentActionSchema>;
