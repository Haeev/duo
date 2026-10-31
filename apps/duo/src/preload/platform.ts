// preload-platform (ADR 0003, point 3): expose `window.duo`, rien d'autre.
// Des appels sur une liste fermée de canaux et un abonnement à l'état.
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_GET_STATE,
  IPC_INTENT_PREFIX,
  IPC_STATE,
  isIntentChannel,
  type DuoApi,
  type IntentResult,
} from '../shared/ipc';
import type { AppState } from '../shared/state';

const api: DuoApi = {
  invoke(channel, arg) {
    if (!isIntentChannel(channel)) {
      return Promise.resolve<IntentResult>({ ok: false, error: 'canal inconnu' });
    }
    return ipcRenderer.invoke(`${IPC_INTENT_PREFIX}${channel}`, arg) as Promise<IntentResult>;
  },
  getState() {
    return ipcRenderer.invoke(IPC_GET_STATE) as Promise<AppState>;
  },
  onState(listener) {
    const handler = (_event: Electron.IpcRendererEvent, state: AppState): void => {
      listener(state);
    };
    ipcRenderer.on(IPC_STATE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_STATE, handler);
    };
  },
};

contextBridge.exposeInMainWorld('duo', api);
