// Le baquet de la maison du garde est un meuble des joueurs (cahier 4.4): déjà posé dans une partie
// neuve (`furnished` du logement), rangeable et déplaçable par le mode déco, et remis une seule fois
// dans l'inventaire d'une partie de la 0.22.0, où il était un objet fixe de la carte.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { HousingState } from '../src/etat/logement';
import { DATA_SCHEMA } from '../src/etat/monde';
import { fill, TEXTS } from '../src/interface/textes';
import { createGuest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { stowedWasher } from '../src/simulation/logement/etat';
import { placementRefusal } from '../src/simulation/logement/pose';
import { idleInput } from '../src/simulation/noyau/entrees';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { MEMBERS, newSim } from './aides';
import { act, contentWith, wait } from './aides-l3';
import { put } from './aides-noyau';
import { createVirtualLink, memoryLog } from './aides-reseau';

const HOUSE = 'maison-du-garde';
const content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
  settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
});

function housing(sim: Sim): HousingState {
  const state = sim.world.places.aubrune?.housing?.[HOUSE];
  if (state === undefined) throw new Error('maison absente');
  return state;
}

function tubs(sim: Sim): { id: string; x: number; y: number; rotation: number }[] {
  return (sim.world.places.aubrune?.placed ?? []).filter((p) => p.type === 'baquet');
}

/** Aubrune à 10 h, la maison créée au premier pas; `restored`: pièces déjà restaurées. */
function aubrune(restored: readonly string[] = []): Sim {
  const sim = newSim(content);
  wait(sim, 1 / 30);
  for (const id of restored) {
    const room = housing(sim).rooms[id];
    if (room === undefined) throw new Error(`pièce absente: ${id}`);
    room.state = 'restored';
  }
  return sim;
}

/** Toilette au baquet posé: debout à l'ouest de lui, tourné vers l'est. */
function wash(sim: Sim, player: PlayerIndex): void {
  const tub = tubs(sim)[0];
  if (tub === undefined) throw new Error('baquet non posé');
  put(sim, player, tub.x - 1, tub.y, 0);
  sim.world.players[player].needs.hygiene = 12;
  expect(act(sim, player, { type: 'act' })).toContainEqual({
    type: 'gesture_started',
    player,
    clip: 'wash',
    target: tub.id,
  });
  wait(sim, 4.5);
  expect(sim.world.players[player].needs.hygiene).toBeCloseTo(100, 0);
}

function stool(sim: Sim): string | null {
  const place = sim.content.places.aubrune;
  const state = sim.world.places.aubrune;
  const def = place?.housings[HOUSE];
  if (place === undefined || state === undefined || def === undefined) throw new Error('lieu');
  return placementRefusal({
    content: sim.content,
    place,
    state,
    world: sim.world,
    housing: def,
    candidate: { type: 'tabouret-miel', x: 21.5, y: 213.5, rotation: 0 },
    exclude: new Set(),
  });
}

describe('baquet de la maison du garde', () => {
  it('partie neuve: déjà posé au pied du lit, il lave à 100, et l’invité le voit', () => {
    const sim = aubrune();
    expect(tubs(sim)).toEqual([expect.objectContaining({ x: 21.5, y: 214, rotation: 3 })]);
    expect(housing(sim).stock.baquet).toBeUndefined();
    expect(housing(sim).granted?.baquet).toBe(1);
    expect(stowedWasher(sim.content, sim.world)).toBeNull();
    wash(sim, 0);

    const clock = { now: 0 };
    const link = createVirtualLink({ latencyMs: 20, jitterMs: 0, lossPercent: 0 }, 3, () => {
      return clock.now;
    });
    const host = createHost(sim, link.host, memoryLog(), 0);
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
    host.sendAll();
    for (let i = 0; i < 40; i++) {
      clock.now += 1000 / 30;
      link.deliver(clock.now);
      host.step(idleInput(0));
      guest.step(idleInput(i + 1));
      link.deliver(clock.now);
    }
    const seen = guest.world();
    expect(seen?.places.aubrune?.placed.filter((p) => p.type === 'baquet')).toEqual(tubs(sim));
    expect(seen?.places.aubrune?.housing?.[HOUSE]?.granted).toEqual(housing(sim).granted);
    guest.dispose();
  });

  it('rangé, il libère la salle et l’aide le dit; reposé, il lave encore', () => {
    const sim = aubrune(['salle']);
    expect(stool(sim)).toBe('overlap');
    const id = tubs(sim)[0]?.id ?? '';
    put(sim, 0, 22.5, 211.5, 0);
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 0, { type: 'deco_store', housing: HOUSE, prop: id });
    expect(tubs(sim)).toEqual([]);
    expect(housing(sim).stock.baquet).toBe(1);
    expect(stool(sim)).toBeNull();
    // Aide de l'hygiène (carnet): le meuble pour se laver est rangé, elle dit de le poser.
    expect(stowedWasher(sim.content, sim.world)).toBe('Baquet');
    expect(fill(TEXTS.needs.washStowed, { meuble: 'baquet' })).toBe(
      'Pose le baquet dans la maison pour te laver',
    );

    act(sim, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'baquet',
      x: 21.5,
      y: 214,
      rotation: 3,
    });
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: false });
    expect(tubs(sim)).toEqual([expect.objectContaining({ x: 21.5, y: 214, rotation: 3 })]);
    expect(housing(sim).stock.baquet).toBeUndefined();
    expect(stowedWasher(sim.content, sim.world)).toBeNull();
    wash(sim, 1);
  });

  it('sauvegarde de la 0.22.0 (baquet de la carte): il arrive une fois dans l’inventaire', () => {
    const sim = aubrune(['salle']);
    // Une maison de la 0.22.0: ni relevé des meubles de départ, ni baquet à elle.
    const old = housing(sim);
    delete old.granted;
    const state = sim.world.places.aubrune;
    if (state === undefined) throw new Error('lieu');
    for (const tub of tubs(sim)) Reflect.deleteProperty(state.objects, tub.id);
    state.placed = state.placed.filter((p) => p.type !== 'baquet');
    const stockBefore = { ...old.stock };

    const reload = (from: Sim): Sim => {
      const saved = JSON.parse(JSON.stringify(snapshotOf(from.world, content).data)) as unknown;
      const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved }, MEMBERS);
      if (!restored.ok) throw new Error(restored.reason);
      const again = createSim(content, restored.world);
      wait(again, 1 / 30);
      return again;
    };
    const again = reload(sim);
    // Seul ce qui manquait arrive: les autres meubles de départ ne sont pas redonnés.
    expect(housing(again).stock).toEqual({ ...stockBefore, baquet: 1 });
    expect(housing(again).granted?.baquet).toBe(1);
    expect(tubs(again)).toEqual([]);
    // Une seule fois: posé ailleurs puis rangé, rechargé, il n'y en a toujours qu'un.
    expect(reload(again).world.places.aubrune?.housing?.[HOUSE]?.stock.baquet).toBe(1);
    put(again, 0, 22.5, 211.5, 0);
    act(again, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(again, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'baquet',
      x: 21.5,
      y: 214,
      rotation: 3,
    });
    act(again, 0, { type: 'deco_drop', housing: HOUSE });
    act(again, 0, { type: 'deco_mode', housing: HOUSE, on: false });
    const after = reload(again);
    expect(tubs(after)).toHaveLength(1);
    expect(housing(after).stock.baquet).toBeUndefined();
    wash(after, 0);
  });
});
