import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AgentState, DesktopApi, StorageInfo } from '../shared/api';
import './style.css';

declare global {
  interface Window {
    studio: DesktopApi;
  }
}

const labels: Record<AgentState['phase'], string> = {
  idle: '待命',
  running: '运行中',
  stopping: '正在停止',
  completed: '已完成',
  cancelled: '已取消',
  failed: '失败'
};

function App() {
  const [storage, setStorage] = useState<StorageInfo>();
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [task, setTask] = useState('');
  const [error, setError] = useState('');
  const studio = window.studio;

  useEffect(() => {
    let active = true;
    const changed = new Set<AgentState['id']>();
    const unsubscribe = studio.onAgentState(state => {
      changed.add(state.id);
      setAgents(previous => [...previous.filter(agent => agent.id !== state.id), state]);
    });
    void Promise.all([studio.storage(), studio.agents()]).then(([info, snapshot]) => {
      if (!active) return;
      setStorage(info);
      setAgents(previous => [...snapshot.filter(agent => !changed.has(agent.id)), ...previous]);
    }).catch(() => { if (active) setError('无法读取桌面服务状态。'); });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [studio]);

  async function run(action: () => Promise<void>) {
    setError('');
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '操作失败。');
    }
  }

  return (
    <main>
      <header>
        <p className="tag">V0.2 ALPHA · 离线模拟</p>
        <h1>Dual Agent Studio</h1>
        {storage && <p>{storage.mode === 'portable' ? '便携模式' : '标准模式'} · <code>{storage.root}</code></p>}
      </header>
      <label htmlFor="task">模拟任务</label>
      <textarea id="task" rows={4} maxLength={8000} value={task}
        onChange={event => setTask(event.currentTarget.value)} placeholder="输入一条任务，选择要运行的模拟 Agent。" />
      {error && <p role="alert">{error}</p>}
      <section aria-label="Agent 状态">
        {(['codex', 'deepseek'] as const).map(id => {
          const agent = agents.find(state => state.id === id);
          if (!agent) return null;
          const busy = agent.phase === 'running' || agent.phase === 'stopping';
          return (
            <article key={id}>
              <h2>{id === 'codex' ? 'Codex' : 'DeepSeek'}</h2>
              <p aria-live="polite">{labels[agent.phase]}</p>
              <button disabled={busy || !task.trim()} onClick={() => void run(() => studio.start(id, task))}>运行</button>
              <button disabled={agent.phase !== 'running'} onClick={() => void run(() => studio.stop(id))}>停止</button>
              {agent.error && <p role="alert">{agent.error}</p>}
              {agent.output && <pre>{agent.output}</pre>}
            </article>
          );
        })}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
