// Premier jour ouvert (retours de la séance du 2026-11-08), en quelques secondes: chaque recette
// que l'ardoise peut proposer le mardi se fait de bout en bout par les vraies intentions d'un
// joueur (commande à la caisse, ticket, vaisselle, postes, passe), avec le stock du mardi; les
// clients du mardi arrivent un à la fois, patients, et l'affluence monte les jours suivants.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { serviceId } from '../src/branchement';
import { guideOf, type GuideFocus } from '../src/branchement/guide';
import { soldOutNote } from '../src/branchement/interface';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { PlayerIndex, World } from '../src/etat/monde';
import { calmArrivals, holdCalmArrival, patienceOf } from '../src/clientele/prise-en-main';
import { passersPerHour } from '../src/clientele/attrait';
import type { Intent, StepInput, Target } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld, heldObject, objectOnSlot } from '../src/simulation/monde';
import { stepWorld } from '../src/simulation/pas';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);

interface Rig {
  readonly world: World;
  readonly events: GameEvent[];
  steps: (n: number, held?: PlayerIndex | null, intents?: Intent[], by?: PlayerIndex) => void;
  act: (player: PlayerIndex, target: Target, holdSeconds?: number) => void;
  drop: (player: PlayerIndex, target: Target) => void;
  at: (player: PlayerIndex, x: number, z: number) => void;
}

function rig(seed: number): Rig {
  const world = createWorld(content, ['a', 'b']);
  const events: GameEvent[] = [];
  const random = createRandom(seed);
  const input = (actHeld: boolean): StepInput => ({
    seq: 0,
    moveX: 0,
    moveZ: 0,
    fast: false,
    yawDeg: 180,
    pitchDeg: 0,
    actHeld,
  });
  const steps = (
    n: number,
    held: PlayerIndex | null = null,
    intents: Intent[] = [],
    by: PlayerIndex = 0,
  ): void => {
    for (let i = 0; i < n; i++) {
      const queued = i === 0 ? intents.map((intent) => ({ player: by, intent })) : [];
      stepWorld(content, world, [input(held === 0), input(held === 1)], queued, DT, random, (e) =>
        events.push(e),
      );
    }
  };
  return {
    world,
    events,
    steps,
    act(player, target, holdSeconds = 0) {
      const n = Math.max(1, Math.round(holdSeconds / DT));
      steps(n, holdSeconds > 0 ? player : null, [{ type: 'act', target }], player);
      steps(1);
    },
    drop(player, target) {
      steps(1, null, [{ type: 'drop', target }], player);
    },
    at(player, x, z) {
      world.players[player].x = x;
      world.players[player].z = z;
    },
  };
}

const station = (furniture: string): Target => ({ kind: 'station', furniture });
const slot = (furniture: string, id: string): Target => ({ kind: 'slot', furniture, slot: id });

/** Du lundi au mardi matin, à deux; rend le monde au moment d'écrire l'ardoise. */
function tuesday(seed: number): Rig {
  const r = rig(seed);
  r.steps(1);
  r.steps(1, null, [{ type: 'clientele-vote', topic: 'next-day', yes: true }], 0);
  r.steps(1, null, [{ type: 'clientele-vote', topic: 'next-day', yes: true }], 1);
  expect(r.world.clientele.day).toBe(2);
  expect(r.world.clientele.phase).toBe('prep');
  return r;
}

/** Recettes « de départ »: celles que l'ardoise du mardi peut porter. */
const START = content.clientele.recipeList
  .filter((x) => x.unlock.kind === 'start')
  .map((x) => x.id);
/** L'ardoise proposée du mardi (lundi, la première commande se fait pour elle). */
const SLATE = tuesday(3).world.clientele.slate.map(([id]) => id);

/** Les gestes d'une recette, du ticket au passe, par le joueur 0. */
function prepare(r: Rig, recipe: string, focus: (() => GuideFocus | null) | null): void {
  const p: PlayerIndex = 0;
  const guided = (id: string): void => {
    if (focus !== null) expect(focus()).toEqual({ kind: 'furniture', id });
  };
  const cupFromStack = (): void => {
    r.at(p, 9.6, 7.95);
    r.act(p, station('pile-tasses-1'));
  };
  const pickUp = (furniture: string, id: string): void => {
    const o = objectOnSlot(r.world, furniture, id);
    if (o === undefined) throw new Error(`rien sur ${furniture}/${id}`);
    r.act(p, { kind: 'object', id: o.id });
  };
  const espresso = (passive: number): void => {
    cupFromStack();
    guided('groupe-1');
    r.at(p, 9.0, 8.3);
    r.drop(p, slot('groupe-1', 'bec'));
    guided('station-5');
    r.at(p, 9.8, 8.3);
    r.act(p, station('station-5'), 2.6);
    guided('groupe-1');
    r.at(p, 9.0, 8.3);
    r.act(p, station('groupe-1'));
    guided('groupe-1');
    r.steps(Math.round((passive + 0.8) / DT));
    r.act(p, station('groupe-1'));
    pickUp('groupe-1', 'bec');
  };
  const steam = (seconds: number): void => {
    r.at(p, 9.4, 8.3);
    r.drop(p, slot('buse-1', 'bec'));
    r.act(p, station('buse-1'), seconds);
    pickUp('buse-1', 'bec');
  };
  const plate = (): void => {
    cupFromStack();
    expect(heldObject(r.world, p)?.type).toBe('assiette');
  };
  switch (recipe) {
    case 'espresso':
      espresso(12);
      break;
    case 'allonge':
      espresso(14);
      break;
    case 'creme':
      espresso(12);
      guided('buse-1');
      steam(4.8);
      guided('station-3');
      break;
    case 'chocolat':
      cupFromStack();
      steam(4.8);
      break;
    case 'the_noir':
      cupFromStack();
      r.at(p, 8.2, 7.95);
      r.drop(p, slot('bouilloire-1', 'tasse'));
      r.act(p, station('bouilloire-1'));
      r.steps(448);
      r.act(p, station('bouilloire-1'));
      pickUp('bouilloire-1', 'tasse');
      break;
    case 'croissant':
    case 'pain_chocolat':
    case 'tarte_fruits':
      plate();
      r.at(p, 8.6, 7.95);
      r.drop(p, slot('vitrine-1', 'assiette'));
      r.act(p, station('vitrine-1'), 2.2);
      pickUp('vitrine-1', 'assiette');
      break;
    case 'tartine':
      plate();
      r.at(p, 8.4, 7.95);
      r.drop(p, slot('station-2', 'plan'));
      r.act(p, station('station-2'), 4.2);
      pickUp('station-2', 'plan');
      break;
    default:
      throw new Error(`gestes inconnus: ${recipe}`);
  }
  expect(heldObject(r.world, p)?.type).toBe(content.service.recipes.get(serviceId(recipe))?.id);
  r.at(p, 8.4, 8.3);
  r.drop(p, slot('station-3', 'p1'));
  r.steps(3);
}

describe('Deux Tabliers, le premier jour ouvert', () => {
  it("l'ardoise proposée du mardi ne porte que des recettes de départ", () => {
    const r = tuesday(3);
    for (const [id] of r.world.clientele.slate) expect(START).toContain(id);
  });

  it('une recette de départ sans stock le mardi est grisée et personne ne la commande', () => {
    const missing = START.filter((id) => !SLATE.includes(id));
    for (const recipe of missing) {
      const r = tuesday(5);
      const c = r.world.clientele;
      r.steps(1, null, [{ type: 'clientele-slate', lines: [[recipe, 0]] }], 1);
      const note = soldOutNote(content.clientele, c, recipe);
      if (note === null) continue;
      expect(note).toMatch(/^En rupture : plus de /);
      r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 0);
      r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 1);
      c.arrivals = [[0, 'voisins', 1, false]];
      c.expected = [];
      r.steps(Math.round(5 / DT));
      expect(c.groups.filter((g) => g.regular === null)).toHaveLength(0);
    }
    for (const recipe of SLATE)
      expect(soldOutNote(content.clientele, tuesday(5).world.clientele, recipe)).toBeNull();
  });

  for (const recipe of SLATE) {
    it(`${recipe}: de la caisse au passe, avec le stock du mardi`, () => {
      const r = tuesday(5);
      const c = r.world.clientele;
      r.steps(1, null, [{ type: 'clientele-slate', lines: [[recipe, 0]] }], 1);
      expect(c.slate).toEqual([[recipe, 0]]);
      r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 0);
      r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 1);
      expect(c.phase).toBe('service');
      // Un seul client, tout de suite (un gourmand pour une part de tarte); Simone plus tard.
      c.arrivals = [[0, recipe === 'tarte_fruits' ? 'gourmands' : 'voisins', 1, false]];
      c.expected = [];
      for (let i = 0; i < 20 / DT && r.world.service.waiting.length === 0; i++) r.steps(1);
      const group = c.groups[0];
      if (group === undefined) throw new Error('aucun client');
      expect(group.stage).toBe('register');
      group.items = [recipe];
      const focus = (): GuideFocus | null => guideOf(content, r.world, 0)?.focus ?? null;
      expect(focus()).toEqual({ kind: 'furniture', id: 'station-6' });

      // Prendre la commande (caisse maintenue), puis le ticket au rail.
      r.at(0, 10.4, 8.3);
      r.act(0, station('station-6'), 3);
      r.steps(2);
      expect(r.world.service.tickets).toHaveLength(1);
      expect(group.paid).not.toBeNull();
      expect(focus()).toEqual({ kind: 'furniture', id: 'rail-1' });
      r.at(0, 8.4, 8.3);
      r.act(0, station('rail-1'));
      expect(r.world.service.tickets[0]?.taker).toBe(0);
      expect(focus()).toEqual({ kind: 'furniture', id: 'pile-tasses-1' });

      prepare(r, recipe, recipe === 'creme' ? focus : null);
      expect(r.world.service.tickets).toHaveLength(0);
      expect(group.servedAt).not.toBeNull();
      expect(r.events.filter((e) => e.type === 'refused')).toEqual([]);
    });
  }

  it('le mardi au calme: un groupe à la fois, patients, puis la montée', () => {
    const cc = content.clientele;
    const spm = cc.days.secondsPerGameMinute;
    const calm = calmArrivals(cc, 2, spm, createRandom(9));
    expect(calm.length).toBeGreaterThanOrEqual(6);
    expect(calm.length).toBeLessThanOrEqual(8);
    expect(calm[0]?.[0]).toBeLessThan(30);
    for (const a of calm) expect(a[2]).toBeLessThanOrEqual(2);
    // Plus patients que d'habitude.
    const voisins = cc.profiles.get('voisins');
    if (voisins === undefined) throw new Error('profil absent');
    expect(patienceOf(cc, 2, voisins)).toBeGreaterThan(voisins.patienceSeconds * 2);
    expect(patienceOf(cc, 9, voisins)).toBe(voisins.patienceSeconds);

    // Le vrai mardi: les arrivées tirées sont les seuls groupes calmes.
    const r = tuesday(7);
    const c = r.world.clientele;
    r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 0);
    r.steps(1, null, [{ type: 'clientele-vote', topic: 'open', yes: true }], 1);
    expect(c.arrivals.length).toBeGreaterThanOrEqual(6);
    expect(c.arrivals.length).toBeLessThanOrEqual(8);
    // Personne ne sert: après une minute, un seul groupe de passage est entré.
    c.expected = [];
    r.steps(Math.round(60 / DT));
    const passing = c.groups.filter((g) => g.regular === null && g.role === null);
    expect(passing).toHaveLength(1);
    expect(holdCalmArrival(cc, 2, c.groups, c.serviceSec)).toBe(true);

    // Montée: affluence attendue jour après jour, la normale au sixième jour.
    const expected = (day: number): number => {
      const w = cc.rules.warmup.find((x) => x.day === day);
      let total = 0;
      for (const p of cc.profileList)
        total += passersPerHour(cc, p, (day - 1) % 7, 'soleil', 1).reduce((s, x) => s + x, 0);
      return w === undefined ? total : w.calmGroups + total * w.affluence;
    };
    const days = [2, 3, 4, 5, 6].map(expected);
    for (let i = 1; i < days.length; i++)
      expect(days[i] ?? 0).toBeGreaterThan(days[i - 1] ?? Infinity);
  });
});
