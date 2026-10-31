// S'asseoir sur un banc par choix (gauntlet, tour 6): Espace près d'une place libre fait s'asseoir,
// une direction relève; deux places par banc, jamais deux corps sur la même (un habitant arrêté en
// tient une); les envies du banc et la quête des oies demandent d'être assis.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, ControlFrame } from '../src/etat/actions';
import { benchById, seatPlace } from '../src/etat/bancs';
import type { CharacterId, Vec2, WorldEvent } from '../src/etat/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { bodyCollides } from '../src/simulation/grille';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const BENCH = 'quay_bench';
const SOUTH = Math.PI / 2;

/** Jour 1, arrivée finie; Jeanne partie du banc du quai (sauf `keepJeanne`); les deux joueurs loin du banc. */
function readySim(keepJeanne = false): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  if (!keepJeanne) hideJeanne(sim);
  const square = sim.map.points.village_square;
  if (square === undefined) throw new Error('place du village absente');
  for (const c of sim.world.characters) placeCharacter(sim, c, { x: square.x + (c.id === 'p1' ? 0 : 1), y: square.y });
  return sim;
}

/**
 * Jeanne arrêtée juste derrière la place 0 du banc du quai, le banc pour point de son
 * emploi du temps (comme le matin), posée juste avant le pas: elle y est assise.
 */
function seatJeanne(sim: Sim): void {
  const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
  if (jeanne === undefined) throw new Error('Jeanne absente');
  jeanne.visible = true;
  jeanne.target = BENCH;
  jeanne.speed = 0;
  jeanne.pos = { x: 40.5, y: 19.5 };
  jeanne.prev = { x: 40.5, y: 19.5 };
  sim.runtime.villagerPaths.jeanne = { target: BENCH, path: [] };
}

function hideJeanne(sim: Sim): void {
  const jeanne = sim.world.villagers.find((v) => v.id === 'jeanne');
  if (jeanne === undefined) throw new Error('Jeanne absente');
  jeanne.visible = false;
  jeanne.pos = { x: -10, y: -10 };
  jeanne.prev = { x: -10, y: -10 };
  sim.runtime.villagerPaths.jeanne = { target: jeanne.target, path: [] };
}

/** Milieu de l'assise d'une place du banc du quai. */
function seat(sim: Sim, slot: number): Vec2 {
  const prop = benchById(sim.map, BENCH);
  if (prop === null) throw new Error('banc du quai absent');
  const p = seatPlace(prop, slot, sim.content.settings.benches, { x: 0, y: 0, facing: 0 });
  return { x: p.x, y: p.y };
}

/** Le personnage devant la place `slot` (côté de l'assise, au nord), tourné vers le banc. */
function standBefore(sim: Sim, id: CharacterId, slot: number, gap = 0.9): void {
  const at = seat(sim, slot);
  const c = character(sim, id);
  placeCharacter(sim, c, { x: at.x, y: at.y - gap });
  c.facing = SOUTH;
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

/** Un pas, avec des intentions; renvoie les événements du pas. */
function tick(sim: Sim, intents: AuthoredIntent[] = [], controls: Partial<Record<CharacterId, ControlFrame>> = {}): WorldEvent[] {
  step(sim, { controls, intents });
  return [...sim.events];
}

function press(sim: Sim, id: CharacterId): WorldEvent[] {
  return tick(sim, [{ by: id, intent: { type: 'act' } }]);
}

function wait(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) tick(sim, [], { p1: still(i), p2: still(i) });
}

describe('bancs: s’asseoir par choix', () => {
  it('Espace à moins de 1,2 m d’une place libre assoit au pas même, à la place, face à l’avant du banc', () => {
    const sim = readySim();
    standBefore(sim, 'p1', 0, 1.15);
    tick(sim);
    expect(character(sim, 'p1').aim?.verb).toBe('sit');
    const events = press(sim, 'p1');
    const c = character(sim, 'p1');
    expect(events).toContainEqual({ type: 'sat_down', by: 'p1', bench: BENCH, slot: 0 });
    expect(c.seat).toMatchObject({ bench: BENCH, slot: 0 });
    expect(c.action.kind).toBe('sit');
    expect(c.pos.x).toBeCloseTo(seat(sim, 0).x, 6);
    expect(c.pos.y).toBeCloseTo(seat(sim, 0).y, 6);
    // Le banc du quai regarde la voie (nord): l'assis aussi.
    expect(Math.cos(c.facing)).toBeCloseTo(0, 6);
    expect(Math.sin(c.facing)).toBeCloseTo(-1, 6);
  });

  it('une direction relève au pas même, devant la place, sur une case libre, et le personnage marche', () => {
    const sim = readySim();
    standBefore(sim, 'p1', 0);
    press(sim, 'p1');
    const events = tick(sim, [], { p1: { seq: 1, moveX: 0, moveY: -1, actHeld: false } });
    const c = character(sim, 'p1');
    expect(events).toContainEqual({ type: 'stood_up', by: 'p1', bench: BENCH });
    expect(c.seat).toBeNull();
    expect(c.action.kind).not.toBe('sit');
    expect(c.pos.y).toBeLessThan(seat(sim, 0).y - sim.content.settings.benches.standForward + 1e-6);
    expect(bodyCollides(refreshBlockers(sim), c.pos.x, c.pos.y)).toBe(false);
    expect(c.speed).toBeGreaterThan(0);
  });

  it('deux places par banc: le second prend l’autre, et un troisième corps ne s’y assoit jamais', () => {
    const sim = readySim(true);
    // Jeanne, arrêtée sur le banc, en tient une place: Camille prend l'autre.
    standBefore(sim, 'p1', 0);
    seatJeanne(sim);
    press(sim, 'p1');
    const first = character(sim, 'p1').seat;
    expect(first).not.toBeNull();
    // Jeanne (derrière la place 0, à x = 40,5) garde la sienne: Camille est sur l'autre.
    expect(first?.slot).toBe(1);
    // Sacha devant le banc plein: il ne s'assoit pas (Espace parle à Jeanne), personne ne se superpose.
    standBefore(sim, 'p2', 0);
    seatJeanne(sim);
    const events = press(sim, 'p2');
    expect(character(sim, 'p2').seat).toBeNull();
    expect(events.some((e) => e.type === 'sat_down')).toBe(false);
    // Jeanne partie, Sacha s'assoit à côté de Camille.
    tick(sim, [{ by: 'p2', intent: { type: 'dialogue_close' } }]);
    hideJeanne(sim);
    tick(sim);
    press(sim, 'p2');
    expect(character(sim, 'p2').seat?.slot).toBe(0);
    const [a, b] = sim.world.characters.map((c) => c.pos);
    expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeCloseTo(1, 6);
  });

  it('banc plein et personne à qui parler: Espace dit pourquoi on ne s’assoit pas', () => {
    // Bancs d'une seule place (variante des réglages): Camille assise, le banc est plein pour Sacha.
    const { content } = contentAndMap();
    const onePlace = { ...content, settings: { ...content.settings, benches: { ...content.settings.benches, slots: [0] } } };
    const sim = newSim(5, onePlace);
    play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
    hideJeanne(sim);
    standBefore(sim, 'p1', 0);
    press(sim, 'p1');
    expect(character(sim, 'p1').seat).toMatchObject({ bench: BENCH, slot: 0 });
    const c = character(sim, 'p2');
    placeCharacter(sim, c, { x: seat(sim, 0).x + 0.6, y: seat(sim, 0).y - 0.9 });
    c.facing = SOUTH;
    const events = press(sim, 'p2');
    expect(c.seat).toBeNull();
    expect(events.some((e) => e.type === 'sat_down')).toBe(false);
    expect(c.notifications.at(-1)?.text).toBe(sim.content.texts.messages.bench_full);
  });

  it('un clic sur une place du banc (boîte de clic du rendu) mène devant elle et assoit à l’arrivée; bêcher au pied du banc reste possible', () => {
    const sim = readySim();
    const at = seat(sim, 1);
    tick(sim, [{ by: 'p1', intent: { type: 'move_to', target: { kind: 'ground', x: at.x, y: at.y }, act: true } }]);
    play(sim, { decide: () => ({ controls: {}, intents: [] }), job: () => '' }, (s) => character(s, 'p1').seat !== null, SIM_HZ * 30);
    expect(character(sim, 'p1').seat).toMatchObject({ bench: BENCH, slot: 1 });
    // Bêche en main, tournée vers le sol à côté du banc: Espace bêche (énigme d'Émile), on ne s'assoit pas.
    const c = character(sim, 'p2');
    placeCharacter(sim, c, { x: 42.3, y: 17.6 });
    c.facing = 0;
    const hoe = c.bag.findIndex((s) => s?.item === 'hoe');
    if (hoe >= 0) c.selected = hoe;
    else c.bag[c.selected] = { item: 'hoe', quality: 'ordinary', count: 1 };
    tick(sim);
    expect(c.aim?.verb).toBe('dig');
    press(sim, 'p2');
    expect(c.seat).toBeNull();
  });
});

describe('bancs: envies et quête des oies', () => {
  const benchMoment = (sim: Sim): boolean => {
    const def = sim.content.envies.find((e) => e.id === 'bench_moment');
    if (def === undefined) throw new Error('envie bench_moment absente');
    return evaluateAll(sim, def.fulfilledWhen, { ...NO_CONTEXT, actor: 'p1' });
  };
  const benchTogether = (sim: Sim): boolean => {
    const def = sim.content.envies.find((e) => e.id === 'bench_together');
    if (def === undefined) throw new Error('envie bench_together absente');
    return evaluateAll(sim, def.fulfilledWhen, NO_CONTEXT);
  };
  const geeseWatch = (sim: Sim): boolean => {
    const step0 = sim.content.quests.find((q) => q.id === 'wild_geese')?.steps[0];
    if (step0 === undefined) throw new Error('quête wild_geese absente');
    return evaluateAll(sim, step0.conditions, NO_CONTEXT);
  };

  it('les conditions des données demandent d’être assis (seated)', () => {
    const { content } = contentAndMap();
    const seatedStays = [
      ...(content.envies.find((e) => e.id === 'bench_moment')?.fulfilledWhen ?? []),
      ...(content.envies.find((e) => e.id === 'bench_together')?.fulfilledWhen ?? []),
      ...(content.quests.find((q) => q.id === 'wild_geese')?.steps[0]?.conditions ?? []),
    ].filter((c) => c.type === 'stayed_at');
    expect(seatedStays).toHaveLength(3);
    for (const c of seatedStays) expect(c).toMatchObject({ point: BENCH, seated: true });
  });

  it('« S’asseoir un moment »: debout 12 s à côté du banc ne suffit pas, assis 10 s oui', () => {
    const sim = readySim();
    standBefore(sim, 'p1', 0);
    wait(sim, 12);
    expect(character(sim, 'p1').stays[BENCH] ?? 0).toBeGreaterThan(10);
    expect(benchMoment(sim)).toBe(false);
    press(sim, 'p1');
    wait(sim, 9.5);
    expect(benchMoment(sim)).toBe(false);
    wait(sim, 0.6);
    expect(benchMoment(sim)).toBe(true);
    // Relevé, le compte repart de zéro.
    tick(sim, [], { p1: { seq: 1, moveX: 0, moveY: -1, actHeld: false } });
    expect(benchMoment(sim)).toBe(false);
  });

  it('« Se retrouver sur le banc » et les oies: les deux assis, 10 s, l’un seul ne suffit pas', () => {
    const sim = readySim();
    standBefore(sim, 'p1', 0);
    press(sim, 'p1');
    standBefore(sim, 'p2', 1);
    wait(sim, 11);
    expect(benchTogether(sim)).toBe(false);
    press(sim, 'p2');
    wait(sim, 10.1);
    expect(benchTogether(sim)).toBe(true);
    // Les oies: même condition, entre 17 h et 18 h 30 seulement.
    sim.world.clock.minutes = 16 * 60;
    expect(geeseWatch(sim)).toBe(false);
    sim.world.clock.minutes = 17 * 60 + 15;
    expect(geeseWatch(sim)).toBe(true);
  });
});

describe('bancs: sauvegarde', () => {
  it('une sauvegarde d’avant les bancs (sans `seat`) se reprend debout; assis, on se retrouve à sa place', () => {
    const sim = readySim();
    standBefore(sim, 'p1', 1);
    press(sim, 'p1');
    const { content, map } = contentAndMap();
    const snap = snapshotOf(sim);
    const restored = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(character(restored, 'p1').seat).toMatchObject({ bench: BENCH, slot: 1 });
    expect(character(restored, 'p1').action.kind).toBe('sit');

    const old = JSON.parse(JSON.stringify(snap.data)) as { characters: Record<string, unknown>[] };
    for (const c of old.characters) delete c.seat;
    const fromOld = restoreWorld(content, map, old, snap.dataSchema, [A, B]);
    expect(fromOld.world.characters.map((c) => c.seat)).toEqual([null, null]);
    expect(character(fromOld, 'p1').action.kind).not.toBe('sit');
    // Debout à la place du banc (dans son emprise): une direction ne le bloque pas.
    for (let i = 0; i < SIM_HZ; i++) tick(fromOld, [], { p1: { seq: i, moveX: 0, moveY: -1, actHeld: false } });
    expect(character(fromOld, 'p1').seat).toBeNull();
  });
});
