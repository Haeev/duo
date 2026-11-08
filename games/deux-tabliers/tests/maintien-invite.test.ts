// Gestes à maintien de l'invité (bug de la séance du 2026-11-08: « E ne marche pas » sur le PC,
// qui rejoint la partie). L'intention « act » de l'invité arrive avec ses entrées des deux derniers
// pas; l'hôte doit l'appliquer au pas de l'entrée où elle est née (Agir déjà tenu), pas au pas
// d'une entrée plus ancienne où Agir était encore relâché, sinon le geste s'annule aussitôt.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { createRobot, type Robot } from '../src/robots/robot';
import { createSession } from '../src/session';

const DT = 1 / 60;

describe('Deux Tabliers, maintien chez l’invité', () => {
  // Les deux parités: l'appui tombe sur le premier ou le second pas d'un message de l'invité.
  it.each([1, 2])(
    'l’invité moud une dose en tenant Agir (appui après %i pas)',
    async (offset) => {
      const content = loadContent(DATA_FILES);
      const duo = await startLocalDuo<GameAction>({
        manifest,
        conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
        seed: 5,
      });
      try {
        await duo.start();
        const t0 = performance.now();
        const now = (): number => performance.now() - t0;
        const host = createSession({ duo: duo.hostGame, content, now });
        const guest = createSession({ duo: duo.guestGame, content, now });
        const world = host.hostWorld();
        if (world === null) throw new Error('hôte sans monde');
        world.players[1].x = 9.8;
        world.players[1].z = 8.3;

        let seq = 0;
        const runGuest = async (guestRobot: Robot, steps: number): Promise<void> => {
          const idle = createRobot([]);
          for (let i = 0; i < steps; i++) {
            seq++;
            host.step(idle.next(host.view, seq).input, [], DT);
            const g = guestRobot.next(guest.view, seq);
            guest.step(g.input, g.intents, DT);
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        };
        await runGuest(createRobot([]), 40 + offset);
        expect(guest.ready()).toBe(true);
        expect(world.service.doses).toBe(0);
        await runGuest(
          createRobot([
            { kind: 'hold', target: { kind: 'station', furniture: 'station-5' }, steps: 170 },
          ]),
          200,
        );
        expect(world.service.doses).toBe(1);
      } finally {
        duo.dispose();
      }
    },
  );
});
