/**
 * Moments rares vus de l'interface (tour 6): ligne d'observation, anneau et confidence du matin.
 * Le héron du jour 6 est joué une fois par les robots (graine de la démo), puis chaque cas part
 * d'une copie de cet état.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { momentDef } from '../../etat/moments';
import type { CharacterId, MomentToday } from '../../etat/types';
import type { Sim } from '../../simulation/contexte';
import { LOOK_CONE } from '../../simulation/conditions';
import { createWorld } from '../../simulation/monde';
import { morningMoments } from '../../simulation/moments';
import { HEN_CALL_DIALOGUE } from '../../simulation/secrets';
import { UI_SETTINGS } from '../config';
import { SteadyWatch, type WatchModel, momentHintModel, watchModel } from '../modele-moments';
import { setupScenario } from '../demo/scenarios';
import { apply, character, contentAndMap, newSim, uiContext } from './aides';

const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, ' ').replace(/\u2019/g, "'");

let heron: Sim;

/** Une copie de l'état du héron (les deux regardent, l'anneau à moitié). */
function copy(): Sim {
  return { ...heron, world: structuredClone(heron.world) };
}

function today(sim: Sim): MomentToday {
  const t = sim.world.moments.today;
  if (t === null) throw new Error('pas de moment');
  return t;
}

function line(sim: Sim, me: CharacterId): string | null {
  const m = watchModel(sim.world, uiContext(me));
  return m?.line === undefined || m.line === null ? null : plain(m.line);
}

/** Place `id` à `d` m du point du héron, tourné vers lui (ou dos à lui). */
function placeAt(sim: Sim, id: CharacterId, d: number, facingAway = false): void {
  const anchor = sim.map.points.heron_stand;
  if (anchor === undefined) throw new Error('heron_stand');
  const c = character(sim, id);
  c.pos = { x: anchor.x, y: anchor.y - d };
  c.facing = facingAway ? -Math.PI / 2 : Math.PI / 2;
  c.speed = 0;
}

beforeAll(() => {
  heron = newSim();
  apply(heron, 'p1', { type: 'title_ready', ready: true });
  apply(heron, 'p2', { type: 'title_ready', ready: true });
  setupScenario(heron, 'moment-ensemble', 'p1');
}, 300_000);

describe('réglages partagés avec la simulation', () => {
  it('même cône du regard et même conversation d’appel que la simulation', () => {
    expect(UI_SETTINGS.lookCone).toBe(LOOK_CONE);
    expect(UI_SETTINGS.henCallDialogue).toBe(HEN_CALL_DIALOGUE);
  });
});

describe("ligne d'observation et anneau", () => {
  it('ne dit rien sans moment du jour', () => {
    const sim = copy();
    sim.world.moments.today = null;
    expect(watchModel(sim.world, uiContext('p1'))).toBeNull();
  });

  it('les deux regardent: « Sans bouger... » et l’anneau qui se remplit, chez les deux', () => {
    const sim = copy();
    const t = today(sim);
    expect(t.id).toBe('heron');
    expect(t.watching).toEqual({ p1: true, p2: true });
    const def = momentDef(sim.content, 'heron');
    const needed = Math.round((def?.watch.holdSeconds ?? 0) * UI_SETTINGS.simHz);
    for (const me of ['p1', 'p2'] as const) {
      const m = watchModel(sim.world, uiContext(me));
      expect(m?.tone).toBe('together');
      expect(m?.line).toBe(uiContext(me).t(sim.content.texts.messages.moment_watch_self ?? '-'));
      expect(m?.ring).toBeCloseTo(t.watchTicks / needed, 5);
      expect(m?.ring ?? 0).toBeGreaterThan(0);
      expect(m?.ring ?? 1).toBeLessThan(1);
    }
  });

  it("l'autre manque: celui qui regarde le lit, celui qui est loin ne voit rien", () => {
    const sim = copy();
    today(sim).watching = { p1: true, p2: false };
    today(sim).watchTicks = 0;
    character(sim, 'p2').pos = { x: 41.5, y: 19.5 };
    expect(line(sim, 'p1')).toBe('Sacha n\'est pas encore là.');
    expect(watchModel(sim.world, uiContext('p1'))?.ring).toBeNull();
    expect(watchModel(sim.world, uiContext('p2'))).toBeNull();
    // L'autre arrive près du gué sans être en place: il n'est pas dit absent.
    placeAt(sim, 'p2', 4, true);
    expect(line(sim, 'p1')).toBe('Sacha est là, mais pas encore en place.');
  });

  it('dit la pose demandée (immobile et tourné vers lui), et que l’autre est déjà là', () => {
    const sim = copy();
    today(sim).watching = { p1: false, p2: true };
    placeAt(sim, 'p1', 4, true);
    const m = watchModel(sim.world, uiContext('p1'));
    expect(m?.tone).toBe('pose');
    expect(plain(m?.line ?? '')).toBe('Arrête-toi et tourne-toi vers lui.');
    expect(plain(m?.detail ?? '')).toBe('Sacha est déjà en place.');
    // En marche, tourné vers lui: seulement « Ne bouge plus. ».
    placeAt(sim, 'p1', 4);
    character(sim, 'p1').speed = 1.2;
    expect(line(sim, 'p1')).toBe('Ne bouge plus.');
  });

  it('trop près, un peu trop loin, ou bien trop loin', () => {
    const sim = copy();
    today(sim).watching = { p1: false, p2: false };
    const w = momentDef(sim.content, 'heron')?.watch;
    if (w === undefined) throw new Error('héron');
    placeAt(sim, 'p1', w.minRadius - 1);
    expect(line(sim, 'p1')).toBe("Pas si près : recule d'un pas.");
    placeAt(sim, 'p1', w.radius + 1);
    expect(line(sim, 'p1')).toBe('Approche-toi encore un peu.');
    placeAt(sim, 'p1', w.radius + UI_SETTINGS.watchNearMargin + 1);
    expect(watchModel(sim.world, uiContext('p1'))).toBeNull();
    expect(watchModel(sim.world, uiContext('p2'))?.detail ?? null).toBeNull();
  });

  it('rien dans un menu, une conversation ou la maison (la simulation ne compte pas ce joueur)', () => {
    for (const change of [
      (s: Sim): void => {
        character(s, 'p1').menu = 'notebook';
      },
      (s: Sim): void => {
        character(s, 'p1').inHouse = true;
      },
    ]) {
      const sim = copy();
      change(sim);
      expect(watchModel(sim.world, uiContext('p1'))).toBeNull();
    }
  });

  it("assis sur le banc pour les oies de la quête, l'échelle tenue: la touche réelle est dite", () => {
    const sim = copy();
    const t = today(sim);
    sim.world.moments.today = { ...t, id: 'geese', origin: 'quest', watching: { p1: false, p2: false } };
    const anchor = sim.map.points.geese_rest;
    if (anchor === undefined) throw new Error('geese_rest');
    const c = character(sim, 'p1');
    c.pos = { x: anchor.x, y: anchor.y - 3 };
    c.seat = null;
    expect(line(sim, 'p1')).toBe('Assieds-toi sur le banc (Espace).');
    sim.world.moments.today = { ...t, id: 'ladder', origin: 'quest', watching: { p1: false, p2: false } };
    const foot = sim.map.points.ladder_foot;
    if (foot === undefined) throw new Error('ladder_foot');
    c.pos = { x: foot.x + 1, y: foot.y };
    c.holding = null;
    expect(line(sim, 'p1')).toBe("Tiens un côté de l'échelle (Espace).");
  });

  it('les oies trop tôt: la ligne le dit, sans anneau', () => {
    const sim = copy();
    today(sim).early = true;
    const m = watchModel(sim.world, uiContext('p1'));
    expect(m?.tone).toBe('early');
    expect(m?.line).toBe(uiContext('p1').t(sim.content.texts.messages.geese_not_yet ?? '-'));
    expect(m?.ring).toBeNull();
  });

  it("apogée: l'anneau plein chez les deux; l'échelle lâchée dit qui doit reprendre; après: rien", () => {
    const sim = copy();
    const t = today(sim);
    t.phase = 'climax';
    for (const me of ['p1', 'p2'] as const) expect(watchModel(sim.world, uiContext(me))).toMatchObject({ tone: 'climax', ring: 1, line: null });
    sim.world.moments.today = { ...t, id: 'ladder', origin: 'quest', paused: true };
    character(sim, 'p1').holding = null;
    character(sim, 'p2').holding = 'ladder_hold_west';
    expect(line(sim, 'p1')).toBe("Tiens un côté de l'échelle (Espace).");
    expect(line(sim, 'p2')).toBe("Camille a lâché l'échelle.");
    for (const phase of ['after', 'left', 'gone', 'absent'] as const) {
      sim.world.moments.today = { ...t, phase };
      expect(watchModel(sim.world, uiContext('p1'))).toBeNull();
    }
  });
});

describe('ligne stable, jamais en rafale', () => {
  const pose: WatchModel = { key: 'pose:a', tone: 'pose', line: 'a', detail: null, ring: null };
  const together = (ring: number): WatchModel => ({ key: 'together', tone: 'together', line: 'b', detail: null, ring });

  it("une ligne n'apparaît, ne change et ne part qu'après avoir tenu le délai", () => {
    const s = new SteadyWatch(400);
    expect(s.next(pose, 0)).toBeNull();
    expect(s.next(pose, 399)).toBeNull();
    expect(s.next(pose, 400)).toBe(pose);
    // Un aller-retour bref (un pas de trop au bord du rayon) ne se voit pas.
    expect(s.next(null, 500)).toBe(pose);
    expect(s.next(pose, 600)).toBe(pose);
    expect(s.next(together(0.1), 700)).toBe(pose);
    expect(s.next(together(0.4), 1100)?.ring).toBe(0.4);
    // La même ligne se met à jour aussitôt (l'anneau qui se remplit).
    expect(s.next(together(0.6), 1150)?.ring).toBe(0.6);
    expect(s.next(null, 1200)?.ring).toBe(0.6);
    expect(s.next(null, 1600)).toBeNull();
  });

  it("l'apogée s'affiche sans attendre", () => {
    const s = new SteadyWatch(400);
    s.next(together(0.9), 0);
    s.next(together(0.9), 400);
    const climax: WatchModel = { key: 'climax', tone: 'climax', line: null, detail: null, ring: 1 };
    expect(s.next(climax, 450)).toBe(climax);
  });
});

describe('confidence du matin (M-10)', () => {
  it('ne se lit que chez son destinataire, et alterne en commençant par p2, sur 8 graines', () => {
    const { content, map } = contentAndMap();
    let hints = 0;
    for (const seed of [1, 7, 42, 99, 123, 2024, 20261031, 31337]) {
      const sim: Sim = createWorld(content, map, seed, [
        { id: 'a', name: 'Camille', color: '#5CE1E6' },
        { id: 'b', name: 'Sacha', color: '#8D6CFF' },
      ]);
      apply(sim, 'p1', { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 });
      apply(sim, 'p2', { type: 'create_character', name: 'Sacha', hair: 2, outfit: 1 });
      // Les deux ont rencontré tout le monde: aucune confidence n'est retenue faute de rencontre.
      for (const id of ['p1', 'p2'] as const) for (const v of content.villagers) sim.world.counters[id][`talked:${v.id}`] = 1;
      const order: CharacterId[] = [];
      for (let day = 2; day <= 15; day++) {
        sim.world.clock.day = day;
        morningMoments(sim);
        const to = sim.world.moments.today?.hintTo ?? null;
        const p1 = momentHintModel(sim.world, uiContext('p1'));
        const p2 = momentHintModel(sim.world, uiContext('p2'));
        if (to === null) {
          expect(p1).toBeNull();
          expect(p2).toBeNull();
          continue;
        }
        order.push(to);
        const mine = to === 'p1' ? p1 : p2;
        const other = to === 'p1' ? p2 : p1;
        expect(mine?.text).not.toBe('');
        expect(other).toBeNull();
        expect(plain(mine?.help ?? '')).toContain(to === 'p1' ? 'Sacha' : 'Camille');
      }
      hints += order.length;
      order.forEach((to, i) => {
        expect(to).toBe(i % 2 === 0 ? 'p2' : 'p1');
      });
    }
    expect(hints).toBeGreaterThan(4);
  });
});
