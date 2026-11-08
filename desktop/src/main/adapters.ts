import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { join } from 'node:path';
import type { AgentId } from '../shared/api';

export interface AgentAdapter {
  readonly id: AgentId;
  start(): ChildProcessWithoutNullStreams;
}

export function createOfflineAdapters(executable: string): AgentAdapter[] {
  return (['codex', 'deepseek'] as const).map(id => ({
    id,
    start() {
      // Pass only the OS variables needed to launch the bundled worker.
      const { SystemRoot, WINDIR } = process.env;
      return spawn(executable, [join(__dirname, 'offline-worker.js'), id], {
        env: { ELECTRON_RUN_AS_NODE: '1', SystemRoot, WINDIR },
        shell: false,
        windowsHide: true
      });
    }
  }));
}
