// Accès au processus principal: `window.duo` (preload-platform) dans Electron;
// faux pont dans Chromium seul, pour les tests et les captures (ADR 0012, point 9).
import { signal } from '@preact/signals';
import type { DuoApi, IntentArgs, IntentChannel, IntentResult } from '../shared/ipc';
import type { AppState } from '../shared/state';
import { createFakeBridge } from './fake-bridge';

declare global {
  interface Window {
    duo?: DuoApi;
  }
}

export const appState = signal<AppState | null>(null);

let api: DuoApi | null = null;

export function connectBridge(): void {
  api = window.duo ?? createFakeBridge(new URLSearchParams(window.location.search).get('scenario'));
  api.onState((state) => {
    appState.value = state;
  });
  void api.getState().then((state) => {
    appState.value ??= state;
  });
}

export function send<C extends IntentChannel>(
  channel: C,
  arg: IntentArgs[C],
): Promise<IntentResult> {
  if (api === null) return Promise.resolve({ ok: false, error: 'pont absent' });
  return api.invoke(channel, arg);
}
