import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { mailbox, registerReceiver } from './mailbox.mjs';
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

test('Work and DSH use distinct tools and exchange approved messages across restarts', async t => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-room-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const roomsRoot = () => join(root, 'rooms');
  const alias = 'project';
  const inbox = mailbox(roomsRoot(), alias);
  await inbox.initialize();

  async function connect(register) {
    const client = new Client({ name: 'test', version: '1.0.0' });
    const server = new McpServer({ name: 'test-room', version: '1.0.0' });
    register(server);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    t.after(() => client.close());
    return {
      call: (name, args = {}) => client.callTool({ name, arguments: args }),
      tools: async () => (await client.listTools()).tools.map(tool => tool.name).sort(),
      close: () => client.close()
    };
  }

  const connectWork = () => connect(server => registerRoom(server, { roomsRoot, html: '<p>test</p>' }));
  const work = await connectWork();
  const dsh = await connect(server => registerReceiver(server, mailbox(roomsRoot(), alias), alias));
  assert.deepEqual(await dsh.tools(), ['post_reply', 'receive_message']);
  const open = await work.call('open_three_way_room', { alias });
  assert.equal(open.structuredContent, undefined);
  const { token } = open._meta;
  assert.equal((await work.call('room_action', {
    action: 'send-dsh', text: 'unapproved', token: '0'.repeat(64)
  })).isError, true);
  const update = (action, text) => work.call('room_action', { action, text, token });
  const receive = async () => JSON.parse((await dsh.call('receive_message')).content[0].text);
  await update('post', 'user only');
  await work.call('post_work_message', { alias, text: 'Work reply' });
  assert.equal((await receive()).pending, false);
  await update('send-dsh', 'approved prompt');
  const queued = await receive();
  assert.equal(queued.text, 'approved prompt');
  assert.equal(queued.from, 'user');
  await work.close();

  const payload = { requestId: queued.requestId, text: 'DSH answer' };
  const replies = await Promise.all([dsh.call('post_reply', payload), dsh.call('post_reply', payload)]);
  assert.equal(replies.filter(result => result.isError).length, 1);
  assert.equal((await receive()).pending, false);

  const reopened = await connectWork();
  const result = await reopened.call('open_three_way_room', { alias });
  assert.notEqual(result._meta.token, token);
  assert.equal(result._meta.room.waiting, 0);
  const messages = result._meta.room.messages;
  assert.equal(messages.length, 4);
  assert.deepEqual(new Set(messages.map(({ role }) => role)), new Set(['user', 'work', 'dsh']));
  assert.equal(messages.filter(message => message.text === 'DSH answer').length, 1);
  assert.doesNotMatch(JSON.stringify(result.content), /DSH answer/);
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

test('generated DSH bundle mounts its receiver over stdio with no Work tools', async t => {
  const { setupReceiver } = await import('./setup-receiver.mjs');
  const { readFile } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'dsh-bundle-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = await setupReceiver(root, 'threeway', new URL('./dist/server.mjs', import.meta.url));
  const manifest = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
  const [{ insert: [row] }] = JSON.parse(await readFile(join(target, manifest.dsh.bundle.patch), 'utf8'));
  const { apply } = await import(pathToFileURL(join(target, 'index.mjs')));
  let registered;
  apply({ mcpManager: { register: (name, spec) => { registered = { name, ...spec }; } } }, row.config);
  assert.equal(registered.name, 'threeway');
  assert.equal(registered.transport, 'stdio');
  const inbox = mailbox(join(root, 'rooms'), 'threeway');
  const id = await inbox.enqueue('a local fixture');
  const client = new Client({ name: 'bundle-test', version: '1.0.0' });
  try {
    await client.connect(new StdioClientTransport({ command: registered.command, args: registered.args }));
    assert.deepEqual((await client.listTools()).tools.map(tool => tool.name).sort(), ['post_reply', 'receive_message']);
    const { content } = await client.callTool({ name: 'receive_message' });
    assert.equal(JSON.parse(content[0].text).requestId, id);
    const posted = await client.callTool({ name: 'post_reply', arguments: { requestId: id, text: 'local reply' } });
    assert.ok(!posted.isError);
    assert.ok((await inbox.list()).some(record => record.role === 'dsh' && record.text === 'local reply'));
  } finally {
    await client.close();
  }
});
