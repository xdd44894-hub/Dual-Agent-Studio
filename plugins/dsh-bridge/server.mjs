import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { registerRoom } from './room.mjs';
import { approveWindows, bind, bindingsDirectory, createBridge, runDsh } from './bridge.mjs';

if (process.argv[2] === 'bind') {
  const [, , , alias, sessionId, cwd] = process.argv;
  if (process.argv.length !== 6) {
    throw new Error('Usage: node dist/server.mjs bind <alias> <existing-dsh-session-id> <original-working-directory>');
  }
  await bind(bindingsDirectory(), alias, sessionId, cwd);
  console.log(`已绑定 ${alias}。`);
} else {
  const exchange = createBridge({ directory: bindingsDirectory, approve: approveWindows, run: runDsh });
  const server = new McpServer({ name: 'dsh-bridge', version: '0.2.0' });
  const lifetime = new AbortController();
  process.stdin.once('end', () => lifetime.abort());
  registerRoom(server, { directory: bindingsDirectory,
    run: (session, prompt) => runDsh(session, prompt, lifetime.signal) });
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
