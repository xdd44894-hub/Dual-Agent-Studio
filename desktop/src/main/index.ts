import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOfflineAdapters } from './adapters';
import { AgentManager } from './agent-manager';
import { agentId, agentTask, APP_URL, isTrustedSender } from './ipc-policy';
import { initializeStorage } from './storage';

protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
]);

function bootstrap() {
  const storage = initializeStorage(
    app.getPath('exe'),
    app.getPath('appData'),
    app.isPackaged && process.platform === 'win32' ? process.env.PORTABLE_EXECUTABLE_DIR : undefined
  );
  app.setPath('userData', storage.root);
  app.setPath('sessionData', join(storage.root, 'Chromium'));

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }

  let window: BrowserWindow | null = null;
  let quitting = false;
  let readyToQuit = false;
  const agents = new AgentManager(createOfflineAdapters(process.execPath), state => {
    if (window && !window.webContents.isDestroyed()) window.webContents.send('studio:agent-state', state);
  });

  function handle(channel: string, arity: number, action: (...args: unknown[]) => unknown) {
    ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
      if (!isTrustedSender(event.sender, window?.webContents, event.senderFrame) || args.length !== arity) {
        throw new Error('Rejected IPC request');
      }
      return action(...args);
    });
  }

  function openWindow() {
    const browser = new BrowserWindow({
      width: 900,
      height: 650,
      webPreferences: {
        preload: join(__dirname, 'preload.cjs'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true
      }
    });
    window = browser;
    browser.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    browser.webContents.on('will-navigate', event => event.preventDefault());
    browser.webContents.on('will-frame-navigate', event => event.preventDefault());
    browser.webContents.on('will-redirect', event => event.preventDefault());
    browser.webContents.on('will-attach-webview', event => event.preventDefault());
    browser.on('closed', () => { window = null; });
    void browser.loadURL(APP_URL).catch(() => {
      dialog.showErrorBox('Dual Agent Studio', '无法加载桌面界面。');
      app.quit();
    });
  }

  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (readyToQuit) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    void agents.shutdown().then(() => {
      readyToQuit = true;
      app.quit();
    });
  });

  void app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    protocol.handle('studio', request => {
      const url = new URL(request.url);
      const allowed = url.pathname === '/index.html' || /^\/assets\/[a-zA-Z0-9_-]+\.(js|css)$/.test(url.pathname);
      if (request.method !== 'GET' || url.host !== 'app' || !allowed || url.search) {
        return new Response(null, { status: 404 });
      }
      return net.fetch(pathToFileURL(join(__dirname, '../renderer', url.pathname.slice(1))).href);
    });
    handle('studio:storage', 0, () => storage);
    handle('studio:agents', 0, () => agents.list());
    handle('studio:start', 2, (id, task) => agents.start(agentId(id), agentTask(task)));
    handle('studio:stop', 1, id => agents.stop(agentId(id)));
    openWindow();
  }).catch(() => {
    dialog.showErrorBox('Dual Agent Studio', '桌面服务启动失败。');
    app.quit();
  });
}

try {
  bootstrap();
} catch (error) {
  dialog.showErrorBox('Dual Agent Studio', error instanceof Error ? error.message : '无法初始化数据目录。');
  app.exit(1);
}
