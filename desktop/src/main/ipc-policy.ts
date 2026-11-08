import type { AgentId } from '../shared/api';
import { MAX_TASK } from './agent-manager';

export const APP_URL = 'studio://app/index.html';

export function isTrustedSender(sender: unknown, expected: unknown, frame: { url: string; parent: unknown } | null): boolean {
  return expected != null && sender === expected && frame?.parent === null && frame.url === APP_URL;
}

export function agentId(value: unknown): AgentId {
  if (value === 'codex' || value === 'deepseek') return value;
  throw new Error('Invalid agent');
}

export function agentTask(value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_TASK || !value.trim()) {
    throw new Error('Invalid task');
  }
  return value.trim();
}
