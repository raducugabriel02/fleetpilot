import type Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';

// contractul erodează tipul de input la `unknown` ca registry-ul să poată ține
// tool-uri eterogene într-un singur array fără `any` — fiecare tool își validează
// singur input-ul (schema Zod) înainte de a atinge Prisma
export interface AgentTool {
  definition: Anthropic.Tool;
  run: (companyId: string, rawInput: unknown) => Promise<unknown>;
}

export function defineTool<TSchema extends z.ZodTypeAny>(options: {
  name: string;
  description: string;
  inputSchema: TSchema;
  jsonSchema: Anthropic.Tool.InputSchema;
  execute: (companyId: string, input: z.infer<TSchema>) => Promise<unknown>;
}): AgentTool {
  return {
    definition: {
      name: options.name,
      description: options.description,
      input_schema: options.jsonSchema,
    },
    run: (companyId, rawInput) => options.execute(companyId, options.inputSchema.parse(rawInput)),
  };
}
