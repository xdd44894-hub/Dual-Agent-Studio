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
  vault: VaultApi;
  storage(): Promise<StorageInfo>;
  agents(): Promise<AgentState[]>;
  start(id: AgentId, task: string): Promise<void>;
  stop(id: AgentId): Promise<void>;
  onAgentState(listener: (state: AgentState) => void): () => void;
}

export type VaultStatus =
  | { phase: 'missing' | 'locked' }
  | { phase: 'unlocked'; configured: Record<AgentId, boolean> };

export interface VaultApi {
  status(): Promise<VaultStatus>;
  create(passphrase: string): Promise<VaultStatus>;
  unlock(passphrase: string): Promise<VaultStatus>;
  lock(): Promise<VaultStatus>;
  set(id: AgentId, secret: string): Promise<VaultStatus>;
  remove(id: AgentId): Promise<VaultStatus>;
}
