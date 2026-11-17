import { fileURLToPath } from 'node:url';

export const name = 'dsh-room-receiver';
export const inject = ['mcpManager'];

export function apply(ctx, { alias, node, roomsRoot }) {
  ctx.mcpManager.register('threeway', {
    transport: 'stdio',
    command: node,
    args: [fileURLToPath(new URL('./server.mjs', import.meta.url)), 'receiver', alias, roomsRoot]
  });
}
