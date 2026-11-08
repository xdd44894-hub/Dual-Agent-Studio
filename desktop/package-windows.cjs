const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const { Arch, build, Platform } = require('electron-builder');

const common = {
  appId: 'studio.dualagent.desktop',
  executableName: 'DualAgentStudio',
  files: ['dist/**/*'],
  artifactName: 'DualAgentStudio-${version}-Single.exe'
};

async function packageWindows() {
  await build({
    targets: Platform.WINDOWS.createTarget(['portable'], Arch.x64),
    publish: 'never',
    config: { ...common, directories: { output: 'out/single' } }
  });
  await build({
    targets: Platform.WINDOWS.createTarget(['dir'], Arch.x64),
    publish: 'never',
    config: {
      ...common,
      directories: { output: 'out/folder' },
      afterPack: ({ appOutDir }) => writeFile(join(appOutDir, 'portable.flag'), '')
    }
  });
}

packageWindows().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
