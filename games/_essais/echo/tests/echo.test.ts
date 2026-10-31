// L'essai à deux, dans Node: deux SDK reliés par le faux hôte en mémoire.
import { startLocalDuo } from '@duo/sdk-dev';
import { expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { startEcho, type Message } from '../src/echo';

it("l'hôte reçoit le message de l'invité et lui répond", async () => {
  const duo = await startLocalDuo({ manifest, conditions: { latencyMs: 10 } });
  try {
    await duo.start();
    const received: Message[] = [];
    const replied = new Promise<Message>((resolve) => {
      startEcho(duo.guestGame, { received: () => undefined, replied: resolve }).send();
    });
    startEcho(duo.hostGame, { received: (m) => received.push(m), replied: () => undefined });
    expect(await replied).toEqual({ n: 2, de: 'Alex' });
    expect(received).toEqual([{ n: 1, de: 'Sacha' }]);
  } finally {
    duo.dispose();
  }
});
