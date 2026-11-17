import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';

await build({
  entryPoints: ['server.mjs'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
});

const ui = await build({
  entryPoints: ['room-view.mjs'],
  bundle: true,
  minify: true,
  write: false,
  format: 'iife',
  platform: 'browser'
});
const template = await readFile('room.html', 'utf8');
const script = ui.outputFiles[0].text.replace(/<\/script/gi, match => '<\\/' + match.slice(2));
await writeFile('dist/room.html', template.replace('/* ROOM_SCRIPT */', () => script));
