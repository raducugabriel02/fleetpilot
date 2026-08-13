import type Anthropic from '@anthropic-ai/sdk';
import type { AgentChatTurn } from '@fleetpilot/shared';
import { AGENT_MODEL, anthropic } from './client';
import { agentTools, agentToolsByName } from './registry';
import { buildAgentSystemPrompt } from './system-prompt';

// plasă de siguranță împotriva unei bucle tool_use -> tool_use fără sfârșit
// (model care nu se oprește niciodată din chemat tool-uri) — nu ar trebui atinsă în practică
const MAX_TOOL_ITERATIONS = 10;

export interface AgentToolCallLog {
  name: string;
  input: unknown;
  output: unknown;
}

export interface AgentLoopResult {
  reply: string;
  toolCalls: AgentToolCallLog[];
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export async function runAgentLoop(
  companyId: string,
  userMessage: string,
  history: AgentChatTurn[] = [],
): Promise<AgentLoopResult> {
  // istoricul e text simplu, fără tool_use — dacă un tur anterior a chemat tool-uri, agentul
  // le poate rechema oricând (sunt citiri ieftine), nu are nevoie să-și amintească rezultatele exacte
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
    { role: 'user', content: userMessage },
  ];
  const toolCalls: AgentToolCallLog[] = [];
  // construit o singură dată per conversație (nu per iterație de tool loop) — data
  // rămâne consistentă chiar dacă bucla durează câteva secunde peste o graniță de minut
  const systemPrompt = buildAgentSystemPrompt();

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      // suficient pentru text explicativ + un tool_use cu justificare (max 300 caractere) pe
      // aceeași iterație — dacă e prea mic, un tool_use trunchiat la mijloc ar da JSON invalid
      max_tokens: 2048,
      system: systemPrompt,
      tools: agentTools.map((tool) => tool.definition),
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      return { reply: extractText(response.content), toolCalls };
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const tool = agentToolsByName.get(block.name);
      if (!tool) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: `Tool necunoscut: ${block.name}`,
          is_error: true,
        });
        continue;
      }
      try {
        const output = await tool.run(companyId, block.input);
        toolCalls.push({ name: block.name, input: block.input, output });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(output),
        });
      } catch (err) {
        // eroarea intră înapoi la model ca tool_result de eroare — poate reformula
        // cererea sau explica userului, în loc să crape tot request-ul
        const message =
          err instanceof Error ? err.message : 'Eroare necunoscută la rularea tool-ului';
        toolCalls.push({ name: block.name, input: block.input, output: { error: message } });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: message,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply: 'Nu am reușit să finalizez cererea — reformuleaz-o sau încearcă din nou.',
    toolCalls,
  };
}
