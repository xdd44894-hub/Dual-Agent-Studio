import { dirname, isAbsolute, join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerRoom } from './room.mjs';
import { aliasSchema, mailbox, registerReceiver } from './mailbox.mjs';
import { setupReceiver } from './setup-receiver.mjs';
import { approveWindows, bind, bindingsDirectory, createBridge, runDsh } from './bridge.mjs';

const roomsRoot = () => join(dirname(bindingsDirectory()), 'rooms');

if (process.argv[2] === 'setup-receiver') {
  const alias = aliasSchema.parse(process.argv[3]);
  console.log(await setupReceiver(dirname(bindingsDirectory()), alias));
} else if (process.argv[2] === 'receiver') {
  const [, , , alias, root] = process.argv;
  if (!root || !isAbsolute(root)) throw new Error('Mailbox path must be absolute.');
  const server = new McpServer({ name: 'dsh-room-receiver', version: '0.1.0' });
  registerReceiver(server, mailbox(root, alias), alias);
  await server.connect(new StdioServerTransport());
} else if (process.argv[2] === 'bind') {
  const [, , , alias, sessionId, cwd] = process.argv;
  if (process.argv.length !== 6) {
    throw new Error('Usage: node dist/server.mjs bind <alias> <existing-dsh-session-id> <original-working-directory>');
  }
  await bind(bindingsDirectory(), alias, sessionId, cwd);
  console.log(`已绑定 ${alias}。`);
} else {
  const exchange = createBridge({ directory: bindingsDirectory, approve: approveWindows, run: runDsh });
  const server = new McpServer({ name: 'dsh-bridge', version: '0.3.0' });
  registerRoom(server, { roomsRoot });
  server.registerTool('exchange_with_dsh', {
    description: 'Propose one prompt for a locally registered DSH session. Windows requires approval before sending and again before returning selected reply text. Call only for a user-requested exchange.',
    inputSchema: {
      alias: z.string().regex(/^[a-z0-9][a-z0-9-]{0,47}$/),
      prompt: z.string().min(1).max(16_000)
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async ({ alias, prompt }, { signal }) => {
    try {
      const result = await exchange(alias, prompt, signal);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });
  await server.connect(new StdioServerTransport());
}
