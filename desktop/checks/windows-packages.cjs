const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const { cp, mkdtemp, rm, writeFile } = require('node:fs/promises');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { tmpdir } = require('node:os');
const { basename, join, resolve } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const { version } = require('../package.json');

async function availablePort() {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  return port;
}

async function eventually(read, description, timeout = 25_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await read();
    if (result) return result;
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function withPage(port, check) {
  const page = await eventually(async () => {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`, {
      signal: AbortSignal.timeout(1500)
    }).then(response => response.json()).catch(() => []);
    return pages.find(target => target.url === 'studio://app/index.html');
  }, 'the desktop renderer');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  try {
    await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
    let nextId = 0;
    function call(method, params = {}) {
      const id = ++nextId;
      return new Promise((done, reject) => {
        const timeout = setTimeout(() => finish(reject, new Error(`No response to ${method}`)), 6000);
        function finish(callback, value) {
          clearTimeout(timeout);
          socket.removeEventListener('message', onMessage);
          callback(value);
        }
        function onMessage(event) {
          const message = JSON.parse(event.data);
          if (message.id !== id) return;
          if (message.error) finish(reject, new Error(message.error.message));
          else finish(done, message.result);
        }
        socket.addEventListener('message', onMessage);
        socket.send(JSON.stringify({ id, method, params }));
      });
    }

    await check(async expression => {
      const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(response.result.description);
      return response.result.value;
    });
    const response = await fetch(`http://127.0.0.1:${port}/json/close/${page.id}`, {
      signal: AbortSignal.timeout(5000)
    });
    assert.ok(response.ok, 'Could not close the desktop window');
  } finally {
    socket.close();
  }
}

async function checkPackage(source, executable) {
  const directory = await mkdtemp(join(tmpdir(), 'dual-agent-package-'));
  let child;
  let closed;
  try {
    await cp(source, executable ? directory : join(directory, basename(source)), { recursive: Boolean(executable) });
    await writeFile(join(directory, 'portable.flag'), '');
    const port = await availablePort();
    child = spawn(join(directory, executable ?? basename(source)), [
      `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1'
    ], { stdio: 'ignore' });
    closed = once(child, 'close');
    let readyToClose = false;
    const pageCheck = withPage(port, async evaluate => {
      const state = await eventually(() => evaluate(`(() => {
        const cards = [...document.querySelectorAll('article h2')].map(node => node.textContent);
        const path = document.querySelector('header code')?.textContent;
        return path && cards.length === 2 && {
          path, cards, isolated: typeof require === 'undefined',
          portable: document.querySelector('header').textContent.includes('便携模式')
        };
      })()`), 'the React interface and preload state', 10_000);
      assert.deepEqual(state.cards, ['Codex', 'DeepSeek']);
      assert.equal(state.isolated, true);
      assert.equal(state.portable, true);
      assert.equal(resolve(state.path), resolve(directory, 'Data'));
      for (const agent of ['codex', 'deepseek']) {
        const output = await evaluate(`(async () => {
          await window.studio.start('${agent}', 'offline smoke test');
          for (let attempt = 0; attempt < 30; attempt++) {
            const state = (await window.studio.agents()).find(agent => agent.id === '${agent}');
            if (state.phase === 'completed') return state.output;
            if (state.phase === 'failed') throw new Error(state.error);
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('Agent did not complete');
        })()`);
        assert.match(output, /离线模拟.*18 字符/);
      }
      assert.equal(await evaluate("document.querySelector('.vault-panel h2').textContent"), '加密凭据库');
      assert.deepEqual(await evaluate(`(async () => {
        const vault = window.studio.vault;
        const password = 'CI-only test password';
        const initial = (await vault.status()).phase;
        await vault.create(password);
        await vault.set('codex', 'CI-fake-credential');
        const locked = (await vault.lock()).phase;
        const reopened = await vault.unlock(password);
        return { initial, locked, reopened };
      })()`), {
        initial: 'missing',
        locked: 'locked',
        reopened: { phase: 'unlocked', configured: { codex: true, deepseek: false } }
      });
      readyToClose = true;
    });
    await Promise.race([
      pageCheck,
      closed.then(([code]) => {
        if (!readyToClose) throw new Error(`Application exited during startup (${code})`);
        return pageCheck;
      })
    ]);
    const [code] = await Promise.race([
      closed,
      delay(10_000, null, { ref: false }).then(() => { throw new Error('Application did not close'); })
    ]);
    assert.equal(code, 0);
  } finally {
    if (child?.pid && child.exitCode === null && child.signalCode === null) {
      execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      await closed.catch(() => {});
    }
    await rm(directory, { recursive: true, force: true, maxRetries: 5 });
  }
}

test('portable folder renders and runs offline agents', { timeout: 60_000 }, () =>
  checkPackage('out/folder/win-unpacked', 'DualAgentStudio.exe'));
test('single EXE renders and runs offline agents', { timeout: 60_000 }, () =>
  checkPackage(`out/single/DualAgentStudio-${version}-Single.exe`));
