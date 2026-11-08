import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import type { AgentId, AgentState } from '../shared/api';
import type { AgentAdapter } from './adapters';

export const MAX_TASK = 8_000;
const MAX_OUTPUT = 16_000;

interface RunningAgent {
  done: Promise<void>;
  stop: (reason: 'cancelled' | 'timeout' | 'failed') => void;
}

export class AgentManager {
  private readonly states = new Map<AgentId, AgentState>();
  private readonly running = new Map<AgentId, RunningAgent>();
  private closing = false;

  constructor(
    private readonly adapters: readonly AgentAdapter[],
    private readonly onChange: (state: AgentState) => void,
    private readonly timeoutMs = 15_000
  ) {
    for (const { id } of adapters) this.states.set(id, { id, phase: 'idle', output: '' });
  }

  list(): AgentState[] {
    return [...this.states.values()];
  }

  start(id: AgentId, task: string): void {
    if (this.closing) throw new Error('Application is closing');
    if (this.running.has(id)) throw new Error('Agent is already running');
    const adapter = this.adapters.find(candidate => candidate.id === id);
    if (!adapter) throw new Error('Unknown agent');

    let child: ChildProcessWithoutNullStreams;
    try {
      child = adapter.start();
    } catch {
      this.update({ id, phase: 'failed', output: '', error: 'Could not start agent' });
      return;
    }

    let output = '';
    let reason: 'cancelled' | 'timeout' | 'failed' | undefined;
    let forceKill: NodeJS.Timeout | undefined;
    let finish!: () => void;
    const done = new Promise<void>(resolve => { finish = resolve; });
    const stop: RunningAgent['stop'] = requested => {
      if (reason) return;
      reason = requested;
      this.update({ id, phase: 'stopping', output });
      child.kill();
      forceKill = setTimeout(() => child.kill('SIGKILL'), 1_000);
    };
    const deadline = setTimeout(() => stop('timeout'), this.timeoutMs);

    child.on('error', () => { reason ??= 'failed'; });
    child.stdin.on('error', () => stop('failed'));
    child.once('close', code => {
      clearTimeout(deadline);
      clearTimeout(forceKill);
      this.running.delete(id);
      const phase = reason === 'cancelled' ? 'cancelled' : !reason && code === 0 ? 'completed' : 'failed';
      const error = reason === 'timeout' ? 'Agent timed out' : 'Agent process failed';
      this.update({ id, phase, output, ...(phase === 'failed' ? { error } : {}) });
      finish();
    });

    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        const remaining = MAX_OUTPUT - output.length;
        if (remaining <= 0 || reason) return;
        output += chunk.slice(0, remaining);
        this.update({ id, phase: 'running', output });
      });
    }

    this.running.set(id, { done, stop });
    this.update({ id, phase: 'running', output });
    child.stdin.end(task);
  }

  stop(id: AgentId): Promise<void> | undefined {
    const running = this.running.get(id);
    running?.stop('cancelled');
    return running?.done;
  }

  async shutdown(): Promise<void> {
    this.closing = true;
    await Promise.all([...this.running.keys()].map(id => this.stop(id)));
  }

  private update(state: AgentState): void {
    this.states.set(state.id, state);
    this.onChange(state);
  }
}
