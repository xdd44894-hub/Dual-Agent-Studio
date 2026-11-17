import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { z } from 'zod';
import { aliasSchema, mailbox, textSchema } from './mailbox.mjs';

export const ROOM_URI = 'ui://dsh-bridge/room.html';

export function registerRoom(server, { roomsRoot, html }) {
  const capabilities = new Map();
  const roomPath = alias => join(roomsRoot(), alias);
  const inboxFor = alias => mailbox(roomsRoot(), alias);
  let lastOrder = 0;
  const toolError = error => ({ isError: true, content: [{ type: 'text', text: error.message }] });

  async function append(alias, role, text) {
    const folder = roomPath(alias);
    await mkdir(folder, { recursive: true });
    const at = new Date().toISOString();
    lastOrder = Math.max(Date.now(), lastOrder + 1);
    const id = `${lastOrder}-${randomUUID()}`;
    const pending = join(folder, `.${id}.tmp`);
    try {
      await writeFile(pending, JSON.stringify({ id, at, role, text }), { flag: 'wx' });
      await rename(pending, join(folder, `${id}.json`));
    } finally {
      await rm(pending, { force: true });
    }
  }

  async function snapshot(alias) {
    const folder = roomPath(alias);
    const files = await readdir(folder).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    const names = files.filter(name => /^\d{13}-[a-f0-9-]{36}\.json$/.test(name)).sort().slice(-100);
    const messages = await Promise.all(names.map(async name => JSON.parse(await readFile(join(folder, name), 'utf8'))));
    const entries = await inboxFor(alias).list();
    const answered = new Set(entries.filter(entry => entry.role === 'dsh').map(entry => entry.requestId));
    const combined = messages.concat(entries)
      .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)).slice(-100);
    return { alias, messages: combined, waiting: entries.filter(entry => entry.forwarded && !answered.has(entry.id)).length };
  }

  function issue(alias) {
    // Only the room iframe receives this value in tool-result metadata.
    const token = randomBytes(32).toString('hex');
    if (capabilities.size >= 32) capabilities.delete(capabilities.keys().next().value);
    capabilities.set(token, alias);
    return token;
  }

  registerAppResource(server, 'dsh-room', ROOM_URI, {}, async () => ({
    contents: [{ uri: ROOM_URI, mimeType: RESOURCE_MIME_TYPE,
      text: html ?? readFileSync(new URL('./room.html', import.meta.url), 'utf8') }]
  }));
  registerAppTool(server, 'open_three_way_room', {
    description: 'Open the three-way chat panel for the local receiver room requested by the user. Opening a room does not send any text to DSH.',
    inputSchema: { alias: aliasSchema },
    _meta: { ui: { resourceUri: ROOM_URI } }
  }, async ({ alias }) => {
    try {
      await inboxFor(alias).assertReady();
      return {
        content: [{ type: 'text', text: `已打开三方聊天室「${alias}」。从当前 Work 对话发送的回复可用 post_work_message 加入时间线。` }],
        _meta: { room: await snapshot(alias), token: issue(alias) }
      };
    } catch (error) { return toolError(error); }
  });
  server.registerTool('post_work_message', {
    description: 'Add your Work reply to the local three-way chat after the user asks you to reply to that room. This shows the text in the room and does not send it to DSH.',
    inputSchema: { alias: aliasSchema, text: textSchema }
  }, async ({ alias, text }) => {
    try {
      await inboxFor(alias).assertReady();
      await append(alias, 'work', text);
      return { content: [{ type: 'text', text: '已将 Work 回复加入房间。' }] };
    } catch (error) { return toolError(error); }
  });

  registerAppTool(server, 'room_action', {
    description: 'Private room controls for the interactive room panel.',
    inputSchema: {
      token: z.string().length(64),
      action: z.enum(['refresh', 'post', 'send-dsh']),
      text: textSchema.optional(),
      source: z.enum(['user', 'work']).optional()
    },
    _meta: { ui: { visibility: ['app'] } }
  }, async ({ token, action, text, source }) => {
    try {
      const alias = capabilities.get(token);
      if (!alias) throw new Error('房间已断开，请在这条 Work 对话重新打开。');
      if (action !== 'refresh' && !text) throw new Error('请输入消息。');
      if (action === 'post') await append(alias, 'user', text);
      if (action === 'send-dsh') await inboxFor(alias).enqueue(text, source);
      return { content: [], _meta: { room: await snapshot(alias) } };
    } catch (error) { return toolError(error); }
  });
}
