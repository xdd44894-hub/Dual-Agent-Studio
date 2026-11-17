import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aliasSchema, mailbox } from './mailbox.mjs';

export async function setupReceiver(root, alias, entrypoint = new URL('./server.mjs', import.meta.url)) {
  aliasSchema.parse(alias);
  const roomsRoot = join(root, 'rooms');
  const target = join(root, 'receiver-' + alias);
  await mkdir(target, { recursive: true });
  await copyFile(new URL('../receiver-bundle/index.mjs', entrypoint), join(target, 'index.mjs'));
  await copyFile(fileURLToPath(entrypoint), join(target, 'server.mjs'));
  await writeFile(join(target, 'package.json'), JSON.stringify({
    name: 'dsh-room-receiver-' + alias, version: '0.1.0', type: 'module',
    main: './index.mjs', exports: { '.': './index.mjs', './cordis.patch.yml': './cordis.patch.yml' },
    dsh: { bundle: { patch: './cordis.patch.yml' } }
  }, null, 2));
  await writeFile(join(target, 'cordis.patch.yml'), JSON.stringify([{
    insert: [{ id: 'dsh-room-receiver-' + alias, name: 'dsh-room-receiver-' + alias,
      config: { alias, node: process.execPath, roomsRoot } }]
  }], null, 2));
  await mailbox(roomsRoot, alias).initialize();
  return target;
}
