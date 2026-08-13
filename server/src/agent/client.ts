import Anthropic from '@anthropic-ai/sdk';
import { env } from '../lib/env';

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// fixat explicit în CLAUDE.md — nu se schimbă fără să fie discutat
export const AGENT_MODEL = 'claude-sonnet-4-6';
