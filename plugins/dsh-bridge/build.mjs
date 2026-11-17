import { build } from 'esbuild';

await build({
  entryPoints: ['server.mjs'],
  outfile: 'dist/server.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
});
