// Retours de la soirée de jeu du 2026-11-01 (docs/jeux/jeu-1/retours/2026-11-01/retours.md):
// un test par correction (R01, R02, R03, R04, R06, R13, R14), sur la vraie carte et le vrai contenu.
import { isHome } from '../src/etat/interieurs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, Intent } from '../src/etat/actions';
import type { Cell, CharacterId } from '../src/etat/types';
import { secondsPerGameMinuteOn } from '../src/donnees/calendrier';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import { IntentSchema } from '../src/reseau/schemas';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { bestTarget } from '../src/simulation/agir';
import { placementProblem } from '../src/simulation/amenagement';
import { type Sim, character } from '../src/simulation/contexte';
import { isStuck } from '../src/simulation/deblocage';
import { footprintCells, placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { bodyCollides, findPath, isBlockedCell } from '../src/simulation/grille';
import { placeVillagers } from '../src/simulation/habitants';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { gardenCellAt, sow, till } from '../src/simulation/potager';
import { addToBag, countInBag, countInStacks } from '../src/simulation/sac';
import { SEED, contentAndMap, createRobot, newSim, play, withPace } from './aides';
import type { Content } from '../src/donnees/types';
import { SIM_HZ } from '../src/simulation/constantes';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée. */
function started(content?: Content): Sim {
  const sim = content === undefined ? newSim() : newSim(SEED, content);
  const intents: AuthoredIntent[] = [
    { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
    { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
  ];
  step(sim, { controls: {}, intents });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent: scene.choices.length > 0 ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  return sim;
}

function act(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

function idle(sim: Sim, steps: number): void {
  for (let i = 0; i < steps; i++) step(sim, { controls: {}, intents: [] });
}

/** Pièce vide (paillasses, coffre et réchaud retirés), Sacha au comptoir et Camille à `at`. */
function emptyRoom(at: { x: number; y: number }): Sim {
  const sim = started();
  sim.world.furniture = [];
  sim.runtime.dynamicDirty = true;
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, 'p2'), counter);
  placeCharacter(sim, character(sim, 'p1'), at);
  return sim;
}

function put(sim: Sim, item: string, cell: Cell, rotation = 0): void {
  sim.world.furniture.push({ id: `f-${item}-${cell.cx}-${cell.cy}`, item, cell, rotation, placedBy: null });
  sim.runtime.dynamicDirty = true;
}

/** Le personnage peut-il marcher jusque devant la maison ? */
function reachesFront(sim: Sim, id: CharacterId): boolean {
  const front = sim.map.points.house_door;
  if (front === undefined) throw new Error('devant de la maison absent');
  const c = character(sim, id);
  return !bodyCollides(refreshBlockers(sim), c.pos.x, c.pos.y) && findPath(refreshBlockers(sim), c.pos, front) !== null;
}

describe('R01: personne ne reste coincé dans les meubles', () => {
  it("refuse un meuble qui touche le corps d'un personnage, même hors de la case de ses pieds", () => {
    const room = contentAndMap().map.house.room;
    // Camille au bord ouest de sa case: son corps (rayon 0,3 m) déborde sur la case voisine.
    const sim = emptyRoom({ x: room.x + 1.2, y: room.y + 1.5 });
    expect(placementProblem(sim, 'chair', { cx: room.x, cy: room.y + 1 }, 0)).toBe('occupied');
    expect(placementProblem(sim, 'chair', { cx: room.x + 3, cy: room.y + 1 }, 0)).toBeNull();
  });

  it("refuse un meuble qui enferme un personnage dans un recoin, ou qui coupe la pièce de sa porte", () => {
    const { room, door } = contentAndMap().map.house;
    // Camille dans le coin nord-ouest; une chaise à l'est d'elle passe, une seconde au sud l'enfermerait.
    const sim = emptyRoom({ x: room.x + 0.5, y: room.y + 0.5 });
    expect(placementProblem(sim, 'chair', { cx: room.x + 1, cy: room.y }, 0)).toBeNull();
    put(sim, 'chair', { cx: room.x + 1, cy: room.y });
    expect(placementProblem(sim, 'chair', { cx: room.x, cy: room.y + 1 }, 0)).toBe('blocks_way');
    // Juste derrière la porte: plus rien de la pièce ne mène dehors.
    expect(placementProblem(sim, 'chair', { cx: door.cx, cy: door.cy - 1 }, 0)).toBe('blocks_way');
    // Le tapis et les objets muraux ne barrent rien.
    expect(placementProblem(sim, 'rug', { cx: door.cx - 1, cy: door.cy - 2 }, 0)).toBeNull();
  });

  it("aucune pose acceptée n'isole une case, sur toutes les places et rotations de l'étagère et de la table", () => {
    const { room } = contentAndMap().map.house;
    const sim = emptyRoom({ x: room.x + 2.5, y: room.y + 2.5 });
    put(sim, 'chest', { cx: room.x, cy: room.y + room.h - 1 });
    put(sim, 'shelf', { cx: room.x + 1, cy: room.y });
    for (const item of ['shelf', 'table']) {
      for (let cy = room.y; cy < room.y + room.h; cy++) {
        for (let cx = room.x; cx < room.x + room.w; cx++) {
          for (const rotation of [0, 1, 2, 3]) {
            if (placementProblem(sim, item, { cx, cy }, rotation, null, 'p1') !== null) continue;
            const def = sim.content.items[item];
            if (def === undefined || def.footprint === null) throw new Error('meuble sans emprise');
            const id = `essai-${item}`;
            sim.world.furniture.push({ id, item, cell: { cx, cy }, rotation, placedBy: 'p1' });
            sim.runtime.dynamicDirty = true;
            expect(isStuck(sim, character(sim, 'p1'))).toBe(false);
            expect(reachesFront(sim, 'p1')).toBe(true);
            sim.world.furniture = sim.world.furniture.filter((f) => f.id !== id);
            sim.runtime.dynamicDirty = true;
          }
        }
      }
    }
  });

  it('« Débloquer mon personnage »: les deux, enfermés par des meubles, retrouvent le chemin de la porte', () => {
    const { room } = contentAndMap().map.house;
    const sim = emptyRoom({ x: room.x + 0.5, y: room.y + 0.5 });
    placeCharacter(sim, character(sim, 'p2'), { x: room.x + 1.4, y: room.y + 0.5 });
    // Comme une vieille sauvegarde: des meubles posés sans contrôle autour et sous eux.
    put(sim, 'shelf', { cx: room.x, cy: room.y + 1 });
    put(sim, 'chair', { cx: room.x + 2, cy: room.y });
    put(sim, 'chair', { cx: room.x + 1, cy: room.y });
    expect(isStuck(sim, character(sim, 'p1'))).toBe(true);
    expect(isStuck(sim, character(sim, 'p2'))).toBe(true);
    act(sim, 'p1', { type: 'unstick' });
    act(sim, 'p2', { type: 'unstick' });
    for (const id of ['p1', 'p2'] as const) {
      expect(isStuck(sim, character(sim, id))).toBe(false);
      expect(isHome(character(sim, id))).toBe(true);
      expect(reachesFront(sim, id)).toBe(true);
    }
    expect(character(sim, 'p1').notifications.some((n) => n.key === 'unstuck')).toBe(true);
  });

  it('pièce pleine: on se retrouve sur le seuil; dehors, pris dans un obstacle: sur la case libre la plus proche', () => {
    const { room, door } = contentAndMap().map.house;
    const sim = emptyRoom({ x: room.x + 0.5, y: room.y + 0.5 });
    for (let cy = room.y; cy < room.y + room.h; cy++) for (let cx = room.x; cx < room.x + room.w; cx++) put(sim, 'chair', { cx, cy });
    act(sim, 'p1', { type: 'unstick' });
    const c = character(sim, 'p1');
    expect({ cx: Math.floor(c.pos.x), cy: Math.floor(c.pos.y) }).toEqual(door);
    expect(reachesFront(sim, 'p1')).toBe(true);
    // Dehors, dans le tas de bois de la scierie.
    const pile = sim.map.props.find((p) => p.id === 'sawmill_log_pile')?.rect;
    if (pile === undefined || pile === null) throw new Error('tas de bois absent');
    placeCharacter(sim, c, { x: pile.x + 0.5, y: pile.y + 0.5 });
    expect(isBlockedCell(refreshBlockers(sim), pile.x, pile.y)).toBe(true);
    act(sim, 'p1', { type: 'unstick' });
    expect(reachesFront(sim, 'p1')).toBe(true);
    expect(Math.hypot(c.pos.x - (pile.x + 0.5), c.pos.y - (pile.y + 0.5))).toBeLessThan(1.6);
  });

  it("la commande passe le contrôle du réseau, et l'hôte la refuse pendant une conversation", () => {
    expect(v.safeParse(IntentSchema, { type: 'unstick' }).success).toBe(true);
    const sim = emptyRoom({ x: 7.5, y: 23.5 });
    const c = character(sim, 'p1');
    c.status = 'dialogue';
    const before = { ...c.pos };
    put(sim, 'chair', { cx: 7, cy: 23 });
    act(sim, 'p1', { type: 'unstick' });
    expect(c.pos).toEqual(before);
  });

  it('au chargement, un personnage pris dans un meuble (sauvegarde ancienne) est dégagé', () => {
    const { room } = contentAndMap().map.house;
    const sim = emptyRoom({ x: room.x + 1.5, y: room.y + 1.5 });
    put(sim, 'table', { cx: room.x + 1, cy: room.y + 1 });
    expect(isStuck(sim, character(sim, 'p1'))).toBe(true);
    const { content, map } = contentAndMap();
    const snap = snapshotOf(sim);
    const restored = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(isStuck(restored, character(restored, 'p1'))).toBe(false);
    expect(reachesFront(restored, 'p1')).toBe(true);
  });

  it('pris dans un obstacle, on peut toujours en sortir à pied (sans jamais traverser un second obstacle)', () => {
    const { room } = contentAndMap().map.house;
    // Enfoncé de 25 cm dans la chaise: un pas (12 cm) ne suffit pas à en sortir.
    const sim = emptyRoom({ x: room.x + 1.05, y: room.y + 1.5 });
    put(sim, 'chair', { cx: room.x, cy: room.y + 1 });
    const c = character(sim, 'p1');
    expect(bodyCollides(refreshBlockers(sim), c.pos.x, c.pos.y)).toBe(true);
    for (let i = 0; i < 30; i++) step(sim, { controls: { p1: { seq: i + 1, moveX: 1, moveY: 0, actHeld: false } }, intents: [] });
    expect(bodyCollides(refreshBlockers(sim), c.pos.x, c.pos.y)).toBe(false);
  });
});

describe('R02: les objets muraux ne prennent pas de place au sol', () => {
  it('rideaux et décorations murales: la case reste franchissable, on peut s’y tenir', () => {
    const { room } = contentAndMap().map.house;
    const sim = emptyRoom({ x: room.x + 2.5, y: room.y + 2.5 });
    const walls = Object.values(sim.content.items).filter((d) => d.wall && d.footprint !== null);
    expect(walls.map((d) => d.id)).toContain('curtains');
    for (const def of walls) {
      sim.world.furniture = [];
      const cell = { cx: room.x + 2, cy: room.y };
      put(sim, def.id, cell);
      const b = refreshBlockers(sim);
      for (const k of footprintCells(def.footprint ?? { w: 1, d: 1 }, cell, 0)) expect(isBlockedCell(b, k.cx, k.cy)).toBe(false);
      // Quelqu'un debout sous le rideau n'empêche pas de l'accrocher.
      sim.world.furniture = [];
      sim.runtime.dynamicDirty = true;
      placeCharacter(sim, character(sim, 'p1'), { x: cell.cx + 0.5, y: cell.cy + 0.5 });
      expect(placementProblem(sim, def.id, cell, 0)).toBeNull();
    }
  });
});

describe('R03: chaque recette consomme ses matériaux, côté hôte', () => {
  it('sans matériaux: rien; avec: les entrées exactes une fois, la sortie une fois, puis plus rien', () => {
    for (const recipe of Object.values(contentAndMap().content.recipes)) {
      const sim = started();
      const c = character(sim, 'p1');
      sim.world.cellar = [];
      c.bag = c.bag.map(() => null);
      if (!sim.world.unlockedRecipes.includes(recipe.id)) sim.world.unlockedRecipes.push(recipe.id);
      if (recipe.station === 'workbench') {
        const at = sim.map.points.sawmill_workbench;
        if (at === undefined) throw new Error('établi absent');
        placeCharacter(sim, c, at);
      } else {
        placeCharacter(sim, c, sim.map.house.spawn);
      }
      const out = recipe.output.item;
      act(sim, 'p1', { type: 'craft', recipe: recipe.id });
      idle(sim, Math.ceil(recipe.seconds * 3 * 30) + 30);
      expect(countInBag(c, out), `${recipe.id} sans matériaux`).toBe(0);
      for (const input of recipe.inputs) addToBag(sim, c, input.item, 'ordinary', input.count);
      for (let k = 0; k < 3; k++) {
        act(sim, 'p1', { type: 'craft', recipe: recipe.id });
        idle(sim, Math.ceil(recipe.seconds * 3 * 30) + 30);
      }
      expect(countInBag(c, out), recipe.id).toBe(recipe.output.count);
      for (const input of recipe.inputs) {
        expect(countInBag(c, input.item) + countInStacks(sim.world.cellar, input.item), `${recipe.id}: ${input.item}`).toBe(0);
      }
    }
  });
});

describe('R04: on mange ce qu’on tient en main', () => {
  it('chaque plat tenu en main se mange à Espace, sans rien devant soi', () => {
    const foods = Object.values(contentAndMap().content.items).filter((d) => d.category === 'food');
    expect(foods.map((d) => d.id)).toContain('bread');
    for (const def of foods) {
      expect(def.dish, def.id).not.toBeNull();
      const sim = started();
      const c = character(sim, 'p1');
      // Au milieu du pré, rien à portée.
      placeCharacter(sim, c, { x: 30.5, y: 12.5 });
      c.bag[2] = { item: def.id, quality: 'ordinary', count: 2 };
      c.selected = 2;
      c.endurance = 1;
      idle(sim, 1);
      act(sim, 'p1', { type: 'act' });
      expect(countInBag(c, def.id), def.id).toBe(1);
      expect(c.action.kind).toBe('eat');
      expect(c.endurance).toBeGreaterThan(1);
    }
  });
});

describe('R06: les habitants ne gênent ni la poutre ni l’établi', () => {
  it("à toute heure de Basile, Espace devant l'établi ouvre l'établi", () => {
    const sim = started();
    const at = sim.map.points.sawmill_workbench;
    if (at === undefined) throw new Error('établi absent');
    sim.world.clock.day = 3;
    const c = character(sim, 'p1');
    for (let minutes = 6 * 60; minutes < 24 * 60; minutes += 30) {
      sim.world.clock.minutes = minutes;
      placeVillagers(sim);
      placeCharacter(sim, c, at);
      c.facing = -Math.PI / 2;
      const best = bestTarget(sim, c);
      expect(best?.target.kind, `${minutes / 60} h`).toBe('point');
      expect(best?.verb).toBe('open');
      const basile = sim.world.villagers.find((v) => v.id === 'basile');
      if (basile?.visible === true) expect(Math.hypot(basile.pos.x - at.x, basile.pos.y - at.y)).toBeGreaterThan(1);
    }
  });

  it('au jour 1, Basile attend à côté de la poutre, pas dessus; Espace aux deux bouts vise la poutre', () => {
    const sim = started();
    const beam = sim.world.beam;
    if (beam === null) throw new Error('poutre absente');
    placeVillagers(sim);
    const basile = sim.world.villagers.find((v) => v.id === 'basile');
    expect(basile?.visible).toBe(true);
    // La poutre, couchée d'est en ouest, fait 4 m: Basile n'est ni dessus ni sur le passage nord-sud.
    expect(Math.abs((basile?.pos.y ?? 0) - beam.pos.y)).toBeGreaterThan(1);
    for (const side of [-1, 1]) {
      const c = character(sim, side < 0 ? 'p1' : 'p2');
      placeCharacter(sim, c, { x: beam.pos.x + side * 1.6, y: beam.pos.y });
      c.facing = side < 0 ? 0 : Math.PI;
      expect(bestTarget(sim, c)?.target.kind).toBe('beam');
    }
  });
});

describe('R13: la pluie arrose le potager', () => {
  it("un jour de pluie, une case bêchée dans la journée est mouillée comme à l'arrosoir, et sa culture pousse", () => {
    const sim = started();
    sim.world.weather = 'rain';
    const c = character(sim, 'p1');
    const g = sim.world.garden[0];
    if (g === undefined) throw new Error('potager vide');
    g.soil = 'grass';
    g.wet = false;
    g.crop = null;
    addToBag(sim, c, 'radish_seed', 'ordinary', 1);
    till(sim, c, g);
    sow(sim, c, g, 'radish_seed');
    expect(gardenCellAt(sim, g.cell)?.wet).toBe(true);
    morning(sim);
    expect(gardenCellAt(sim, g.cell)?.crop?.days).toBe(1);
    expect(gardenCellAt(sim, g.cell)?.crop?.wateredEveryDay).toBe(true);
  });
});

describe('R14: des journées plus longues, au rythme choisi', () => {
  it('la journée par défaut dure environ deux fois plus longtemps, et le rythme se règle', () => {
    const content = loadContent(CONTENT_FILES);
    const clock = content.settings.clock;
    expect(clock.pace).toBe('normal');
    expect(secondsPerGameMinuteOn(content.settings, 1)).toBeCloseTo(0.7, 6);
    const minutes = clock.dayEnd - clock.dayStart;
    expect((minutes * secondsPerGameMinuteOn(content.settings, 1)) / 60).toBeGreaterThan(12);
    const at = (pace: 'vif' | 'normal' | 'paisible'): number =>
      secondsPerGameMinuteOn({ clock: { ...clock, pace } }, 20);
    expect(at('vif')).toBeCloseTo(0.35, 6);
    expect(at('paisible')).toBeGreaterThan(at('normal'));
  });

  it("l'horloge suit le rythme: une heure de jeu prend 42 s au rythme normal", () => {
    const sim = started(loadContent(CONTENT_FILES));
    const before = sim.world.clock.minutes;
    idle(sim, 42 * 30);
    expect(sim.world.clock.minutes - before).toBeCloseTo(60, 0);
  });

  it('au rythme normal livré, le robot joue toute la démo: horaires, trains et moments tiennent dans la journée', () => {
    const content = withPace(loadContent(CONTENT_FILES), 'normal');
    const sim = newSim(SEED, content);
    const ticks = play(sim, createRobot(), (s) => s.world.phase === 'ended', SIM_HZ * 60 * 240);
    expect(sim.world.phase).toBe('ended');
    expect(ticks).toBeLessThan(SIM_HZ * 60 * 240);
    expect(sim.world.clock.day).toBe(15);
    expect(sim.world.orderHistory.map((o) => o.complete)).toEqual([true, true]);
    expect(sim.world.flags).toContain('handcar_pushed');
  });
});
