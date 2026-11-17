import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRoom, ROOM_URI } from './room.mjs';
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

test('built stdio server advertises room and handoff tools', async () => {
  const client = new Client({ name: 'offline-test', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['dist/server.mjs']
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(),
      ['exchange_with_dsh', 'open_three_way_room', 'post_work_message', 'room_action']);
    const resource = await client.readResource({ uri: ROOM_URI });
    assert.match(resource.contents[0].text, /你 · DSH · Work/);
    assert.doesNotMatch(resource.contents[0].text, /ROOM_SCRIPT/);
    const rejected = await client.callTool({
      name: 'exchange_with_dsh',
      arguments: { alias: '../escape', prompt: 'example' }
    });
    assert.equal(rejected.isError, true);
  } finally {
    await client.close();
  }
});

test('room keeps three authors, gates DSH by a view token and survives a restart', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-room-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = () => join(root, 'bindings');
  await bind(directory(), 'project', 'old-dsh-session', root);
  const calls = [];
  async function connect() {
    const client = new Client({ name: 'test', version: '1.0.0' });
    const server = new McpServer({ name: 'test-room', version: '1.0.0' });
    registerRoom(server, { directory, html: '<p>test</p>', run: async (session, prompt) => {
      calls.push({ session, prompt });
      return 'DSH answer';
    } });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    t.after(() => client.close());
    return {
      call: (name, args) => client.callTool({ name, arguments: args }),
      close: () => client.close()
    };
  }

  const first = await connect();
  const open = await first.call('open_three_way_room', { alias: 'project' });
  const { token } = open._meta;
  assert.equal(open.structuredContent, undefined);
  assert.deepEqual(open._meta.room.messages, []);
  assert.equal((await first.call('room_action', {
    action: 'send-dsh', text: 'unapproved', token: '0'.repeat(64)
  })).isError, true);
  assert.equal(calls.length, 0);
  const update = (action, text) => first.call('room_action', { action, text, token });
  await update('post', 'user only');
  await first.call('post_work_message', { alias: 'project', text: 'Work reply' });
  assert.equal(calls.length, 0);
  await update('send-dsh', 'approved prompt');

  let state;
  for (let attempt = 0; attempt < 50; attempt++) {
    state = await update('refresh');
    if (!state._meta.room.running) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.deepEqual(state.content, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].session.sessionId, 'old-dsh-session');
  assert.equal(calls[0].prompt, 'approved prompt');
  const messages = state._meta.room.messages;
  assert.equal(messages.length, 4);
  assert.deepEqual(messages.map(({ role }) => role), ['user', 'work', 'user', 'dsh']);
  assert.equal(messages[3].text, 'DSH answer');
  await first.close();

  const second = await connect();
  const reopened = await second.call('open_three_way_room', { alias: 'project' });
  assert.deepEqual(reopened._meta.room.messages, messages);
  assert.notEqual(reopened._meta.token, token);
});

test('personal installation copies the built room and preserves existing marketplace entries', async t => {
  const { installLocal } = await import('./install-local.mjs');
  const { mkdir, readFile, writeFile } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'dsh-install-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const catalogDir = join(root, '.agents', 'plugins');
  const file = join(catalogDir, 'marketplace.json');
  const previous = { name: 'mine', plugins: [{ name: 'other-plugin', source: { source: 'local', path: './other' } }] };
  await mkdir(catalogDir, { recursive: true });
  await writeFile(file, '\uFEFF' + JSON.stringify(previous));
  const installation = await installLocal(root);
  await installLocal(root);
  const config = JSON.parse(await readFile(file, 'utf8'));
  assert.deepEqual(config.plugins[0], previous.plugins[0]);
  assert.equal(config.plugins.length, 2);
  const target = join(root, config.plugins[1].source.path);
  assert.equal(target, installation.target);
  assert.match(await readFile(join(target, 'dist', 'room.html'), 'utf8'), /三方聊天室/);

  const client = new Client({ name: 'installed', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({
      command: process.execPath,
      args: [join(target, 'dist', 'server.mjs')]
    }));
    assert.ok((await client.listTools()).tools.some(tool => tool.name === 'open_three_way_room'));
  } finally {
    await client.close();
  }
});
