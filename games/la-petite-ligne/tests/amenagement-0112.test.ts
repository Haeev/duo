// Patch 0.11.2: s'asseoir sur une chaise posée dans la maison (S07), poser et reprendre un petit
// objet sur le dessus d'un meuble (S03), reprendre une table qui porte un objet (rien ne se perd),
// format 9 et sa migration depuis le format 8.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../src/etat/actions';
import type { Character, CharacterId } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { placeFurniture, takeFurniture, updatePlacement } from '../src/simulation/amenagement';
import { type Sim, character } from '../src/simulation/contexte';
import { DATA_SCHEMA } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag, countInStacks } from '../src/simulation/sac';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const NORTH = -Math.PI / 2;
const SOUTH = Math.PI / 2;

function reference(file: string): { dataSchema: number; data: Record<string, unknown> } {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as {
    dataSchema: number;
    data: Record<string, unknown>;
  };
}

/** Jeudi 62 à midi, chez soi (référence du format 8): la table en (8, 24), la chaise en (8, 22). */
function autumn(): Sim {
  const ref = reference('format-8-automne-jour-62.json');
  const { content, map } = contentAndMap();
  const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
  for (const c of sim.world.characters) c.corner = null;
  return sim;
}

function at(sim: Sim, id: CharacterId, x: number, y: number, facing: number): Character {
  const c = character(sim, id);
  placeCharacter(sim, c, { x, y });
  c.facing = facing;
  c.status = 'active';
  c.seat = null;
  c.menu = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  return c;
}

function send(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

/** Met l'objet en main (ajouté au sac, case choisie). */
function hold(sim: Sim, c: Character, item: string): void {
  addToBag(sim, c, item, 'ordinary', 1);
  c.selected = c.bag.findIndex((s) => s?.item === item);
}

function tableOf(sim: Sim): string {
  const id = sim.world.furniture.find((f) => f.item === 'table')?.id;
  if (id === undefined) throw new Error('table absente');
  return id;
}

describe('s’asseoir sur une chaise posée (S07)', () => {
  it('Espace devant la chaise fabriquée et posée assoit, tourné comme elle, et la place tient', () => {
    const sim = autumn();
    sim.world.furniture = sim.world.furniture.filter((f) => f.item !== 'chair');
    const c = at(sim, 'p1', 8.5, 23.4, NORTH);
    hold(sim, c, 'chair');
    sim.runtime.dynamicDirty = true;
    expect(placeFurniture(sim, c, { cx: 8, cy: 22 }, 0)).toBe(true);
    const chair = sim.world.furniture.find((f) => f.item === 'chair');
    send(sim, 'p1', { type: 'act' });
    expect(c.seat?.bench).toBe(chair?.id);
    // Au milieu de l'assise, tourné vers le sud (rotation 0, dossier au nord), et toujours assis au pas suivant.
    expect(c.pos.x).toBeCloseTo(8.5, 5);
    expect(c.pos.y).toBeCloseTo(22.5, 5);
    expect(c.facing).toBeCloseTo(SOUTH, 5);
    send(sim, 'p1', { type: 'menu', menu: null });
    expect(c.seat?.bench).toBe(chair?.id);
    expect(c.action.kind).toBe('sit');
    // L'autre ne s'assoit pas sur la même place (une seule à la chaise).
    const d = at(sim, 'p2', 8.5, 23.5, NORTH);
    send(sim, 'p2', { type: 'act' });
    expect(d.seat).toBeNull();
  });

  it('une sauvegarde relue garde le joueur assis sur sa chaise', () => {
    const sim = autumn();
    const chair = sim.world.furniture.find((f) => f.item === 'chair');
    const c = at(sim, 'p1', 8.5, 23.4, NORTH);
    send(sim, 'p1', { type: 'act' });
    expect(c.seat?.bench).toBe(chair?.id);
    const snap = snapshotOf(sim);
    const back = restoreWorld(sim.content, sim.map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(character(back, 'p1').seat?.bench).toBe(chair?.id);
  });
});

describe('petits objets sur les meubles (S03)', () => {
  it('poser une plume sur la table puis la reprendre (X)', () => {
    const sim = autumn();
    const table = tableOf(sim);
    const c = at(sim, 'p1', 8.5, 23.4, SOUTH);
    hold(sim, c, 'jay_feather');
    updatePlacement(sim, c);
    expect(c.placement?.on?.furniture).toBe(table);
    send(sim, 'p1', { type: 'act' });
    expect(sim.world.decor).toHaveLength(1);
    expect(sim.world.decor[0]?.on).toBe(table);
    expect(countInBag(c, 'jay_feather')).toBe(0);
    // La table reste en place; X reprend d'abord ce qui est posé dessus.
    send(sim, 'p1', { type: 'examine' });
    expect(sim.world.decor).toHaveLength(0);
    expect(countInBag(c, 'jay_feather')).toBe(1);
    expect(sim.world.furniture.some((f) => f.id === table)).toBe(true);
  });

  it('deux objets prennent les deux places de la table, jamais la même', () => {
    const sim = autumn();
    const c = at(sim, 'p1', 8.5, 23.4, SOUTH);
    for (const item of ['jay_feather', 'flower_pot']) {
      hold(sim, c, item);
      updatePlacement(sim, c);
      send(sim, 'p1', { type: 'act' });
    }
    expect(sim.world.decor.map((d) => d.place).sort()).toEqual([0, 1]);
  });

  it('reprendre une table qui porte un objet: l’objet revient au sac, ou au coffre si le sac est plein', () => {
    const sim = autumn();
    const table = tableOf(sim);
    const c = at(sim, 'p1', 8.5, 23.4, SOUTH);
    sim.world.decor.push({ id: 'd-a', item: 'jay_feather', on: table, place: 0, placedBy: 'p1' });
    expect(takeFurniture(sim, c, table)).toBe(true);
    expect(sim.world.decor).toHaveLength(0);
    expect(countInBag(c, 'table')).toBe(1);
    expect(countInBag(c, 'jay_feather')).toBe(1);

    const full = autumn();
    const t2 = tableOf(full);
    const e = at(full, 'p1', 8.5, 23.4, SOUTH);
    // Sac plein de rondins, sauf une case (pour la table): la plume va au rangement.
    for (let i = 0; i < e.bag.length; i++) e.bag[i] = { item: 'log', quality: 'ordinary', count: 99 };
    e.bag[0] = null;
    const before = countInStacks(full.world.cellar, 'jay_feather');
    full.world.decor.push({ id: 'd-b', item: 'jay_feather', on: t2, place: 1, placedBy: 'p1' });
    expect(takeFurniture(full, e, t2)).toBe(true);
    expect(countInBag(e, 'table')).toBe(1);
    const stored = countInStacks(full.world.cellar, 'jay_feather') - before;
    const onGround = full.world.groundItems.filter((g) => g.item === 'jay_feather').length;
    expect(stored + onGround).toBe(1);
  });
});

describe('format 9', () => {
  it('une sauvegarde du format 8 se relit sans petit objet, et un objet posé survit à la reprise', () => {
    expect(DATA_SCHEMA).toBeGreaterThanOrEqual(9);
    const ref = reference('format-8-automne-jour-62.json');
    expect(ref.dataSchema).toBe(8);
    expect('decor' in ref.data).toBe(false);
    const sim = autumn();
    expect(sim.world.decor).toEqual([]);
    const table = tableOf(sim);
    sim.world.decor.push({ id: 'd-c', item: 'flower_pot', on: table, place: 1, placedBy: 'p2' });
    // Un objet dont le meuble a disparu (sauvegarde abîmée) revient au rangement, rien ne se perd.
    sim.world.decor.push({ id: 'd-d', item: 'jay_feather', on: 'f-disparu', place: 0, placedBy: 'p2' });
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(9);
    const before = countInStacks(sim.world.cellar, 'jay_feather');
    const back = restoreWorld(sim.content, sim.map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(back.world.decor).toEqual([{ id: 'd-c', item: 'flower_pot', on: table, place: 1, placedBy: 'p2' }]);
    const returned = countInStacks(back.world.cellar, 'jay_feather') - before + back.world.groundItems.filter((g) => g.item === 'jay_feather').length;
    expect(returned).toBe(1);
  });
});
