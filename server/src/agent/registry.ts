import type { AgentTool } from './tools/types';
import { calculateRouteTool } from './tools/calculate-route.tool';
import { checkScheduleConflictsTool } from './tools/check-schedule-conflicts.tool';
import { createTripDraftTool } from './tools/create-trip-draft.tool';
import { getAvailableDriversTool } from './tools/get-available-drivers.tool';
import { getAvailableVehiclesTool } from './tools/get-available-vehicles.tool';
import { getClientByNameTool } from './tools/get-client-by-name.tool';

// adaugă tool-uri noi doar aici — loop.ts nu se atinge (vezi .claude/skills/agent-tool)
export const agentTools: AgentTool[] = [
  getAvailableVehiclesTool,
  getAvailableDriversTool,
  getClientByNameTool,
  calculateRouteTool,
  checkScheduleConflictsTool,
  createTripDraftTool,
];

export const agentToolsByName = new Map(agentTools.map((tool) => [tool.definition.name, tool]));
