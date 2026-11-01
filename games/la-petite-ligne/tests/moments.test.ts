// Moments rares (gauntlet, tour 6; docs/jeux/jeu-1/tour-06-conception.md, sections 1 et 4):
// tirage du matin sans le générateur, règle des 7 jours, phases, apogée qui n'attend que les deux
// joueurs (M-05), l'échelle qui se fige quand on lâche (M-09), confidence du matin à un seul
// joueur (M-10), le tirage qui ne change rien au reste de la partie (M-11), temps à l'écran (M-02).
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import { actorPose, momentDef, watchTarget } from '../src/etat/moments';
import type { Character, CharacterId, MomentToday, Vec2, WorldEvent } from '../src/etat/types';
import type { Content } from '../src/donnees/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { captureBaselines, variantOf } from '../src/simulation/conditions';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { isBlockedCell } from '../src/simulation/grille';
import { morning } from '../src/simulation/horloge';
import { drawToday, morningMoments, newToday, unitDraw } from '../src/simulation/moments';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/** Valeurs du script de simulation (`docs/jeux/jeu-1/simulations/moments_rares.py`, fonction `unit`). */
const PYTHON_UNITS: [number, string, number, number][] = [
  [1, 'moment', 2, 0.9082158873789012],
  [7, 'moment_pick', 9, 0.8818898368626833],
  [20261030, 'moment', 13, 0.9799996656365693],
  [42, 'moment', 5, 0.5074668861925602],
];

/** Annexe A et `play_demo` du script, mêmes graines: « jour:moment:origine » (q: quête, a: ambiance). */
const PYTHON_DEMOS: Record<number, string> = {
  1: '5:fox:a 6:heron:q 11:geese:q 13:glowworms:a',
  2: '3:fox:a 5:heron:a 7:geese:a 10:ladder:q 13:tits:a 14:fox:a',
  3: '5:fox:a 6:heron:q 9:glowworms:a 11:geese:q 13:fox:a',
  4: '5:heron:a 6:geese:a 10:ladder:q 11:fox:a 13:glowworms:a',
  5: '3:fox:a 6:heron:q 10:fox:a 11:geese:q 14:glowworms:a',
  6: '3:fox:a 6:heron:a 7:geese:a 10:ladder:q 13:heron:a',
  7: '6:heron:q 7:fox:a 9:glowworms:a 11:geese:q 13:heron:a',
  8: '5:heron:a 6:fox:a 7:geese:a 10:ladder:q 14:glowworms:a',
  42: '3:fox:a 7:geese:a 10:ladder:q 14:tits:a',
  20261030: '3:fox:a 7:heron:a 9:glowworms:a 10:ladder:q 11:tits:a 14:heron:a',
};

/**
 * La démo jour par jour, sans joueurs: chaque matin le tirage, et un moment de quête vu le jour
 * où il sort (comme le script). Rend « jour:moment:origine ».
 */
function drawDemo(seed: number, content: Content = contentAndMap().content): string[] {
  const sim = newSim(seed, content);
  const w = sim.world;
  const s = content.settings;
  const out: string[] = [];
  for (let day = 1; day <= s.clock.lastDay.day; day++) {
    w.clock.day = day;
    w.clock.minutes = s.clock.dayStart;
    w.weather = s.weatherByDay[day - 1] ?? 'sunny';
    morningMoments(sim);
    const today = w.moments.today;
    if (today === null) continue;
    out.push(`${String(day)}:${today.id}:${today.origin === 'quest' ? 'q' : 'a'}`);
    if (today.origin === 'quest') {
      const def = momentDef(content, today.id);
      const quest = def?.quest ?? null;
      if (quest !== null) w.quests.push({ id: quest, status: 'done', step: 1, checklist: [], baselines: {}, startedDay: day });
      w.moments.history.push({ id: today.id, day, weekday: (day - 1) % 7, origin: 'quest', seen: true });
      // Le nichoir redressé ouvre les mésanges (fin de la quête de Basile).
      if (today.id === 'ladder') w.flags.push('nest_box_straight');
    }
  }
  return out;
}

/** Jour 1, arrivée finie, les deux libres et dehors, loin de tout. */
function readySim(seed = 5): Sim {
  const sim = newSim(seed);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null && s.world.scripts.length === 0, SIM_HZ * 600);
  sim.world.beam = null;
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  return sim;
}

/** Le moment du jour posé à la main, en attente, à cette heure. */
function setMoment(sim: Sim, id: string, origin: MomentToday['origin'], minutes: number): MomentToday {
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  sim.world.clock.minutes = minutes;
  const today = newToday(sim, def, origin);
  today.phase = 'waiting';
  sim.world.moments.today = today;
  return today;
}

function place(sim: Sim, id: CharacterId, at: Vec2, lookAt: Vec2 | null = null): Character {
  const c = character(sim, id);
  placeCharacter(sim, c, at);
  if (lookAt !== null) c.facing = Math.atan2(lookAt.y - at.y, lookAt.x - at.x);
  return c;
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

/** Des pas sans bouger (sauf les commandes données); renvoie tous les événements. */
function wait(sim: Sim, seconds: number, controls: (i: number) => Partial<Record<CharacterId, ControlFrame>> = (i) => ({ p1: still(i), p2: still(i) })): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    step(sim, { controls: controls(i), intents: [] });
    events.push(...sim.events);
  }
  return events;
}

function press(sim: Sim, id: CharacterId): WorldEvent[] {
  step(sim, { controls: { p1: still(0), p2: still(0) }, intents: [{ by: id, intent: { type: 'act' } }] });
  return [...sim.events];
}

const climaxes = (events: WorldEvent[]): WorldEvent[] => events.filter((e) => e.type === 'moment_climax');

/** Au nord du gué, sur la berge, à 4,5 et 4,1 m du héron (les places de la conception). */
const HERON_VIEW_1 = { x: 22.5, y: 35.5 };
const HERON_VIEW_2 = { x: 21.0, y: 35.5 };

describe('moments: le tirage du matin', () => {
  it('« unit » donne exactement les valeurs du script de simulation (même empreinte, même mélange)', () => {
    for (const [seed, key, day, value] of PYTHON_UNITS) expect(unitDraw(seed, key, day)).toBe(value);
  });

  it('rejoue la démo du script pour ses graines: mêmes jours, mêmes moments, même origine', () => {
    for (const [seed, expected] of Object.entries(PYTHON_DEMOS)) {
      expect(drawDemo(Number(seed)).join(' '), `graine ${seed}`).toBe(expected);
    }
  });

  it('M-07: jamais le même moment à moins de 7 jours, au plus un par jour, rien les jours du train (2 000 graines)', () => {
    const { content } = contentAndMap();
    const trains = content.settings.train.days;
    let total = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      const log = drawDemo(seed, content).map((x) => x.split(':'));
      const last: Record<string, number> = {};
      const days = new Set<number>();
      for (const [d, id, origin] of log) {
        const day = Number(d);
        expect(days.has(day), `graine ${String(seed)}: deux moments le jour ${String(day)}`).toBe(false);
        days.add(day);
        if (origin === 'a') expect(trains.includes(day), `graine ${String(seed)}: moment un jour de train`).toBe(false);
        const before = last[id ?? ''];
        if (before !== undefined) expect(day - before, `graine ${String(seed)}: ${String(id)} revient trop tôt`).toBeGreaterThanOrEqual(7);
        last[id ?? ''] = day;
        total++;
      }
      // Les oies ne passent qu'une fois par printemps (quête comprise).
      expect(log.filter((x) => x[1] === 'geese').length).toBeLessThanOrEqual(1);
    }
    // Environ 4,8 moments par démo (annexe A): rares, sans être absents.
    expect(total / 2000).toBeGreaterThan(4.3);
    expect(total / 2000).toBeLessThan(5.3);
  });

  it('les mésanges attendent le nichoir redressé; les vers luisants, le soleil à partir du jour 9', () => {
    const sim = newSim(3);
    sim.world.clock.day = 12;
    sim.world.weather = 'sunny';
    const admissibleIds = (): string[] => {
      const ids: string[] = [];
      for (let seedDay = 0; seedDay < 1; seedDay++) for (const def of sim.content.moments) if (def.mode !== 'quest') ids.push(def.id);
      return ids;
    };
    expect(admissibleIds()).toContain('tits');
    sim.world.moments.history = [];
    const tits = momentDef(sim.content, 'tits');
    const glow = momentDef(sim.content, 'glowworms');
    if (tits === null || glow === null) throw new Error('moments absents');
    // Sans le drapeau, jamais tirées: on force le tirage à « oui » en vidant tout le reste.
    const only = (id: string): Content => ({ ...sim.content, moments: sim.content.moments.filter((m) => m.id === id), settings: { ...sim.content.settings, moments: { ...sim.content.settings.moments, dailyChance: 1 } } });
    const s1 = newSim(3, only('tits'));
    s1.world.clock.day = 12;
    s1.world.weather = 'sunny';
    expect(drawToday(s1)).toBeNull();
    s1.world.flags.push('nest_box_straight');
    expect(drawToday(s1)?.id).toBe('tits');
    const s2 = newSim(3, only('glowworms'));
    s2.world.clock.day = 12;
    s2.world.weather = 'cloudy';
    expect(drawToday(s2)).toBeNull();
    s2.world.weather = 'sunny';
    expect(drawToday(s2)?.id).toBe('glowworms');
    s2.world.clock.day = 8;
    expect(drawToday(s2), 'jour du train').toBeNull();
  });

  it('M-11: même graine, avec ou sans moments.json: même générateur, mêmes envies, même météo, mêmes variantes', () => {
    const { content } = contentAndMap();
    const without: Content = { ...content, moments: [] };
    const run = (c: Content): string => {
      const sim = newSim(31_337, c);
      for (const id of ['p1', 'p2'] as const) {
        step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'title_ready', ready: true } }, { by: id, intent: { type: 'create_character', name: id, hair: 1, outfit: 1 } }] });
      }
      const trace: string[] = [];
      for (let day = 2; day <= 14; day++) {
        for (let i = 0; i < SIM_HZ * 5; i++) step(sim, { controls: {}, intents: [] });
        morning(sim);
        trace.push(`${String(day)} ${sim.world.weather} ${sim.world.characters.map((ch) => ch.envie?.id ?? '-').join('/')} ${sim.world.rng.join(',')}`);
      }
      const variants = ['afternoon_d6', 'afternoon_d10', 'afternoon_d11', 'afternoon_d13', 'hen_names', 'lucie_reply'].map((g) => variantOf(sim.world.seed, g, 6));
      return `${trace.join('\n')}\n${variants.join(',')}`;
    };
    const a = run(content);
    expect(a).toBe(run(without));
    expect(a.split('\n')).toHaveLength(14);
  });
});

describe('moments: l’apogée n’attend que les deux (M-05)', () => {
  it('les deux immobiles, tournés vers le héron, entre 2,5 et 6 m, pendant 4 s: l’apogée part, une fois', () => {
    const sim = readySim();
    const today = setMoment(sim, 'heron', 'ambient', 15 * 60);
    const at = sim.map.points.heron_stand;
    if (at === undefined) throw new Error('heron_stand absent');
    place(sim, 'p1', HERON_VIEW_1, at);
    place(sim, 'p2', HERON_VIEW_2, at);
    const purse = sim.world.purse;
    const early = wait(sim, 3.8);
    expect(climaxes(early)).toEqual([]);
    expect(today.watching).toEqual({ p1: true, p2: true });
    const events = wait(sim, 0.4);
    expect(climaxes(events)).toEqual([{ type: 'moment_climax', moment: 'heron', startTick: today.startTick }]);
    expect(today.phase).toBe('climax');
    expect(sim.world.characters.every((c) => c.heartToday.moment === true)).toBe(true);
    // Le texte attend la fin du spectacle pour ne pas détourner les yeux de la bête.
    expect(sim.world.characters.some((c) => c.notifications.some((n) => n.key === 'heron_seen'))).toBe(false);
    // La chorégraphie dure 7,4 s (alerte tenue avant l'envol, M-02), identique chez les deux, puis l'état d'après; aucun sou ajouté.
    wait(sim, 7.5);
    expect(today.phase).toBe('after');
    expect(sim.world.characters.every((c) => c.notifications.some((n) => n.key === 'heron_seen'))).toBe(true);
    expect(climaxes(wait(sim, 3))).toEqual([]);
    expect(sim.world.purse).toBe(purse);
    expect(sim.world.moments.history.at(-1)).toMatchObject({ id: 'heron', origin: 'ambient', seen: true });
  });

  for (const [label, spoil] of [
    ['un seul joueur', (sim: Sim): void => void place(sim, 'p2', { x: 40, y: 30 })],
    ['l’un dans la maison', (sim: Sim): void => void place(sim, 'p2', sim.map.house.spawn)],
    ['l’un dans un menu', (sim: Sim): void => void (character(sim, 'p2').menu = 'notebook')],
    [
      'l’un en conversation',
      (sim: Sim): void => {
        character(sim, 'p2').dialogue = { dialogue: 'x', villager: 'jeanne', lines: [], line: 0, choices: [] };
      },
    ],
    ['l’un trop près (moins de 2,5 m)', (sim: Sim): void => void place(sim, 'p2', { x: 20.6, y: 37.4 }, { x: 20.6, y: 39.6 })],
    ['l’un tourné ailleurs', (sim: Sim): void => void (character(sim, 'p2').facing = -Math.PI / 2)],
    ['hors de la fenêtre (13 h)', (sim: Sim): void => void (sim.world.clock.minutes = 13 * 60)],
  ] as const) {
    it(`ne part pas: ${label}`, () => {
      const sim = readySim();
      const today = setMoment(sim, 'heron', 'ambient', 15 * 60);
      const at = sim.map.points.heron_stand ?? { x: 0, y: 0 };
      place(sim, 'p1', HERON_VIEW_1, at);
      place(sim, 'p2', HERON_VIEW_2, at);
      spoil(sim);
      // L'heure ne doit pas avancer jusque dans la fenêtre pendant le test « hors de la fenêtre ».
      sim.world.clock.running = false;
      expect(climaxes(wait(sim, 6))).toEqual([]);
      expect(today.phase === 'waiting' || today.phase === 'absent').toBe(true);
      expect(today.watching.p1).toBe(true);
    });
  }

  it('bouger remet le compteur à zéro: il faut 4 s d’affilée sans bouger', () => {
    const sim = readySim();
    const today = setMoment(sim, 'heron', 'ambient', 15 * 60);
    const at = sim.map.points.heron_stand ?? { x: 0, y: 0 };
    place(sim, 'p1', HERON_VIEW_1, at);
    place(sim, 'p2', HERON_VIEW_2, at);
    wait(sim, 3);
    // Un pas de côté (vers l'est): l'immobilité tombe.
    wait(sim, 0.1, (i) => ({ p1: { seq: i, moveX: 1, moveY: 0, actHeld: false }, p2: still(i) }));
    expect(today.watchTicks).toBe(0);
    const at1 = character(sim, 'p1');
    at1.facing = Math.atan2(at.y - at1.pos.y, at.x - at1.pos.x);
    expect(climaxes(wait(sim, 3.5))).toEqual([]);
    expect(climaxes(wait(sim, 0.7))).toHaveLength(1);
  });

  it('seul près d’un moment d’ambiance: « Montre-le à {partner} ! » une seule fois, chez lui seul', () => {
    const sim = readySim();
    setMoment(sim, 'fox', 'ambient', 19 * 60 + 30);
    place(sim, 'p1', { x: 9.5, y: 14.5 });
    place(sim, 'p2', { x: 45, y: 30 });
    wait(sim, 2);
    const notices = (id: CharacterId): number => character(sim, id).notifications.filter((n) => n.key === 'moment_notice').length;
    expect(notices('p1')).toBe(1);
    expect(notices('p2')).toBe(0);
    expect(character(sim, 'p1').notifications.find((n) => n.key === 'moment_notice')?.text).toContain('Sacha');
  });

  it('les oies de la quête: assis à deux sur le banc de la berge, pas avant 16 h 30 (ligne « pas encore »)', () => {
    const sim = readySim();
    const state = { id: 'wild_geese', status: 'active' as const, step: 0, checklist: [], baselines: {}, startedDay: 1 };
    const def = sim.content.quests.find((q) => q.id === 'wild_geese');
    if (def?.steps[0] === undefined) throw new Error('wild_geese absente');
    state.baselines = captureBaselines(sim, def.steps[0].conditions);
    sim.world.quests.push(state);
    const today = setMoment(sim, 'geese', 'quest', 16 * 60);
    sim.world.clock.running = false;
    const prop = sim.map.props.find((p) => p.id === 'riverbank_bench');
    if (prop === undefined) throw new Error('banc de la berge absent');
    place(sim, 'p1', { x: prop.pos.x - 0.5, y: prop.pos.y + 0.9 }, prop.pos);
    place(sim, 'p2', { x: prop.pos.x + 0.5, y: prop.pos.y + 0.9 }, prop.pos);
    press(sim, 'p1');
    press(sim, 'p2');
    expect(sim.world.characters.map((c) => c.seat?.bench)).toEqual(['riverbank_bench', 'riverbank_bench']);
    expect(climaxes(wait(sim, 6))).toEqual([]);
    expect(today.early).toBe(true);
    sim.world.clock.minutes = 16 * 60 + 40;
    expect(climaxes(wait(sim, 5.2))).toHaveLength(1);
    // L'étape finit avec le spectacle (16,8 s), pas à son début (QA6-07).
    wait(sim, 1);
    expect(sim.world.quests.find((q) => q.id === 'wild_geese')?.status).toBe('active');
    wait(sim, 17);
    expect(sim.world.quests.find((q) => q.id === 'wild_geese')?.status).toBe('done');
  });
});

describe('moments: l’échelle de Basile (geste « tenir », M-09)', () => {
  function ladderSim(): { sim: Sim; today: MomentToday } {
    const sim = readySim();
    const def = sim.content.quests.find((q) => q.id === 'basile_lost');
    const help = def?.steps[1];
    if (help === undefined) throw new Error('basile_lost absente');
    sim.world.quests.push({ id: 'basile_lost', status: 'active', step: 1, checklist: [], baselines: captureBaselines(sim, help.conditions), startedDay: 1 });
    const today = setMoment(sim, 'ladder', 'quest', 13 * 60);
    sim.world.clock.running = false;
    return { sim, today };
  }

  function holdBoth(sim: Sim): void {
    place(sim, 'p1', { x: 50.5, y: 7.3 });
    place(sim, 'p2', { x: 52.3, y: 5.5 });
    press(sim, 'p1');
    press(sim, 'p2');
  }

  it('Agir près d’une place libre la prend, face à l’échelle; la place de l’autre ne se prend pas', () => {
    const { sim } = ladderSim();
    place(sim, 'p1', { x: 50.5, y: 7.3 });
    step(sim, { controls: {}, intents: [] });
    expect(character(sim, 'p1').aim?.verb).toBe('hold');
    const events = press(sim, 'p1');
    const c = character(sim, 'p1');
    expect(c.holding).toBe('ladder_hold_west');
    expect(c.pos).toEqual(sim.map.points.ladder_hold_west);
    // Face au montant: la place de l'ouest regarde le nord-est (cap de la carte).
    expect(c.facing).toBeCloseTo(-Math.PI / 4, 6);
    expect(events).toContainEqual({ type: 'hold_started', by: 'p1', point: 'ladder_hold_west' });
    // L'autre arrive du même côté: on lui dit de prendre l'autre côté.
    place(sim, 'p2', { x: 50.4, y: 6.9 });
    // Mains libres (sinon la bêche qu'on tient bêcherait la case devant soi, comme ailleurs).
    const p2 = character(sim, 'p2');
    p2.selected = p2.bag.findIndex((s, i) => s === null && i < 10);
    press(sim, 'p2');
    expect(character(sim, 'p2').holding).toBeNull();
    expect(character(sim, 'p2').notifications.at(-1)?.key).toBe('ladder_hold_taken');
    // Une direction lâche.
    wait(sim, 0.1, (i) => ({ p1: { seq: i, moveX: -1, moveY: 0, actHeld: false }, p2: still(i) }));
    expect(character(sim, 'p1').holding).toBeNull();
  });

  it('les deux tiennent 0,5 s: Basile monte; lâcher à 4 s le fige (« Tenez bon »), reprendre le relance au même instant', () => {
    const { sim, today } = ladderSim();
    holdBoth(sim);
    expect(climaxes(wait(sim, 0.6))).toHaveLength(1);
    wait(sim, 4);
    const at = today.elapsed;
    expect(at).toBeGreaterThan(3.8);
    const events = wait(sim, 0.1, (i) => ({ p1: still(i), p2: { seq: i, moveX: 0, moveY: 1, actHeld: false } }));
    expect(events.some((e) => e.type === 'moment_paused')).toBe(true);
    expect(today.paused).toBe(true);
    for (const c of sim.world.characters) expect(c.notifications.at(-1)?.key).toBe('ladder_hold_on');
    const frozen = today.elapsed;
    wait(sim, 2);
    expect(today.elapsed).toBe(frozen);
    // L'étape (et son texte de fin) attend la fin du spectacle (QA6-07); la récompense, elle, est partie au début.
    expect(sim.world.quests.find((q) => q.id === 'basile_lost')?.status).toBe('active');
    // Il revient à sa place: Basile reprend où il en était.
    const back = press(sim, 'p2');
    expect(character(sim, 'p2').holding).toBe('ladder_hold_east');
    expect([...back, ...wait(sim, 0.1)].some((e) => e.type === 'moment_resumed')).toBe(true);
    expect(today.elapsed).toBeGreaterThan(frozen);
    expect(today.elapsed).toBeLessThan(frozen + 0.2);
    wait(sim, 6);
    expect(today.phase).toBe('after');
    expect(sim.world.characters.map((c) => c.holding)).toEqual([null, null]);
    expect(sim.world.quests.find((q) => q.id === 'basile_lost')?.status).toBe('done');
    expect(sim.world.flags).toContain('nest_box_straight');
  });

  it('après 7,4 s (Basile au sol), on peut lâcher: il finit de reculer sans s’arrêter', () => {
    const { sim, today } = ladderSim();
    holdBoth(sim);
    wait(sim, 0.6 + 7.5);
    expect(today.phase).toBe('climax');
    expect(today.elapsed).toBeGreaterThan(7.4);
    const events = wait(sim, 0.1, (i) => ({ p1: { seq: i, moveX: -1, moveY: 0, actHeld: false }, p2: still(i) }));
    expect(events.some((e) => e.type === 'moment_paused')).toBe(false);
    wait(sim, 1);
    expect(today.phase).toBe('after');
  });

  it('QA6-07: le texte de fin de quête et le texte d’apogée tombent à la fin du spectacle, pas au début', () => {
    const { sim, today } = ladderSim();
    const before = character(sim, 'p1').notifications.filter((n) => n.key === 'quest_done').length;
    const done = (): number => character(sim, 'p1').notifications.filter((n) => n.key === 'quest_done').length - before;
    const climaxText = (): number => character(sim, 'p1').notifications.filter((n) => n.key === 'moment_ladder_climax').length;
    holdBoth(sim);
    wait(sim, 1.5);
    expect(today.phase).toBe('climax');
    expect(character(sim, 'p1').heartToday.moment).toBe(true);
    expect([done(), climaxText()]).toEqual([0, 0]);
    expect(sim.world.quests.find((q) => q.id === 'basile_lost')?.status).toBe('active');
    wait(sim, 8);
    expect(today.phase).toBe('after');
    expect([done(), climaxText()]).toEqual([1, 1]);
    expect(sim.world.quests.find((q) => q.id === 'basile_lost')?.status).toBe('done');
    expect(sim.world.flags).toContain('nest_box_straight');
  });

  it('QA6-08: une sauvegarde faite pendant l’apogée finit l’étape et montre le texte au rechargement', () => {
    const { sim, today } = ladderSim();
    holdBoth(sim);
    wait(sim, 2);
    expect(today.phase).toBe('climax');
    const snap = snapshotOf(sim);
    const back = restoreWorld(sim.content, sim.map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(back.world.moments.today?.phase).toBe('after');
    expect(character(back, 'p1').notifications.some((n) => n.key === 'moment_ladder_climax')).toBe(true);
    step(back, { controls: {}, intents: [] });
    expect(back.world.quests.find((q) => q.id === 'basile_lost')?.status).toBe('done');
    expect(character(back, 'p2').notifications.some((n) => n.key === 'quest_done')).toBe(true);
  });
});

describe('moments: les bêtes ne traversent pas les joueurs (QA6-04)', () => {
  it('le renard qui mulote: un joueur dans son coin d’herbe en est écarté au-delà de `roam` et des deux rayons', () => {
    const sim = readySim();
    const today = setMoment(sim, 'fox', 'ambient', 20 * 60);
    const actor = momentDef(sim.content, 'fox')?.actors.find((a) => a.id === 'fox');
    const at = sim.map.points.fox_mousing;
    if (actor === undefined || at === undefined) throw new Error('renard absent');
    expect(actor.roam).toBeGreaterThan(2);
    const p1 = character(sim, 'p1');
    placeCharacter(sim, p1, { x: at.x + 1.5, y: at.y });
    wait(sim, 0.5);
    expect(today.phase).toBe('waiting');
    expect(Math.hypot(p1.pos.x - at.x, p1.pos.y - at.y)).toBeGreaterThanOrEqual(actor.roam + actor.collisionRadius + 0.3 - 1e-6);
  });
});

describe('moments: la confidence du matin (M-10)', () => {
  it('va à un seul joueur, en commençant par p2, puis en alternance; elle ne s’affiche que chez lui', () => {
    let checked = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const sim = newSim(seed);
      const w = sim.world;
      // Tous les habitants rencontrés par les deux (une confidence d'habitant suppose la rencontre).
      for (const c of w.characters) for (const v of sim.content.villagers) w.counters[c.id][`talked:${v.id}`] = 1;
      const recipients: CharacterId[] = [];
      for (let day = 2; day <= 14; day++) {
        w.clock.day = day;
        w.weather = sim.content.settings.weatherByDay[day - 1] ?? 'sunny';
        for (const c of w.characters) c.notifications = [];
        morningMoments(sim);
        const hinted = w.characters.filter((c) => c.momentHint !== null);
        const today = w.moments.today;
        if (today?.origin !== 'ambient') {
          expect(hinted).toEqual([]);
          continue;
        }
        expect(hinted).toHaveLength(1);
        const to = hinted[0]?.id ?? 'p1';
        expect(today.hintTo).toBe(to);
        const def = momentDef(sim.content, today.id);
        const other = character(sim, to === 'p1' ? 'p2' : 'p1');
        expect(other.notifications.some((n) => n.key === def?.texts.hint)).toBe(false);
        expect(character(sim, to).notifications.some((n) => n.key === def?.texts.hint)).toBe(true);
        recipients.push(to);
        checked++;
      }
      recipients.forEach((r, i) => {
        expect(r, `graine ${String(seed)}, confidence ${String(i + 1)}`).toBe(i % 2 === 0 ? 'p2' : 'p1');
      });
    }
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('une confidence d’habitant suppose de l’avoir rencontré: sinon à l’autre, sinon personne', () => {
    const only: Content = (() => {
      const { content } = contentAndMap();
      return { ...content, moments: content.moments.filter((m) => m.id === 'glowworms'), settings: { ...content.settings, moments: { ...content.settings.moments, dailyChance: 1 } } };
    })();
    const sim = newSim(4, only);
    sim.world.clock.day = 10;
    sim.world.weather = 'sunny';
    morningMoments(sim);
    expect(sim.world.moments.today?.id).toBe('glowworms');
    expect(sim.world.characters.map((c) => c.momentHint)).toEqual([null, null]);
    sim.world.counters.p1['talked:odette'] = 1;
    sim.world.moments.history = [];
    morningMoments(sim);
    expect(sim.world.moments.today?.hintTo).toBe('p1');
    expect(sim.world.moments.hintTurn).toBe('p2');
  });

  it('la confidence part à l’apogée', () => {
    const sim = readySim();
    const today = setMoment(sim, 'heron', 'ambient', 15 * 60);
    character(sim, 'p2').momentHint = { moment: 'heron', text: 'x' };
    today.hintTo = 'p2';
    const at = sim.map.points.heron_stand ?? { x: 0, y: 0 };
    place(sim, 'p1', HERON_VIEW_1, at);
    place(sim, 'p2', HERON_VIEW_2, at);
    wait(sim, 4.2);
    expect(character(sim, 'p2').momentHint).toBeNull();
  });
});

describe('moments: chorégraphies et temps à l’écran (M-02)', () => {
  /**
   * M-02, décision du manager (tour 6): rayon de 6 m gardé, et chaque apogée reste au moins 3,4 s
   * à moins de `watch.radius` depuis toute case libre de l'anneau, y compris le bord opposé à
   * l'envol (le héron et les oies tiennent leur pose d'alerte avant de partir, le renard regarde
   * encore après ses jappements). Aucun écart toléré.
   */
  const M02_MIN_SECONDS = 3.4;

  it('mesure, pour chaque moment, le pire temps où une bête reste dans le rayon de chaque case libre de l’anneau', () => {
    const sim = newSim(1);
    const b = refreshBlockers(sim);
    for (const def of sim.content.moments) {
      const today = newToday(sim, def, def.mode === 'ambient' ? 'ambient' : 'quest');
      for (const w of [def.watch, def.questWatch]) {
        if (w === null) continue;
        today.phase = 'waiting';
        const target = watchTarget(sim.map, def, w.target, today);
        let worst = Infinity;
        for (let cy = Math.floor(target.y - w.radius); cy <= target.y + w.radius; cy++) {
          for (let cx = Math.floor(target.x - w.radius); cx <= target.x + w.radius; cx++) {
            const p = { x: cx + 0.5, y: cy + 0.5 };
            const d0 = Math.hypot(p.x - target.x, p.y - target.y);
            if (isBlockedCell(b, cx, cy) || d0 > w.radius || d0 < w.minRadius) continue;
            today.phase = 'climax';
            let inside = 0;
            for (let t = 0; t <= def.climax.seconds + 1e-9; t += 0.05) {
              today.elapsed = t;
              const near = def.actors.some((a) => {
                const pose = actorPose(sim.map, def, today, a.id);
                return pose !== null && Math.hypot(pose.x - p.x, pose.y - p.y) <= w.radius;
              });
              if (near) inside += 0.05;
            }
            worst = Math.min(worst, inside);
          }
        }
        expect(worst, `${def.id}: au moins une case de l'anneau`).toBeLessThan(Infinity);
        expect(worst, `${def.id}: ${String(M02_MIN_SECONDS)} s au moins`).toBeGreaterThanOrEqual(M02_MIN_SECONDS);
      }
    }
  });

  it('depuis la berge nord (places de la conception et des robots), le héron reste 3,4 s à moins de 6 m des deux', () => {
    const sim = newSim(1);
    const def = momentDef(sim.content, 'heron');
    if (def === null) throw new Error('héron absent');
    const today = newToday(sim, def, 'ambient');
    today.phase = 'climax';
    let both = 0;
    for (let t = 0; t <= def.climax.seconds; t += 0.05) {
      today.elapsed = t;
      const pose = actorPose(sim.map, def, today, 'heron');
      if (pose === null) continue;
      const near = [HERON_VIEW_1, HERON_VIEW_2].every((v) => Math.hypot(pose.x - v.x, pose.y - v.y) <= 6);
      if (near) both += 0.05;
    }
    expect(both).toBeGreaterThanOrEqual(3);
  });

  it('les images clés passent par chaque point et se tiennent sur la carte; la pose suit les phases', () => {
    const sim = newSim(1);
    for (const def of sim.content.moments) {
      const today = newToday(sim, def, 'ambient');
      expect(actorPose(sim.map, def, today, def.actors[0]?.id ?? '')).toBeNull();
      today.phase = 'waiting';
      expect(actorPose(sim.map, def, today, def.actors[0]?.id ?? '')?.clip).toBe(def.actors[0]?.idle);
      today.phase = 'climax';
      for (const [actor, frames] of Object.entries(def.climax.keyframes)) {
        for (const [t, x, y, z] of frames) {
          today.elapsed = t;
          const pose = actorPose(sim.map, def, today, actor);
          if (pose === null) throw new Error(`${def.id}.${actor}: pas de pose`);
          if (x !== null) expect(pose.x).toBeCloseTo(x, 6);
          if (y !== null) expect(pose.y).toBeCloseTo(y, 6);
          expect(pose.z).toBeCloseTo(z, 6);
        }
      }
    }
  });

  it('une sortie pendant l’apogée la compte comme vue: la reprise donne l’état d’après', () => {
    const sim = readySim();
    const today = setMoment(sim, 'heron', 'ambient', 15 * 60);
    const at = sim.map.points.heron_stand ?? { x: 0, y: 0 };
    place(sim, 'p1', HERON_VIEW_1, at);
    place(sim, 'p2', HERON_VIEW_2, at);
    wait(sim, 4.5);
    expect(today.phase).toBe('climax');
    const snap = snapshotOf(sim);
    const { content, map } = contentAndMap();
    const back = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(back.world.moments.today?.phase).toBe('after');
    expect(back.world.moments.history.at(-1)).toMatchObject({ id: 'heron', seen: true });
  });
});
