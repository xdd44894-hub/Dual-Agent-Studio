import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isSea, getAsset } from 'node:sea';

const HOST = '127.0.0.1';
const PORT = Number(process.env.DUAL_AGENT_PORT ?? 3700);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('DUAL_AGENT_PORT must be an integer from 1 to 65535');
}
const APP_DATA = join(process.env.LOCALAPPDATA || homedir(), 'DualAgentStudio');
const WORKSPACE = process.env.DUAL_AGENT_WORKSPACE || join(APP_DATA, 'test-workspace');
mkdirSync(WORKSPACE, { recursive: true });

// The packaged EXE embeds the UI. Development mode reads index.html beside server.js.
const page = isSea()
  ? getAsset('index.html', 'utf8')
  : readFileSync(join(import.meta.dirname, 'index.html'), 'utf8');

// First version: one-shot conversations, read-only, no direct project modification.
// The Windows shell commands are constants; user input is passed through stdin only.
const COMMANDS = {
  codex: 'codex exec --sandbox read-only --skip-git-repo-check -',
  deepseek: 'dsh --profile headless --permission-mode read-only -'
};

function findCommand(command) {
  if (process.platform !== 'win32') return { found: false, path: null };
  const result = spawnSync('where.exe', [command], {
    encoding: 'utf8', windowsHide: true, timeout: 5000
  });
  const firstPath = (result.stdout || '').trim().split(/\r?\n/)[0] || null;
  return { found: result.status === 0 && Boolean(firstPath), path: firstPath };
}

const agentStatus = {
  codex: findCommand('codex'),
  deepseek: findCommand('dsh')
};

function runAgent(agent, prompt) {
  return new Promise((resolveResult, reject) => {
    const cmd = COMMANDS[agent];
    if (!cmd) return reject(new Error('Unknown agent'));
    const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', cmd], {
      cwd: WORKSPACE,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '', stderr = '', finished = false;
    const done = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      error ? reject(error) : resolveResult(value);
    };
    const timeout = setTimeout(() => {
      child.kill();
      done(new Error(`${agent} timed out after 180 seconds`));
    }, 180_000);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stdout.length > 150000) child.kill();
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-12000); });
    child.on('error', error => done(error));
    child.on('close', code => {
      if (code !== 0) return done(new Error(`${agent} exit ${code}: ${stderr.slice(-2500) || stdout.slice(-2500)}`));
      done(null, stdout.trim() || '(No final text returned)');
    });
    child.stdin.on('error', () => {});
    child.stdin.end(prompt, 'utf8');
  });
}

const safeRun = async (name, prompt) => {
  try { return { ok: true, text: await runAgent(name, prompt) }; }
  catch (error) { return { ok: false, error: String(error.message || error) }; }
};

async function handleJob(task, mode) {
  const original = `You are discussing a technical task with another AI agent. Answer in Chinese.\nRead-only consultation: do not modify files, install packages, or run destructive commands.\nTask: ${task}`;
  const [codex, deepseek] = await Promise.all([
    safeRun('codex', original), safeRun('deepseek', original)
  ]);
  const rounds = [{ codex, deepseek }];
  if (mode === 'discuss' && codex.ok && deepseek.ok) {
    const limit = s => s.slice(0, 12000);
    const [nextCodex, nextDeepseek] = await Promise.all([
      safeRun('codex', `${original}\n\nMy previous answer:\n${limit(codex.text)}\n\nDeepSeek's response:\n${limit(deepseek.text)}\n\nPlease identify disagreements and propose a practical joint decision. Do not modify files.`),
      safeRun('deepseek', `${original}\n\nMy previous answer:\n${limit(deepseek.text)}\n\nCodex's response:\n${limit(codex.text)}\n\nPlease identify disagreements and propose a practical joint decision. Do not modify files.`)
    ]);
    rounds.push({ codex: nextCodex, deepseek: nextDeepseek });
  }
  return { mode, task, rounds };
}

const writeJSON = (res, status, object) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(object));
};

let busy = false;
const server = http.createServer(async (req, res) => {
  // Reject DNS rebinding and cross-origin attempts before reading any input.
  const allowedHosts = new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]);
  if (!allowedHosts.has(req.headers.host || '')) {
    return writeJSON(res, 403, { error: 'Untrusted Host header' });
  }
  const origin = req.headers.origin;
  if (origin && origin !== `http://${HOST}:${PORT}` && origin !== `http://localhost:${PORT}`) {
    return writeJSON(res, 403, { error: 'Foreign origin not allowed' });
  }
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store'
    });
    return res.end(page);
  }
  if (req.method === 'GET' && req.url === '/health') {
    return writeJSON(res, 200, {
      status: 'ok', busy, packaged: isSea(), workspace: WORKSPACE, agents: agentStatus
    });
  }
  if (req.method !== 'POST' || req.url !== '/api/run') return writeJSON(res, 404, { error: 'Not found' });
  if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return writeJSON(res, 415, { error: 'Content-Type must be application/json' });
  }
  if (busy) return writeJSON(res, 429, { error: 'Another job is in progress' });
  let body = '';
  let bodyBytes = 0;
  let acquiredJobLock = false;
  try {
    for await (const chunk of req) {
      bodyBytes += chunk.length;
      if (bodyBytes > 16_000) return writeJSON(res, 413, { error: 'Request too large' });
      body += chunk.toString('utf8');
    }
    const input = JSON.parse(body);
    const task = typeof input.task === 'string' ? input.task.trim() : '';
    const mode = input.mode;
    if (!task || task.length > 4000 || !['parallel', 'discuss'].includes(mode)) {
      return writeJSON(res, 400, { error: 'Invalid task or mode' });
    }
    // Recheck after the asynchronous body read: concurrent requests may overlap.
    if (busy) return writeJSON(res, 429, { error: 'Another job is in progress' });
    busy = true;
    acquiredJobLock = true;
    const result = await handleJob(task, mode);
    writeJSON(res, 200, result);
  } catch (error) {
    writeJSON(res, 500, { error: String(error.message || error) });
  } finally {
    // Only the handler that acquired the job lock may release it.
    if (acquiredJobLock) busy = false;
  }
});

function openBrowser() {
  if (process.platform !== 'win32') return;
  const child = spawn('explorer.exe', [`http://${HOST}:${PORT}`], {
    detached: true, stdio: 'ignore', windowsHide: true
  });
  child.unref();
}

server.on('error', error => {
  console.error(`\n无法启动本地服务器：${error.message}`);
  if (error.code === 'EADDRINUSE') console.error(`端口 ${PORT} 已被占用。请关闭另一个 Dual Agent Studio 实例后重试。`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log('==============================================');
  console.log(' Dual Agent Studio V0.1.1');
  console.log(` 本地控制台：http://${HOST}:${PORT}`);
  console.log(` 工作目录：${WORKSPACE}`);
  console.log(` Codex CLI：${agentStatus.codex.found ? '已找到命令' : '未找到命令'}`);
  console.log(` DeepSeek CLI：${agentStatus.deepseek.found ? '已找到命令' : '未找到命令'}`);
  console.log(' 注意：命令存在不代表账号登录或模型额度可用。');
  console.log(' 按 Ctrl+C 关闭服务器。');
  console.log('==============================================');
  if (isSea()) setTimeout(openBrowser, 700);
});

process.on('SIGINT', () => {
  console.log('\n正在关闭 Dual Agent Studio…');
  server.close(() => process.exit(0));
});
