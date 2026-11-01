// La souris choisit la cible (R11, retours du 2026-11-01): ce qu'elle survole est mis en évidence
// (`aim.source === 'pointer'`) s'il y a un geste à y faire; Espace et le clic le prennent; Z Q S D
// rendent la visée au clavier. En aménagement, l'aperçu du meuble suit la case sous la souris et se
// pose avec les mêmes règles que celui du clavier.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ClickTarget, Intent } from '../src/etat/actions';
import type { CharacterId, Vec2, WorldEvent } from '../src/etat/types';
import { IntentSchema } from '../src/reseau/schemas';
import { placementProblem, previewCell } from '../src/simulation/amenagement';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, rotatedSize } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { gardenCellAt } from '../src/simulation/potager';
import { addToBag } from '../src/simulation/sac';
import { createRobot, newSim, play } from './aides';

function send(sim: Sim, by: CharacterId, ...intents: Intent[]): WorldEvent[] {
  const list: AuthoredIntent[] = intents.map((intent) => ({ by, intent }));
  step(sim, { controls: {}, intents: list });
  return [...sim.events];
}

/** Pas sans entrée jusqu'à `until` (au plus `seconds`), avec les événements vus. */
function runUntil(
  sim: Sim,
  until: (events: WorldEvent[]) => boolean,
  seconds: number,
): WorldEvent[] {
  const seen: WorldEvent[] = [];
  for (let i = 0; i < seconds * SIM_HZ && !until(seen); i++) {
    step(sim, { controls: {}, intents: [] });
    seen.push(...sim.events);
  }
  return seen;
}

/** Jour 1, scène d'arrivée finie; Sacha au comptoir; Camille à `at`, tournée vers `facing`, l'objet `item` en main (`null`: main libre). */
function camilleAt(at: Vec2, facing: number, item: string | null): Sim {
  const sim = newSim(5);
  play(
    sim,
    createRobot(),
    (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null,
    SIM_HZ * 600,
  );
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, 'p2'), counter);
  const c = character(sim, 'p1');
  placeCharacter(sim, c, at);
  c.facing = facing;
  if (item !== null && !c.bag.some((s) => s?.item === item)) addToBag(sim, c, item, 'ordinary', 1);
  const slot =
    item === null
      ? c.bag.findIndex((s, i) => s === null && i < 10)
      : c.bag.findIndex((s) => s?.item === item);
  if (slot < 0) throw new Error(`case pour ${item ?? 'la main libre'} absente`);
  c.selected = slot;
  for (const g of sim.world.garden) {
    g.soil = 'grass';
    g.crop = null;
  }
  step(sim, { controls: {}, intents: [] });
  return sim;
}

const ground = (x: number, y: number): ClickTarget => ({ kind: 'ground', x, y });

describe('survol à la souris', () => {
  it('une case du potager survolée, bêche en main: mise en évidence; Espace y va et la bêche, pas la case devant soi', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, 'hoe');
    const c = character(sim, 'p1');
    expect(c.aim).toMatchObject({ cell: { cx: 8, cy: 28 }, verb: 'till' });
    expect(c.aim?.source).toBeUndefined();
    // La case du potager la plus éloignée: il faut marcher.
    const far = [...sim.world.garden].sort(
      (a, b) =>
        Math.hypot(b.cell.cx + 0.5 - c.pos.x, b.cell.cy + 0.5 - c.pos.y) -
        Math.hypot(a.cell.cx + 0.5 - c.pos.x, a.cell.cy + 0.5 - c.pos.y),
    )[0];
    if (far === undefined) throw new Error('potager vide');
    expect(Math.hypot(far.cell.cx + 0.5 - c.pos.x, far.cell.cy + 0.5 - c.pos.y)).toBeGreaterThan(2);
    send(sim, 'p1', { type: 'point_at', target: ground(far.cell.cx + 0.4, far.cell.cy + 0.6) });
    expect(c.aim).toEqual({ cell: far.cell, verb: 'till', blocked: null, source: 'pointer' });
    const events = send(sim, 'p1', { type: 'act' });
    expect(c.destination, 'Espace sur la cible survolée: le personnage s’y rend').not.toBeNull();
    events.push(...runUntil(sim, (seen) => seen.some((e) => e.type === 'tilled'), 15));
    expect(events.filter((e) => e.type === 'tilled')).toEqual([
      { type: 'tilled', by: 'p1', cell: far.cell },
    ]);
    expect(gardenCellAt(sim, { cx: 8, cy: 28 })?.soil).toBe('grass');
  });

  it('l’herbe hors du potager survolée, houe en main: rien de mis en évidence, Espace bêche devant soi', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, 'hoe');
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'point_at', target: ground(3.5, 31.5) });
    expect(c.aim).toMatchObject({ cell: { cx: 8, cy: 28 }, verb: 'till' });
    expect(c.aim?.source).toBeUndefined();
    const events = send(sim, 'p1', { type: 'act' });
    expect(events.filter((e) => e.type === 'tilled')).toEqual([
      { type: 'tilled', by: 'p1', cell: { cx: 8, cy: 28 } },
    ]);
  });

  it('un arbre survolé sans hache: rien à y faire, la visée reste devant soi', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, 'hoe');
    const c = character(sim, 'p1');
    const tree = sim.world.trees.find((t) => !t.felled);
    if (tree === undefined) throw new Error('arbre absent');
    send(sim, 'p1', { type: 'point_at', target: { kind: 'tree', tree: tree.id } });
    expect(c.aim).toMatchObject({ cell: { cx: 8, cy: 28 }, verb: 'till' });
    expect(c.aim?.source).toBeUndefined();
  });

  it('un arbre survolé, hache en main: « couper »; la souris retirée (`null`), la visée revient au clavier', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, 'axe');
    const c = character(sim, 'p1');
    const tree = sim.world.trees.find((t) => !t.felled);
    if (tree === undefined) throw new Error('arbre absent');
    send(sim, 'p1', { type: 'point_at', target: { kind: 'tree', tree: tree.id } });
    expect(c.aim).toEqual({
      cell: { cx: Math.floor(tree.pos.x), cy: Math.floor(tree.pos.y) },
      verb: 'chop',
      blocked: null,
      source: 'pointer',
    });
    send(sim, 'p1', { type: 'point_at', target: null });
    expect(c.aim?.source).toBeUndefined();
  });

  it('un habitant survolé: « parler »; à portée, le clic lui parle tout de suite', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, null);
    const c = character(sim, 'p1');
    const v0 = sim.world.villagers.find((v) => v.visible);
    if (v0 === undefined) throw new Error('aucun habitant visible');
    send(sim, 'p1', { type: 'point_at', target: { kind: 'villager', villager: v0.id } });
    expect(c.aim).toMatchObject({ verb: 'talk', source: 'pointer' });
    placeCharacter(sim, c, { x: v0.pos.x + 1, y: v0.pos.y });
    send(sim, 'p1', { type: 'move_to', target: { kind: 'villager', villager: v0.id }, act: true });
    expect(c.status).toBe('dialogue');
    expect(c.destination).toBeNull();
  });

  it('le chantier de la porte survolé (main libre): « bâtir », comme le prendrait la construction une fois arrivé', () => {
    const sim = camilleAt({ x: 8.5, y: 29.5 }, -Math.PI / 2, null);
    const c = character(sim, 'p1');
    const door = sim.map.points.house_door;
    if (door === undefined) throw new Error('porte absente');
    expect(sim.world.constructions.find((k) => k.id === 'house_door')?.status).toBe('ghost');
    send(sim, 'p1', { type: 'point_at', target: ground(door.x + 0.3, door.y + 0.3) });
    expect(c.aim).toMatchObject({ verb: 'build', source: 'pointer' });
  });

  it('les messages de survol se valident à l’arrivée chez l’hôte', () => {
    expect(v.safeParse(IntentSchema, { type: 'point_at', target: null }).success).toBe(true);
    expect(
      v.safeParse(IntentSchema, { type: 'point_at', target: { kind: 'tree', tree: 't1' } }).success,
    ).toBe(true);
    expect(
      v.safeParse(IntentSchema, {
        type: 'point_at',
        target: { kind: 'ground', x: Number.NaN, y: 2 },
      }).success,
    ).toBe(false);
    expect(v.safeParse(IntentSchema, { type: 'point_at' }).success).toBe(false);
  });
});

/** Jour 1, les deux dans la pièce, la pièce vide de meubles; Camille tient `item`. */
function holdingInHouse(item: string): Sim {
  const sim = camilleAt({ x: 8.5, y: 29.5 }, 0, null);
  sim.world.furniture = sim.world.furniture.filter(
    (f) => f.item !== 'table' && f.item !== 'chair' && f.item !== 'shelf',
  );
  sim.runtime.dynamicDirty = true;
  const c = character(sim, 'p1');
  placeCharacter(sim, c, { x: 8.5, y: 22.5 });
  placeCharacter(sim, character(sim, 'p2'), { x: 6.5, y: 23.5 });
  c.facing = Math.PI / 2;
  addToBag(sim, c, item, 'ordinary', 1);
  send(sim, 'p1', { type: 'hold_furniture', item });
  return sim;
}

describe('pose d’un meuble à la souris', () => {
  it('l’aperçu suit la case sous la souris et se pose au clic, là où on le voit', () => {
    const sim = holdingInHouse('chair');
    const c = character(sim, 'p1');
    expect(c.placement).not.toBeNull();
    send(sim, 'p1', { type: 'point_at', target: ground(9.6, 24.4) });
    expect(c.placement).toMatchObject({ item: 'chair', cell: { cx: 9, cy: 24 }, valid: true });
    // Le clic envoie la case survolée puis « agir », au même pas: la pose suit la souris sans attendre.
    send(sim, 'p1', { type: 'point_at', target: ground(8.7, 24.2) }, { type: 'act' });
    expect(sim.world.furniture.filter((f) => f.item === 'chair').map((f) => f.cell)).toEqual([
      { cx: 8, cy: 24 },
    ]);
  });

  it('une table (2 cases) se centre sur la souris et se tourne; les règles de pose sont celles du clavier', () => {
    const sim = holdingInHouse('table');
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'point_at', target: ground(8.2, 23.7) });
    expect(c.placement).toMatchObject({ cell: { cx: 7, cy: 23 }, rotation: 0 });
    send(sim, 'p1', { type: 'rotate_furniture', delta: 1 });
    expect(c.placement).toMatchObject({ cell: { cx: 8, cy: 23 }, rotation: 1 });
    // Sur le réchaud (10:22): la même raison que `placementProblem`, et rien ne se pose.
    send(sim, 'p1', { type: 'point_at', target: ground(10.4, 22.9) });
    const p = c.placement;
    if (p === null) throw new Error('aperçu perdu');
    expect(p.valid).toBe(placementProblem(sim, 'table', p.cell, p.rotation, null, 'p1') === null);
    expect(p.valid).toBe(false);
    const before = sim.world.furniture.length;
    send(sim, 'p1', { type: 'act' });
    expect(sim.world.furniture.length).toBe(before);
  });

  it('la souris hors de la pièce ou retirée: l’aperçu revient devant le personnage', () => {
    const sim = holdingInHouse('chair');
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'point_at', target: ground(9.6, 24.4) });
    send(sim, 'p1', { type: 'point_at', target: ground(20, 40) });
    expect(c.placement?.cell).toEqual(previewCell(c, rotatedSize({ w: 1, d: 1 }, 0)));
    send(sim, 'p1', { type: 'point_at', target: ground(9.6, 24.4) });
    send(sim, 'p1', { type: 'point_at', target: null });
    expect(c.placement?.cell).toEqual(previewCell(c, rotatedSize({ w: 1, d: 1 }, 0)));
  });

  it('en aménagement, le survol ne met pas d’autre cible en évidence', () => {
    const sim = holdingInHouse('chair');
    const c = character(sim, 'p1');
    send(sim, 'p1', { type: 'point_at', target: ground(9.6, 24.4) });
    expect(c.aim?.source).toBeUndefined();
  });
});
