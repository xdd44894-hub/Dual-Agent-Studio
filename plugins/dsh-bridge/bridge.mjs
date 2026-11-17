import { spawn } from 'node:child_process';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_TEXT = 16_000;
const aliasPattern = /^[a-z0-9][a-z0-9-]{0,47}$/;
const sessionPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const approvalScript = fileURLToPath(new URL('../approve.ps1', import.meta.url));

export function bindingsDirectory() {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('请在 Windows 本地 Work 中运行 DSH Bridge。');
  }
  return join(process.env.LOCALAPPDATA, 'Dual Agent Studio', 'DSH Bridge', 'bindings');
}

function bindingPath(directory, alias) {
  if (!aliasPattern.test(alias)) throw new Error('会话别名格式无效。');
  return join(directory, `${alias}.json`);
}

export async function bind(directory, alias, sessionId, workingDirectory) {
  if (!sessionPattern.test(sessionId)) throw new Error('DSH 会话 ID 格式无效。');
  const path = bindingPath(directory, alias);
  if (!workingDirectory || !isAbsolute(workingDirectory)) throw new Error('请指定 DSH 会话的绝对工作目录。');
  const cwd = await realpath(workingDirectory);
  if (!(await stat(cwd)).isDirectory()) throw new Error('DSH 工作目录无效。');
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify({ sessionId, cwd }), { flag: 'wx' });
}

export async function getSession(directory, alias) {
  const path = bindingPath(directory, alias);
  let data;
  try {
    data = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('未找到会话别名。请先在 Windows 本机登记已有 DSH 会话。');
    throw new Error('无法读取本地会话绑定。');
  }
  if (typeof data?.sessionId !== 'string' || !sessionPattern.test(data.sessionId) ||
      typeof data.cwd !== 'string' || !isAbsolute(data.cwd)) {
    throw new Error('本地会话绑定格式无效。');
  }
  return { sessionId: data.sessionId, cwd: data.cwd };
}

function validateText(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) {
    throw new Error('交接内容须为 1–16000 个字符。');
  }
}

export function createBridge({ directory, approve, run }) {
  let busy = false;
  return async (alias, draft, signal) => {
    validateText(draft);
    if (busy) throw new Error('已有一轮交接在进行。');
    busy = true;
    try {
      signal?.throwIfAborted();
      const session = await getSession(directory(), alias);
      const target = { alias, ...session };
      const prompt = await approve({ ...target, direction: 'to-dsh', text: draft }, signal);
      if (prompt === null) return { status: 'declined_send' };
      validateText(prompt);
      signal?.throwIfAborted();

      const reply = await run(session, prompt, signal);
      signal?.throwIfAborted();
      validateText(reply);
      const approved = await approve({ ...target, direction: 'to-work', text: reply }, signal);
      if (approved === null) return { status: 'declined_return' };
      validateText(approved);
      signal?.throwIfAborted();
      return { status: 'approved', reply: approved };
    } finally {
      busy = false;
    }
  };
}

function runProcess(executable, args, input, signal, timeoutMs, cwd) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, cwd });
    let output = '';
    let failure;
    const timeout = setTimeout(() => stop(new Error('本地操作超时。')), timeoutMs);
    function stop(error) {
      if (failure) return;
      failure = error;
      if (!child.pid || child.exitCode !== null) return;
      // DSH may be started by a Windows command shim beneath PowerShell.
      const killer = spawn(join(process.env.SystemRoot, 'System32', 'taskkill.exe'),
        ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => child.kill());
      killer.on('close', code => { if (code !== 0) child.kill(); });
    }
    const onAbort = () => stop(new Error('Work 已取消本轮交接。'));
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (failure) return;
      output += chunk;
      if (output.length > 256_000) stop(new Error('本地进程输出超过上限。'));
    });
    child.stderr.resume();
    child.on('error', error => { failure ??= error; });
    child.stdin.on('error', () => stop(new Error('无法写入本地进程。')));
    child.on('close', code => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      if (failure) reject(failure);
      else resolve({ code, output });
    });
    child.stdin.end(input, 'utf8');
  });
}

export async function approveWindows(request, signal) {
  const powershell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { code, output } = await runProcess(powershell, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-STA', '-File', approvalScript
  ], JSON.stringify(request), signal, 120_000);
  if (code === 2) return null;
  if (code !== 0) throw new Error('无法打开 Windows 批准对话框。');
  return JSON.parse(output);
}

export async function runDsh({ sessionId, cwd }, prompt, signal) {
  if (!sessionPattern.test(sessionId)) throw new Error('DSH 会话 ID 格式无效。');
  const powershell = join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const script = fileURLToPath(new URL('../run-dsh.ps1', import.meta.url));
  const { code, output } = await runProcess(powershell, [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', script, '-SessionId', sessionId
  ], prompt, signal, 120_000, cwd);
  if (code !== 0) throw new Error('DSH 执行失败。请检查本机 dsh、登录状态、只读配置及会话 ID。');
  return output.trim();
}
