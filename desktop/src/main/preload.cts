import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopApi } from '../shared/api';

const api: DesktopApi = {
  vault: {
    status: () => ipcRenderer.invoke('studio:vault-status'),
    create: passphrase => ipcRenderer.invoke('studio:vault-create', passphrase),
    unlock: passphrase => ipcRenderer.invoke('studio:vault-unlock', passphrase),
    lock: () => ipcRenderer.invoke('studio:vault-lock'),
    set: (id, secret) => ipcRenderer.invoke('studio:vault-set', id, secret),
    remove: id => ipcRenderer.invoke('studio:vault-remove', id)
  },
  storage: () => ipcRenderer.invoke('studio:storage'),
  agents: () => ipcRenderer.invoke('studio:agents'),
  start: (id, task) => ipcRenderer.invoke('studio:start', id, task),
  stop: id => ipcRenderer.invoke('studio:stop', id),
  onAgentState(listener) {
    const forward = (_event: IpcRendererEvent, state: Parameters<typeof listener>[0]) => listener(state);
    ipcRenderer.on('studio:agent-state', forward);
    return () => { ipcRenderer.removeListener('studio:agent-state', forward); };
  }
};

contextBridge.exposeInMainWorld('studio', api);
