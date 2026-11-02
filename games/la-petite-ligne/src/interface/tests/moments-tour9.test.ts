/**
 * Ligne d'observation des moments du tour 9 (tour-09-conception.md, sections 4.2 à 4.4): la dame
 * blanche (côte à côte, `closeTogether`), les lanternes du quai (chacun à sa lanterne, allumer au
 * même instant, `syncPress`) et le salut du mécanicien (une manivelle chacun). La ligne dit ce que
 * la simulation attend (`watchPart`), chez les deux joueurs.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { activeWatch, momentDef, watchTarget } from '../../etat/moments';
import type { CharacterId, Vec2 } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { placeCharacter } from '../../simulation/deplacement';
import { newToday, watchPart } from '../../simulation/moments';
import { keyTokens } from '../format';
import { watchModel } from '../modele-moments';
import { NBSP, NNBSP } from '../typographie';
import { character, playUntil, started, uiContext } from './aides';

const plain = (s: string): string =>
  s.split(NBSP).join(' ').split(NNBSP).join(' ').split('’').join("'");

let base: Sim;

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
}, 300_000);

function momentSim(id: string): Sim {
  const sim: Sim = { ...base, world: structuredClone(base.world), events: [] };
  sim.world.beam = null;
  for (const c of sim.world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
    c.seat = null;
    c.holding = null;
    c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  }
  const def = momentDef(sim.content, id);
  if (def === null) throw new Error(`moment ${id} absent`);
  const today = newToday(sim, def, 'ambient');
  today.phase = 'waiting';
  today.phaseTick = sim.world.tick;
  sim.world.moments.today = today;
  return sim;
}

function place(sim: Sim, id: CharacterId, at: Vec2, lookAt: Vec2): void {
  const c = character(sim, id);
  placeCharacter(sim, c, at);
  c.facing = Math.atan2(lookAt.y - at.y, lookAt.x - at.x);
  c.speed = 0;
}

function point(sim: Sim, id: string): Vec2 {
  const p = sim.map.points[id];
  if (p === undefined) throw new Error(`point ${id}`);
  return p;
}

function anchor(sim: Sim): Vec2 {
  const today = sim.world.moments.today;
  const def = today === null ? null : momentDef(sim.content, today.id);
  if (today === null || def === null) throw new Error('moment');
  return watchTarget(sim.map, def, activeWatch(def, today).target, today);
}

function partOf(sim: Sim, id: CharacterId): boolean {
  const today = sim.world.moments.today;
  const def = today === null ? null : momentDef(sim.content, today.id);
  if (today === null || def === null) throw new Error('moment');
  return watchPart(sim, character(sim, id), activeWatch(def, today), anchor(sim));
}

function text(sim: Sim, me: CharacterId, key: string): string {
  const ctx = uiContext(me);
  return plain(
    ctx.t(sim.content.texts.messages[key] ?? `(${key} absent)`, {
      ...keyTokens(ctx.key),
      partner: character(sim, ctx.partner).name,
    }),
  );
}

describe('la dame blanche: côte à côte', () => {
  it('à plus de 1,8 m l’un de l’autre, chacun lit « Mets-toi tout près de... », comme la simulation l’attend', () => {
    const sim = momentSim('barn_owl');
    const a = anchor(sim);
    // À 4 m au sud du rocher, à 3 m l'un de l'autre, tournés vers lui.
    place(sim, 'p1', { x: a.x - 1.5, y: a.y + 4 }, a);
    place(sim, 'p2', { x: a.x + 1.5, y: a.y + 4 }, a);
    for (const me of ['p1', 'p2'] as const) {
      expect(partOf(sim, me)).toBe(false);
      expect(plain(watchModel(sim.world, uiContext(me))?.line ?? '')).toBe(
        text(sim, me, 'moment_side_by_side'),
      );
    }
  });

  it('côte à côte, immobiles, à bonne distance: la ligne ne demande plus de se rapprocher', () => {
    const sim = momentSim('barn_owl');
    const a = anchor(sim);
    place(sim, 'p1', { x: a.x - 0.5, y: a.y + 4 }, a);
    place(sim, 'p2', { x: a.x + 0.5, y: a.y + 4 }, a);
    for (const me of ['p1', 'p2'] as const) {
      expect(partOf(sim, me)).toBe(true);
      expect(plain(watchModel(sim.world, uiContext(me))?.line ?? '')).not.toBe(
        text(sim, me, 'moment_side_by_side'),
      );
    }
  });
});

describe('les lanternes du quai: chacun à sa lanterne', () => {
  it('à sa lanterne, on lit la touche et le nom de l’autre; l’autre arrivée à la sienne, « prêt » s’affiche', () => {
    const sim = momentSim('quay_lanterns');
    const quay = point(sim, 'lantern_quay');
    const square = point(sim, 'lantern_square');
    place(sim, 'p1', { x: quay.x + 0.5, y: quay.y }, quay);
    place(sim, 'p2', { x: quay.x + 6, y: quay.y + 3 }, quay);
    const today = sim.world.moments.today;
    if (today === null) throw new Error('moment');
    today.watching = { p1: partOf(sim, 'p1'), p2: partOf(sim, 'p2') };
    expect(today.watching).toEqual({ p1: true, p2: false });
    const alone = watchModel(sim.world, uiContext('p1'));
    expect(plain(alone?.line ?? '')).toBe(text(sim, 'p1', 'moment_lantern_take'));
    expect(alone?.line).toContain('(Espace)');
    expect(alone?.ring ?? null).toBeNull();
    place(sim, 'p2', { x: square.x + 0.5, y: square.y }, square);
    today.watching = { p1: partOf(sim, 'p1'), p2: partOf(sim, 'p2') };
    expect(today.watching).toEqual({ p1: true, p2: true });
    for (const me of ['p1', 'p2'] as const) {
      const m = watchModel(sim.world, uiContext(me));
      expect(plain(m?.line ?? '')).toBe(text(sim, me, 'moment_lantern_take'));
      expect(m?.tone).toBe('together');
      expect(m?.ring ?? null).toBeNull();
    }
  });
});

describe('le salut du mécanicien: une manivelle chacun', () => {
  it('sans manivelle en main, la ligne dit de prendre celle d’une barrière', () => {
    const sim = momentSim('train_salute');
    const a = anchor(sim);
    place(sim, 'p1', { x: a.x + 1, y: a.y + 1 }, a);
    place(sim, 'p2', { x: a.x - 6, y: a.y - 6 }, a);
    expect(partOf(sim, 'p1')).toBe(false);
    expect(plain(watchModel(sim.world, uiContext('p1'))?.line ?? '')).toBe(
      text(sim, 'p1', 'moment_crank_take'),
    );
  });
});
