// Recette du tour 6 (qa-testeur, 2026-10-31): critères M-01 et M-06 rendus testables, et tests
// des bugs relevés en revue adverse (QA6-01 à QA6-04, `docs/jeux/jeu-1/recette/2026-10-31-tour-06.md`).
// Un bug connu sans correctif est un `it.fails`: la CI reste verte et le test échoue dès la
// correction (le passer alors en `it`).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import { momentDef, sampleTrack } from '../src/etat/moments';
import type { MomentToday } from '../src/etat/types';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { newToday } from '../src/simulation/moments';
import { captureBaselines } from '../src/simulation/conditions';
import { createRandom } from '@duo/sdk/sim';
import soundsFile from '../assets/son/sons.json';
import { parseCatalogue } from '../src/audio/catalogue';
import { MomentSounds } from '../src/audio/moments';
import { AUDIO_SETTINGS } from '../src/audio/reglages';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play } from './aides';

const ROOT = join(import.meta.dirname, '..');

/** Acteurs dessinés sans modèle de `index.json` (effet procédural), avec le fichier qui les dessine. */
const PROCEDURAL_ACTORS: Readonly<Record<string, string>> = { glowworm_light: 'src/rendu/vers-luisants.ts', mist_bank: 'src/rendu/brume.ts' };

function json(path: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as unknown;
}

function soundIds(): Set<string> {
  const raw = json('assets/son/sons.json') as { sounds: Record<string, unknown> };
  return new Set(Object.keys(raw.sounds));
}

function textKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (value: unknown): void => {
    if (typeof value !== 'object' || value === null) return;
    for (const [k, v] of Object.entries(value)) {
      keys.add(k);
      walk(v);
    }
  };
  walk(json('donnees/textes.json'));
  return keys;
}

describe('M-01: chaque moment P0 a un modèle, un son d’attente et un son d’apogée, et des textes valides', () => {
  const { content } = contentAndMap();
  const models = new Set(Object.keys(json('assets/modeles/index.json') as Record<string, unknown>));
  const sounds = soundIds();
  const texts = textKeys();
  const p0 = content.moments.filter((m) => m.tier === 'P0');

  it('au moins 6 moments P0', () => {
    expect(p0.length).toBeGreaterThanOrEqual(6);
  });

  for (const def of p0) {
    it(`${def.id}: modèles livrés (ou effet procédural déclaré), sons dans sons.json, textes présents`, () => {
      for (const actor of def.actors) {
        if (actor.villager !== null) continue;
        const procedural = PROCEDURAL_ACTORS[actor.model];
        if (procedural !== undefined) expect(statSync(join(ROOT, procedural)).isFile(), procedural).toBe(true);
        else expect(models.has(actor.model), `modèle ${actor.model}`).toBe(true);
      }
      const named = [...def.sounds.idle.map((s) => s.id), ...def.climax.sounds.map(([, n]) => n)];
      for (const name of named) expect(sounds.has(name.replaceAll('_', '-')) || sounds.has(name), `son ${name}`).toBe(true);
      expect(def.climax.sounds.length, 'au moins un son daté à l’apogée').toBeGreaterThan(0);
      for (const key of [def.texts.climax, def.texts.memory, def.texts.hint]) if (key !== null) expect(texts.has(key), `texte ${key}`).toBe(true);
    });
  }
});

describe('QA6-01: les places de l’échelle citées dans le code existent sur la carte', () => {
  it('chaque « ladder_hold_* » des sources, tests et scénarios est un point de la carte, avec son cap', () => {
    const { map, content } = contentAndMap();
    const ladder = content.moments.find((m) => m.id === 'ladder');
    const places = ladder?.watch.hold ?? [];
    expect(places.length).toBe(2);
    for (const p of places) {
      expect(map.points[p], p).toBeDefined();
      expect(map.pointFacings[p], `cap de ${p}`).toBeDefined();
    }
    const found = new Map<string, string>();
    const scan = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') continue;
        if (statSync(path).isDirectory()) scan(path);
        else if (/\.(ts|json)$/.test(name)) for (const m of readFileSync(path, 'utf8').matchAll(/ladder_hold_[a-z]+/g)) found.set(m[0], path);
      }
    };
    scan(join(ROOT, 'src'));
    scan(join(ROOT, 'tests'));
    scan(join(ROOT, 'donnees'));
    // Les clés de messages (`ladder_hold_on`, `ladder_hold_taken`) ne sont pas des places.
    const messages = textKeys();
    const unknown = [...found].filter(([id]) => map.points[id] === undefined && !messages.has(id)).map(([id, path]) => `${id} (${path.slice(ROOT.length + 1)})`);
    expect(unknown).toEqual([]);
  });
});

describe('M-06: le texte d’apogée ne décrit rien qui ne se voie (relecture outillée)', () => {
  // Les autres affirmations ont été relues à la main contre la chorégraphie et les sons
  // (rapport de recette, tableau M-06). QA6-03: l'oie de tête ne passe jamais à moins de 5 m
  // du banc de la berge; le texte a été corrigé plutôt que la trajectoire (décision du manager).
  it('QA6-03 oies: le texte ne dit plus qu’elles passent juste au-dessus de vous, et dit vrai sur la berge', () => {
    const { content, map } = contentAndMap();
    const def = momentDef(content, 'geese');
    const track = def?.climax.keyframes.goose;
    const rest = map.points.geese_rest;
    const bench = map.props.find((p) => p.id === 'riverbank_bench');
    if (def === null || track === undefined || rest === undefined || bench === undefined) throw new Error('oies ou banc absents');
    const text = content.texts.messages.geese_seen ?? '';
    expect(text).not.toContain('au-dessus de vous');
    expect(text).toContain('au-dessus de la berge');
    let overBank = false;
    for (let t = 0; t <= def.climax.seconds; t += 0.05) {
      const p = sampleTrack(track, t, { x: rest.x, y: rest.y, z: 0 });
      if (p.z >= 1 && Math.hypot(p.x - bench.pos.x, p.y - bench.pos.y) < 12) overBank = true;
    }
    expect(overBank).toBe(true);
  });
});

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function readySim(): Sim {
  const sim = newSim(5);
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

function setMoment(sim: Sim, id: string, minutes: number): MomentToday {
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  sim.world.clock.minutes = minutes;
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  sim.world.moments.today = today;
  return today;
}

describe('QA6-04: une bête en attente ne traverse pas un joueur', () => {
  it('héron timide: un joueur debout là où le héron fait son pas de côté en est écarté (rayon de collision et corps)', () => {
    const sim = readySim();
    const today = setMoment(sim, 'heron', 15 * 60);
    const actor = momentDef(sim.content, 'heron')?.actors.find((a) => a.id === 'heron');
    const stepTo = actor?.shy?.stepTo;
    if (actor === undefined || stepTo === undefined || stepTo === null) throw new Error('pas de côté du héron absent');
    const at = { x: stepTo[0], y: stepTo[1] + 0.1 };
    const p1 = character(sim, 'p1');
    placeCharacter(sim, p1, at);
    placeCharacter(sim, character(sim, 'p2'), { x: 22.5, y: 35.5 });
    for (let i = 0; i < SIM_HZ * 3; i++) step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    // Le joueur est assez près pour effaroucher le héron: le rendu le fait reculer jusqu'à `stepTo`.
    expect(today.shyUntil).toBeGreaterThan(sim.world.tick);
    const reach = actor.collisionRadius + 0.3;
    expect(Math.hypot(p1.pos.x - stepTo[0], p1.pos.y - stepTo[1])).toBeGreaterThanOrEqual(reach - 1e-6);
  });
});

describe('QA6-06: l’échelle lâchée pour de bon ne fige pas l’apogée jusqu’au soir', () => {
  it('après l’heure de départ (18 h), l’apogée de l’échelle abandonnée se termine et la musique remonte', () => {
    const sim = readySim();
    const quest = sim.content.quests.find((q) => q.id === 'basile_lost');
    const help = quest?.steps[1];
    if (help === undefined) throw new Error('basile_lost absente');
    sim.world.quests.push({ id: 'basile_lost', status: 'active', step: 1, checklist: [], baselines: captureBaselines(sim, help.conditions), startedDay: 1 });
    const today = setMoment(sim, 'ladder', 13 * 60);
    today.origin = 'quest';
    sim.world.clock.running = false;
    placeCharacter(sim, character(sim, 'p1'), { x: 50.5, y: 7.3 });
    placeCharacter(sim, character(sim, 'p2'), { x: 52.3, y: 5.5 });
    for (const by of ['p1', 'p2'] as const) step(sim, { controls: { p1: still(0), p2: still(0) }, intents: [{ by, intent: { type: 'act' } }] });
    for (let i = 0; i < SIM_HZ * 2; i++) step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    expect(today.phase).toBe('climax');
    // Les deux lâchent et s'en vont (la quête est déjà finie, la notification d'apogée déjà lue).
    for (let i = 0; i < SIM_HZ * 3; i++) step(sim, { controls: { p1: { seq: i, moveX: -1, moveY: 0, actHeld: false }, p2: { seq: i, moveX: 0, moveY: 1, actHeld: false } }, intents: [] });
    expect(today.paused).toBe(true);
    // Le soir venu, bien après `present.to` (18 h).
    sim.world.clock.minutes = 19 * 60;
    sim.world.clock.running = true;
    for (let i = 0; i < SIM_HZ * 2; i++) step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    const sounds = new MomentSounds(parseCatalogue(soundsFile), AUDIO_SETTINGS, sim.content, sim.map, createRandom(1));
    sounds.update(sim.world, 0, [], [], []);
    expect(sounds.duckDb(), 'musique toujours baissée').toBe(0);
    expect(today.phase).not.toBe('climax');
  });
});
