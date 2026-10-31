// La démo à deux dans Node: deux SDK reliés par le faux hôte en mémoire, un robot sur chaque machine.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { ControlFrame } from '../src/etat/actions';
import type { WorldEvent } from '../src/etat/types';
import { createSession, type GameAction, type Session } from '../src/session';
import { SIM_DT } from '../src/simulation/constantes';
import { createRobot } from '../src/simulation/robot';
import { contentAndMap } from './aides';

const STEP_MS = SIM_DT * 1000;

/** Fait avancer les deux machines d'un pas, en laissant passer les messages. */
async function stepBoth(host: Session, guest: Session, clock: { now: number }, seq: { n: number }): Promise<void> {
  const idle = (): ControlFrame => ({ seq: (seq.n += 1), moveX: 0, moveY: 0, actHeld: false });
  host.step(idle());
  guest.step(idle());
  clock.now += STEP_MS;
  host.beforeFrame(1);
  guest.beforeFrame(1);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('réseau: hôte qui fait autorité, invité qui envoie ses intentions', () => {
  it("l'invité crée son personnage, joue la scène d'arrivée et porte la poutre avec l'hôte", async () => {
    const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 }, seed: 7 });
    try {
      await duo.start();
      const { content, map } = contentAndMap();
      const clock = { now: 0 };
      const now = (): number => clock.now;
      const host = createSession({ duo: duo.hostGame, content, map, robot: createRobot(), now });
      const guest = createSession({ duo: duo.guestGame, content, map, robot: createRobot(), now });
      const guestEvents: WorldEvent[] = [];
      guest.view.onEvent((e) => guestEvents.push(e));
      const seq = { n: 0 };
      const sim = host.hostSim();
      expect(sim).not.toBeNull();
      if (sim === null) return;
      for (let i = 0; i < 30 * 120 && sim.world.beam !== null; i++) await stepBoth(host, guest, clock, seq);
      // Le temps que le dernier état complet arrive chez l'invité.
      for (let i = 0; i < 20; i++) await stepBoth(host, guest, clock, seq);

      expect(guest.ready()).toBe(true);
      const world = sim.world;
      expect(world.characters.map((c) => c.created)).toEqual([true, true]);
      expect(world.characters.find((c) => c.playerId === duo.guestGame.localPlayer.id)?.name).toBe('Sacha');
      expect(world.quests.find((q) => q.id === 'first_train')?.status).toBe('done');
      // La poutre ne se porte qu'à deux: l'invité a tenu sa part à travers le réseau.
      expect(world.beam).toBeNull();
      expect(world.constructions.find((k) => k.id === 'house_beam')?.status).toBe('done');
      // L'invité voit le même monde et a reçu les événements.
      const seen = guest.view.world();
      expect(seen.phase).toBe('day');
      expect(seen.constructions.find((k) => k.id === 'house_beam')?.status).toBe('done');
      expect(guestEvents.some((e) => e.type === 'beam_placed')).toBe(true);
      expect(guest.view.localCharacter()).toBe(world.characters.find((c) => c.playerId === duo.guestGame.localPlayer.id)?.id);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
