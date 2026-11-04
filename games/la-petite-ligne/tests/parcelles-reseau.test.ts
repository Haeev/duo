// Parcelles libres de la 0.13 à travers le réseau (PL-17): l'invité pose et reprend par intentions,
// l'hôte valide chaque case avec ses règles (l'aperçu de l'invité n'est qu'une prévision), et
// l'invité voit le même potager que l'hôte (forme compacte de l'état transmis).
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { ControlFrame } from '../src/etat/actions';
import { plotPlacement } from '../src/etat/parcelles';
import type { WorldEvent } from '../src/etat/types';
import { createSession, type GameAction } from '../src/session';
import { SIM_DT } from '../src/simulation/constantes';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { ITEM } from '../src/simulation/ids';
import { contentAndMap } from './aides';

const STEP_MS = SIM_DT * 1000;

describe('parcelles libres à travers le réseau (PL-17)', () => {
  it("l'invité pose et reprend par intentions; l'hôte refuse une case invalide même si l'aperçu de l'invité était vert", async () => {
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
      const frame = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
      const tick = async (): Promise<void> => {
        host.step(frame());
        guest.step(frame());
        host.beforeFrame(1);
        guest.beforeFrame(1);
        await new Promise((resolve) => setTimeout(resolve, STEP_MS));
      };
      const ticks = async (n: number): Promise<void> => {
        for (let i = 0; i < n; i++) await tick();
      };
      host.view.send({ type: 'create_character', name: 'Alex', hair: 0, outfit: 0 });
      await ticks(10);
      guest.view.send({ type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 });
      await ticks(10);
      for (let i = 0; i < 60 && sim.world.scene !== null; i++) {
        const scene = sim.world.scene;
        const intent = scene.choices.length > 0 ? ({ type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } as const) : ({ type: 'dialogue_next' } as const);
        host.view.send(intent);
        guest.view.send(intent);
        await ticks(4);
      }
      expect(sim.world.scene).toBeNull();

      // Deux parcelles de plus au compteur; l'invité prend son cordeau au milieu du pré.
      sim.world.plots.bought = 2;
      const id = guest.view.localCharacter();
      const c = character(sim, id);
      placeCharacter(sim, c, { x: 5.5, y: 31.5 });
      const slot = c.bag.findIndex((s) => s?.item === ITEM.gardenLine);
      guest.view.send({ type: 'select_slot', slot });
      await ticks(15);
      expect(guest.view.world().characters.find((k) => k.id === id)?.bag[slot]?.item).toBe(ITEM.gardenLine);
      const events: WorldEvent[] = [];
      guest.view.onEvent((event) => events.push(event));

      // Pose valide de l'invité: la parcelle naît chez l'hôte, puis chez l'invité.
      guest.view.send({ type: 'plot_place', cells: [{ cx: 4, cy: 31 }] });
      await ticks(15);
      expect(sim.world.garden.some((g) => g.cell.cx === 4 && g.cell.cy === 31)).toBe(true);
      expect(guest.view.world().garden.some((g) => g.cell.cx === 4 && g.cell.cy === 31)).toBe(true);
      expect(events.some((e) => e.type === 'plot_placed' && e.by === id)).toBe(true);

      // L'hôte pose (5, 31) à l'instant même où l'invité, qui ne le sait pas encore, l'y voit en vert.
      const target = { cx: 5, cy: 31 };
      expect(plotPlacement(content, map, guest.view.world(), target)).toBeNull();
      host.view.send({ type: 'select_slot', slot: character(sim, host.view.localCharacter()).bag.findIndex((s) => s?.item === ITEM.gardenLine) });
      await tick();
      host.view.send({ type: 'plot_place', cells: [target] });
      guest.view.send({ type: 'plot_place', cells: [target] });
      await ticks(15);
      expect(sim.world.garden.filter((g) => g.cell.cx === 5 && g.cell.cy === 31)).toHaveLength(1);
      expect(events).toContainEqual({ type: 'plot_refused', by: id, cell: target, reason: 'exists' });

      // Une case hors de la terre envoyée telle quelle (aperçu trafiqué): refusée par l'hôte.
      guest.view.send({ type: 'plot_place', cells: [{ cx: 30, cy: 30 }] });
      await ticks(10);
      expect(sim.world.garden.some((g) => g.cell.cx === 30)).toBe(false);

      // Reprise par l'invité (X, clic droit): la parcelle vide part chez les deux.
      guest.view.send({ type: 'plot_hold', cell: { cx: 4, cy: 31 } });
      await ticks(15);
      expect(sim.world.garden.some((g) => g.cell.cx === 4 && g.cell.cy === 31)).toBe(false);
      expect(guest.view.world().garden.some((g) => g.cell.cx === 4 && g.cell.cy === 31)).toBe(false);

      // L'invité voit le potager de l'hôte, case pour case (la dernière récolte reste chez l'hôte).
      const shown = guest.view.world().garden.map((g) => ({ ...g, lastHarvest: null }));
      expect(shown).toEqual(sim.world.garden.map((g) => ({ ...g, lastHarvest: null })));
      expect(guest.view.world().plots).toEqual(sim.world.plots);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
