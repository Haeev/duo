// Moments du tour 9 (docs/jeux/jeu-1/tour-09-conception.md, section 4; critères T9-22 à T9-25):
// les étoiles de l'Aubrune (assis au bord du ponton), le salut du mécanicien (les deux manivelles,
// le départ au pas), la dame blanche (côte à côte, immobiles) et les lanternes (allumer au même
// instant). Monde réel de l'été (mardi 25) avancé à la main.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import { armedCells, momentDef } from '../src/etat/moments';
import type { CharacterId, MomentToday, Vec2, WorldEvent } from '../src/etat/types';
import { decodeSave, restoreWorld } from '../src/sauvegarde/sauvegarde';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { isBlockedCell } from '../src/simulation/grille';
import { cooldownOf, newToday } from '../src/simulation/moments';
import { step } from '../src/simulation/pas';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const HOUR = 60;

function world(day: number, minutes: number, slowRoll = true): Sim {
  const { content, map } = contentAndMap();
  const c = structuredClone(content);
  c.settings.train.saluteSlowRoll = slowRoll;
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL('./donnees/sauvegardes/format-5-ete-jour-25.json', import.meta.url)), 'utf8')) as { dataSchema: number; data: unknown };
  const sim = restoreWorld(c, map, decodeSave(raw.data), raw.dataSchema, [A, B]);
  sim.world.clock.day = day;
  sim.world.clock.minutes = minutes;
  sim.world.weather = 'sunny';
  // Le monde avancé à la main: l'étape de l'été franchie, la commande en cours pour le samedi suivant.
  sim.world.stages.passed = ['demo', 'summer_end'];
  const train = day + ((7 - ((day - 1) % 7)) % 7 || 7);
  if (sim.world.order.generated !== null) sim.world.order.generated.train = train;
  for (const q of sim.world.quests) if (q.id === 'weekly_order') q.train = train;
  for (const ch of sim.world.characters) {
    ch.status = 'active';
    ch.menu = null;
    ch.dialogue = null;
    ch.seat = null;
    ch.inHouse = false;
    ch.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  return sim;
}

function setMoment(sim: Sim, id: string): MomentToday {
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  sim.world.moments.today = today;
  return today;
}

function place(sim: Sim, id: CharacterId, at: Vec2): void {
  placeCharacter(sim, character(sim, id), at);
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function wait(sim: Sim, seconds: number, intents: (i: number) => { by: CharacterId; intent: { type: 'act' } }[] = () => []): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    step(sim, { controls: { p1: still(i), p2: still(i) }, intents: intents(i) });
    events.push(...sim.events);
  }
  return events;
}

const climax = (events: WorldEvent[]): boolean => events.some((e) => e.type === 'moment_climax');

function pointOf(sim: Sim, id: string): Vec2 {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id} absent`);
  return p;
}

describe('la dame blanche (T9-24)', () => {
  it('rien à plus de 1,8 m l’un de l’autre; côte à côte, immobiles, entre 3 et 5,5 m, 3 s: l’apogée', () => {
    const sim = world(45, 19 * HOUR + 10);
    setMoment(sim, 'barn_owl');
    const anchor = pointOf(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: anchor.x - 4, y: anchor.y });
    place(sim, 'p2', { x: anchor.x - 4, y: anchor.y + 2.5 });
    expect(climax(wait(sim, 4))).toBe(false);
    place(sim, 'p2', { x: anchor.x - 4, y: anchor.y + 1.2 });
    const events = wait(sim, 3.5);
    expect(climax(events)).toBe(true);
  });

  it('jamais sous la pluie (disponibilité)', () => {
    const def = momentDef(contentAndMap().content, 'barn_owl');
    const rain = JSON.stringify(def?.availableWhen);
    expect(rain).toContain('sunny');
    expect(rain).not.toContain('rain');
  });
});

describe('les lanternes du quai (T9-25)', () => {
  it('deux allumages à moins de 0,8 s: l’apogée; à plus de 0,8 s, la flamme s’éteint et l’on recommence', () => {
    const sim = world(45, 19 * HOUR + 5);
    setMoment(sim, 'quay_lanterns');
    place(sim, 'p1', pointOf(sim, 'lantern_quay'));
    place(sim, 'p2', pointOf(sim, 'lantern_square'));
    // Seul: la flamme vacille et s'éteint.
    let events = wait(sim, 2, (i) => (i === 0 ? [{ by: 'p1', intent: { type: 'act' } }] : []));
    expect(events.some((e) => e.type === 'lantern_lit')).toBe(true);
    expect(events.some((e) => e.type === 'lantern_out')).toBe(true);
    expect(climax(events)).toBe(false);
    // Trop tard: 1 s d'écart.
    events = wait(sim, 3, (i) => (i === 0 ? [{ by: 'p1', intent: { type: 'act' } }] : i === SIM_HZ ? [{ by: 'p2', intent: { type: 'act' } }] : []));
    expect(climax(events)).toBe(false);
    // Ensemble, à 0,4 s d'écart.
    events = wait(sim, 2, (i) => (i === 0 ? [{ by: 'p1', intent: { type: 'act' } }] : i === 12 ? [{ by: 'p2', intent: { type: 'act' } }] : []));
    expect(climax(events)).toBe(true);
  });

  it('sans apogée, le moment part à 19 h 45, sans texte', () => {
    const sim = world(45, 19 * HOUR + 44);
    setMoment(sim, 'quay_lanterns');
    wait(sim, 30);
    expect(['left', 'gone']).toContain(sim.world.moments.today?.phase);
  });
});

describe('le salut du mécanicien (T9-23, M-20)', () => {
  for (const slowRoll of [true, false]) {
    it(`les deux manivelles tenues 1 s arment; les cases de la traversée se ferment; à 16 h, l’apogée et le départ ${slowRoll ? 'au pas (20 s)' : 'ordinaire (6 s)'}`, () => {
      const sim = world(29, 15 * HOUR + 30, slowRoll);
      sim.world.train = { phase: 'stopped', progress: 1, prevProgress: 1 };
      const today = setMoment(sim, 'train_salute');
      // Un joueur au milieu de la traversée est poussé vers le quai à l'armement.
      place(sim, 'p1', pointOf(sim, 'gate_north_crank'));
      place(sim, 'p2', pointOf(sim, 'gate_south_crank'));
      step(sim, { controls: {}, intents: [{ by: 'p1', intent: { type: 'act' } }, { by: 'p2', intent: { type: 'act' } }] });
      expect(sim.world.characters.map((c) => c.holding)).toEqual(['gate_north_crank', 'gate_south_crank']);
      const events = wait(sim, 1.5);
      expect(events.some((e) => e.type === 'moment_armed')).toBe(true);
      expect(today.armedTick).not.toBeNull();
      expect(armedCells(sim.content, today)).not.toBeNull();
      expect(isBlockedCell(refreshBlockers(sim), 18, 13)).toBe(true);
      // Jusqu'au départ.
      sim.world.clock.minutes = 15 * HOUR + 59.9;
      const later = wait(sim, 2);
      expect(climax(later)).toBe(true);
      expect(sim.world.train.phase).toBe('departing');
      expect(sim.world.train.slow === true).toBe(slowRoll);
      // Les lisses remontent à 18 s de l'apogée.
      wait(sim, 19);
      expect(isBlockedCell(refreshBlockers(sim), 18, 13)).toBe(false);
    });
  }

  it('un samedi sur deux au plus (fenêtre propre de 14 jours)', () => {
    const sim = world(29, 10 * HOUR);
    const def = momentDef(sim.content, 'train_salute');
    if (def === null) return;
    expect(cooldownOf(sim, def)).toBe(14);
    const heron = momentDef(sim.content, 'heron');
    if (heron === null) return;
    expect(cooldownOf(sim, heron)).toBe(16);
  });
});

describe('les étoiles de l’Aubrune (T9-22)', () => {
  it('assis tous deux au bord du ponton, 3 s, dans la fenêtre: l’apogée', () => {
    const sim = world(30, 22 * HOUR + 5);
    setMoment(sim, 'falling_stars');
    for (const [id, slot] of [['p1', 0], ['p2', 1]] as const) {
      place(sim, id, pointOf(sim, 'fishing_pontoon'));
      step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'move_to', target: { kind: 'ground', x: 44.5 + slot, y: 39.8 }, act: true } }] });
      wait(sim, 1);
    }
    expect(sim.world.characters.map((c) => c.seat?.bench)).toEqual(['pontoon_edge', 'pontoon_edge']);
    expect(climax(wait(sim, 3.5))).toBe(true);
  });
});
