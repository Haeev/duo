// Gestes à deux de la semaine 2 (gauntlet, tour 4, D2): la draisine poussée sur la voie de la remise,
// le colis lourd du train porté du quai à la maison. Mécanique de la poutre: seul on ne peut pas, à
// deux ça avance, relâché la charge est posée là, sans dommage.
import { describe, expect, it } from 'vitest';
import { groundAt, mapMaxX, mapMaxY, mapMinX, mapMinY } from '../src/etat/carte';
import type { ControlFrame } from '../src/etat/actions';
import type { CharacterId, WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character, distance } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { handcarCells, placeCharacter, refreshBlockers, touchesCell } from '../src/simulation/deplacement';
import { deliverCatalogue } from '../src/simulation/economie';
import { bodyCollides, findPath, isBlockedCell } from '../src/simulation/grille';
import { step } from '../src/simulation/pas';
import { startQuest } from '../src/simulation/quetes';
import { countInStacks } from '../src/simulation/sac';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

function dayOne(): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null && s.world.beam === null, SIM_HZ * 1200);
  return sim;
}

/** Les deux (ou un seul) à côté de la charge, de part et d'autre. */
function grab(sim: Sim, who: CharacterId[]): void {
  const b = sim.world.beam;
  if (b === null) throw new Error('aucune charge');
  who.forEach((id, i) => {
    placeCharacter(sim, character(sim, id), { x: b.pos.x + (i === 0 ? -0.7 : 0.7), y: b.pos.y });
  });
}

/** `ticks` pas, action tenue par `who`, déplacement vers la destination (chemin de la grille). */
function carry(sim: Sim, who: CharacterId[], ticks: number): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < ticks && sim.world.beam !== null; i++) {
    const b = sim.world.beam;
    const next = b.route?.[b.leg] ?? findPath(refreshBlockers(sim), b.pos, b.to)?.[0] ?? b.to;
    const d = Math.max(1e-6, Math.hypot(next.x - b.pos.x, next.y - b.pos.y));
    const frame: ControlFrame = { seq: i + 1, moveX: (next.x - b.pos.x) / d, moveY: (next.y - b.pos.y) / d, actHeld: true };
    const controls: Partial<Record<CharacterId, ControlFrame>> = {};
    for (const id of who) controls[id] = frame;
    step(sim, { controls, intents: [] });
    events.push(...sim.events);
  }
  return events;
}

function withHandcar(): Sim {
  const sim = dayOne();
  startQuest(sim, 'handcar');
  const q = sim.world.quests.find((x) => x.id === 'handcar');
  const steps = sim.content.quests.find((x) => x.id === 'handcar')?.steps ?? [];
  if (q === undefined) throw new Error('quête absente');
  q.step = steps.findIndex((s) => s.id === 'push');
  step(sim, { controls: {}, intents: [] });
  return sim;
}

function withParcel(): Sim {
  const sim = dayOne();
  sim.world.catalogueOrders.push('wood_stove');
  deliverCatalogue(sim);
  step(sim, { controls: {}, intents: [] });
  return sim;
}

describe('draisine poussée à deux', () => {
  it('apparaît devant la remise à l’étape « push »', () => {
    const sim = withHandcar();
    expect(sim.world.beam?.purpose).toBe('handcar');
    expect(distance(sim.world.beam?.pos ?? { x: 0, y: 0 }, sim.map.points.handcar_shed ?? { x: -9, y: -9 })).toBeLessThan(0.01);
  });

  it('seul: elle ne bouge pas, et on lui dit qu’il faut être deux', () => {
    const sim = withHandcar();
    const start = { ...(sim.world.beam?.pos ?? { x: 0, y: 0 }) };
    grab(sim, ['p1']);
    carry(sim, ['p1'], SIM_HZ * 2);
    expect(sim.world.beam?.carried).toBe(false);
    expect(distance(sim.world.beam?.pos ?? { x: 0, y: 0 }, start)).toBe(0);
    expect(character(sim, 'p1').notifications.some((n) => n.key === 'handcar_needs_both' || n.key === 'needs_both')).toBe(true);
  });

  it('à deux: elle roule jusqu’au bout de la voie, le drapeau de l’étape est posé', () => {
    const sim = withHandcar();
    grab(sim, ['p1', 'p2']);
    const events = carry(sim, ['p1', 'p2'], SIM_HZ * 30);
    expect(events.some((e) => e.type === 'beam_placed')).toBe(true);
    expect(sim.world.beam).toBeNull();
    expect(sim.world.flags).toContain('handcar_pushed');
    expect(sim.world.characters.every((c) => c.status === 'active')).toBe(true);
  });

  it('au bout de la voie, elle y reste, même après une sauvegarde rechargée', () => {
    const sim = withHandcar();
    const to = { ...(sim.world.beam?.to ?? { x: 0, y: 0 }) };
    const start = { ...(sim.world.beam?.pos ?? { x: 0, y: 0 }) };
    const route = sim.world.beam?.route ?? [];
    const length = route.reduce((sum, w, i) => sum + distance(i === 0 ? start : (route[i - 1] ?? start), w), 0);
    expect(length, 'une vraie poussée sur les rails, de plusieurs mètres').toBeGreaterThan(6);
    expect(sim.world.handcarAt).toBeNull();
    grab(sim, ['p1', 'p2']);
    carry(sim, ['p1', 'p2'], SIM_HZ * 30);
    const at = sim.world.handcarAt;
    expect(at).not.toBeNull();
    expect(distance(at?.pos ?? { x: 0, y: 0 }, to), 'arrêtée au bout des rails').toBeLessThan(1e-6);
    for (let i = 0; i < SIM_HZ * 5; i++) step(sim, { controls: {}, intents: [] });
    expect(sim.world.handcarAt).toEqual(at);
    expect(sim.world.beam).toBeNull();
    const { content, map } = contentAndMap();
    const snap = snapshotOf(sim);
    const restored = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(restored.world.handcarAt).toEqual(at);
    // Une sauvegarde plus ancienne, sans le champ: la draisine est dans la remise.
    const old = JSON.parse(JSON.stringify(snap.data)) as Record<string, unknown>;
    delete old.handcarAt;
    expect(restoreWorld(content, map, old, snap.dataSchema, [A, B]).world.handcarAt).toBeNull();
  });

  it('relâchée en chemin: posée là, intacte, et on la reprend', () => {
    const sim = withHandcar();
    grab(sim, ['p1', 'p2']);
    // Trajet sur rails: la voie de garage (4 m vers le sud, jusqu'à l'axe de la ligne), puis 2,5 m vers l'ouest.
    const route = sim.world.beam?.route ?? [];
    expect(route.length).toBeGreaterThanOrEqual(2);
    carry(sim, ['p1', 'p2'], SIM_HZ * 3);
    const mid = sim.world.beam;
    expect(mid?.leg, 'à mi-chemin, sur la voie principale').toBe(1);
    expect(Math.abs((mid?.pos.y ?? 0) - (route[0]?.y ?? -1))).toBeLessThan(1e-6);
    expect(Math.cos(mid?.facing ?? 0)).toBeLessThan(-0.99);
    const events = carry(sim, [], 2);
    expect(events.some((e) => e.type === 'beam_dropped')).toBe(true);
    expect(sim.world.beam?.carried).toBe(false);
    expect(sim.world.flags).not.toContain('handcar_pushed');
    expect(sim.world.characters.every((c) => c.status === 'active')).toBe(true);
    grab(sim, ['p1', 'p2']);
    carry(sim, ['p1', 'p2'], SIM_HZ * 30);
    expect(sim.world.flags).toContain('handcar_pushed');
  });
});

/** Axe de la ligne (m): milieu des rangées de voie, comme le rendu (`voie.ts`). */
function trackAxis(sim: Sim): number {
  const rows: number[] = [];
  for (let cy = mapMinY(sim.map); cy <= mapMaxY(sim.map); cy++) {
    let rails = 0;
    for (let cx = mapMinX(sim.map); cx <= mapMaxX(sim.map); cx++) if (groundAt(sim.map, cx, cy) === 'rail') rails++;
    if (rails > sim.map.width / 2) rows.push(cy);
  }
  return ((rows[0] ?? 0) + (rows[rows.length - 1] ?? 0) + 1) / 2;
}

function pushedHandcar(): Sim {
  const sim = withHandcar();
  grab(sim, ['p1', 'p2']);
  carry(sim, ['p1', 'p2'], SIM_HZ * 30);
  if (sim.world.handcarAt === null) throw new Error('draisine pas posée');
  return sim;
}

describe('draisine posée sur la voie', () => {
  it('roule et s’arrête sur l’axe des rails, à plus de 2 m de la traversée de service et hors du train à quai', () => {
    const sim = withHandcar();
    const axis = trackAxis(sim);
    const shed = sim.map.points.handcar_shed ?? { x: -9, y: -9 };
    const route = sim.world.beam?.route ?? [];
    // La voie de garage descend dans la colonne de la remise, puis tout le reste roule sur l'axe de la ligne.
    expect(route[0]?.x).toBeCloseTo(shed.x, 6);
    for (const w of route) expect(w.y).toBeCloseTo(axis, 6);
    const sim2 = pushedHandcar();
    const at = sim2.world.handcarAt;
    const length = sim2.content.settings.carry.handcar?.size[0] ?? 0;
    expect(at?.pos.y).toBeCloseTo(axis, 6);
    const westEnd = (at?.pos.x ?? 0) - length / 2;
    // Traversée de service: la colonne de planches de la voie la plus à l'est de celles qui sont à
    // l'ouest de la draisine (0.13: d'autres passages à niveau sont plus loin à l'est).
    let service = -1;
    for (let cx = mapMinX(sim2.map); cx <= mapMaxX(sim2.map) && cx < westEnd; cx++) {
      if (groundAt(sim2.map, cx, Math.floor(axis)) === 'wood') service = cx;
    }
    expect(service).toBeGreaterThan(0);
    // Ni sur un passage à niveau de l'est: aucune planche sous la draisine ni à 2 m devant elle.
    for (let cx = Math.floor(westEnd); cx <= Math.floor(westEnd + length + 2); cx++) {
      expect(groundAt(sim2.map, cx, Math.floor(axis)), `planches en x ${String(cx)}`).not.toBe('wood');
    }
    expect(westEnd - (service + 1), 'à plus de 2 m de la traversée de service').toBeGreaterThan(2);
    const train = sim2.map.zones.train_at_platform;
    expect(train).toBeDefined();
    expect(westEnd).toBeGreaterThan((train?.x ?? 0) + (train?.w ?? 0) + 2);
  });

  it('bloque le passage comme un meuble, sans enfermer personne ni couper la voie', () => {
    const sim = pushedHandcar();
    const cells = handcarCells(sim);
    expect(cells.length).toBeGreaterThan(0);
    const b = refreshBlockers(sim);
    for (const cell of cells) expect(isBlockedCell(b, cell.cx, cell.cy)).toBe(true);
    // Les porteurs, posés à côté d'elle, n'y restent pas pris.
    for (const c of sim.world.characters) expect(bodyCollides(b, c.pos.x, c.pos.y), c.id).toBe(false);
    for (const v of sim.world.villagers) expect(cells.some((cell) => touchesCell(v.pos, cell)), v.id).toBe(false);
    // On ne la traverse plus: marcher droit dessus s'arrête devant elle.
    const at = sim.world.handcarAt ?? { pos: { x: 0, y: 0 }, facing: 0 };
    const p1 = character(sim, 'p1');
    placeCharacter(sim, p1, { x: at.pos.x, y: at.pos.y - 2 });
    for (let i = 0; i < SIM_HZ * 3; i++) {
      step(sim, { controls: { p1: { seq: i + 1, moveX: 0, moveY: 1, actHeld: false } }, intents: [] });
    }
    expect(p1.pos.y).toBeLessThan(at.pos.y - 0.5);
    // On la contourne: la voie se traverse toujours à côté, et la remise reste joignable.
    const around = findPath(refreshBlockers(sim), { x: at.pos.x, y: at.pos.y - 2 }, { x: at.pos.x, y: at.pos.y + 2 });
    expect(around).not.toBeNull();
    const shed = sim.map.points.handcar_shed ?? { x: -9, y: -9 };
    expect(findPath(refreshBlockers(sim), sim.map.points.train_stop ?? { x: 0, y: 0 }, shed)).not.toBeNull();
  });

  it('bloque encore après une sauvegarde rechargée', () => {
    const sim = pushedHandcar();
    const { content, map } = contentAndMap();
    const snap = snapshotOf(sim);
    const restored = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    const b = refreshBlockers(restored);
    const cells = handcarCells(restored);
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) expect(isBlockedCell(b, cell.cx, cell.cy)).toBe(true);
  });
});

describe('draisine: sauvegardes', () => {
  it('une draisine en cours de poussée écrite sans trajet (version d’avant) reprend le trajet sur rails', () => {
    const sim = withHandcar();
    grab(sim, ['p1', 'p2']);
    carry(sim, ['p1', 'p2'], 10);
    const old = JSON.parse(JSON.stringify(snapshotOf(sim).data)) as { beam: Record<string, unknown> };
    delete old.beam.route;
    delete old.beam.leg;
    const { content, map } = contentAndMap();
    const restored = restoreWorld(content, map, old, snapshotOf(sim).dataSchema, [A, B]);
    const beam = restored.world.beam;
    expect(beam?.route?.length).toBeGreaterThanOrEqual(2);
    expect(beam?.leg).toBe(0);
    expect(distance(beam?.pos ?? { x: 0, y: 0 }, restored.map.points.handcar_shed ?? { x: -9, y: -9 })).toBeLessThan(1e-6);
    grab(restored, ['p1', 'p2']);
    carry(restored, ['p1', 'p2'], SIM_HZ * 30);
    expect(restored.world.flags).toContain('handcar_pushed');
  });
});

describe('colis lourd du train', () => {
  it('un objet lourd du catalogue arrive en colis sur le quai, pas au cellier', () => {
    const sim = withParcel();
    expect(sim.world.beam).toMatchObject({ purpose: 'parcel', item: 'heavy_parcel', contents: 'wood_stove' });
    expect(countInStacks(sim.world.cellar, 'wood_stove')).toBe(0);
  });

  it('seul: refusé; à deux: porté jusqu’à la maisonnette, le poêle va au cellier', () => {
    const sim = withParcel();
    grab(sim, ['p1']);
    carry(sim, ['p1'], SIM_HZ);
    expect(sim.world.beam?.carried).toBe(false);
    grab(sim, ['p1', 'p2']);
    carry(sim, ['p1', 'p2'], SIM_HZ * 60);
    expect(sim.world.beam).toBeNull();
    expect(sim.world.heavyDeliveries).toEqual([]);
    expect(countInStacks(sim.world.cellar, 'wood_stove')).toBe(1);
  });
});
