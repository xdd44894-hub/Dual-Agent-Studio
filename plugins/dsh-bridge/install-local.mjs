import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const name = 'dsh-bridge';
const relativePluginPath = './.codex/plugins/dsh-bridge';
const source = dirname(fileURLToPath(import.meta.url));
const files = ['plugin.json', 'mcp.json', 'skills', 'approve.ps1', 'run-dsh.ps1', 'dist'];

export async function installLocal(userDirectory = homedir()) {
  const marketplace = join(userDirectory, '.agents', 'plugins', 'marketplace.json');
  const target = join(userDirectory, relativePluginPath);
  let config;
  try {
    const saved = await readFile(marketplace, 'utf8');
    config = JSON.parse(saved.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    config = { name: 'local-plugins', interface: { displayName: 'Local Plugins' }, plugins: [] };
  }
  if (typeof config?.name !== 'string' || !config.name || !Array.isArray(config.plugins)) {
    throw new Error('个人插件目录格式无效。请先检查 ' + marketplace);
  }
  const existing = config.plugins.find(item => item?.name === name);
  if (existing && (existing.source?.source !== 'local' || existing.source.path !== relativePluginPath)) {
    throw new Error('个人插件目录已有指向另一处的 DSH Bridge。请先检查 ' + marketplace);
  }
  await readFile(join(source, 'dist', 'server.mjs'));
  await readFile(join(source, 'dist', 'room.html'));
  await mkdir(target, { recursive: true });
  for (const file of files) {
    await cp(join(source, file), join(target, file), { recursive: true });
  }
  if (!existing) {
    config.plugins.push({
      name,
      source: { source: 'local', path: relativePluginPath },
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Productivity'
    });
    await mkdir(dirname(marketplace), { recursive: true });
    const pending = marketplace + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(pending, JSON.stringify(config, null, 2) + '\n', { flag: 'wx' });
      await rename(pending, marketplace);
    } finally {
      await rm(pending, { force: true });
    }
  }
  return { target, marketplace, catalog: config.interface?.displayName ?? config.name };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { target, marketplace, catalog } = await installLocal();
    console.log(`DSH Bridge 已登记在本地插件目录「${catalog}」\n${marketplace}\n${target}\n请完全退出并重开 ChatGPT 桌面版。`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
