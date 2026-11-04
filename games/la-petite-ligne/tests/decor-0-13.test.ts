// 0.13, lot H7 (`docs/jeux/jeu-1/v0-13-habitants.md`, section 7.1): les gestes des joueurs avec le
// décor. Un test court par geste (données de `vie.json`): le joueur se tient au lieu du geste, fait
// son appui (Agir, Maintenir, Examiner), et l'on lit ce qui en sort: le compteur du jour, l'événement
// du son, la réplique, le drapeau du monde. Plus les contrôles du fichier de données.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DecorGestureDef } from '../src/donnees/vie-gestes';
import type { CharacterId, WorldEvent } from '../src/etat/types';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import { SIM_HZ } from '../src/simulation/constantes';
import { type Sim, character } from '../src/simulation/contexte';
import { ACTION_FOR_CLIP, decorFlagNames, decorTargets } from '../src/simulation/decor';
import { bestTarget, verbOf } from '../src/simulation/agir';
import type { Intent } from '../src/etat/actions';
import { step } from '../src/simulation/pas';
import { addToBag } from '../src/simulation/sac';
import { contentAndMap, newSim, SEED } from './aides';

const { content, map } = contentAndMap();
const GESTURES = content.playerGestures;

/** Un monde de jour, les deux joueurs dehors, les habitants cachés (rien ne vole la touche). */
function daySim(): Sim {
  const sim = newSim(SEED, content);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = 2;
  w.clock.minutes = 10 * 60;
  w.clock.running = false;
  w.weather = 'sunny';
  w.weatherTomorrow = 'sunny';
  w.scene = null;
  w.purse = 100;
  for (const ch of w.characters) {
    ch.created = true;
    ch.status = 'active';
    ch.inside = null;
    ch.pos = { x: 5, y: 60 };
    ch.enduranceMax = 100;
    ch.endurance = 10;
  }
  for (const v of w.villagers) v.visible = false;
  return sim;
}

interface Run {
  sim: Sim;
  events: WorldEvent[];
  seq: number;
  /** Habitants laissés visibles (le test les a placés). */
  keep: Map<string, { x: number; y: number }>;
}

function start(): Run {
  return { sim: daySim(), events: [], seq: 0, keep: new Map() };
}

/** Avance de `ticks` pas, avec les commandes (par défaut, rien d'appuyé) et les intentions du premier pas. */
function advance(
  run: Run,
  ticks: number,
  opts: {
    held?: Partial<Record<CharacterId, boolean>>;
    intents?: { by: CharacterId; intent: Intent }[];
  } = {},
): void {
  for (let i = 0; i < ticks; i++) {
    run.seq += 1;
    const frame = (
      id: CharacterId,
    ): { seq: number; moveX: number; moveY: number; actHeld: boolean } => ({
      seq: run.seq,
      moveX: 0,
      moveY: 0,
      actHeld: opts.held?.[id] === true,
    });
    // Les scènes d'accueil de la démo ne sont pas l'objet de ces tests: on les referme.
    run.sim.world.scene = null;
    for (const v of run.sim.world.villagers) {
      const pin = run.keep.get(v.id);
      if (pin === undefined) v.visible = false;
      else {
        v.pos = { ...pin };
        v.visible = true;
      }
    }
    for (const ch of run.sim.world.characters)
      if (ch.status === 'dialogue' || ch.status === 'scene' || ch.status === 'menu') {
        ch.status = 'active';
        ch.menu = null;
      }
    step(run.sim, {
      controls: { p1: frame('p1'), p2: frame('p2') },
      intents: i === 0 ? (opts.intents ?? []) : [],
    });
    run.events.push(...run.sim.events);
  }
}

function seconds(n: number): number {
  return Math.round(n * SIM_HZ);
}

/** Règle le monde pour que les conditions du geste tiennent (saison, jour de la semaine, heure, météo). */
function setUp(run: Run, def: DecorGestureDef): void {
  const w = run.sim.world;
  w.flags.push('mill_running');
  const weathers = def.rain ? (['rain'] as const) : (['sunny', 'cloudy', 'rain'] as const);
  for (let day = 2; day <= 90; day++) {
    for (const minutes of [10 * 60, 16 * 60, 22 * 60, 3 * 60, 7 * 60, 12 * 60 + 45]) {
      for (const weather of weathers) {
        w.clock.day = day;
        w.clock.minutes = minutes;
        w.weather = weather;
        if (evaluateAll(run.sim, def.when, { ...NO_CONTEXT, actor: 'p1' })) return;
      }
    }
  }
  throw new Error(`conditions de ${def.id} jamais réunies`);
}

/** Place le joueur au lieu du geste (le premier point ou lieu), tourné vers lui; rend la position. */
function stand(
  run: Run,
  def: DecorGestureDef,
  who: CharacterId = 'p1',
  offset = 0,
): { x: number; y: number } {
  const p = def.points[0] === undefined ? def.spots[0] : run.sim.map.points[def.points[0]];
  if (p === undefined) throw new Error(`lieu de ${def.id} introuvable`);
  const c = character(run.sim, who);
  c.pos = { x: p.x - offset, y: p.y };
  c.prev = { x: c.pos.x, y: c.pos.y };
  c.facing = 0;
  return { x: p.x, y: p.y };
}

function used(run: Run, def: DecorGestureDef, who: CharacterId = 'p1'): number {
  return run.sim.world.countersToday[who][`decor:${def.id}`] ?? 0;
}

function messages(run: Run, who: CharacterId = 'p1'): string[] {
  return character(run.sim, who).notifications.map((n) => n.text);
}

function eventsOf(run: Run, type: string): WorldEvent[] {
  return run.events.filter((e) => e.type === type);
}

function def(id: string): DecorGestureDef {
  const found = GESTURES.find((g) => g.id === id);
  if (found === undefined) throw new Error(`geste ${id} absent`);
  return found;
}

function act(run: Run, who: CharacterId = 'p1'): void {
  advance(run, 1, { intents: [{ by: who, intent: { type: 'act' } }] });
}

function examine(run: Run, who: CharacterId = 'p1'): void {
  advance(run, 1, { intents: [{ by: who, intent: { type: 'examine' } }] });
}

describe('gestes de décor: les données', () => {
  it('portent les numéros 1 à 29 de la table 7.1 (le 30, le chat, est au lot du chat)', () => {
    const refs = new Set(GESTURES.map((g) => g.ref));
    for (let n = 1; n <= 29; n++) expect(refs.has(n), `geste ${String(n)}`).toBe(true);
  });

  it('citent des points de la carte, des clips connus, des sons du catalogue', () => {
    const sons = JSON.parse(
      readFileSync(fileURLToPath(new URL('../assets/son/sons.json', import.meta.url)), 'utf8'),
    ) as { sounds: Record<string, unknown> };
    for (const g of GESTURES) {
      for (const p of g.points) expect(map.points[p], `${g.id}: point ${p}`).toBeDefined();
      if (g.clip !== null) expect(ACTION_FOR_CLIP[g.clip], `${g.id}: clip ${g.clip}`).toBeDefined();
      if (g.sound !== null) expect(sons.sounds[g.sound], `${g.id}: son ${g.sound}`).toBeDefined();
      expect(
        g.lines.length === 0 && g.kind === 'plain' && g.sound === null && g.event === null,
        `${g.id}: sans retour`,
      ).toBe(false);
    }
  });

  it("n'ont ni tiret cadratin ni demi-cadratin", () => {
    expect(JSON.stringify(GESTURES)).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`, 'u'),
    );
  });
});

describe('gestes de décor: un test par geste', () => {
  it('1 well_peek: Agir se penche (son well_peek, réplique), maintenir crie (well_shout)', () => {
    const run = start();
    const peek = def('well_peek');
    setUp(run, peek);
    stand(run, peek);
    act(run);
    expect(used(run, peek)).toBe(1);
    expect(eventsOf(run, 'well_peek')).toHaveLength(1);
    expect(messages(run).length).toBeGreaterThan(0);
    advance(run, seconds(1.5), { held: { p1: true } });
    expect(eventsOf(run, 'well_shout').length).toBeGreaterThanOrEqual(1);
    expect(eventsOf(run, 'well_peek')[0]).toMatchObject({ by: 'p1' });
  });

  it('1 well_peek à deux: deux reflets, le souvenir une fois', () => {
    const run = start();
    const peek = def('well_peek');
    setUp(run, peek);
    stand(run, peek, 'p1');
    stand(run, peek, 'p2', 0.3);
    act(run, 'p1');
    advance(run, seconds(1.2));
    act(run, 'p2');
    expect(messages(run, 'p2').join(' ')).toContain('Deux têtes');
    expect(run.sim.world.flags).toContain('decor_memory:well_peek');
  });

  it('2 bell_ring: un coup, puis la main reste muette 20 s', () => {
    const run = start();
    const g = def('bell_ring');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(eventsOf(run, 'decor_gesture')).toHaveLength(1);
    expect(eventsOf(run, 'decor_gesture')[0]).toMatchObject({ sound: 'quay-bell-once', by: 'p1' });
    advance(run, seconds(3));
    act(run);
    expect(eventsOf(run, 'decor_gesture')).toHaveLength(1);
    advance(run, seconds(20));
    act(run);
    expect(eventsOf(run, 'decor_gesture')).toHaveLength(2);
  });

  it('3 station_register et 27 quay_timetable: X lit le registre, puis l’horaire, à la porte de la halte', () => {
    const run = start();
    const reg = def('station_register');
    setUp(run, reg);
    stand(run, reg);
    examine(run);
    advance(run, seconds(1.5));
    examine(run);
    advance(run, seconds(1.5));
    expect(used(run, reg)).toBe(1);
    expect(used(run, def('quay_timetable'))).toBe(1);
    expect(messages(run).join(' ')).toContain('Samedi');
  });

  it('4 skim_stone: maintenir puis relâcher lance, un événement par rebond avec at', () => {
    const run = start();
    const g = def('skim_stone');
    setUp(run, g);
    stand(run, g);
    advance(run, seconds(0.6), { held: { p1: true } });
    advance(run, seconds(2));
    expect(used(run, g)).toBe(1);
    const bounces = eventsOf(run, 'skim_stone');
    expect(bounces.length).toBeGreaterThan(0);
    for (const e of bounces)
      expect(e).toMatchObject({
        by: 'p1',
        at: { x: expect.any(Number) as number, y: expect.any(Number) as number },
      });
    expect(messages(run).join(' ')).not.toContain('quille');
  });

  it('5 apple_shake: en automne, secouer le pommier (une fois par jour)', () => {
    const run = start();
    const g = def('apple_shake');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(1);
    advance(run, seconds(6));
    act(run);
    expect(used(run, g)).toBe(1);
  });

  it('6 awning_shelter: sous la pluie, 2 s à l’abri suffisent', () => {
    const run = start();
    const g = def('awning_shelter');
    setUp(run, g);
    expect(run.sim.world.weather).toBe('rain');
    stand(run, g);
    advance(run, seconds(3));
    expect(used(run, g)).toBe(1);
    expect(messages(run).join(' ')).toContain('auvent');
  });

  it('6 awning_shelter à deux: Cœur +2 chacun, le souvenir « À l’abri »', () => {
    const run = start();
    const g = def('awning_shelter');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    const before = character(run.sim, 'p1').needs.heart;
    advance(run, seconds(3));
    expect(run.sim.world.flags).toContain('decor_memory:awning_shelter');
    expect(character(run.sim, 'p1').needs.heart).toBeGreaterThan(before);
  });

  it('7 fence_lean: s’accouder', () => {
    const run = start();
    const g = def('fence_lean');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(1);
    expect(character(run.sim, 'p1').action.kind).toBe('decor_look');
  });

  it('8 mairie_poster: X lit l’affiche de la semaine', () => {
    const run = start();
    const g = def('mairie_poster');
    setUp(run, g);
    stand(run, g);
    examine(run);
    expect(used(run, g)).toBe(1);
    expect(messages(run).join(' ')).toContain('Affiche');
  });

  it('9 dandelion_blow: au printemps ou en été, souffler; ensemble, « Deux vœux d’un coup. »', () => {
    const run = start();
    const g = def('dandelion_blow');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    act(run, 'p1');
    advance(run, seconds(0.5));
    act(run, 'p2');
    expect(used(run, g, 'p1')).toBe(1);
    expect(messages(run, 'p2').join(' ')).toContain('Deux vœux');
  });

  it('10 church_candle: un cierge par joueur et par jour, la flamme reste (drapeau du monde)', () => {
    const run = start();
    const g = def('church_candle');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(1);
    expect(decorFlagNames(run.sim.world.flags, run.sim.world.clock.day, 'decor:candle:')).toEqual([
      'p1',
    ]);
    advance(run, seconds(2));
    act(run);
    expect(used(run, g)).toBe(1);
  });

  it('11 harmonium_note: une note; ensemble, un accord', () => {
    const run = start();
    const g = def('harmonium_note');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    act(run, 'p1');
    expect(eventsOf(run, 'harmonium_note')).toHaveLength(1);
    advance(run, seconds(0.5));
    act(run, 'p2');
    expect(eventsOf(run, 'harmonium_chord')).toHaveLength(1);
  });

  it('12 bell_rope_pull: maintenir tire la corde, la volée suit, une fois par jour', () => {
    const run = start();
    const g = def('bell_rope_pull');
    setUp(run, g);
    stand(run, g);
    advance(run, seconds(1.6), { held: { p1: true } });
    expect(eventsOf(run, 'bell_rope_pull')).toHaveLength(1);
    advance(run, seconds(2));
    expect(eventsOf(run, 'bells_rung')).toHaveLength(1);
    advance(run, seconds(3), { held: { p1: true } });
    expect(eventsOf(run, 'bell_rope_pull')).toHaveLength(1);
  });

  it('13 grave_flower: une fleur de pissenlit sur la tombe, trois jours, lien avec le proche', () => {
    const run = start();
    const g = def('grave_flower_lacombe');
    setUp(run, g);
    stand(run, g);
    addToBag(run.sim, character(run.sim, 'p1'), 'dandelion', 'ordinary', 1);
    character(run.sim, 'p1').selected = character(run.sim, 'p1').bag.findIndex(
      (s) => s?.item === 'dandelion',
    );
    act(run);
    expect(used(run, g)).toBe(1);
    expect(
      decorFlagNames(run.sim.world.flags, run.sim.world.clock.day + 2, 'decor:flower:'),
    ).toEqual(['lacombe']);
    expect(
      decorFlagNames(run.sim.world.flags, run.sim.world.clock.day + 3, 'decor:flower:'),
    ).toEqual([]);
    expect(run.sim.world.bonds.firmin ?? 0).toBeGreaterThan(0);
  });

  it('14 washhouse_scrub: maintenir bat le linge, un événement par coup', () => {
    const run = start();
    const g = def('washhouse_scrub');
    setUp(run, g);
    stand(run, g);
    advance(run, seconds(3), { held: { p1: true } });
    expect(eventsOf(run, 'washhouse_scrub').length).toBeGreaterThanOrEqual(3);
  });

  it('15 pump_handle: maintenir pompe et remplit l’arrosoir', () => {
    const run = start();
    const g = def('pump_handle');
    setUp(run, g);
    stand(run, g);
    const c = character(run.sim, 'p1');
    c.water = 0;
    const slot = c.bag.findIndex((s) => s?.item === 'watering_can');
    if (slot >= 0) c.selected = slot;
    advance(run, seconds(1.5), { held: { p1: true } });
    expect(used(run, g)).toBeGreaterThanOrEqual(1);
    if (slot >= 0) expect(c.water).toBeGreaterThan(0);
  });

  it('16 millwheel_watch: s’asseoir 10 s, Repos +5 une fois par jour', () => {
    const run = start();
    const g = def('millwheel_watch');
    setUp(run, g);
    stand(run, g);
    const before = character(run.sim, 'p1').endurance;
    act(run);
    advance(run, seconds(11));
    expect(used(run, g)).toBe(1);
    expect(character(run.sim, 'p1').endurance).toBeGreaterThan(before);
  });

  it('17 cafe_coffee: 2 aubrins, tasse fumante, Repos +10; deux cafés ensemble: Cœur +5', () => {
    const run = start();
    const g = def('cafe_coffee');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    const colette = run.sim.world.villagers.find((v) => v.id === 'colette');
    if (colette === undefined) throw new Error('colette absente');
    colette.visible = true;
    colette.pos = { x: character(run.sim, 'p1').pos.x, y: character(run.sim, 'p1').pos.y + 4 };
    run.keep.set('colette', { ...colette.pos });
    const purse = run.sim.world.purse;
    act(run, 'p1');
    advance(run, seconds(0.3));
    act(run, 'p2');
    expect(run.sim.world.purse).toBe(purse - 4);
    expect(messages(run, 'p1').join(' ')).toContain('Deux cafés');
  });

  it('17 cafe_coffee: sans Colette, rien à servir', () => {
    const run = start();
    const g = def('cafe_coffee');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(0);
  });

  it('18 skittles_throw: le dimanche à 15 h, lancer donne un score', () => {
    const run = start();
    const g = def('skittles_throw');
    setUp(run, g);
    stand(run, g);
    advance(run, seconds(0.7), { held: { p1: true } });
    advance(run, seconds(1));
    expect(used(run, g)).toBe(1);
    expect(messages(run).join(' ')).toMatch(/quilles?\./u);
  });

  it('19 lookout_shout: crier au belvédère', () => {
    const run = start();
    const g = def('lookout_shout');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(eventsOf(run, 'lookout_shout')).toHaveLength(1);
    expect(eventsOf(run, 'lookout_shout')[0]).toMatchObject({ by: 'p1' });
  });

  it('20 oak_knock: frapper le chêne, repos de 5 minutes', () => {
    const run = start();
    const g = def('oak_knock');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(eventsOf(run, 'decor_gesture')).toHaveLength(1);
    advance(run, seconds(10));
    act(run);
    expect(eventsOf(run, 'decor_gesture')).toHaveLength(1);
  });

  it('21 spring_drink: boire à la source, Repos +5 la première fois du jour', () => {
    const run = start();
    const g = def('spring_drink');
    setUp(run, g);
    stand(run, g);
    const before = character(run.sim, 'p1').endurance;
    act(run);
    expect(character(run.sim, 'p1').endurance).toBe(before + 5);
    advance(run, seconds(8));
    act(run);
    expect(character(run.sim, 'p1').endurance).toBe(before + 5);
  });

  it('22 bench_carve: il faut les deux joueurs, dans les 5 s; les initiales restent', () => {
    const run = start();
    const g = def('bench_carve');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    advance(run, seconds(1.5), { held: { p1: true } });
    expect(run.sim.world.flags).not.toContain('decor:carved');
    advance(run, seconds(1.5), { held: { p2: true } });
    expect(run.sim.world.flags).toContain('decor:carved');
    expect(messages(run, 'p1').join(' ')).toContain('gravées');
  });

  it('22 bench_carve: seul, rien n’est gravé', () => {
    const run = start();
    const g = def('bench_carve');
    setUp(run, g);
    stand(run, g, 'p1');
    advance(run, seconds(1.5), { held: { p1: true } });
    advance(run, seconds(7));
    advance(run, seconds(1.5), { held: { p1: true } });
    expect(run.sim.world.flags).not.toContain('decor:carved');
  });

  it('23 leaf_pile: en automne, sauter dans le tas', () => {
    const run = start();
    const g = def('leaf_pile');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(1);
  });

  it('24 puddle_jump: sous la pluie, sauter dans la flaque', () => {
    const run = start();
    const g = def('puddle_jump');
    setUp(run, g);
    stand(run, g);
    act(run);
    expect(used(run, g)).toBe(1);
    expect(eventsOf(run, 'decor_gesture')[0]).toMatchObject({ sound: 'fishing-splash' });
  });

  it('25 weathervane: lit la météo de demain (juste quatre fois sur cinq), puis « n’a pas bougé »', () => {
    const run = start();
    const g = def('weathervane');
    setUp(run, g);
    run.sim.world.weatherTomorrow = 'rain';
    stand(run, g);
    examine(run);
    expect(used(run, g)).toBe(1);
    advance(run, seconds(2));
    examine(run);
    expect(messages(run).join(' ')).toContain('Le coq n’a pas bougé'.replace('’', "'"));
    // Sur 40 jours, la girouette dit juste environ quatre fois sur cinq.
    let right = 0;
    const seen: string[] = [];
    for (let day = 1; day <= 40; day++) {
      const r = start();
      setUp(r, g);
      r.sim.world.seed = 1000 + day;
      r.sim.world.weatherTomorrow = 'rain';
      stand(r, g);
      character(r.sim, 'p1').notifications.length = 0;
      examine(r);
      seen.push(
        messages(r)
          .filter((t) => t.startsWith('Le coq'))
          .join('|')
          .slice(0, 40),
      );
      if (messages(r).join(' ').includes("l'ouest")) right += 1;
    }
    expect(right, JSON.stringify(seen)).toBeGreaterThan(24);
    expect(right).toBeLessThan(40);
  });

  it('26 hay_nap: s’allonger dans le foin, Repos +10', () => {
    const run = start();
    const g = def('hay_nap');
    setUp(run, g);
    stand(run, g);
    const before = character(run.sim, 'p1').endurance;
    act(run);
    advance(run, seconds(5));
    expect(used(run, g)).toBe(1);
    expect(character(run.sim, 'p1').endurance).toBe(before + 10);
  });

  it('28 stepping_stones: trois sauts en rythme, un retard fait « Plouf. »', () => {
    const run = start();
    const g = def('stepping_stones');
    setUp(run, g);
    stand(run, g);
    act(run);
    advance(run, seconds(0.8));
    act(run);
    advance(run, seconds(0.8));
    act(run);
    expect(used(run, g)).toBe(1);
    expect(messages(run).join(' ')).toContain('pieds secs');
    const slow = start();
    setUp(slow, g);
    stand(slow, g);
    act(slow);
    advance(slow, seconds(3));
    act(slow);
    expect(messages(slow).join(' ')).toContain('Plouf');
    expect(used(slow, g)).toBe(0);
  });

  it('29 postcard_rack: X fait tourner le tourniquet, une carte après l’autre', () => {
    const run = start();
    const g = def('postcard_rack');
    setUp(run, g);
    stand(run, g);
    examine(run);
    advance(run, seconds(1.5));
    examine(run);
    const cards = messages(run).filter((t) => t.startsWith('Carte postale'));
    expect(cards).toHaveLength(2);
    expect(cards[0]).not.toBe(cards[1]);
  });

  it('31 mill_sluice: la vanne se lève à deux (sluice_opened)', () => {
    const run = start();
    const g = def('mill_sluice');
    setUp(run, g);
    stand(run, g, 'p1');
    stand(run, g, 'p2', 0.3);
    act(run, 'p1');
    expect(eventsOf(run, 'sluice_opened')).toHaveLength(0);
    advance(run, seconds(1));
    act(run, 'p2');
    expect(eventsOf(run, 'sluice_opened')).toHaveLength(1);
  });
});

describe('gestes de décor: visée et invite', () => {
  it('le geste visé donne le verbe decor et son invite, à la souris comme à la touche', () => {
    const run = start();
    const g = def('church_candle');
    setUp(run, g);
    stand(run, g);
    const c = character(run.sim, 'p1');
    const best = bestTarget(run.sim, c);
    expect(best?.target.kind).toBe('decor');
    expect(best?.verb).toBe('decor');
    advance(run, 2);
    expect(c.aim?.verb).toBe('decor');
    expect(c.aim?.label).toBe('Allumer un cierge');
    // Le survol de loin (à 1 m du point) vise aussi le geste.
    const at = decorTargets(run.sim, c, { at: { x: c.pos.x + 1, y: c.pos.y }, radius: 1.2 });
    expect(at[0]?.gesture).toBe('church_candle');
    const target = bestTarget(run.sim, c)?.target;
    if (target !== undefined) expect(verbOf(run.sim, c, target)).toBe('decor');
  });

  it('hôte et invité voient la même chose: le monde porte les drapeaux et les gestes', () => {
    const run = start();
    const g = def('church_candle');
    setUp(run, g);
    stand(run, g);
    act(run);
    const sent = JSON.parse(JSON.stringify(run.sim.world)) as typeof run.sim.world;
    expect(decorFlagNames(sent.flags, sent.clock.day, 'decor:candle:')).toEqual(['p1']);
    expect(sent.characters[0]?.action.kind).toBe('decor_offer');
  });
});
