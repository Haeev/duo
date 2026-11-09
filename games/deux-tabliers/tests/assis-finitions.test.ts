// Finitions des personnages assis (2026-11-08), tests courts: plusieurs places par meuble
// comptées par la clientèle, boire seulement avec sa boisson servie, pose droite tenue.
import { createRandom } from '@duo/sdk';
import { AnimationClip, QuaternionKeyframeTrack } from 'three';
import { describe, expect, it } from 'vitest';
import { ctxOf } from '../src/clientele';
import { spawnGroup } from '../src/clientele/clients';
import {
  fillBefore,
  memberDrink,
  sipCount,
  sipDuration,
  sipPose,
  sipTime,
} from '../src/clientele/gestes';
import { seatList } from '../src/clientele/places';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { placeAnchor, placeFurniture, seatAnchor, seatPlaces } from '../src/etat/assises';
import type { World } from '../src/etat/monde';
import { restClip, SIT_REST } from '../src/rendu/assis';
import { IDLE_INPUT } from '../src/simulation/entrees';
import { planAct } from '../src/simulation/interactions';
import { createWorld } from '../src/simulation/monde';
import { stepWorld } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

const content = loadContent(DATA_FILES);
const DT = 1 / 60;

/** Salle de départ, banquette de trois contre le mur ouest, face à la table carrée. */
function worldWithBench(): World {
  const world = createWorld(content, ['a', 'b']);
  world.furniture = world.furniture.filter((f) => f.id !== 'seat-7' && f.id !== 'seat-8');
  const table = world.furniture.find((f) => f.id === 'table-4');
  if (table !== undefined) table.x = 5.05;
  world.furniture.push(
    { id: 'bq', type: 'banquette-moleskine', x: 4.29, z: 10.1, y: 0, rotDeg: 90 },
    { id: 'bf', type: 'banc-ferme', x: 6.4, z: 11.0, y: 0, rotDeg: 180 },
  );
  return world;
}

function simOf(world: World): SimContext {
  return {
    world,
    content,
    dt: DT,
    random: createRandom(1),
    inputs: [IDLE_INPUT, IDLE_INPUT],
    emit: () => undefined,
  };
}

describe('Deux Tabliers, places des meubles', () => {
  it("l'assise déclarée du modèle est lue (chaise paillée: 2 cm en avant du centre)", () => {
    const world = createWorld(content, ['a', 'b']);
    const chair = world.furniture.find((f) => f.id === 'seat-1');
    expect(chair).toBeDefined();
    if (chair === undefined) return;
    // Chaise tournée de 90°: son avant (+Z du modèle) regarde l'est.
    expect(seatAnchor(content, world.furniture, chair).x).toBeCloseTo(chair.x + 0.02, 5);
  });

  it('banquette de trois et banc de deux: chaque place face à sa table, comptées par la clientèle', () => {
    const world = worldWithBench();
    const bench = world.furniture.find((f) => f.id === 'bq');
    const farm = world.furniture.find((f) => f.id === 'bf');
    if (bench === undefined || farm === undefined) throw new Error('meubles absents');
    const places = seatPlaces(content, world.furniture, bench);
    expect(places.map((p) => p.id)).toEqual(['bq', 'bq#1', 'bq#2']);
    expect(seatPlaces(content, world.furniture, farm)).toHaveLength(2);
    // Trois points distincts, à 55 cm l'un de l'autre, tous tournés vers la table (est). Celle
    // du milieu est en face; les bouts, au-delà du bord du plateau, se tournent vers lui (au plus
    // `endSeatTurnMaxDeg`): genoux vers le milieu de la banquette, loin des accoudoirs.
    const xs = new Set(places.map((p) => p.anchor.z.toFixed(2)));
    expect(xs.size).toBe(3);
    const table = world.furniture.find((f) => f.id === 'table-4');
    if (table === undefined) throw new Error('table absente');
    const maxTurn = (content.settings.seating.endSeatTurnMaxDeg * Math.PI) / 180;
    for (const p of places) {
      const off = p.anchor.z - table.z;
      if (Math.abs(off) < 0.2) expect(p.anchor.fx).toBeGreaterThan(0.99);
      else {
        expect(p.anchor.fx).toBeGreaterThanOrEqual(Math.cos(maxTurn) - 1e-6);
        expect(p.anchor.fx).toBeLessThan(0.99);
        expect(Math.sign(p.anchor.fz)).toBe(-Math.sign(off));
      }
      expect(placeAnchor(content, world.furniture, p.id)).toEqual(p.anchor);
      expect(placeFurniture(p.id)).toBe('bq');
    }
    const s = ctxOf(simOf(world)).s;
    const list = seatList({ content, world }, content.clientele, s);
    expect(list.filter((x) => placeFurniture(x.id) === 'bq')).toHaveLength(3);
    expect(list.filter((x) => placeFurniture(x.id) === 'bf')).toHaveLength(2);
  });

  it("un avatar s'assoit sur la place visée de la banquette, les autres restent libres", () => {
    const world = worldWithBench();
    const target = { kind: 'seat', furniture: 'bq#1' } as const;
    expect(planAct(content, world, 0, target)).toEqual({ kind: 'sit', furniture: 'bq#1' });
    const a = placeAnchor(content, world.furniture, 'bq#1');
    world.players[0].x = 4.75;
    world.players[0].z = (a?.z ?? 10.1) + 0.9;
    stepWorld(
      content,
      world,
      [IDLE_INPUT, IDLE_INPUT],
      [{ player: 0, intent: { type: 'act', target } }],
      DT,
      createRandom(2),
      () => undefined,
    );
    expect(world.players[0].seat).toBe('bq#1');
    expect(world.players[0].z).toBeCloseTo(a?.z ?? NaN, 5);
    expect(planAct(content, world, 1, target).kind).toBe('refuse');
    expect(planAct(content, world, 1, { kind: 'seat', furniture: 'bq#2' }).kind).toBe('sit');
  });
});

describe('Deux Tabliers, gestes des clients assis', () => {
  it('gorgée: montée à plat, inclinaison de 30 à 55° selon le contenu, contenu qui baisse', () => {
    const s = content.settings.seating.sip;
    const out = { hand: 0, lift: 0, tiltDeg: 0, headDeg: 0, fill: 1 };
    const top = s.reachSec + s.liftSec + s.tiltSec + s.holdSec / 4;
    // Pleine: 30°, presque vide: 55°; jamais inclinée tant qu'elle n'est pas aux lèvres.
    expect(sipPose(s, top, 1, out).tiltDeg).toBeCloseTo(30, 5);
    expect(out.lift).toBe(1);
    expect(out.headDeg).toBeGreaterThan(0);
    expect(sipPose(s, top, s.emptyFill, out).tiltDeg).toBeCloseTo(55, 5);
    for (let t = 0; t < sipDuration(s); t += 0.05) {
      sipPose(s, t, 0.6, out);
      if (out.lift < 1) expect(out.tiltDeg).toBe(0);
      expect(out.tiltDeg).toBeLessThanOrEqual(55);
    }
    // Reposée à plat et lâchée à la fin; le contenu a baissé d'une gorgée.
    sipPose(s, sipDuration(s), 0.6, out);
    expect(out.hand).toBe(0);
    expect(out.lift).toBe(0);
    expect(out.fill).toBeCloseTo(0.6 - s.sipShare, 5);
    expect(fillBefore(s, 0)).toBe(1);
    expect(fillBefore(s, 100)).toBe(s.emptyFill);
    expect(sipCount(content.settings.seating, 3, 0, 0, 600, sipDuration(s))).toBeGreaterThan(20);
  });

  it('on ne boit que sa boisson servie; qui a commandé à manger attend sans tasse', () => {
    const world = worldWithBench();
    const ctx = ctxOf(simOf(world));
    const g = spawnGroup(ctx, { profile: 'voisins', size: 2, items: ['cappuccino', 'croissant'] });
    g.stage = 'waiting';
    expect(memberDrink(content.clientele, g, 0)).toBeNull();
    g.stage = 'seated';
    g.servedAt = null;
    expect(memberDrink(content.clientele, g, 0)).toBeNull();
    g.servedAt = 10;
    expect(memberDrink(content.clientele, g, 0)).toBe('cappuccino');
    expect(memberDrink(content.clientele, g, 1)).toBeNull();
  });

  it('une gorgée de temps en temps, pas tous ensemble', () => {
    const seating = content.settings.seating;
    const sip = 6.7;
    const sampled = (k: number): boolean[] =>
      Array.from({ length: 400 }, (_, i) => sipTime(seating, 3, k, i * 0.25, sip) !== null);
    const a = sampled(0);
    const b = sampled(1);
    const share = a.filter(Boolean).length / a.length;
    // Gorgée de 6,7 s toutes les 12,7 à 20,7 s: environ un tiers à une moitié du temps.
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.6);
    expect(a.some((x, i) => x !== b[i])).toBe(true);
  });

  it('pose assise tenue: la première image de `sit`, immobile', () => {
    const track = new QuaternionKeyframeTrack(
      'Spine.quaternion',
      [0, 1, 2],
      [0, 0, 0, 1, 0.38, 0, 0, 0.92, 0, 0, 0, 1],
    );
    const rest = restClip([new AnimationClip('sit', 2, [track])]);
    expect(rest?.name).toBe(SIT_REST);
    const values = Array.from(rest?.tracks[0]?.values ?? []);
    expect(values).toEqual([0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
