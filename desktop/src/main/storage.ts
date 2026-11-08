import { lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { StorageInfo } from '../shared/api';

export const PRODUCT_NAME = 'Dual Agent Studio';

export function initializeStorage(executable: string, appData: string, launcherDir?: string): StorageInfo {
  const programDir = launcherDir && isAbsolute(launcherDir) ? launcherDir : dirname(executable);
  const marker = join(programDir, 'portable.flag');
  let portable = false;
  try {
    if (!lstatSync(marker).isFile()) throw new Error('Expected a regular file');
    portable = true;
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw new Error(`Cannot use the portable marker: ${marker}`, { cause });
    }
  }
  const root = portable ? join(programDir, 'Data') : join(appData, PRODUCT_NAME);
  const folders = [root, join(root, 'Chromium'), join(root, 'Security')];

  for (const directory of folders) {
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const probe = mkdtempSync(join(directory, '.write-'));
      try {
        writeFileSync(join(probe, 'probe'), '', { flag: 'wx' });
      } finally {
        rmSync(probe, { recursive: true });
      }
    } catch (cause) {
      throw new Error(`Cannot write to the data directory: ${directory}`, { cause });
    }
  }

  return { mode: portable ? 'portable' : 'standard', root };
}
