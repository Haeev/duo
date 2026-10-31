// S'asseoir chez l'invité (gauntlet, tour 6): l'hôte fait autorité, l'événement `sat_down` arrive
// chez l'invité en moins de 100 ms sur un réseau local, et le lever est prédit au pas même
// (le personnage ne revient pas sur le banc quand un état plus ancien arrive).
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { ControlFrame } from '../src/etat/actions';
import { benchById, seatPlace } from '../src/etat/bancs';
import type { WorldEvent } from '../src/etat/types';
import { createSession, type GameAction } from '../src/session';
import { SIM_DT } from '../src/simulation/constantes';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { contentAndMap } from './aides';

const STEP_MS = SIM_DT * 1000;

describe('bancs à travers le réseau', () => {
  it('l’invité s’assoit en moins de 100 ms (réseau local) et se relève sans revenir sur le banc', async () => {
    const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 }, seed: 11 });
    try {
      await duo.start();
      const { content, map } = contentAndMap();
      const start = performance.now();
      const now = (): number => performance.now() - start;
      const host = createSession({ duo: duo.hostGame, content, map, now });
      const guest = createSession({ duo: duo.guestGame, content, map, now });
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      let seq = 0;
      const frame = (moveY: number): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY, actHeld: false });
      const tick = async (guestMoveY = 0): Promise<void> => {
        host.step(frame(0));
        guest.step(frame(guestMoveY));
        host.beforeFrame(1);
        guest.beforeFrame(1);
        await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      };
      host.view.send({ type: 'create_character', name: 'Alex', hair: 0, outfit: 0 });
      for (let i = 0; i < 10; i++) await tick();
      guest.view.send({ type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 });
      for (let i = 0; i < 10; i++) await tick();
      for (let i = 0; i < 60 && sim.world.scene !== null; i++) {
        const scene = sim.world.scene;
        const intent = scene.choices.length > 0 ? ({ type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } as const) : ({ type: 'dialogue_next' } as const);
        host.view.send(intent);
        guest.view.send(intent);
        for (let k = 0; k < 4; k++) await tick();
      }
      expect(sim.world.scene).toBeNull();

      // L'invité devant la place 1 du banc du quai, tourné vers lui; Jeanne ailleurs.
      const id = guest.view.localCharacter();
      const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
      if (jeanne !== undefined) jeanne.visible = false;
      const prop = benchById(map, 'quay_bench');
      if (prop === null) throw new Error('banc du quai absent');
      const place = seatPlace(prop, 1, content.settings.benches, { x: 0, y: 0, facing: 0 });
      const c = character(sim, id);
      placeCharacter(sim, c, { x: place.x, y: place.y - 0.9 });
      c.facing = Math.PI / 2;
      for (let i = 0; i < 15; i++) await tick();

      const events: { event: WorldEvent; at: number }[] = [];
      guest.view.onEvent((event) => events.push({ event, at: now() }));
      const pressedAt = now();
      guest.view.send({ type: 'act' });
      for (let i = 0; i < 10 && !events.some((e) => e.event.type === 'sat_down'); i++) await tick();
      const sat = events.find((e) => e.event.type === 'sat_down');
      expect(sat?.event).toEqual({ type: 'sat_down', by: id, bench: 'quay_bench', slot: 1 });
      expect((sat?.at ?? Number.POSITIVE_INFINITY) - pressedAt).toBeLessThan(100);
      expect(character(sim, id).seat).toMatchObject({ bench: 'quay_bench', slot: 1 });
      // Le temps que l'état complet arrive (5 par seconde): l'invité se sait assis.
      for (let i = 0; i < 12; i++) await tick();
      expect(guest.view.world().characters.find((k) => k.id === id)?.seat).toMatchObject({ slot: 1 });

      // Une direction (vers le nord): l'invité se relève tout de suite chez lui, devant la place.
      await tick(-1);
      const shownAfter = (): { x: number; y: number } => guest.view.world().characters.find((k) => k.id === id)?.pos ?? { x: 0, y: 0 };
      expect(guest.view.world().characters.find((k) => k.id === id)?.seat).toBeNull();
      expect(shownAfter().y).toBeLessThan(place.y - content.settings.benches.standForward + 1e-6);
      // Il marche au nord sans jamais revenir sur le banc, même quand les états d'avant arrivent.
      for (let i = 0; i < 20; i++) {
        await tick(-1);
        expect(place.y - shownAfter().y).toBeGreaterThan(0.8);
      }
      for (let i = 0; i < 20; i++) await tick();
      const authority = character(sim, id).pos;
      expect(character(sim, id).seat).toBeNull();
      expect(Math.hypot(shownAfter().x - authority.x, shownAfter().y - authority.y)).toBeLessThan(0.15);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
