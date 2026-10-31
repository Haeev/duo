// preload-game (ADR 0003, point 3): remet à la page le MessagePort du pont, rien
// d'autre. Contrat avec le SDK (à aligner sur @duo/sdk à la fusion): après
// DOMContentLoaded, la page reçoit `window.postMessage('duo:bridge', '*', [port])`;
// le SDK écoute `message` sur `window` dès son import.
import { ipcRenderer } from 'electron';

const PORT_CHANNEL = 'duo:bridge-port';
const PAGE_MESSAGE = 'duo:bridge';

const documentReady = new Promise<void>((resolve) => {
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        resolve();
      },
      { once: true },
    );
  } else {
    resolve();
  }
});

ipcRenderer.once(PORT_CHANNEL, (event) => {
  void documentReady.then(() => {
    window.postMessage(PAGE_MESSAGE, '*', event.ports);
  });
});
