export type AgentId = 'codex' | 'deepseek';

export interface StorageInfo {
  mode: 'portable' | 'standard';
  root: string;
}

export interface AgentState {
  id: AgentId;
  phase: 'idle' | 'running' | 'stopping' | 'completed' | 'cancelled' | 'failed';
  output: string;
  error?: string;
}

export interface DesktopApi {
  storage(): Promise<StorageInfo>;
  agents(): Promise<AgentState[]>;
  start(id: AgentId, task: string): Promise<void>;
  stop(id: AgentId): Promise<void>;
  onAgentState(listener: (state: AgentState) => void): () => void;
}
