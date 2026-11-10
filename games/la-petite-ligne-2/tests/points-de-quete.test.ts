// Règle d'accès (défaut D5 de la recette): aucun point de quête n'est inaccessible. Pour chaque
// lieu du jeu, tout endroit où une quête envoie les joueurs s'atteint à pied depuis l'arrivée
// (`aides-acces.ts`, données seules). Dans le wagon du prologue, la preuve est aussi jouée: les
// deux joueurs marchent, par leurs commandes, d'étape en étape, sans jamais être replacés.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { isBlockedCell } from '../src/simulation/noyau/grille';
import { createWorld } from '../src/simulation/noyau/monde';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, step, type Sim } from '../src/simulation/noyau/pas';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import { questSpots, unreachableQuestSpots, walkableFromArrival } from './aides-acces';
import { wait } from './aides-l3';

const content = loadContent(gameDataFiles());
const PROLOGUE = content.settings.start.place;

describe('règle d’accès: aucun point de quête inaccessible', () => {
  it('dans chaque lieu, tout endroit où une quête envoie les joueurs s’atteint depuis l’arrivée', () => {
    const problems: string[] = [];
    for (const place of Object.values(content.places))
      problems.push(...unreachableQuestSpots(content, place));
    expect(problems).toEqual([]);
  });

  it('un point de quête enfermé (exemplaire factice) est signalé, sans autre changement', () => {
    type Json = Record<string, unknown>;
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

/** Chemin de cases libres (quatre voisins) de la case du corps à celle du but, obstacles du jeu. */
function cellPath(sim: Sim, player: PlayerIndex, to: { x: number; y: number }): number[] | null {
  const b = currentBlockers(sim.content, sim.world);
  if (b === null) return null;
  const body = sim.world.players[player].body;
  const start = Math.floor(body.y) * b.width + Math.floor(body.x);
  const goal = Math.floor(to.y) * b.width + Math.floor(to.x);
  const prev = new Map<number, number>([[start, -1]]);
  const queue = [start];
  for (const i of queue) {
    if (i === goal) break;
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
  if (!prev.has(goal)) return null;
  const cells: number[] = [];
  for (let i = goal; i !== -1; i = prev.get(i) ?? -1) cells.push(i);
  return cells.reverse();
}

/**
 * Fait marcher un joueur jusqu'à `to` par ses commandes (jamais en posant son corps): il suit les
 * centres des cases du chemin, puis le but. Renvoie la distance qui reste au bout de `seconds`.
 */
function walkTo(sim: Sim, player: PlayerIndex, to: { x: number; y: number }, seconds = 12): number {
  const path = cellPath(sim, player, to);
  if (path === null) return Number.POSITIVE_INFINITY;
  const width = sim.content.places[sim.world.common.place]?.map.width ?? 1;
  const stops = path
    .slice(1, -1)
    .map((i) => ({ x: (i % width) + 0.5, y: Math.floor(i / width) + 0.5 }));
  stops.push(to);
  const body = sim.world.players[player].body;
  for (let n = 0; n < seconds / SIM_DT && stops.length > 0; n++) {
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
