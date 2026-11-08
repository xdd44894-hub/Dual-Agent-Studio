const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { test } = require('node:test');
const { createOfflineAdapters } = require('../dist/main/adapters.js');
const { AgentManager } = require('../dist/main/agent-manager.js');
const { APP_URL, isTrustedSender, agentId, agentTask } = require('../dist/main/ipc-policy.js');
const { initializeStorage } = require('../dist/main/storage.js');

function storageFixture(t) {
  const base = fs.mkdtempSync(join(tmpdir(), 'dual-agent-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const appData = join(base, 'appdata');
  const launcher = join(base, 'USB');
  fs.mkdirSync(launcher);
  return { base, appData, launcher, exe: join(base, 'extracted', 'studio.exe') };
}

test('standard data lives under the application data directory', t => {
  const { exe, appData } = storageFixture(t);
  const root = join(appData, 'Dual Agent Studio');
  assert.deepEqual(initializeStorage(exe, appData), { mode: 'standard', root });
  assert.deepEqual(fs.readdirSync(root).sort(), ['Chromium', 'Security']);
});

test('folder build uses the marker beside the executable', t => {
  const { appData, launcher } = storageFixture(t);
  fs.writeFileSync(join(launcher, 'portable.flag'), '');
  assert.deepEqual(initializeStorage(join(launcher, 'studio.exe'), appData), {
    mode: 'portable', root: join(launcher, 'Data')
  });
});

test('single EXE detects the marker beside the original launcher', t => {
  const { exe, appData, launcher } = storageFixture(t);
  fs.writeFileSync(join(launcher, 'portable.flag'), '');
  assert.deepEqual(initializeStorage(exe, appData, launcher), {
    mode: 'portable', root: join(launcher, 'Data')
  });
});

test('portable initialization failure never creates standard storage', t => {
  const { exe, appData, launcher } = storageFixture(t);
  fs.writeFileSync(join(launcher, 'portable.flag'), '');
  fs.writeFileSync(join(launcher, 'Data'), '');
  assert.throws(() => initializeStorage(exe, appData, launcher), /Cannot write to the data directory/);
  assert.equal(fs.existsSync(appData), false);
});

test('IPC permits only the intended top-level document and bounded tasks', () => {
  const contents = {};
  const frame = { parent: null, url: APP_URL };
  assert.equal(isTrustedSender(contents, contents, frame), true);
  assert.equal(isTrustedSender({}, contents, frame), false);
  assert.equal(isTrustedSender(contents, contents, { ...frame, parent: {} }), false);
  assert.equal(isTrustedSender(contents, contents, { ...frame, url: 'studio://app/other.html' }), false);
  assert.equal(isTrustedSender(contents, contents, null), false);
  assert.equal(agentId('deepseek'), 'deepseek');
  assert.throws(() => agentId('shell'), /Invalid agent/);
  assert.equal(agentTask('  hello  '), 'hello');
  for (const invalid of ['', ' '.repeat(20), 'x'.repeat(8001), {}, null]) {
    assert.throws(() => agentTask(invalid), /Invalid task/);
  }
});

test('both adapters run bundled mock processes and report completion', { timeout: 5000 }, async t => {
  const events = [];
  let complete;
  const finished = new Promise(resolve => { complete = resolve; });
  const manager = new AgentManager(createOfflineAdapters(process.execPath), state => {
    events.push(state);
    if (manager.list().every(agent => agent.phase === 'completed')) complete();
  });
  t.after(() => manager.shutdown());
  manager.start('codex', 'hello');
  manager.start('deepseek', '模拟');
  await finished;
  assert.ok(events.some(state => state.phase === 'running'));
  const [codex, deepseek] = manager.list();
  assert.match(codex.output, /Codex.*5 字符/);
  assert.match(deepseek.output, /DeepSeek.*2 字符/);
});

function waitingAdapter() {
  return {
    id: 'codex',
    start: () => spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'])
  };
}

test('rejects duplicate starts and shuts down an active process', { timeout: 5000 }, async () => {
  const manager = new AgentManager([waitingAdapter()], () => {});
  manager.start('codex', 'task');
  assert.throws(() => manager.start('codex', 'another'), /already running/);
  await manager.shutdown();
  assert.equal(manager.list()[0].phase, 'cancelled');
  assert.throws(() => manager.start('codex', 'task'), /closing/);
});

test('times out a worker and allows another run', { timeout: 5000 }, async t => {
  const failures = [];
  let report;
  const manager = new AgentManager([waitingAdapter()], state => {
    if (state.phase === 'failed') {
      failures.push(state.error);
      report();
    }
  }, 50);
  t.after(() => manager.shutdown());
  for (let run = 0; run < 2; run++) {
    const failed = new Promise(resolve => { report = resolve; });
    manager.start('codex', 'task');
    await failed;
  }
  assert.deepEqual(failures, ['Agent timed out', 'Agent timed out']);
});
