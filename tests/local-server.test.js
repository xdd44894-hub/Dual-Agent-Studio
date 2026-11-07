import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function getFreePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error('Server exited before it became healthy');
    try {
      const response = await fetch(url + '/health', { signal: AbortSignal.timeout(400) });
      if (response.ok) return;
    } catch { /* Not ready yet */ }
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw new Error('Server did not start in time');
}

function requestWithHost(port, host) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/health', headers: { Host: host } }, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode));
    });
    req.once('error', reject);
    req.end();
  });
}

test('loopback server smoke test (no Codex/DeepSeek calls)', { timeout: 16000 }, async t => {
  const port = await getFreePort();
  const workspace = await mkdtemp(join(tmpdir(), 'dual-agent-test-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, DUAL_AGENT_PORT: String(port), DUAL_AGENT_WORKSPACE: workspace },
    stdio: 'ignore',
    windowsHide: true
  });
  t.after(async () => {
    child.kill();
    await rm(workspace, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(url, child);

  await t.test('serves its UI and health', async () => {
    const [index, health] = await Promise.all([fetch(url), fetch(url + '/health')]);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Dual Agent Studio/);
    const payload = await health.json();
    assert.equal(payload.status, 'ok');
    assert.equal(payload.busy, false);
    assert.equal(payload.packaged, false);
  });

  await t.test('rejects foreign Host and Origin', async () => {
    assert.equal(await requestWithHost(port, 'evil.example'), 403);
    const resp = await fetch(url + '/api/run', {
      method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: 'test', mode: 'parallel' })
    });
    assert.equal(resp.status, 403);
  });

  await t.test('does not allow non-JSON requests or invalid tasks', async () => {
    const wrongType = await fetch(url + '/api/run', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'hello'
    });
    assert.equal(wrongType.status, 415);
    const invalid = await fetch(url + '/api/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: '', mode: 'parallel' })
    });
    assert.equal(invalid.status, 400);
  });
});
