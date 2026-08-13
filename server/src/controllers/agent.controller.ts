import type { Request, Response } from 'express';
import {
  agentMessageSchema,
  approveAgentActionSchema,
  idParamSchema,
  rejectAgentActionSchema,
} from '@fleetpilot/shared';
import type { AgentActionDto, AgentReply } from '@fleetpilot/shared';
import { getAuth } from '../middleware/auth';
import * as agentService from '../services/agent.service';

export async function sendMessage(req: Request, res: Response<AgentReply>): Promise<void> {
  const { companyId, userId } = getAuth(req);
  const { message, history } = agentMessageSchema.parse(req.body);
  res.json(await agentService.sendMessage(companyId, userId, message, history ?? []));
}

export async function list(req: Request, res: Response<AgentActionDto[]>): Promise<void> {
  const { companyId } = getAuth(req);
  res.json(await agentService.listActions(companyId));
}

export async function approve(req: Request, res: Response<AgentActionDto>): Promise<void> {
  const { companyId, userId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const overrides = approveAgentActionSchema.parse(req.body ?? {});
  res.json(await agentService.approveAction(companyId, id, userId, overrides));
}

export async function reject(req: Request, res: Response<AgentActionDto>): Promise<void> {
  const { companyId } = getAuth(req);
  const { id } = idParamSchema.parse(req.params);
  const { note } = rejectAgentActionSchema.parse(req.body ?? {});
  res.json(await agentService.rejectAction(companyId, id, note));
}
