import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DesktopApi } from '../shared/api';

const api: DesktopApi = {
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
