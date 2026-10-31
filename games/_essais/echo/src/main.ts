import { connect } from '@duo/sdk';
import manifest from '../duo-game.json';
import { startEcho } from './echo';

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`élément #${id} absent`);
  return node;
}

const duo = await connect<'envoyer'>({ manifest });
byId('role').textContent = duo.role === 'host' ? 'Hôte' : 'Invité';
byId('joueurs').textContent = `${duo.localPlayer.name} avec ${duo.remotePlayer.name}`;
const echo = startEcho(duo, {
  received: (message) => {
    byId('recu').textContent = `Reçu de ${message.de}: ${message.n}`;
  },
  replied: (message) => {
    byId('reponse').textContent = `Réponse de ${message.de}: ${message.n}`;
  },
});
duo.reportLoading(1);
await duo.ready();

const send = byId('envoyer');
if (duo.role === 'guest') {
  send.hidden = false;
  send.addEventListener('click', () => {
    echo.send();
  });
}
const steps = byId('pas');
duo.loop.start({
  step: () => {
    if (duo.input.wasPressed('envoyer')) echo.send();
  },
  render: () => {
    steps.textContent = `Pas: ${duo.loop.tick}`;
  },
});
duo.on('stop', () => {
  duo.dispose();
});
