/**
 * Ligne d'observation des moments du tour 7 (critères M-26 et M-27, tour-07-conception.md,
 * section 7.4): la brume (un sur chaque rive, face à face) et la chevrette (« un, deux, trois,
 * soleil »). La ligne dit ce que la simulation attend, et l'anneau ne paraît que quand elle compte;
 * des parties de robots le vérifient à chaque pas, chez les deux.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { createRandom } from '@duo/sdk/sim';
import type { ControlFrame } from '../../etat/actions';
import { activeWatch, freezeState, momentDef, watchTarget } from '../../etat/moments';
import type { CharacterId, MomentToday, Vec2 } from '../../etat/types';
import { type Sim, createRuntime } from '../../simulation/contexte';
import { placeCharacter } from '../../simulation/deplacement';
import { bankSide, newToday, watchPart } from '../../simulation/moments';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';
import { setupScenario } from '../demo/scenarios';
import { type WatchModel, bankOf, watchModel } from '../modele-moments';
import { character, playUntil, started, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2019/g, "'");
const IDS = ['p1', 'p2'] as const;

let base: Sim;
/** L'aube du jour 2 (la maison du jour 1 est bâtie: les robots sont libres d'aller voir le moment). */
let dawn: Sim;

function copyOf(from: Sim): Sim {
  const world = structuredClone(from.world);
  return {
    ...from,
    world,
    rng: createRandom(world.rng),
    events: [],
    runtime: createRuntime(from.map),
  };
}

beforeAll(() => {
  base = started();
  playUntil(
    base,
    (s) =>
      s.world.phase === 'day' &&
      s.world.clock.running &&
      s.world.scene === null &&
      s.world.scripts.length === 0,
  );
  dawn = copyOf(base);
  playUntil(
    dawn,
    (s) => s.world.clock.day === 2 && s.world.phase === 'day' && s.world.clock.running,
  );
}, 300_000);

/** Les robots du jeu à l'aube du jour 2, le moment `id` tiré ce matin-là (il arrive à son heure). */
function robotSim(id: string): Sim {
  const sim = copyOf(dawn);
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  sim.world.moments.today = newToday(sim, def, 'ambient');
  return sim;
}

/** Jour 1, les deux libres et dehors, le moment `id` en attente à `minutes`. */
function momentSim(id: string, minutes: number): { sim: Sim; today: MomentToday } {
  const sim = copyOf(base);
  sim.world.beam = null;
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  sim.world.clock.minutes = minutes;
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  today.phaseTick = sim.world.tick;
  sim.world.moments.today = today;
  return { sim, today };
}

function place(sim: Sim, id: CharacterId, at: Vec2, lookAt: Vec2): void {
  const c = character(sim, id);
  placeCharacter(sim, c, at);
  c.facing = Math.atan2(lookAt.y - at.y, lookAt.x - at.x);
  c.speed = 0;
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function wait(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 30); i++)
    step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
}

function model(sim: Sim, me: CharacterId): WatchModel | null {
  return watchModel(sim.world, uiContext(me));
}

function line(sim: Sim, me: CharacterId): string | null {
  const l = model(sim, me)?.line ?? null;
  return l === null ? null : plain(l);
}

/** Texte des données, formaté comme l'interface le formate. */
function text(sim: Sim, me: CharacterId, key: string, partner = true): string {
  const ctx = uiContext(me);
  const name = character(sim, ctx.partner).name;
  return plain(
    ctx.t(sim.content.texts.messages[key] ?? `(${key} absent)`, partner ? { partner: name } : {}),
  );
}

function point(sim: Sim, id: string): Vec2 {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id}`);
  return p;
}

// Positions du test M-18 (tests/moments-tour7.test.ts).
const NORTH = { x: 29.5, y: 38.5 };
const SOUTH = { x: 29.5, y: 42.5 };
const MIST_AT = 6 * 60 + 10;

describe('la brume: une rive chacun, face à face (M-26)', () => {
  it('même rive, face à face et immobiles: les deux lisent qu’il faut passer le gué, jamais « Sans bouger... », pas d’anneau', () => {
    const { sim, today } = momentSim('mist', MIST_AT);
    place(sim, 'p1', NORTH, { x: 31.5, y: 38.5 });
    place(sim, 'p2', { x: 31.5, y: 38.5 }, NORTH);
    for (let s = 0; s < 5; s++) {
      wait(sim, 1);
      expect(today.watching, 'chacun remplit sa part').toEqual({ p1: true, p2: true });
      expect(today.watchTicks, 'la simulation ne compte pas').toBe(0);
      for (const me of IDS) {
        expect(line(sim, me)).toBe(text(sim, me, 'moment_opposite_same_bank'));
        expect(model(sim, me)?.ring ?? null).toBeNull();
      }
    }
    expect(line(sim, 'p1')).toBe(
      "Sacha est sur la même rive que toi : passe sur l'autre par le gué, ou attends que Sacha y passe.",
    );
  });

  it('même rive, l’un de dos: la rive passe avant la pose, chez les deux', () => {
    const { sim } = momentSim('mist', MIST_AT);
    place(sim, 'p1', NORTH, { x: 29.5, y: 30 });
    place(sim, 'p2', { x: 31.5, y: 38.5 }, NORTH);
    wait(sim, 1);
    for (const me of IDS) expect(line(sim, me)).toBe(text(sim, me, 'moment_opposite_same_bank'));
  });

  it('deux rives, l’un de dos: lui lit « Tourne-toi vers... », l’autre que son partenaire n’est pas en place', () => {
    const { sim, today } = momentSim('mist', MIST_AT);
    place(sim, 'p1', NORTH, SOUTH);
    place(sim, 'p2', SOUTH, { x: 29.5, y: 46 });
    wait(sim, 1);
    expect(today.watching).toEqual({ p1: true, p2: false });
    expect(line(sim, 'p2')).toBe('Tourne-toi vers Camille.');
    expect(line(sim, 'p2')).toBe(text(sim, 'p2', 'moment_face_partner'));
    expect(model(sim, 'p2')?.detail ?? '').toBe(
      uiContext('p2').t(uiContext('p2').texts.extra.moments.partnerReady, { partner: 'Camille' }),
    );
    expect(line(sim, 'p1')).toBe('Sacha est là, mais pas encore en place.');
    for (const me of IDS) expect(model(sim, me)?.ring ?? null).toBeNull();
  });

  it('deux rives, face à face: « Sans bouger... » et l’anneau qui se remplit chez les deux, puis l’apogée', () => {
    const { sim, today } = momentSim('mist', MIST_AT);
    place(sim, 'p1', NORTH, SOUTH);
    place(sim, 'p2', SOUTH, NORTH);
    wait(sim, 1);
    const first = model(sim, 'p1')?.ring ?? 0;
    expect(first).toBeGreaterThan(0);
    wait(sim, 1);
    for (const me of IDS) {
      expect(line(sim, me)).toBe(text(sim, me, 'moment_watch_self', false));
      expect(model(sim, me)?.ring ?? 0).toBeGreaterThan(first);
    }
    wait(sim, 1.2);
    expect(today.phase).toBe('climax');
    for (const me of IDS) expect(model(sim, me)?.tone).toBe('climax');
  });

  it('même règle des rives que la simulation', () => {
    const { sim } = momentSim('mist', MIST_AT);
    const o = momentDef(sim.content, 'mist')?.watch.opposite ?? null;
    if (o === null) throw new Error('brume sans rives');
    for (let y = 36; y <= 45; y += 0.25)
      expect(bankOf({ x: 29.5, y }, o)).toBe(bankSide({ x: 29.5, y }, o));
  });
});

const DEER_AT = 6 * 60 + 10;

/** Pas jusqu'au prochain regard de la chevrette. */
function ticksToLook(sim: Sim, today: MomentToday): number {
  const def = momentDef(sim.content, today.id);
  const freeze = def?.watch.freeze ?? null;
  if (def === null || freeze === null) throw new Error('chevrette sans « freeze »');
  for (let k = 0; k < 30 * 60; k++)
    if (freezeState(def, freeze, today, sim.world.tick + k, sim.world.seed).kind === 'look')
      return k;
  throw new Error('aucun regard en 60 s');
}

describe('la chevrette: elle broute, elle regarde, effarouchée (M-27)', () => {
  it('elle broute: « tu peux bouger » chez qui est à moins de 8 m, avec « approche-toi » au-delà de 5,5 m, sans anneau', () => {
    const { sim, today } = momentSim('roe_deer', DEER_AT);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 7, y: deer.y }, deer);
    wait(sim, 1);
    expect(today.watching.p1).toBe(true);
    expect(line(sim, 'p1')).toBe('Elle broute : tu peux bouger.');
    expect(model(sim, 'p1')?.detail ?? null).toBeNull();
    expect(line(sim, 'p2')).toBe(text(sim, 'p2', 'moment_freeze_graze', false));
    expect(plain(model(sim, 'p2')?.detail ?? '')).toBe('Approche-toi encore un peu.');
    for (const me of IDS) expect(model(sim, me)?.ring ?? null).toBeNull();
    // Bien au-delà de 8 m: rien.
    place(sim, 'p2', { x: deer.x - 9, y: deer.y }, deer);
    wait(sim, 0.1);
    expect(model(sim, 'p2')).toBeNull();
  });

  it('elle regarde, les deux en place: « Sans bouger... » et l’anneau tout de suite, chez les deux', () => {
    const { sim, today } = momentSim('roe_deer', DEER_AT);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 3.5, y: deer.y - 2 }, deer);
    wait(sim, (ticksToLook(sim, today) + 15) / 30);
    for (const me of IDS) {
      const m = model(sim, me);
      expect(m?.tone).toBe('together');
      expect(m?.instant, 'sans le délai de stabilisation').toBe(true);
      expect(m?.ring ?? 0).toBeGreaterThan(0);
    }
  });

  it('elle regarde, l’autre hors de portée: « Ne bouge plus: elle regarde ! » chez les deux, sans anneau', () => {
    const { sim, today } = momentSim('roe_deer', DEER_AT);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 7, y: deer.y }, deer);
    wait(sim, (ticksToLook(sim, today) + 10) / 30);
    expect(today.watchTicks).toBe(0);
    expect(line(sim, 'p1')).toBe('Ne bouge plus : elle regarde !');
    expect(plain(model(sim, 'p1')?.detail ?? '')).toBe('Sacha est là, mais pas encore en place.');
    expect(line(sim, 'p2')).toBe(text(sim, 'p2', 'moment_freeze_look', false));
    for (const me of IDS) {
      expect(model(sim, me)?.tone).toBe('alert');
      expect(model(sim, me)?.ring ?? null).toBeNull();
    }
    // Qui bouge pendant un regard (vu avant que la simulation ne l'ait compté): le même avertissement.
    character(sim, 'p1').speed = 1.2;
    expect(line(sim, 'p1')).toBe('Ne bouge plus : elle regarde !');
  });

  it('effarouchée: la ligne dit d’attendre qu’elle broute, chez les deux, puis « tu peux bouger » revient', () => {
    const { sim, today } = momentSim('roe_deer', DEER_AT);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p1', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p2', { x: deer.x - 5, y: deer.y - 2 }, deer);
    wait(sim, (ticksToLook(sim, today) + 10) / 30);
    for (let i = 0; i < 6; i++)
      step(sim, {
        controls: { p1: still(i), p2: { seq: i, moveX: 0, moveY: 1, actHeld: false } },
        intents: [],
      });
    expect(today.shyUntil).toBeGreaterThan(sim.world.tick);
    for (const me of IDS) {
      expect(line(sim, me)).toBe(text(sim, me, 'moment_roe_deer_startled', false));
      expect(model(sim, me)?.ring ?? null).toBeNull();
    }
    wait(sim, (today.shyUntil - sim.world.tick) / 30 + 0.1);
    expect(line(sim, 'p1')).toBe('Elle broute : tu peux bouger.');
  });

  it('sous 3 m: « Pas si près » avant tout, même quand elle broute', () => {
    const { sim } = momentSim('roe_deer', DEER_AT);
    const deer = point(sim, 'roe_deer_graze');
    place(sim, 'p2', { x: deer.x - 4, y: deer.y + 0.5 }, deer);
    place(sim, 'p1', { x: deer.x - 5, y: deer.y - 2 }, deer);
    const c = character(sim, 'p1');
    c.pos = { x: deer.x - 2.5, y: deer.y };
    expect(line(sim, 'p1')).toBe("Pas si près : recule d'un pas.");
  });
});

// ---------------------------------------------------------------------------
// Parties de robots: la ligne affichée est vraie à chaque pas, chez les deux.

type Check = (sim: Sim, me: CharacterId, m: WatchModel | null, counted: boolean) => void;

/** Ce que la ligne affirme, confronté à l'état de la simulation après ce pas. */
function truthful(id: string): Check {
  return (sim, me, m, counted) => {
    const today = sim.world.moments.today;
    if (today === null || m === null) return;
    const where = `${me} au pas ${String(sim.world.tick)}: « ${m.line ?? ''} »`;
    // L'anneau ne paraît que si la simulation a compté ce pas (et « Sans bouger... » avec lui).
    if (today.phase === 'waiting') {
      expect(m.ring !== null, where).toBe(counted);
      expect(m.tone === 'together', where).toBe(counted);
    }
    if (today.phase !== 'waiting' || counted) return;
    const def = momentDef(sim.content, today.id);
    if (def === null) return;
    const w = activeWatch(def, today);
    const target = watchTarget(sim.map, def, w.target, today);
    const self = character(sim, me);
    const other = character(sim, me === 'p1' ? 'p2' : 'p1');
    const same = text(sim, me, 'moment_opposite_same_bank');
    if (id === 'mist' && w.opposite !== null) {
      const sameBank =
        bankSide(self.pos, w.opposite) !== 0 &&
        bankSide(self.pos, w.opposite) === bankSide(other.pos, w.opposite);
      if (plain(m.line ?? '') === same) expect(sameBank, where).toBe(true);
      if (m.tone === 'pose' && plain(m.line ?? '') !== same)
        expect(watchPart(sim, self, w, target), where).toBe(false);
    }
    if (m.tone === 'partner') {
      expect(today.watching[me], where).toBe(true);
      expect(today.watching[other.id], where).toBe(false);
    }
    if (id === 'roe_deer' && w.freeze !== null) {
      const kind = freezeState(def, w.freeze, today, sim.world.tick, sim.world.seed).kind;
      const l = plain(m.line ?? '');
      if (l === text(sim, me, 'moment_freeze_graze', false)) expect(kind, where).toBe('graze');
      if (l === text(sim, me, 'moment_freeze_look', false)) expect(kind, where).toBe('look');
      if (l === text(sim, me, 'moment_roe_deer_startled', false))
        expect(kind, where).toBe('startled');
    }
  };
}

/** Joue `ticks` pas avec `decide`, et confronte la ligne de chacun à la simulation après chaque pas. */
function playChecked(
  sim: Sim,
  ticks: number,
  decide: (sim: Sim, i: number) => Parameters<typeof step>[1],
  check: Check,
): { lines: Set<string>; climax: boolean } {
  const lines = new Set<string>();
  for (let i = 0; i < ticks; i++) {
    const before = sim.world.moments.today?.watchTicks ?? 0;
    step(sim, decide(sim, i));
    const today = sim.world.moments.today;
    if (today === null) break;
    const counted =
      today.phase === 'waiting' && today.watchTicks > 0 && today.watchTicks === before + 1;
    for (const me of IDS) {
      const m = model(sim, me);
      check(sim, me, m, counted);
      if (m?.line !== null && m?.line !== undefined) lines.add(plain(m.line));
    }
    if (today.phase === 'climax') return { lines, climax: true };
  }
  return { lines, climax: false };
}

/**
 * Deux marcheurs au hasard (graine fixe) autour du moment: ils marchent, s'arrêtent, se tournent
 * vers l'autre ou vers la bête; les états les plus divers, dont tous ceux qui ne comptent pas.
 */
function wanderers(
  seed: number,
  centre: Vec2,
): (sim: Sim, i: number) => Parameters<typeof step>[1] {
  const rng = createRandom(seed);
  const plan: Record<CharacterId, { mx: number; my: number; until: number }> = {
    p1: { mx: 0, my: 0, until: 0 },
    p2: { mx: 0, my: 0, until: 0 },
  };
  return (sim, i) => {
    const controls: Partial<Record<CharacterId, ControlFrame>> = {};
    for (const id of IDS) {
      const c = character(sim, id);
      const p = plan[id];
      if (i >= p.until) {
        const r = rng.next();
        const far = Math.hypot(c.pos.x - centre.x, c.pos.y - centre.y) > 7;
        if (far) {
          const a = Math.atan2(centre.y - c.pos.y, centre.x - c.pos.x);
          plan[id] = { mx: Math.cos(a), my: Math.sin(a), until: i + rng.int(10, 40) };
        } else if (r < 0.45) {
          const a = rng.float(0, 2 * Math.PI);
          plan[id] = { mx: Math.cos(a), my: Math.sin(a), until: i + rng.int(5, 40) };
        } else {
          plan[id] = { mx: 0, my: 0, until: i + rng.int(20, 150) };
          // S'arrêter et se tourner (vers l'autre, vers la bête ou ailleurs): un pas sur place.
          const o = character(sim, id === 'p1' ? 'p2' : 'p1');
          const look = rng.next();
          if (look < 0.5) c.facing = Math.atan2(o.pos.y - c.pos.y, o.pos.x - c.pos.x);
          else if (look < 0.8) c.facing = Math.atan2(centre.y - c.pos.y, centre.x - c.pos.x);
          else c.facing = rng.float(-Math.PI, Math.PI);
        }
      }
      controls[id] = { seq: i, moveX: plan[id].mx, moveY: plan[id].my, actHeld: false };
    }
    return { controls, intents: [] };
  };
}

describe('parties de robots: la ligne est vraie à chaque pas', () => {
  it('la brume avec les robots du jeu: ils passent le gué, se font face, et l’apogée part; ligne vraie à chaque pas', () => {
    const sim = robotSim('mist');
    const robot = createRobot();
    const run = playChecked(sim, 30 * 300, (s) => robot.decide(s), truthful('mist'));
    expect(run.climax).toBe(true);
  }, 120_000);

  it('la chevrette avec les robots du jeu: ils se figent aux regards, et l’apogée part; ligne vraie à chaque pas', () => {
    const sim = robotSim('roe_deer');
    const robot = createRobot();
    const run = playChecked(sim, 30 * 300, (s) => robot.decide(s), truthful('roe_deer'));
    expect(run.climax).toBe(true);
  }, 120_000);

  for (const seed of [1, 2, 3]) {
    it(`des marcheurs au hasard (graine ${String(seed)}) autour de la brume puis de la chevrette: aucune ligne fausse`, () => {
      // La rivière ne se passe qu'au gué, à 27 m: une partie sur la même rive, une sur deux rives.
      for (const [k, other] of [{ x: 31.5, y: 38.5 }, SOUTH].entries()) {
        const mist = momentSim('mist', MIST_AT);
        place(mist.sim, 'p1', NORTH, SOUTH);
        place(mist.sim, 'p2', other, NORTH);
        const a = playChecked(
          mist.sim,
          30 * 90,
          wanderers(seed * 10 + k, point(mist.sim, 'mist_narrows')),
          truthful('mist'),
        );
        for (const l of a.lines) seen.mist.add(l);
      }
      const deer = momentSim('roe_deer', DEER_AT);
      const at = point(deer.sim, 'roe_deer_graze');
      place(deer.sim, 'p1', { x: at.x - 4, y: at.y + 0.5 }, at);
      place(deer.sim, 'p2', { x: at.x - 5, y: at.y - 2 }, at);
      const b = playChecked(deer.sim, 30 * 90, wanderers(seed + 100, at), truthful('roe_deer'));
      for (const l of b.lines) seen.deer.add(l);
    }, 120_000);
  }

  // 0.13: le tilleul de la place (case 50, 24, à 8 m de la chevrette) dévie les marcheurs au
  // hasard de la graine 3, qui ne voyaient plus « elle regarde » avec l'autre hors de place. La
  // couverture de cette ligne ne dépend plus du hasard: une partie immobile, l'un à 7 m, la donne.
  it('la chevrette, immobiles, l’un trop loin pour compter: aucune ligne fausse aux regards', () => {
    const deer = momentSim('roe_deer', DEER_AT);
    const at = point(deer.sim, 'roe_deer_graze');
    place(deer.sim, 'p1', { x: at.x - 4, y: at.y + 0.5 }, at);
    place(deer.sim, 'p2', { x: at.x - 7, y: at.y }, at);
    const run = playChecked(
      deer.sim,
      30 * 60,
      (_s, i) => ({ controls: { p1: still(i), p2: still(i) }, intents: [] }),
      truthful('roe_deer'),
    );
    for (const l of run.lines) seen.deer.add(l);
    expect([...run.lines]).toContain('Ne bouge plus : elle regarde !');
  });

  it('les marcheurs ont vu toutes les lignes nouvelles (le contrôle a porté sur chacune)', () => {
    const all = (set: Set<string>): string => [...set].join(' / ');
    for (const part of ['même rive', 'Tourne-toi vers', 'Sans bouger'])
      expect(all(seen.mist)).toContain(part);
    for (const part of ['tu peux bouger', 'elle regarde', 'frappe du pied'])
      expect(all(seen.deer)).toContain(part);
  });
});

const seen = { mist: new Set<string>(), deer: new Set<string>() };

describe('scénarios de la page de démonstration (captures)', () => {
  // [scénario, ligne chez p1, ligne chez p2, anneau visible]
  const CASES: [string, string, string, boolean][] = [
    [
      'brume-meme-rive',
      'Sacha est sur la même rive que toi',
      'Camille est sur la même rive que toi',
      false,
    ],
    ['brume-de-dos', 'Sacha est là, mais pas encore en place.', 'Tourne-toi vers Camille.', false],
    ['brume-face-a-face', 'Sans bouger', 'Sans bouger', true],
    ['chevrette-broute', 'Elle broute : tu peux bouger.', 'Elle broute : tu peux bouger.', false],
    [
      'chevrette-regarde',
      'Ne bouge plus : elle regarde !',
      'Ne bouge plus : elle regarde !',
      false,
    ],
    ['chevrette-ensemble', 'Sans bouger', 'Sans bouger', true],
    ['chevrette-effarouchee', 'Elle a vu bouger', 'Elle a vu bouger', false],
  ];
  for (const [name, p1, p2, ring] of CASES) {
    it(
      name,
      () => {
        const sim = copyOf(base);
        setupScenario(sim, name, 'p1');
        expect(line(sim, 'p1') ?? '').toContain(p1);
        expect(line(sim, 'p2') ?? '').toContain(p2);
        for (const me of IDS) expect((model(sim, me)?.ring ?? null) !== null).toBe(ring);
      },
      120_000,
    );
  }
});
