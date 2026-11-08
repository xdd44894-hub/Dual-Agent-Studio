import { useEffect, useState, type FormEvent } from 'react';
import type { AgentId, VaultApi, VaultStatus } from '../shared/api';

export function VaultPanel({ vault }: { vault: VaultApi }) {
  const [status, setStatus] = useState<VaultStatus>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void vault.status().then(value => {
      if (active) setStatus(value);
    }).catch(() => {
      if (active) setError('无法读取凭据库状态。');
    });
    return () => { active = false; };
  }, [vault]);

  async function run(action: () => Promise<VaultStatus>) {
    setError('');
    setPending(true);
    try {
      setStatus(await action());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '凭据库操作失败。');
    } finally {
      setPending(false);
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get('password'));
    const create = status?.phase === 'missing';
    if (create && password !== values.get('confirmation')) {
      setError('两次输入的主密码不一致。');
      return;
    }
    form.reset();
    void run(() => create ? vault.create(password) : vault.unlock(password));
  }

  function saveCredential(event: FormEvent<HTMLFormElement>, id: AgentId) {
    event.preventDefault();
    const form = event.currentTarget;
    const credential = String(new FormData(form).get('credential'));
    form.reset();
    void run(() => vault.set(id, credential));
  }

  return (
    <div className="vault-panel" aria-label="加密凭据库">
      <h2>加密凭据库</h2>
      <p>离线验收阶段，请使用测试凭据。主密码丢失后无法解锁已有凭据。</p>
      {error && <p role="alert">{error}</p>}
      {status && status.phase !== 'unlocked' &&
        <form onSubmit={submitPassword}>
          <label>主密码<input type="password" name="password" required minLength={12} maxLength={1024}
            autoComplete={status.phase === 'missing' ? 'new-password' : 'current-password'} /></label>
          {status.phase === 'missing' &&
            <label>确认主密码<input type="password" name="confirmation" required maxLength={1024} autoComplete="new-password" /></label>}
          <button disabled={pending}>{status.phase === 'missing' ? '创建凭据库' : '解锁凭据库'}</button>
        </form>}
      {status?.phase === 'unlocked' && <>
        <p role="status">已解锁</p>
        {(['codex', 'deepseek'] as const).map(id => {
          const name = id === 'codex' ? 'Codex' : 'DeepSeek';
          return <form key={id} onSubmit={event => saveCredential(event, id)}>
            <label>{name} 测试凭据（{status.configured[id] ? '已保存' : '未保存'}）
              <input type="password" name="credential" required maxLength={4096} autoComplete="off" />
            </label>
            <button disabled={pending}>保存</button>
            <button type="button" disabled={pending || !status.configured[id]}
              onClick={() => void run(() => vault.remove(id))}>移除</button>
          </form>;
        })}
        <button disabled={pending} onClick={() => void run(() => vault.lock())}>锁定凭据库</button>
      </>}
    </div>
  );
}
