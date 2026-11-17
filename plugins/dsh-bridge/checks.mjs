import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { bind, createBridge } from './bridge.mjs';

test('approved text crosses both boundaries and a new bridge resumes the same session', async t => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'dsh-bridge-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await bind(directory, 'project', 'session-123', directory);
  await assert.rejects(bind(directory, 'project', 'another-session', directory), { code: 'EEXIST' });
  await assert.rejects(bind(directory, '../other', 'another-session'));

  const calls = [];
  const start = (send, receive) => createBridge({
    directory: () => directory,
    approve: async request => {
      assert.equal(request.sessionId, 'session-123');
      assert.equal(request.cwd, directory);
      return request.direction === 'to-dsh' ? send : receive;
    },
    run: async ({ sessionId, cwd }, prompt) => {
      assert.equal(cwd, directory);
      calls.push({ sessionId, prompt });
      return 'complete result';
    }
  });
  assert.deepEqual(await start(null, null)('project', 'draft'), { status: 'declined_send' });
  assert.deepEqual(calls, []);
  assert.deepEqual(await start('批准的提示词', null)('project', 'draft'), { status: 'declined_return' });
  assert.deepEqual(await start('继续', 'selected reply')('project', 'draft'), {
    status: 'approved', reply: 'selected reply'
  });
  assert.deepEqual(calls, [
    { sessionId: 'session-123', prompt: '批准的提示词' },
    { sessionId: 'session-123', prompt: '继续' }
  ]);
});

test('local MCP server advertises only the approval-gated handoff tool', async () => {
  const client = new Client({ name: 'offline-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/server.mjs']
  });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name), ['exchange_with_dsh']);
    const rejected = await client.callTool({
      name: 'exchange_with_dsh',
      arguments: { alias: '../escape', prompt: 'example' }
    });
    assert.equal(rejected.isError, true);
  } finally {
    await client.close();
  }
});
