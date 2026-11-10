// Budgets de taille des messages (ADR 0019): tenus au départ et sur un état fabriqué « au pire ».
import * as v from 'valibot';
import { afterAll, describe, expect, it } from 'vitest';
import { SLICES, WorldSchema } from '../src/etat/monde';
import type { Stack } from '../src/etat/joueur';
import { BUDGET_BYTES, FastSchema, SLICE_SCHEMAS } from '../src/reseau/canaux';
import { byteLength, currentPlace, fastMessage, sliceMessage } from '../src/reseau/tranches';
import { snapshotOf } from '../src/sauvegarde/sauvegarde';
import { gameContent, newSim } from './aides';

/** Limite du SDK par message, et budget interne de la sauvegarde (la moitié du manifeste). */
const SDK_LIMIT = 64 * 1024;
const SAVE_BUDGET = 512 * 1024;

const content = gameContent();

/** Le pire que les règles du jalon 1 permettent: sacs pleins, sol jonché, mémoire et collections remplies. */
function worstCase(): ReturnType<typeof newSim> {
  const sim = newSim(content);
  const full: Stack = { item: 'hache-forgee', count: 1, wear: 120 };
  for (const player of sim.world.players) {
    player.toolbar = player.toolbar.map(() => ({ ...full }));
    player.bag = {
      id: 'malle-a-bretelles',
      slots: Array.from({ length: 20 }, () => ({ ...full })),
    };
    player.look = {
      shape: 'adult-medium',
      skin: 3,
      pieces: ['body', 'head', 'hair', 'top', 'bottom', 'shoes', 'hat', 'glasses', 'accessory'].map(
        (slot) => ({
          slot: slot as 'body',
          id: `${slot}-piece-au-nom-long-00`,
          colors: [10, 20, 30],
        }),
      ),
    };
    player.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'question' };
    player.gesture = { clip: 'reach-up', target: 'pommier', until: 999_999, long: false };
  }
  const place = currentPlace(sim.world);
  for (let i = 0; i < 80; i++)
    place.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 12.345, y: 23.456 });
  for (let i = 0; i < 200; i++) {
    place.placed.push({ id: `pose-${i}`, type: 'banc', x: 12.5, y: 23.5, rotation: 1 });
    place.objects[`pose-${i}`] = { sit: [0, 1] };
  }
  for (let i = 0; i < 20; i++)
    place.villagers[`habitant-${i}`] = {
      met: [true, true],
      talkingWith: null,
      body: { x: 1, y: 1, facing: 0, speed: 0 },
    };
  const progress = sim.world.progress;
  for (let i = 0; i < 300; i++)
    progress.memory[`essai-gare.sujet-${i}.detail`] = { v: `valeur-${i}`, by: 'duo', day: 999 };
  for (let i = 0; i < 60; i++) progress.bonds[`habitant-${i}`] = 9999;
  for (let i = 0; i < 40; i++)
    progress.quests[`suite-de-quetes-${i}`] = {
      chapter: 'chapitre-final',
      step: 'derniere-etape',
      done: true,
    };
  for (let i = 0; i < 8; i++)
    progress.collections[`collection-${i}`] = Array.from({ length: 40 }, (_, n) => `entree-${n}`);
  return sim;
}

let TAILLES_AU_PIRE: Record<string, number> = {};

describe('tailles des messages', () => {
  afterAll(() => {
    // Relevé pour les comptes rendus et l'ADR 0019 (lu par `pnpm test -- --reporter=verbose`).
    process.stdout.write(`tailles au pire (octets): ${JSON.stringify(TAILLES_AU_PIRE)}\n`);
  });

  it('tiennent leur budget au départ, et chaque tranche passe son schéma', () => {
    const sim = newSim(content);
    for (const slice of SLICES) {
      const message = sliceMessage(sim.world, slice);
      expect(
        v.safeParse(SLICE_SCHEMAS[slice], JSON.parse(JSON.stringify(message))).success,
        slice,
      ).toBe(true);
      expect(byteLength(message), slice).toBeLessThanOrEqual(BUDGET_BYTES[slice]);
    }
    const fast = fastMessage(sim.world, content, -1);
    expect(v.safeParse(FastSchema, JSON.parse(JSON.stringify(fast))).success).toBe(true);
    expect(byteLength(fast)).toBeLessThanOrEqual(BUDGET_BYTES.fast);
  });

  it('tiennent leur budget sur l’état au pire', () => {
    const sim = worstCase();
    // L'état au pire respecte les bornes des schémas: c'est bien un état que le jeu peut atteindre.
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
    const sizes: Record<string, number> = {};
    for (const slice of SLICES) {
      sizes[slice] = byteLength(sliceMessage(sim.world, slice));
      expect(sizes[slice], slice).toBeLessThanOrEqual(BUDGET_BYTES[slice]);
    }
    sizes.fast = byteLength(fastMessage(sim.world, content, 123_456));
    expect(sizes.fast).toBeLessThanOrEqual(BUDGET_BYTES.fast);
    // Aucun budget n'approche la limite du SDK: un message refusé n'arrête jamais la partie.
    for (const budget of Object.values(BUDGET_BYTES))
      expect(budget).toBeLessThanOrEqual(SDK_LIMIT / 2);
    expect(Object.fromEntries(Object.entries(sizes).map(([k, n]) => [k, n > 0]))).toEqual({
      common: true,
      players: true,
      progress: true,
      place: true,
      fast: true,
    });
    TAILLES_AU_PIRE = sizes;
  });

  it('gardent la sauvegarde au pire sous son budget', () => {
    expect(byteLength(snapshotOf(worstCase().world).data)).toBeLessThanOrEqual(SAVE_BUDGET);
  });

  it('ne transmettent pas les champs du canal rapide dans les tranches lentes', () => {
    const sim = newSim(content);
    const players = sliceMessage(sim.world, 'players').players;
    expect(Object.keys(players[0])).not.toContain('body');
    expect(Object.keys(players[0])).not.toContain('needs');
    const villager = sliceMessage(sim.world, 'place').place.villagers['cheffe-de-gare'];
    expect(villager).toEqual({ met: [false, false], talkingWith: null });
  });
});
