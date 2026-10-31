// Gestes à deux de la semaine 2 (gauntlet, tour 4, D2): la draisine poussée sur la voie de la remise,
// le colis lourd du train porté du quai à la maison. Mécanique de la poutre: seul on ne peut pas, à
// deux ça avance, relâché la charge est posée là, sans dommage.
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import type { CharacterId, WorldEvent } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character, distance } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { deliverCatalogue } from '../src/simulation/economie';
import { findPath } from '../src/simulation/grille';
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
    const next = findPath(refreshBlockers(sim), b.pos, b.to)?.[0] ?? b.to;
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
    expect(sim.world.handcarAt).toBeNull();
    grab(sim, ['p1', 'p2']);
    carry(sim, ['p1', 'p2'], SIM_HZ * 30);
    const at = sim.world.handcarAt;
    expect(at).not.toBeNull();
    expect(distance(at?.pos ?? { x: 0, y: 0 }, to)).toBeLessThanOrEqual(sim.content.settings.feel.beamDropRadius);
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
    carry(sim, ['p1', 'p2'], SIM_HZ);
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
