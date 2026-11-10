// Deux instances du vrai SDK reliées en mémoire: l'invité reçoit l'état de l'hôte par tranches.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { createSession } from '../src/session';
import { idleInput } from '../src/simulation/noyau/entrees';
import { gameContent } from './aides';

const content = gameContent();

describe('séance à deux', () => {
  it('donne à l’invité le même état lent que l’hôte, et le bon personnage à chacun', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const host = createSession({ duo: duo.hostGame, content });
      const guest = createSession({ duo: duo.guestGame, content });
      expect(host.ready()).toBe(true);
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans simulation');
      for (let i = 1; i <= 40; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      expect(guest.ready()).toBe(true);
      const seen = guest.view.world();
      if (seen === null) throw new Error('invité sans état');
      expect(seen.common).toEqual(sim.world.common);
      expect(seen.progress).toEqual(sim.world.progress);
      expect(seen.players[1].toolbar).toEqual(sim.world.players[1].toolbar);
      expect(seen.players[0].body).toEqual(sim.world.players[0].body);
      expect(seen.places['essai-gare']?.villagers['cheffe-de-gare']?.body).toEqual(
        sim.world.places['essai-gare']?.villagers['cheffe-de-gare']?.body,
      );
      expect(seen.tick).toBeGreaterThan(0);
      expect(host.view.localIndex()).toBe(0);
      expect(guest.view.localIndex()).toBe(1);
      // Une tranche touchée repart: l'invité voit la bourse changée par l'hôte.
      sim.world.players[1].money = 42;
      sim.revisions.players += 1;
      for (let i = 41; i <= 60; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      expect(guest.view.world()?.players[1].money).toBe(42);
      expect(duo.logs.filter((entry) => entry.level === 'error')).toEqual([]);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
