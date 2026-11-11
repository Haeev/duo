// Boucle des meubles: un objet du sac qui déclare sa fiche de meuble (champ `prop`) entre dans
// l'inventaire de la maison (à l'ouverture du mode déco, ou par « Ranger à la maison »), se pose,
// se reprend (il retourne à l'inventaire, pas au sac). Le gabarit est éprouvé par un meuble
// factice ajouté par les seules données: fabriqué à l'établi, il se pose sans autre changement.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { DATA_SCHEMA } from '../src/etat/monde';
import { stowModel } from '../src/interface/ranger-maison';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { jobAt } from '../src/simulation/fabrication/index';
import { stationOf } from '../src/simulation/fabrication/plans';
import type { Intent } from '../src/simulation/noyau/entrees';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { countItem } from '../src/simulation/sac/inventaire';
import { gameContent, MEMBERS, newSim } from './aides';
import { act, contentWith, wait } from './aides-l3';

const PLACE = 'essai-gare';
const HOUSE = 'maison-essai';
const BENCH = 'etabli-de-gare';
const ITEM = 'pouf-factice-bleu';
const PROP = 'pouf-factice';

type Json = Record<string, unknown>;

/** Une fiche des données, qui doit exister. */
function sheet(files: Record<string, Json>, path: string): Json {
  const found = files[path];
  if (found === undefined) throw new Error(`fiche absente: ${path}`);
  return found;
}

/** Le gabarit « meuble obtenable » rempli à la main: une fiche, un objet, un plan. Rien d'autre. */
function withFakeFurniture(files: Record<string, Json>): void {
  files[`commun/meubles/${PROP}.json`] = {
    schema: 1,
    id: PROP,
    name: 'Pouf',
    model: 'stool',
    size: { w: 1, h: 1 },
    solid: true,
    placeable: true,
    series: null,
    bricks: [{ brick: 'sit', seats: 1, restPerMinute: 6 }],
  };
  files[`commun/objets/${ITEM}.json`] = {
    schema: 1,
    id: ITEM,
    name: 'Pouf bleu',
    family: 'furniture',
    stack: 1,
    food: null,
    tool: null,
    prop: PROP,
  };
  files['commun/plans/pouf-factice.json'] = {
    schema: 1,
    id: 'pouf-factice',
    name: 'Pouf',
    makes: { kind: 'furniture', variants: [{ color: '#4a6fa5', item: ITEM }] },
    station: 'workbench',
    materials: [{ item: 'planche', count: 1 }],
    work: 8,
    source: 'start',
    series: null,
  };
}

function housing(sim: Sim) {
  const state = sim.world.places[PLACE]?.housing?.[HOUSE];
  if (state === undefined) throw new Error('logement absent');
  return state;
}

function at(sim: Sim, player: PlayerIndex, x: number, y: number): void {
  sim.world.players[player].body = { x, y, facing: 0, speed: 0 };
}

/** Dans la salle restaurée de la maison d'essai. */
function goHome(sim: Sim, player: PlayerIndex): void {
  for (const room of Object.values(housing(sim).rooms)) room.state = 'restored';
  at(sim, player, 29.5 + player, 11);
}

function refused(sim: Sim, player: PlayerIndex, intent: Intent): string[] {
  return act(sim, player, intent).flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

/** Fabrique le pouf à l'établi de la gare, comme un joueur: plan, matériaux, coups. */
function craft(sim: Sim, player: PlayerIndex): void {
  const station = stationOf(sim, BENCH);
  if (station === null) throw new Error('établi absent');
  at(sim, player, station.x, station.y + 1);
  sim.world.players[player].toolbar[0] = { item: 'planche', count: 1 };
  expect(
    refused(sim, player, { type: 'craft_start', target: BENCH, plan: 'pouf-factice', variant: 0 }),
  ).toEqual([]);
  for (let i = 0; i < 10 && jobAt(sim.world, BENCH) !== null; i++) {
    act(sim, player, { type: 'craft_strike', target: BENCH });
    wait(sim, 1);
  }
  expect(countItem(sim.world.players[player], ITEM)).toBe(1);
}

function fakeSim(): { sim: Sim; content: Content } {
  const content = contentWith(withFakeFurniture);
  const sim = newSim(content);
  wait(sim, 1 / 30);
  return { sim, content };
}

describe('boucle des meubles', () => {
  it('un meuble factice fabriqué à l’établi entre à la maison avec le mode déco, se pose et se reprend', () => {
    const { sim } = fakeSim();
    craft(sim, 0);
    goHome(sim, 0);
    const opened = act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    expect(opened).toContainEqual({
      type: 'furniture_stowed',
      player: 0,
      housing: HOUSE,
      item: ITEM,
      prop: PROP,
      count: 1,
    });
    // Sorti du sac, entré dans l'inventaire de la maison: il paraît dans la liste du mode déco.
    expect(countItem(sim.world.players[0], ITEM)).toBe(0);
    expect(housing(sim).stock[PROP]).toBe(1);
    expect(
      refused(sim, 0, {
        type: 'deco_take',
        housing: HOUSE,
        prop: PROP,
        x: 28.5,
        y: 7.5,
        rotation: 0,
      }),
    ).toEqual([]);
    expect(refused(sim, 0, { type: 'deco_drop', housing: HOUSE })).toEqual([]);
    const placed = sim.world.places[PLACE]?.placed.find((p) => p.type === PROP);
    expect(placed).toMatchObject({ x: 28.5, y: 7.5 });
    expect(housing(sim).stock[PROP]).toBeUndefined();
    // Posé, il sert par ses briques (une place assise).
    expect(sim.world.places[PLACE]?.objects[placed?.id ?? '']).toEqual({ sit: [null] });
    // Repris: il retourne à l'inventaire de la maison, pas au sac.
    expect(refused(sim, 0, { type: 'deco_store', housing: HOUSE, prop: placed?.id ?? '' })).toEqual(
      [],
    );
    expect(housing(sim).stock[PROP]).toBe(1);
    expect(countItem(sim.world.players[0], ITEM)).toBe(0);
  });

  it('« Ranger à la maison » depuis le sac: chez soi oui, ailleurs non, et pas pour un objet ordinaire', () => {
    const { sim, content } = fakeSim();
    const me = sim.world.players[0];
    me.toolbar[0] = { item: ITEM, count: 1 };
    me.toolbar[1] = { item: 'planche', count: 2 };
    const stow = (index: number): Intent => ({
      type: 'furniture_stow',
      housing: HOUSE,
      from: { area: 'toolbar', index },
    });
    // Loin de la maison: l'interface l'annonce, la simulation le refuse.
    at(sim, 0, 10, 20);
    expect(stowModel(content, sim.world, 0, ITEM).kind).toBe('refused');
    expect(refused(sim, 0, stow(0))).toEqual(['deco-not-home']);
    expect(me.toolbar[0]).toEqual({ item: ITEM, count: 1 });
    goHome(sim, 0);
    expect(stowModel(content, sim.world, 0, ITEM)).toEqual({
      kind: 'ready',
      housing: HOUSE,
      prop: PROP,
    });
    expect(stowModel(content, sim.world, 0, 'planche')).toEqual({ kind: 'none' });
    expect(refused(sim, 0, stow(1))).toEqual(['not-furniture']);
    expect(refused(sim, 0, stow(3))).toEqual(['empty-slot']);
    expect(refused(sim, 0, stow(0))).toEqual([]);
    expect(me.toolbar[0]).toBeNull();
    expect(me.toolbar[1]).toEqual({ item: 'planche', count: 2 });
    expect(housing(sim).stock[PROP]).toBe(1);
  });

  it('l’invité range et pose comme l’hôte; les meubles du sac de l’un ne bougent pas quand l’autre décore', () => {
    const { sim } = fakeSim();
    sim.world.players[0].toolbar[0] = { item: ITEM, count: 1 };
    sim.world.players[1].toolbar[2] = { item: ITEM, count: 1 };
    goHome(sim, 0);
    goHome(sim, 1);
    act(sim, 1, { type: 'deco_mode', housing: HOUSE, on: true });
    expect(housing(sim).stock[PROP]).toBe(1);
    expect(countItem(sim.world.players[0], ITEM)).toBe(1);
    expect(
      refused(sim, 1, {
        type: 'deco_take',
        housing: HOUSE,
        prop: PROP,
        x: 30.5,
        y: 7.5,
        rotation: 1,
      }),
    ).toEqual([]);
    expect(refused(sim, 1, { type: 'deco_drop', housing: HOUSE })).toEqual([]);
    expect(sim.world.places[PLACE]?.placed.some((p) => p.type === PROP)).toBe(true);
  });

  it('se sauvegarde et se reprend: inventaire de la maison, meuble posé, meuble resté au sac', () => {
    const { sim, content } = fakeSim();
    sim.world.players[0].toolbar[0] = { item: ITEM, count: 1 };
    sim.world.players[1].toolbar[0] = { item: ITEM, count: 1 };
    goHome(sim, 0);
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 0, { type: 'deco_take', housing: HOUSE, prop: PROP, x: 28.5, y: 7.5, rotation: 0 });
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: false });
    sim.world.players[0].toolbar[1] = { item: ITEM, count: 1 };
    act(sim, 0, { type: 'furniture_stow', housing: HOUSE, from: { area: 'toolbar', index: 1 } });
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world, content).data)) as unknown;
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const again = createSim(content, restored.world);
    wait(again, 1 / 30);
    expect(housing(again).stock[PROP]).toBe(1);
    expect(again.world.places[PLACE]?.placed.filter((p) => p.type === PROP)).toHaveLength(1);
    expect(countItem(again.world.players[1], ITEM)).toBe(1);
    // Après la reprise, celui de l'inventaire se pose encore.
    at(again, 0, 29.5, 11);
    act(again, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(again, 0, { type: 'deco_take', housing: HOUSE, prop: PROP, x: 30.5, y: 7.5, rotation: 0 });
    expect(refused(again, 0, { type: 'deco_drop', housing: HOUSE })).toEqual([]);
    expect(again.world.places[PLACE]?.placed.filter((p) => p.type === PROP)).toHaveLength(2);
  });

  it('les données livrées: chaque objet meuble mène à une fiche posable, plans compris', () => {
    const content = gameContent();
    const furniture = Object.values(content.items).filter((item) => item.family === 'furniture');
    expect(furniture.length).toBeGreaterThanOrEqual(8);
    for (const item of furniture) {
      const prop = content.props[item.prop ?? ''];
      expect(prop?.placeable, item.id).toBe(true);
    }
    // Tout ce que l'établi fabrique comme meuble se range donc à la maison.
    for (const plan of Object.values(content.plans)) {
      if (plan.makes.kind !== 'furniture') continue;
      for (const variant of plan.makes.variants)
        expect(content.items[variant.item]?.prop, `${plan.id}: ${variant.item}`).toBeDefined();
    }
  });

  it('le nichoir (audit B.20): plan donné par Basile, meuble du jardin seulement', () => {
    const content = gameContent();
    // La source: la confidence des nichoirs de Basile retient le plan pour les deux joueurs.
    const secret = content.places.aubrune?.dialogues.find((d) => d.id === 'basile-secret-nichoirs');
    expect(JSON.stringify(secret)).toContain('fabrication.plan.nichoir');
    expect(content.plans.nichoir?.source).toBe('villager');
    const sim = newSim(content);
    wait(sim, 1 / 30);
    sim.world.players[0].toolbar[0] = { item: 'nichoir', count: 1 };
    goHome(sim, 0);
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    expect(housing(sim).stock.nichoir).toBe(1);
    // Dans la salle: refusé; au jardin: posé.
    const drop = (x: number, y: number): string[] => {
      act(sim, 0, { type: 'deco_take', housing: HOUSE, prop: 'nichoir', x, y, rotation: 0 });
      return refused(sim, 0, { type: 'deco_drop', housing: HOUSE });
    };
    expect(drop(28.5, 10.5)).toEqual(['deco-wrong-zone']);
    act(sim, 0, { type: 'deco_cancel', housing: HOUSE });
    expect(drop(25.5, 15.5)).toEqual([]);
    expect(sim.world.places[PLACE]?.placed.find((p) => p.type === 'nichoir')).toMatchObject({
      x: 25.5,
      y: 15.5,
    });
  });

  it('refuse un objet meuble sans fiche, ou une fiche qui ne se pose pas', () => {
    const load = (edit: (files: Record<string, Json>) => void): string => {
      try {
        contentWith((files) => {
          withFakeFurniture(files);
          edit(files);
        });
        return '';
      } catch (error) {
        return String(error);
      }
    };
    expect(
      load((files) => {
        delete sheet(files, `commun/objets/${ITEM}.json`).prop;
      }),
    ).toMatch(/famille furniture déclare sa fiche de meuble/);
    expect(
      load((files) => {
        sheet(files, `commun/objets/${ITEM}.json`).prop = 'meuble-inconnu';
      }),
    ).toMatch(/fiche de meuble inconnue « meuble-inconnu »/);
    expect(
      load((files) => {
        sheet(files, `commun/meubles/${PROP}.json`).placeable = false;
      }),
    ).toMatch(/non posable/);
    expect(
      load((files) => {
        sheet(files, `commun/objets/${ITEM}.json`).family = 'material';
      }),
    ).toMatch(/demande la famille furniture/);
  });
});
