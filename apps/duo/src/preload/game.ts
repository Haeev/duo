// preload-game (ADR 0003, point 3): remet à la page le port du pont, rien d'autre.
// Contrat de @duo/protocol (BRIDGE_PORT_MESSAGE, ADR 0005, « Précisions de
// l'implémentation »): `window.postMessage({ type: 'duo:bridge-port', bridge }, '*', [port])`;
// le SDK écoute dès son import. Valeurs recopiées ici pour garder ce preload sans dépendance.
//
// Relais: un ArrayBuffer placé dans la liste de transfert d'un postMessage arrive vide
// au processus principal d'Electron 45 (MessagePortMain), alors que le SDK transfère
// les données de `saveWrite`. La page reçoit donc le port d'un canal local; ce preload
// recopie chaque message vers le port du principal (copie structurée, sans transfert).
import { ipcRenderer } from 'electron';

const PORT_CHANNEL = 'duo:bridge-port';
const PAGE_MESSAGE = { type: 'duo:bridge-port', bridge: '1.0' } as const;

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
  const mainPort = event.ports[0];
  if (mainPort === undefined) return;
  const local = new MessageChannel();
  local.port1.onmessage = (message: MessageEvent<unknown>) => {
    mainPort.postMessage(message.data);
  };
  mainPort.onmessage = (message: MessageEvent<unknown>) => {
    local.port1.postMessage(message.data);
  };
  void documentReady.then(() => {
    window.postMessage(PAGE_MESSAGE, '*', [local.port2]);
  });
});
