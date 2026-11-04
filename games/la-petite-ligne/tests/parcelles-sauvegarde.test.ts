// Parcelles libres de la 0.13 et sauvegardes (format 15): reprise d'une 0.12 et d'une 0.13 d'avant
// les parcelles (formats 13 et 14) sans perdre une culture (PL-18), aller-retour identique (PL-19).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { plotsFree, plotsOwned, plotsPlaced } from '../src/etat/parcelles';
import type { GardenCell } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { DATA_SCHEMA } from '../src/simulation/constantes';
import { ITEM } from '../src/simulation/ids';
import { step } from '../src/simulation/pas';
import { countInStacks } from '../src/simulation/sac';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const TOOLBAR = 8;

function reference(file: string): { dataSchema: number; data: Record<string, unknown> } {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as {
    dataSchema: number;
    data: Record<string, unknown>;
  };
  return raw;
}

function restore(dataSchema: number, data: unknown): ReturnType<typeof restoreWorld> {
  const { content, map } = contentAndMap();
  return restoreWorld(content, map, decodeSave(structuredClone(data)), dataSchema, [A, B]);
}

describe('reprise des potagers d’avant les parcelles libres (PL-18)', () => {
  it.each(['format-14-milieu-semaine-2.json', 'format-14-ete-jour-25.json', 'format-13-ete-jour-25.json', 'format-12-ete-jour-25.json'])(
    '%s: 12 parcelles aux mêmes cases, sols, eau, cultures et dernières récoltes; 12 possédées; 10 en rayon; un cordeau chacun',
    (file) => {
      const ref = reference(file);
      expect(ref.dataSchema).toBeLessThan(DATA_SCHEMA);
      const before = ref.data.garden as GardenCell[];
      expect(before).toHaveLength(12);
      const sim = restore(ref.dataSchema, ref.data);
      const w = sim.world;
      expect(w.garden).toEqual(before);
      expect(w.garden.map((g) => g.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(w.garden.every((g) => g.kind === undefined)).toBe(true);
      expect(plotsOwned(sim.content, w)).toBe(12);
      expect(plotsPlaced(w)).toBe(12);
      expect(plotsFree(sim.content, w)).toBe(0);
      expect(w.plots).toEqual({ base: 12, bought: 0, clearedCells: [], stock: 10, lastRestockDay: (ref.data.clock as { day: number }).day, nextIndex: 12 });
      for (const c of w.characters) {
        const old = (ref.data.characters as { id: string; bag: ({ item: string } | null)[] }[]).find((x) => x.id === c.id);
        const firstFree = old?.bag.findIndex((s) => s === null) ?? -1;
        expect(firstFree, `${c.id}: une case libre dans la référence`).toBeGreaterThanOrEqual(0);
        // La barre si elle a une case libre, sinon le sac: la première case libre, dans cet ordre.
        expect(c.bag[firstFree]?.item, c.id).toBe(ITEM.gardenLine);
        expect(c.bag.filter((s) => s?.item === ITEM.gardenLine)).toHaveLength(1);
      }
      // L'astuce « Ton potager est libre » attend chez chacun.
      for (const c of w.characters) expect([...c.hintQueue, ...c.hintsShown]).toContain('plot_migration');
      // Et la partie se rejoue.
      for (let i = 0; i < 200; i++) step(sim, { controls: {}, intents: [] });
    },
  );

  it('format 14: qui a une case libre dans sa barre y trouve le cordeau', () => {
    const ref = reference('format-14-milieu-semaine-2.json');
    const sim = restore(ref.dataSchema, ref.data);
    const p2 = sim.world.characters.find((c) => c.id === 'p2');
    const slot = p2?.bag.findIndex((s) => s?.item === ITEM.gardenLine) ?? -1;
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(slot).toBeLessThan(TOOLBAR);
  });

  it('sacs pleins: le cordeau attend au coffre de la maisonnette', () => {
    const ref = reference('format-14-milieu-semaine-2.json');
    const data = structuredClone(ref.data);
    for (const c of data.characters as { bag: unknown[] }[]) {
      c.bag = c.bag.map((s) => s ?? { item: 'log', quality: 'ordinary', count: 1 });
    }
    const sim = restore(ref.dataSchema, data);
    expect(countInStacks(sim.world.cellar, ITEM.gardenLine) + countInStacks(sim.world.rack, ITEM.gardenLine)).toBe(2);
  });
});

describe('aller-retour au format 15 (PL-19)', () => {
  it('sauvegarder puis recharger rend le même potager, le même compteur, le même rayon, la même friche', () => {
    const ref = reference('format-14-ete-jour-25.json');
    const sim = restore(ref.dataSchema, ref.data);
    const w = sim.world;
    // Un potager de la 0.13: des parcelles reprises et reposées, achetées, une friche entamée.
    w.plots.bought = 3;
    w.plots.stock = 4;
    w.plots.clearedCells.push([-8, 29], [-7, 29], [-6, 29], [-5, 29], [-8, 30]);
    w.garden.splice(2, 1);
    w.garden.push({ index: 12, cell: { cx: 3, cy: 31 }, soil: 'tilled', wet: true, crop: null, lastHarvest: null });
    w.garden.push({ index: 13, cell: { cx: -8, cy: 29 }, soil: 'grass', wet: false, crop: null, lastHarvest: null });
    w.plots.nextIndex = 14;
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(DATA_SCHEMA);
    const back = restore(snap.dataSchema, JSON.parse(JSON.stringify(snap.data)));
    expect(back.world.garden).toEqual(w.garden);
    expect(back.world.plots).toEqual(w.plots);
    expect(plotsOwned(back.content, back.world)).toBe(16);
    // Aucun cordeau de plus à la relecture d'une sauvegarde du format 15.
    for (const c of back.world.characters) expect(c.bag.filter((s) => s?.item === ITEM.gardenLine)).toHaveLength(1);
  });
});
