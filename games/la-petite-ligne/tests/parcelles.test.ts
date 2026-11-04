// Parcelles libres de la 0.13 (docs/jeux/jeu-1/parcelles-libres-0-13.md): un test par critère PL
// vérifiable dans la simulation (PL-01 à PL-21, PL-24 à PL-27). PL-17 (réseau) et PL-18 et PL-19
// (sauvegardes) sont dans `parcelles-reseau.test.ts` et `parcelles-sauvegarde.test.ts`.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, Intent } from '../src/etat/actions';
import { gardenCapacity } from '../src/etat/commande-generee';
import { categoryRoom } from '../src/etat/epicerie';
import {
  PLOT_REFUSAL_TEXT,
  type PlotRefusal,
  landCounts,
  plotPlacement,
  plotsFree,
  plotsOwned,
  plotsPlaced,
  readPlot,
  rectCells,
  sendPlot,
} from '../src/etat/parcelles';
import type { Cell, CharacterId, GardenCell, WorldEvent } from '../src/etat/types';
import { sentWorld } from '../src/reseau/etat-transmis';
import { GARDEN_CAPACITY } from '../src/rendu/potager';
import { ITEM } from '../src/simulation/ids';
import type { Sim } from '../src/simulation/contexte';
import { character, secondsToTicks } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { gardenCellAt, morningGrowth } from '../src/simulation/potager';
import { addToBag, countInBag, countInStacks, dropAt } from '../src/simulation/sac';
import { plotCounter } from '../src/interface/modele-parcelles';
import { toolbarModel } from '../src/interface/modele';
import { createUiContext } from '../src/interface/contexte';
import { loadUiTexts } from '../src/interface/textes';
import { contentAndMap, newSim } from './aides';

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée, la journée qui tourne. */
function started(seed = 20261030): Sim {
  const sim = newSim(seed);
  step(sim, {
    controls: {},
    intents: [
      { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
      { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
    ],
  });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent: scene.choices.length > 0 ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  expect(sim.world.phase).toBe('day');
  return sim;
}

/** Les intentions d'un pas, dans leur ordre d'arrivée; rend les événements du pas. */
function send(sim: Sim, intents: [CharacterId, Intent][]): WorldEvent[] {
  step(sim, { controls: {}, intents: intents.map(([by, intent]) => ({ by, intent })) });
  return [...sim.events];
}

function idle(sim: Sim, steps: number): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (let i = 0; i < steps; i++) {
    step(sim, { controls: {}, intents: [] });
    out.push(...sim.events);
  }
  return out;
}

/** Le cordeau en main (sa case de la barre), au milieu du pré, loin de tout chantier. */
function withLine(sim: Sim, by: CharacterId = 'p1', at = { x: 5.5, y: 31.5 }): void {
  const c = character(sim, by);
  const slot = c.bag.findIndex((s) => s?.item === ITEM.gardenLine);
  expect(slot).toBeGreaterThanOrEqual(0);
  c.selected = slot;
  placeCharacter(sim, c, at);
}

function selectItem(sim: Sim, by: CharacterId, item: string): void {
  const c = character(sim, by);
  if (!c.bag.some((s) => s?.item === item)) addToBag(sim, c, item, 'ordinary', 1);
  c.selected = c.bag.findIndex((s) => s?.item === item);
}

const at = (cx: number, cy: number): Cell => ({ cx, cy });

/** Une parcelle déjà posée, portant une culture (mûre ou non). */
function sown(sim: Sim, cell: Cell, ripe: boolean, fine = true): GardenCell {
  const g = gardenCellAt(sim, cell);
  if (g === null) throw new Error(`pas de parcelle en ${String(cell.cx)}, ${String(cell.cy)}`);
  g.soil = 'tilled';
  g.crop = { crop: 'radish', days: ripe ? 2 : 1, stage: ripe ? 'ripe' : 'sprout', ripe, wateredEveryDay: fine, sownDay: 1, sownBy: 'p2' };
  return g;
}

/** Au comptoir d'Odette, à 9 h, elle sert. */
function atCounter(sim: Sim, by: CharacterId = 'p1'): void {
  sim.world.clock.minutes = 9 * 60;
  idle(sim, 20);
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, by), counter);
}

describe('parcelles libres: départ et pose (PL-01 à PL-06)', () => {
  it('PL-01: partie neuve, 6 parcelles en herbe en x 7 à 9, y 28 et 29; 6/6; 2 en rayon', () => {
    const sim = newSim();
    const cells = sim.world.garden.map((g) => [g.cell.cx, g.cell.cy]);
    expect(cells).toEqual([
      [7, 28],
      [8, 28],
      [9, 28],
      [7, 29],
      [8, 29],
      [9, 29],
    ]);
    expect(sim.world.garden.every((g) => g.soil === 'grass' && g.crop === null && g.kind === undefined)).toBe(true);
    expect(sim.world.garden.map((g) => g.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(plotsOwned(sim.content, sim.world)).toBe(6);
    expect(plotsPlaced(sim.world)).toBe(6);
    expect(sim.world.plots.stock).toBe(2);
    expect(sim.world.plots.nextIndex).toBe(6);
  });

  it('PL-02: chaque joueur a un cordeau dans sa barre, après la canne', () => {
    const sim = newSim();
    for (const c of sim.world.characters) {
      const slot = c.bag.findIndex((s) => s?.item === ITEM.gardenLine);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(8);
      expect(slot).toBeGreaterThan(c.bag.findIndex((s) => s?.item === ITEM.fishingRod));
    }
  });

  it('PL-03: cordeau en main, poser sur une case du pré crée une parcelle en herbe, sans endurance', () => {
    const sim = started();
    sim.world.plots.bought = 1;
    withLine(sim);
    const c = character(sim, 'p1');
    const endurance = c.endurance;
    const events = send(sim, [['p1', { type: 'plot_place', cells: [at(4, 31)] }]]);
    const g = gardenCellAt(sim, at(4, 31));
    expect(g).toMatchObject({ index: 6, soil: 'grass', wet: false, crop: null });
    expect(plotsPlaced(sim.world)).toBe(7);
    expect(plotsFree(sim.content, sim.world)).toBe(0);
    expect(c.endurance).toBe(endurance);
    expect(events).toContainEqual({ type: 'plot_placed', by: 'p1', cells: [at(4, 31)] });
  });

  it('PL-03 (clavier): Espace pose sur la case devant soi', () => {
    const sim = started();
    sim.world.plots.bought = 1;
    withLine(sim, 'p1', { x: 4.5, y: 32.5 });
    character(sim, 'p1').facing = -Math.PI / 2;
    send(sim, [['p1', { type: 'act' }]]);
    expect(gardenCellAt(sim, at(4, 31))).not.toBeNull();
  });

  const refusals: [string, PlotRefusal, (sim: Sim) => Cell][] = [
    ['hors de la terre (la route du gué)', 'outside', () => at(18, 31)],
    ['un chemin (devant la maisonnette)', 'outside', () => at(5, 27)],
    ['la réserve de la maison', 'outside', () => at(4, 20)],
    ['le poulailler (et son agrandissement, chantier déclaré)', 'occupied', () => at(14, 29)],
    ['la botte de paille', 'occupied', () => at(12, 28)],
    ['le rocher', 'occupied', () => at(3, 33)],
    ['le coin des poules', 'hens', () => at(13, 32)],
    [
      'le cercle de la chèvre au piquet',
      'goat',
      (sim) => {
        const spot = sim.map.points.goat_graze_04;
        if (spot === undefined) throw new Error('place absente');
        sim.world.breeding.goats.push({
          id: 'g99',
          name: 'Noisette',
          pos: { ...spot },
          prev: { ...spot },
          facing: 0,
          wander: { ...spot },
          happiness: 60,
          stake: 'goat_graze_04',
          led: null,
          home: false,
          milkedDay: null,
          wateredDay: null,
          milking: null,
        });
        return at(8, 33);
      },
    ],
    ['la friche pas encore défrichée', 'friche', () => at(-6, 30)],
    ['une parcelle déjà là', 'exists', () => at(7, 28)],
    [
      'un objet au sol',
      'ground_item',
      (sim) => {
        dropAt(sim, 5.5, 30.5, 'log', 'ordinary', 1);
        return at(5, 30);
      },
    ],
    ['plus de parcelle libre (6/6)', 'none', () => at(5, 31)],
  ];

  it.each(refusals)('PL-04: refus sur %s, avec sa raison', (_name, reason, setup) => {
    const sim = started();
    if (reason !== 'none') sim.world.plots.bought = 1;
    withLine(sim);
    const cell = setup(sim);
    expect(plotPlacement(sim.content, sim.map, sim.world, cell)).toBe(reason);
    const before = sim.world.garden.length;
    const events = send(sim, [['p1', { type: 'plot_place', cells: [cell] }]]);
    expect(sim.world.garden.length).toBe(before);
    expect(events).toContainEqual({ type: 'plot_refused', by: 'p1', cell, reason });
    expect(character(sim, 'p1').notifications.at(-1)?.key).toBe(PLOT_REFUSAL_TEXT[reason]);
  });

  it('PL-05: la terre posable compte 100 cases dans le pré et 48 de friche', () => {
    const { content, map } = contentAndMap();
    expect(landCounts(content, map)).toEqual({ meadow: 100, friche: 48 });
  });

  it('PL-06: un rectangle de N cases valides avec K libres pose min(N, K), rangée par rangée depuis le coin du clic', () => {
    const sim = started();
    sim.world.plots.bought = 5;
    withLine(sim);
    // Du coin sud-est (6, 31) vers le nord-ouest (2, 30): la rangée y 31 d'est en ouest, puis y 30.
    // La case (3, 31)... est libre; le rocher est en (3, 33), hors du rectangle. 10 cases, 5 libres.
    const cells = rectCells(at(6, 31), at(2, 30));
    expect(cells.slice(0, 6)).toEqual([at(6, 31), at(5, 31), at(4, 31), at(3, 31), at(2, 31), at(6, 30)]);
    send(sim, [['p1', { type: 'plot_place', cells }]]);
    const placed = sim.world.garden.slice(6).map((g) => g.cell);
    expect(placed).toEqual([at(6, 31), at(5, 31), at(4, 31), at(3, 31), at(2, 31)]);
    expect(plotsFree(sim.content, sim.world)).toBe(0);
  });

  it('PL-06: les cases interdites du rectangle sont sautées', () => {
    const sim = started();
    sim.world.plots.bought = 10;
    withLine(sim);
    // Rangée y 33 de x 1 à 5: le rocher en (3, 33) est sauté.
    send(sim, [['p1', { type: 'plot_place', cells: rectCells(at(1, 33), at(5, 33)) }]]);
    expect(sim.world.garden.slice(6).map((g) => g.cell)).toEqual([at(1, 33), at(2, 33), at(4, 33), at(5, 33)]);
  });
});

describe('parcelles libres: reprise (PL-07 à PL-10)', () => {
  it('PL-07: reprendre une parcelle vide: elle part, posées -1, possédées inchangé', () => {
    const sim = started();
    withLine(sim);
    const events = send(sim, [['p1', { type: 'plot_hold', cell: at(7, 28) }]]);
    expect(gardenCellAt(sim, at(7, 28))).toBeNull();
    expect(plotsPlaced(sim.world)).toBe(5);
    expect(plotsOwned(sim.content, sim.world)).toBe(6);
    expect(events).toContainEqual({ type: 'plot_removed', by: 'p1', cell: at(7, 28), returned: null });
    // Et elle se repose ailleurs, sans frais.
    send(sim, [['p1', { type: 'plot_place', cells: [at(2, 31)] }]]);
    expect(gardenCellAt(sim, at(2, 31))?.index).toBe(6);
  });

  it('PL-08: avec une culture, il faut maintenir 0,6 s; relâché avant, rien ne change', () => {
    const sim = started();
    withLine(sim);
    sown(sim, at(8, 28), false);
    const ticks = secondsToTicks(sim.content.settings.garden.plots?.removeHoldSeconds ?? 0);
    expect(ticks).toBe(secondsToTicks(0.6));
    send(sim, [['p1', { type: 'plot_hold', cell: at(8, 28) }]]);
    idle(sim, ticks - 2);
    send(sim, [['p1', { type: 'plot_hold', cell: null }]]);
    idle(sim, ticks * 2);
    expect(gardenCellAt(sim, at(8, 28))?.crop?.crop).toBe('radish');
    // Maintenu jusqu'au bout: reprise.
    send(sim, [['p1', { type: 'plot_hold', cell: at(8, 28) }]]);
    let removedAt = -1;
    for (let i = 0; i < ticks + 2 && removedAt < 0; i++) {
      if (idle(sim, 1).some((e) => e.type === 'plot_removed')) removedAt = i + 1;
    }
    expect(removedAt).toBeGreaterThanOrEqual(ticks - 1);
    expect(removedAt).toBeLessThanOrEqual(ticks);
    expect(gardenCellAt(sim, at(8, 28))).toBeNull();
  });

  /** Objets d'un genre partout où ils peuvent être (sacs, coffre, sol). */
  function everywhere(sim: Sim, item: string): number {
    const bags = sim.world.characters.reduce((n, c) => n + countInBag(c, item), 0);
    const ground = sim.world.groundItems.filter((g) => g.item === item).reduce((n, g) => n + g.count, 0);
    return bags + countInStacks(sim.world.cellar, item) + ground;
  }

  it('PL-09: culture non mûre: la graine revient; mûre: la récolte avec sa qualité; rien ne se perd', () => {
    const sim = started();
    withLine(sim);
    const hold = secondsToTicks(0.6) + 2;
    sown(sim, at(7, 28), false);
    sown(sim, at(8, 28), true, true);
    const seeds = everywhere(sim, 'radish_seed');
    const radishes = everywhere(sim, 'radish');
    send(sim, [['p1', { type: 'plot_hold', cell: at(7, 28) }]]);
    const first = idle(sim, hold);
    expect(everywhere(sim, 'radish_seed')).toBe(seeds + 1);
    expect(first).toContainEqual({ type: 'plot_removed', by: 'p1', cell: at(7, 28), returned: { item: 'radish_seed', quality: 'ordinary', count: 1 } });
    // L'autre l'avait semée: une information, pas un reproche.
    expect(character(sim, 'p2').notifications.some((n) => n.key === 'plot_taken_by_partner')).toBe(true);
    send(sim, [['p1', { type: 'plot_hold', cell: at(8, 28) }]]);
    idle(sim, hold);
    expect(everywhere(sim, 'radish')).toBe(radishes + 3);
    expect(countInBag(character(sim, 'p1'), 'radish', 'fine')).toBe(3);
  });

  it('PL-09: sac plein, la graine va au coffre de la maisonnette, jamais au sol', () => {
    const sim = started();
    withLine(sim);
    const c = character(sim, 'p1');
    for (let i = 0; i < c.bag.length; i++) if (c.bag[i] === null) c.bag[i] = { item: 'log', quality: 'ordinary', count: 99 };
    sown(sim, at(7, 28), false);
    const ground = sim.world.groundItems.length;
    send(sim, [['p1', { type: 'plot_hold', cell: at(7, 28) }]]);
    idle(sim, secondsToTicks(0.6) + 2);
    expect(countInStacks(sim.world.cellar, 'radish_seed')).toBe(1);
    expect(sim.world.groundItems.length).toBe(ground);
  });

  it('PL-10: clic droit glissé: les parcelles vides du rectangle partent, celles qui portent une culture restent', () => {
    const sim = started();
    withLine(sim);
    sown(sim, at(8, 28), false);
    sown(sim, at(9, 29), true);
    const events = send(sim, [['p1', { type: 'plot_remove', cells: rectCells(at(7, 28), at(9, 29)) }]]);
    expect(sim.world.garden.map((g) => g.cell)).toEqual([at(8, 28), at(9, 29)]);
    expect(events).toContainEqual({ type: 'plot_kept', by: 'p1', cells: [at(8, 28), at(9, 29)] });
  });
});

describe('parcelles libres: Odette et la friche (PL-11 à PL-15)', () => {
  it('PL-11: Acheter 1: bourse -30, possédées +1, rayon -1; Acheter 4 avec 3 en rayon: 3', () => {
    const sim = started();
    atCounter(sim);
    const purse = sim.world.purse;
    let events = send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 1 }]]);
    expect(sim.world.purse).toBe(purse - 30);
    expect(plotsOwned(sim.content, sim.world)).toBe(7);
    expect(sim.world.plots.stock).toBe(1);
    expect(events).toContainEqual({ type: 'plot_gained', by: 'p1', source: 'shop', count: 1 });
    expect(events).toContainEqual({ type: 'bought', by: 'p1', item: ITEM.plot, count: 1, price: 30 });
    expect(countInBag(character(sim, 'p1'), ITEM.plot)).toBe(0);
    sim.world.plots.stock = 3;
    events = send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 4 }]]);
    expect(events).toContainEqual({ type: 'plot_gained', by: 'p1', source: 'shop', count: 3 });
    expect(plotsOwned(sim.content, sim.world)).toBe(10);
    expect(sim.world.plots.stock).toBe(0);
    expect(sim.world.purse).toBe(purse - 120);
    expect(sim.world.proposals).toEqual([]);
  });

  it("PL-11: Acheter 4 (120 aubrins) attend l'accord de l'autre", () => {
    const sim = started();
    atCounter(sim);
    sim.world.plots.stock = 6;
    const purse = sim.world.purse;
    send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 4 }]]);
    expect(sim.world.proposals).toHaveLength(1);
    expect(plotsOwned(sim.content, sim.world)).toBe(6);
    expect(sim.world.purse).toBe(purse - 120);
    send(sim, [['p2', { type: 'proposal_answer', proposal: sim.world.proposals[0]?.id ?? '', accept: true }]]);
    expect(plotsOwned(sim.content, sim.world)).toBe(10);
    expect(sim.world.plots.stock).toBe(2);
    expect(sim.world.purse).toBe(purse - 120);
  });

  it("PL-11: un gros achat accepté après coup ne prend que ce qui reste en rayon, et rend le reste", () => {
    const sim = started();
    atCounter(sim);
    sim.world.plots.stock = 4;
    const purse = sim.world.purse;
    send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 4 }]]);
    sim.world.plots.stock = 1;
    send(sim, [['p2', { type: 'proposal_answer', proposal: sim.world.proposals[0]?.id ?? '', accept: true }]]);
    expect(plotsOwned(sim.content, sim.world)).toBe(7);
    expect(sim.world.purse).toBe(purse - 30);
  });

  it('PL-12: le rayon gagne 2 à chaque aube, au plus 10', () => {
    const sim = started();
    const seen: number[] = [];
    for (let day = 0; day < 6; day++) {
      morning(sim);
      seen.push(sim.world.plots.stock);
    }
    expect(seen).toEqual([4, 6, 8, 10, 10, 10]);
  });

  it('PL-13: au plafond (40 possédées), achat refusé, la friche défrichée n’offre plus rien', () => {
    const sim = started();
    sim.world.plots.bought = 34;
    expect(plotsOwned(sim.content, sim.world)).toBe(40);
    atCounter(sim);
    const purse = sim.world.purse;
    send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 1 }]]);
    expect(sim.world.purse).toBe(purse);
    expect(plotsOwned(sim.content, sim.world)).toBe(40);
    expect(character(sim, 'p1').notifications.at(-1)?.key).toBe('plot_cap_reached');
    const { content, map } = contentAndMap();
    const ctx = createUiContext(content, map, loadUiTexts(content), 'p1', (code) => code);
    expect(plotCounter(sim.world, ctx)).toMatchObject({ owned: 40, atCap: true });
    // Défricher au plafond: la place s'ouvre, aucune parcelle offerte.
    selectItem(sim, 'p1', ITEM.hoe);
    const events: WorldEvent[] = [];
    for (const [cx, cy] of [[-8, 29], [-7, 29], [-6, 29], [-5, 29]] as const) {
      placeCharacter(sim, character(sim, 'p1'), { x: cx + 0.5, y: cy + 1.5 });
      character(sim, 'p1').facing = -Math.PI / 2;
      events.push(...send(sim, [['p1', { type: 'act' }]]), ...idle(sim, 40));
    }
    expect(sim.world.plots.clearedCells).toHaveLength(4);
    expect(events.flatMap((e) => (e.type === 'friche_cleared' ? [e.gift] : []))).toEqual([false, false, false, false]);
    expect(events.some((e) => e.type === 'plot_gained')).toBe(false);
    expect(plotsOwned(sim.content, sim.world)).toBe(40);
  });

  it('PL-14: défricher à la houe: 3 d’endurance, 1,2 s; la case devient posable; la 4e offre une parcelle; 48 cases en offrent 12', () => {
    const sim = started();
    selectItem(sim, 'p1', ITEM.hoe);
    const c = character(sim, 'p1');
    const s = sim.content.settings;
    placeCharacter(sim, c, { x: -7.5, y: 30.5 });
    c.facing = -Math.PI / 2;
    c.needs.belly = 0;
    const endurance = c.endurance;
    const events = send(sim, [['p1', { type: 'act' }]]);
    expect(events).toContainEqual({ type: 'friche_cleared', by: 'p1', cell: at(-8, 29), gift: false });
    expect(c.action).toMatchObject({ kind: 'till', duration: secondsToTicks(1.2) });
    expect(endurance - c.endurance).toBeCloseTo(3 * s.endurance.costMultiplier, 6);
    expect(plotPlacement(sim.content, sim.map, sim.world, at(-8, 29), true)).toBeNull();
    idle(sim, 40);
    // Les 47 autres cases, une à une, d'un clic à portée (un habitant près du moulin ne prend pas la main);
    // les parcelles offertes arrivent toutes les 4.
    const gifts: WorldEvent[] = [];
    for (const area of sim.map.plotAreas ?? []) {
      if (area.nature !== 'defricher') continue;
      for (const cell of area.cells) {
        if (cell.cx === -8 && cell.cy === 29) continue;
        placeCharacter(sim, c, { x: cell.cx + 0.5, y: cell.cy + 1.4 });
        c.endurance = c.enduranceMax;
        const click: Intent = { type: 'move_to', target: { kind: 'ground', x: cell.cx + 0.5, y: cell.cy + 0.5 }, act: true };
        gifts.push(...send(sim, [['p1', click]]).filter((e) => e.type === 'plot_gained'), ...idle(sim, 40).filter((e) => e.type === 'plot_gained'));
      }
    }

    const missing = (sim.map.plotAreas ?? []).flatMap((a) => (a.nature === 'defricher' ? a.cells : [])).filter((cell) => !sim.world.plots.clearedCells.some(([x, y]) => x === cell.cx && y === cell.cy));
    expect(missing).toEqual([]);
    expect(sim.world.plots.clearedCells).toHaveLength(48);

    expect(gifts).toHaveLength(12);
    expect(plotsOwned(sim.content, sim.world)).toBe(18);
  });

  it('PL-15: une place de pâture dont le cercle touche une parcelle refuse le piquet; les autres restent possibles', () => {
    const sim = started();
    const goats = sim.content.settings.goats;
    if (goats === null) throw new Error('pas de chèvre');
    const spot = sim.map.points.goat_graze_04;
    const free = sim.map.points.goat_graze_06;
    if (spot === undefined || free === undefined) throw new Error('places absentes');
    sim.world.plots.bought = 1;
    withLine(sim);
    send(sim, [['p1', { type: 'plot_place', cells: [at(8, 32)] }]]);
    const c = character(sim, 'p1');
    const goat = {
      id: 'g99',
      name: 'Noisette',
      pos: { ...spot },
      prev: { ...spot },
      facing: 0,
      wander: { ...spot },
      happiness: 60,
      stake: 'goat_graze_01',
      led: c.id,
      home: false,
      milkedDay: null,
      wateredDay: null,
      milking: null,
    };
    sim.world.breeding.goats.push(goat);
    selectItem(sim, 'p1', ITEM.hoe);
    placeCharacter(sim, c, spot);
    send(sim, [['p1', { type: 'act' }]]);
    expect(goat.led).toBe('p1');
    expect(c.notifications.at(-1)?.key).toBe('goat_stake_plots');
    placeCharacter(sim, c, free);
    idle(sim, 1);
    send(sim, [['p1', { type: 'act' }]]);
    expect(goat.led).toBeNull();
    expect(goat.stake).toBe('goat_graze_06');
  });
});

describe('parcelles libres: à deux, commande, pluie (PL-16, PL-20, PL-21)', () => {
  it('PL-16: deux poses sur la même case au même pas: une parcelle, le refus pour le second', () => {
    const sim = started();
    sim.world.plots.bought = 2;
    withLine(sim, 'p1');
    withLine(sim, 'p2', { x: 6.5, y: 31.5 });
    const events = send(sim, [
      ['p1', { type: 'plot_place', cells: [at(4, 31)] }],
      ['p2', { type: 'plot_place', cells: [at(4, 31)] }],
    ]);
    expect(sim.world.garden.filter((g) => g.cell.cx === 4 && g.cell.cy === 31)).toHaveLength(1);
    expect(events).toContainEqual({ type: 'plot_refused', by: 'p2', cell: at(4, 31), reason: 'exists' });
  });

  it('PL-16: la dernière parcelle libre demandée par les deux: une seule posée', () => {
    const sim = started();
    sim.world.plots.bought = 1;
    withLine(sim, 'p1');
    withLine(sim, 'p2', { x: 6.5, y: 31.5 });
    const events = send(sim, [
      ['p2', { type: 'plot_place', cells: [at(6, 32)] }],
      ['p1', { type: 'plot_place', cells: [at(4, 31)] }],
    ]);
    expect(gardenCellAt(sim, at(6, 32))).not.toBeNull();
    expect(gardenCellAt(sim, at(4, 31))).toBeNull();
    expect(events).toContainEqual({ type: 'plot_refused', by: 'p1', cell: at(4, 31), reason: 'none' });
  });

  it('PL-20: ressource potager de la commande: 4,5 x min(possédées + louées, 24); 54 avec 12 parcelles', () => {
    const { content } = contentAndMap();
    expect(gardenCapacity(content.settings, 12)).toBe(54);
    expect(gardenCapacity(content.settings, 6)).toBe(27);
    expect(gardenCapacity(content.settings, 40)).toBe(108);
  });

  it('PL-21: la pluie mouille toutes les parcelles bêchées, où qu’elles soient', () => {
    const sim = started();
    sim.world.plots.bought = 1;
    sim.world.plots.clearedCells.push([-8, 29]);
    withLine(sim);
    send(sim, [['p1', { type: 'plot_place', cells: [at(-8, 29)] }]]);
    for (const g of sim.world.garden) {
      g.soil = 'tilled';
      g.wet = false;
    }
    sim.world.weather = 'rain';
    morningGrowth(sim);
    expect(sim.world.garden.every((g) => g.wet)).toBe(true);
  });
});

describe("parcelles libres: interface, événements, état transmis (PL-22, PL-24 à PL-27)", () => {
  it('PL-22: les instances du potager tiennent 40 parcelles à soi et 40 louées', () => {
    expect(GARDEN_CAPACITY).toBeGreaterThanOrEqual(96);
  });

  it('PL-24: compteur « posées/possédées » et pastille des parcelles libres sur la case du cordeau', () => {
    const sim = started();
    sim.world.plots.bought = 2;
    const { content, map } = contentAndMap();
    const ctx = createUiContext(content, map, loadUiTexts(content), 'p1', (code) => code);
    expect(plotCounter(sim.world, ctx)).toMatchObject({ placed: 6, owned: 8, free: 2, atCap: false, text: '6/8' });
    const me = character(sim, 'p1');
    const model = toolbarModel(ctx, me, 2);
    const slot = model.slots.find((s) => s.item === ITEM.gardenLine);
    expect(slot?.badge).toBe(2);
    expect(model.slots.filter((s) => s.badge !== null)).toHaveLength(1);
    expect(toolbarModel(ctx, me, 0).slots.every((s) => s.badge === null)).toBe(true);
  });

  it('PL-25: chaque action émet son événement: pose, refus, reprise, défrichage, parcelle offerte, achat', () => {
    const sim = started();
    const types = new Set<string>();
    const note = (events: WorldEvent[]): void => {
      for (const e of events) types.add(e.type);
    };
    sim.world.plots.bought = 1;
    withLine(sim);
    note(send(sim, [['p1', { type: 'plot_place', cells: [at(4, 31)] }]]));
    note(send(sim, [['p1', { type: 'plot_place', cells: [at(18, 31)] }]]));
    note(send(sim, [['p1', { type: 'plot_hold', cell: at(4, 31) }]]));
    selectItem(sim, 'p1', ITEM.hoe);
    const c = character(sim, 'p1');
    for (const [cx, cy] of [[-8, 29], [-7, 29], [-6, 29], [-5, 29]] as const) {
      placeCharacter(sim, c, { x: cx + 0.5, y: cy + 1.5 });
      c.facing = -Math.PI / 2;
      note(send(sim, [['p1', { type: 'act' }]]));
      note(idle(sim, 40));
    }
    atCounter(sim);
    note(send(sim, [['p1', { type: 'buy', item: ITEM.plot, count: 1 }]]));
    for (const type of ['plot_placed', 'plot_refused', 'plot_removed', 'friche_cleared', 'plot_gained', 'bought']) expect(types, type).toContain(type);
  });

  it('PL-26: Odette paie au plus 250 aubrins de légumes bruts par jour; les plats restent payés jusqu’aux 400', () => {
    const sim = started();
    sim.world.flags.push(sim.content.settings.economy.grocer.buysAfterFlag);
    atCounter(sim);
    const c = character(sim, 'p1');
    c.bag.fill(null);
    addToBag(sim, c, 'carrot', 'fine', 99);
    addToBag(sim, c, 'radish', 'fine', 99);
    addToBag(sim, c, 'omelette', 'ordinary', 30);
    send(sim, [['p1', { type: 'sell', item: 'carrot', quality: 'fine', count: 99 }]]);
    send(sim, [['p1', { type: 'sell', item: 'radish', quality: 'fine', count: 99 }]]);
    const crops = sim.world.grocerSoldToday;
    expect(crops).toBeLessThanOrEqual(250);
    expect(crops).toBeGreaterThan(200);
    expect(categoryRoom(sim.content, sim.world, 'carrot')).toBeLessThan(15);
    expect(countInBag(c, 'carrot') + countInBag(c, 'radish')).toBeGreaterThan(0);
    send(sim, [['p1', { type: 'sell', item: 'omelette', quality: 'ordinary', count: 30 }]]);
    expect(sim.world.grocerSoldToday).toBeGreaterThan(crops);
    expect(sim.world.grocerSoldToday).toBeLessThanOrEqual(400);
    // L'aube remet le garde-fou à zéro.
    morning(sim);
    expect(categoryRoom(sim.content, sim.world, 'carrot')).toBe(250);
  });

  it('PL-27: état transmis, 40 parcelles avec culture tiennent sous 2 Kio en forme compacte (et se relisent)', () => {
    const sim = started();
    const cells = rectCells(at(1, 28), at(8, 32)).filter((cell) => plotPlacement(sim.content, sim.map, sim.world, cell, true) === null || gardenCellAt(sim, cell) !== null);
    sim.world.plots.bought = 34;
    withLine(sim);
    send(sim, [['p1', { type: 'plot_place', cells }]]);
    expect(sim.world.garden).toHaveLength(40);
    sim.world.garden.forEach((g, i) => {
      g.soil = 'tilled';
      g.wet = i % 2 === 0;
      g.crop = { crop: ['radish', 'lettuce', 'carrot'][i % 3] ?? 'radish', days: i % 4, stage: 'young', ripe: i % 5 === 0, wateredEveryDay: i % 3 !== 0, sownDay: 12, sownBy: i % 2 === 0 ? 'p1' : 'p2' };
      g.lastHarvest = { by: 'p1', tick: 1000 + i };
    });
    const garden = JSON.stringify(sentWorld(sim.world).garden);
    const full = JSON.stringify(sim.world.garden);
    expect(Buffer.byteLength(garden, 'utf8')).toBeLessThan(2048);
    expect(Buffer.byteLength(full, 'utf8')).toBeGreaterThan(8000);
    // La forme compacte se relit à l'identique, sauf la dernière récolte (gardée chez l'hôte).
    const back = sim.world.garden.map((g) => readPlot(sendPlot(g)));
    expect(back).toEqual(sim.world.garden.map((g) => ({ ...g, lastHarvest: null })));
  });
});
