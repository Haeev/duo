// Règle d'accès (défaut D5 de la recette): aucun point de quête n'est inaccessible. Pour chaque
// lieu du jeu, tout endroit où une quête envoie les joueurs s'atteint à pied depuis l'arrivée
// (`aides-acces.ts`, données seules). Règle étendue: portes, escaliers, meubles à brique et points
// cités, dans chaque état de l'histoire, avec les deux casses signalées sur Aubrune (épicerie,
// maison du garde). Dans le wagon du prologue et à Aubrune, la preuve est aussi jouée: les
// joueurs marchent par leurs commandes, portes et escaliers compris, sans jamais être replacés.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { interiorAt, sillsOf } from '../src/simulation/lieux/portes';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { isBlockedCell } from '../src/simulation/noyau/grille';
import { createPlaceState, createWorld, placeAtArrival } from '../src/simulation/noyau/monde';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, step, type Sim } from '../src/simulation/noyau/pas';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import {
  questSpots,
  storyStates,
  unreachableQuestSpots,
  unreachableStoryElements,
  walkableFromArrival,
} from './aides-acces';
import { wait } from './aides-l3';

const content = loadContent(gameDataFiles());
const PROLOGUE = content.settings.start.place;

type Json = Record<string, unknown>;
interface RoomJson {
  blocked: { x: number; y: number; w: number; h: number }[];
  objects: { id: string; x: number; y: number; rotation: number }[];
}

/** Les éléments inaccessibles d'Aubrune après une retouche des fiches (copie des données). */
function aubruneAfter(change: (files: Record<string, Json>) => void): string[] {
  const files = gameDataFiles() as Record<string, Json>;
  change(files);
  const place = loadContent(files).places.aubrune;
  if (place === undefined) throw new Error('Aubrune absente');
  return unreachableStoryElements(content, place);
}

function room(files: Record<string, Json>, id: string): RoomJson {
  const r = files[`lieux/aubrune/interieurs/${id}.json`];
  if (r === undefined) throw new Error(`intérieur ${id} absent`);
  return r as unknown as RoomJson;
}

function move(r: RoomJson, id: string, x: number, y: number, rotation: number): void {
  const o = r.objects.find((m) => m.id === id);
  if (o === undefined) throw new Error(`meuble ${id} absent`);
  Object.assign(o, { x, y, rotation });
}

describe('règle d’accès étendue: tout ce que l’histoire utilise, dans chaque état', () => {
  it('portes, escaliers, lits, sièges, meubles à brique et points cités s’atteignent depuis l’arrivée', () => {
    const problems: string[] = [];
    for (const place of Object.values(content.places))
      problems.push(...unreachableStoryElements(content, place));
    expect(problems).toEqual([]);
  });

  it('Aubrune: les états de l’histoire vont de tous verrous fermés à tous levés', () => {
    const place = content.places.aubrune;
    if (place === undefined) throw new Error('Aubrune absente');
    const states = storyStates(place);
    expect(states.length).toBeGreaterThanOrEqual(15);
    expect(states[0]?.open.size).toBe(0);
    expect(states[states.length - 1]?.open.size).toBe(Object.keys(place.map.locks ?? {}).length);
  });

  it('casse 1 (signalement): la table de l’épicerie à cheval sur la baie isole l’étage et ses lits', () => {
    const problems = aubruneAfter((files) => {
      const r = room(files, 'epicerie-rdc');
      move(r, 'epicerie-table', 4, 7, 0);
      r.blocked = [
        { x: 0, y: 5, w: 3, h: 1 },
        { x: 4, y: 5, w: 3, h: 1 },
      ];
    });
    expect(problems.some((p) => p.includes('lit-pension-1'))).toBe(true);
    expect(problems.some((p) => p.includes('epicerie-rdc-esc-epicerie-etage'))).toBe(true);
  });

  it('casse 2 (signalement): la salle de la maison fermée par table et chaises isole cave et étage', () => {
    const problems = aubruneAfter((files) => {
      const r = room(files, 'maison-rdc');
      move(r, 'maison-table', 7, 2, 0);
      move(r, 'maison-chaise-1', 7, 1, 0);
      move(r, 'maison-chaise-2', 7, 3, 2);
      r.blocked.push({ x: 6, y: 4, w: 2, h: 1 });
    });
    for (const id of ['maison-rdc-esc-maison-cave', 'maison-rdc-esc-maison-etage', 'cave-coffre'])
      expect(
        problems.some((p) => p.includes(id)),
        id,
      ).toBe(true);
  });

  it('casse 3: un escalier qui fait arriver dans le mur (hors de la salle) est signalé', () => {
    const problems = aubruneAfter((files) => {
      const r = files['lieux/aubrune/interieurs/moulin-etage.json'] as {
        doors: Record<string, { facing: number }>;
      };
      for (const d of Object.values(r.doors)) d.facing = 0;
    });
    expect(problems.some((p) => p.includes('moulin-grain-1'))).toBe(true);
  });
});

describe('règle d’accès: aucun point de quête inaccessible', () => {
  it('dans chaque lieu, tout endroit où une quête envoie les joueurs s’atteint depuis l’arrivée', () => {
    const problems: string[] = [];
    for (const place of Object.values(content.places))
      problems.push(...unreachableQuestSpots(content, place));
    expect(problems).toEqual([]);
  });

  it('un point de quête enfermé (exemplaire factice) est signalé, sans autre changement', () => {
    const files = gameDataFiles() as Record<string, Json>;
    const map = files[`lieux/${PROLOGUE}/carte.json`] as {
      points: Record<string, { x: number; y: number }>;
    };
    const quest = Object.keys(files).find((f) => f.startsWith(`lieux/${PROLOGUE}/quetes/`));
    if (quest === undefined) throw new Error('quête du lieu de départ absente');
    // Un point hors de la voiture: case libre, mais aucun passage n'y mène.
    map.points['recoin-factice'] = { x: 0.5, y: 0.5 };
    const steps = (files[quest] as { chapters: { steps: Json[] }[] }).chapters[0]?.steps ?? [];
    const last = steps[steps.length - 1];
    if (last === undefined) throw new Error('étape absente');
    last.target = { point: 'recoin-factice' };
    const fake = loadContent(files);
    const place = fake.places[PROLOGUE];
    if (place === undefined) throw new Error('lieu de départ absent');
    const problems = unreachableQuestSpots(fake, place);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('recoin-factice');
  });
});

/**
 * Chemin de cases libres (quatre voisins) de la case du corps à celle du but, obstacles du jeu. Un
 * but sur une case pleine (escalier dans une cloison) s'arrête à l'une de ses voisines libres.
 */
function cellPath(sim: Sim, player: PlayerIndex, to: { x: number; y: number }): number[] | null {
  const b = currentBlockers(sim.content, sim.world);
  if (b === null) return null;
  const body = sim.world.players[player].body;
  const start = Math.floor(body.y) * b.width + Math.floor(body.x);
  const gx = Math.floor(to.x);
  const gy = Math.floor(to.y);
  const goals = isBlockedCell(b, gx, gy)
    ? [
        [gx + 1, gy],
        [gx - 1, gy],
        [gx, gy + 1],
        [gx, gy - 1],
      ].map(([x = 0, y = 0]) => y * b.width + x)
    : [gy * b.width + gx];
  let goal = -1;
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (const i of queue) {
    if (goals.includes(i)) {
      goal = i;
      break;
    }
    const x = i % b.width;
    const y = (i - x) / b.width;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const n = (y + dy) * b.width + x + dx;
      if (isBlockedCell(b, x + dx, y + dy) || prev.has(n)) continue;
      prev.set(n, i);
      queue.push(n);
    }
  }
  if (goal === -1) return null;
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = prev.get(i) ?? -1) cells.push(i);
  return cells.reverse();
}

/**
 * Fait marcher un joueur jusqu'à `to` par ses commandes (jamais en posant son corps): il suit les
 * centres des cases du chemin, puis le but; `until` arrête la marche (une porte passée). Renvoie
 * la distance qui reste au bout de `seconds`.
 */
function walkTo(
  sim: Sim,
  player: PlayerIndex,
  to: { x: number; y: number },
  seconds = 12,
  until?: () => boolean,
): number {
  const path = cellPath(sim, player, to);
  if (path === null) return Number.POSITIVE_INFINITY;
  const width = sim.content.places[sim.world.common.place]?.map.width ?? 1;
  const center = (i: number): { x: number; y: number } => ({
    x: (i % width) + 0.5,
    y: Math.floor(i / width) + 0.5,
  });
  const last = path[path.length - 1] ?? -1;
  const stops = path.slice(1, -1).map(center);
  // But sur une case pleine: on va d'abord au centre de sa voisine libre, puis on pousse vers lui.
  if (last !== Math.floor(to.y) * width + Math.floor(to.x) && path.length > 1)
    stops.push(center(last));
  stops.push(to);
  const body = sim.world.players[player].body;
  for (let n = 0; n < seconds / SIM_DT && stops.length > 0; n++) {
    if (until?.() === true) break;
    const next = stops[0] ?? to;
    const dx = next.x - body.x;
    const dy = next.y - body.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.15) {
      stops.shift();
      continue;
    }
    const inputs: [StepInput, StepInput] = [idleInput(n), idleInput(n)];
    inputs[player] = { ...idleInput(n), moveX: dx / d, moveY: dy / d };
    step(sim, inputs, []);
  }
  wait(sim, 0.3);
  return Math.hypot(to.x - body.x, to.y - body.y);
}

describe('wagon du prologue: le trajet des étapes se fait à pied', () => {
  it('chacun va de l’arrivée à chaque endroit de la quête, dans l’ordre des étapes, sans être replacé', () => {
    const sim = createSim(content, createWorld(content, SEED, MEMBERS));
    wait(sim, 0.5);
    const story = sim.world.common.story;
    if (story !== undefined) story.scene = null;
    const place = content.places[PROLOGUE];
    if (place === undefined) throw new Error('lieu de départ absent');
    // Les joueurs naissent bien dans la partie de la voiture d'où tout s'atteint.
    const reached = walkableFromArrival(content, place);
    for (const p of [0, 1] as const) {
      const { x, y } = sim.world.players[p].body;
      expect(
        reached.has(Math.floor(y) * place.map.width + Math.floor(x)),
        `départ ${String(p)}`,
      ).toBe(true);
    }
    const spots = questSpots(place);
    expect(spots.length).toBeGreaterThanOrEqual(4);
    // L'autre joueur suit de près: le couloir n'a qu'un mètre, il ne doit pas faire bouchon.
    for (const spot of spots)
      for (const p of [0, 1] as const) {
        const left = walkTo(sim, p, spot);
        // Poste d'un habitant: il occupe sa place, on s'arrête contre lui, à portée de parole.
        const tolerance = spot.post ? content.settings.reach.action : 0.75;
        expect(left, `joueur ${String(p)} vers ${spot.label}`).toBeLessThan(tolerance);
      }
  });
});

describe('Aubrune: les deux signalements, joués à pied', () => {
  /** Une partie posée sur le quai d'Aubrune, scène d'accueil passée. */
  function atAubrune(): Sim {
    const world = createWorld(content, SEED, MEMBERS);
    world.common.place = 'aubrune';
    const place = content.places.aubrune;
    if (place === undefined) throw new Error('Aubrune absente');
    world.places[place.def.id] ??= createPlaceState(content, place);
    placeAtArrival(content, world);
    const sim = createSim(content, world);
    wait(sim, 0.5);
    const story = sim.world.common.story;
    if (story !== undefined) story.scene = null;
    return sim;
  }

  /**
   * Le joueur 0 part devant la porte `door` du dehors, puis passe chaque porte de `legs` en
   * marchant (il doit se retrouver dans la salle annoncée) et finit au point `spot`.
   */
  function walkIn(
    door: string,
    legs: readonly (readonly [string, string])[],
    spot: string,
  ): number {
    const sim = atAubrune();
    const place = content.places.aubrune;
    const d = place?.map.doors?.[door];
    const target = place?.map.points[spot];
    if (place === undefined || d === undefined || target === undefined)
      throw new Error('porte ou point absent');
    const body = sim.world.players[0].body;
    Object.assign(body, { x: Math.floor(d.x) + 1.5, y: Math.floor(d.y) + 0.5 });
    for (const [id, room] of legs) {
      const sill = sillsOf(place)[id];
      if (sill === undefined) throw new Error(`porte ${id} absente`);
      // On franchit le seuil en poussant vers la porte: le but est juste derrière lui, dans le mur.
      const at =
        sill.kind === 'floor' ? sill : { x: sill.x - sill.nx * 0.3, y: sill.y - sill.ny * 0.3 };
      const inside = (): boolean => interiorAt(place, body.x, body.y) === room;
      // D'abord devant la porte, de son côté (une porte de cloison ne se passe que de face).
      if (sill.kind === 'wall')
        walkTo(sim, 0, { x: sill.x + sill.nx * 0.5, y: sill.y + sill.ny * 0.5 }, 15, inside);
      walkTo(sim, 0, at, 15, inside);
      expect(interiorAt(place, body.x, body.y), `après ${id}`).toBe(room);
    }
    return walkTo(sim, 0, target, 15);
  }

  it('de la place au lit de la pension: boutique, cuisine, escalier, palier', () => {
    const left = walkIn(
      'porte-epicerie-epicerie-rdc',
      [
        ['porte-epicerie-epicerie-rdc', 'epicerie-rdc'],
        ['epicerie-rdc-esc-epicerie-etage', 'epicerie-etage'],
      ],
      'pension-lit-a',
    );
    expect(left).toBeLessThan(0.75);
  });

  it('de la route à la cave et à l’étage de la maison du garde', () => {
    const cave = walkIn(
      'porte-maison-maison-rdc',
      [
        ['porte-maison-maison-rdc', 'maison-rdc'],
        ['maison-rdc-esc-maison-cave', 'maison-cave'],
      ],
      'cave-lanterne',
    );
    expect(cave).toBeLessThan(0.75);
    const etage = walkIn(
      'porte-maison-maison-rdc',
      [
        ['porte-maison-maison-rdc', 'maison-rdc'],
        ['maison-rdc-esc-maison-etage', 'maison-etage'],
      ],
      'maison-etage-milieu',
    );
    expect(etage).toBeLessThan(0.75);
  });
});
