// Décor du wagon du prologue (lieu `train-de-nuit`) et sols d'intérieur des petits lieux: le lieu se
// charge, chaque point cité par ses scènes, sa quête et son habitant existe et s'atteint depuis
// l'arrivée, les deux s'assoient face à face, chacun se couche sur sa couchette, et un sol déclaré
// dans une carte (exemplaire factice) arrive au rendu sans autre changement.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { describePlace } from '../src/rendu/lieu/description';
import { GROUND_LOOKS } from '../src/rendu/lieu/reglages-tuiles';
import { floorGeometry, floorNatures } from '../src/rendu/lieu/sol';
import { CHARACTER_SETTINGS } from '../src/rendu/personnages/reglages';
import { postureOf, standUp } from '../src/simulation/briques/postures';
import { bodyCollides, isBlockedCell } from '../src/simulation/noyau/grille';
import { createWorld } from '../src/simulation/noyau/monde';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { put } from './aides-noyau';

const PLACE = 'train-de-nuit';
const files = gameDataFiles();
const content = loadContent(files);
const train = content.places[PLACE];

/** Le prologue à 21 h 30, scène d'ouverture passée: les joueurs ont la main. */
function prologue(): Sim {
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  wait(sim, 0.5);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  return sim;
}

/** Identifiants de points cités par une fiche (`point`, `stands`, `arrival`, `platform`). */
function citedPoints(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const item of value) citedPoints(item, out);
  else if (typeof value === 'object' && value !== null)
    for (const [key, item] of Object.entries(value)) {
      if (['point', 'stands', 'arrival', 'platform'].includes(key) && typeof item === 'string')
        out.add(item);
      else citedPoints(item, out);
    }
  return out;
}

function sitOn(sim: Sim, player: PlayerIndex, target: string): void {
  act(sim, player, { type: 'use_brick', target, brick: 'sit' });
  wait(sim, 1.5);
}

describe('le wagon du train de nuit', () => {
  it('se charge avec son sol de plancher, son tapis de couloir et le noir autour', () => {
    expect(train).toBeDefined();
    const map = train?.map;
    if (map?.floor === undefined) throw new Error('sol du wagon absent');
    const natures = floorNatures(map.floor, map.width, map.height);
    expect(natures[4 * map.width + 3]).toBe('tapis-de-couloir');
    expect(natures[3 * map.width + 8]).toBe('plancher');
    expect(natures[0]).toBe('vide');
    expect(map.blocked).toEqual([]);
  });

  it('chaque point des scènes, de la quête et du Contrôleur existe, est libre et s’atteint', () => {
    const sim = prologue();
    const map = train?.map;
    const blockers = currentBlockers(content, sim.world);
    if (map === undefined || blockers === null) throw new Error('wagon absent');
    const cited = new Set<string>();
    for (const [path, json] of Object.entries(files))
      if (path.startsWith(`lieux/${PLACE}/`)) citedPoints(json, cited);
    expect([...cited].sort()).toEqual(['chariot', 'compartiment', 'couloir', 'porte']);
    // Parcours en largeur des cases libres depuis l'arrivée.
    const start = map.points.compartiment ?? { x: -1, y: -1 };
    const seen = new Set<number>([Math.floor(start.y) * map.width + Math.floor(start.x)]);
    const queue = [...seen];
    for (const cell of queue) {
      const x = cell % map.width;
      const y = Math.floor(cell / map.width);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = (y + dy) * map.width + x + dx;
        if (isBlockedCell(blockers, x + dx, y + dy) || seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    // Rien ne fuit hors de la voiture: 7 x 3 cases moins les banquettes, tablettes et couchettes.
    expect(seen.size).toBe(7 * 3 - 2 * 5);
    const radius = content.settings.movement.radius;
    for (const id of Object.keys(map.points)) {
      const p = map.points[id] ?? { x: -1, y: -1 };
      expect(bodyCollides(blockers, p.x, p.y, radius), `${id} dégagé`).toBe(false);
      expect(seen.has(Math.floor(p.y) * map.width + Math.floor(p.x)), `${id} atteint`).toBe(true);
    }
  });

  it('les banquettes ont deux places assises, les couchettes une place couchée', () => {
    const types = new Set(train?.map.objects.map((o) => o.type));
    expect(types).toContain('banquette-de-train');
    expect(content.props['banquette-de-train']?.bricks).toEqual([
      { brick: 'sit', seats: 2, restPerMinute: 6 },
    ]);
    expect(content.props.banquette?.bricks[0]?.brick).toBe('sleep');
    // Assise livrée à 0,45 m: les personnages assis s'y posent à cette hauteur.
    expect(CHARACTER_SETTINGS.seat.byModel['train-seat']?.height).toBeCloseTo(0.45, 2);
    const seats = train?.map.objects.filter((o) => o.type === 'banquette-de-train') ?? [];
    // Par travée, une banquette tournée vers l'est (1) et une vers l'ouest (3), l'une en face de l'autre.
    expect(seats.map((o) => o.rotation).sort()).toEqual([1, 1, 3, 3]);
  });

  it('les deux s’assoient face à face de part et d’autre de la tablette, puis se relèvent dans le couloir', () => {
    const sim = prologue();
    put(sim, 0, 2.7, 4.4, -Math.PI / 2);
    put(sim, 1, 4.3, 4.4, -Math.PI / 2);
    sitOn(sim, 0, 'banquette-nord-ouest');
    sitOn(sim, 1, 'banquette-nord-est');
    const place = sim.world.places[PLACE];
    if (place === undefined) throw new Error('état du wagon absent');
    expect(postureOf(place, 0)?.object).toBe('banquette-nord-ouest');
    expect(postureOf(place, 1)?.object).toBe('banquette-nord-est');
    const [a, b] = sim.world.players;
    expect(a.body.facing).toBeCloseTo(0);
    expect(Math.abs(b.body.facing)).toBeCloseTo(Math.PI);
    expect(a.body.x).toBeLessThan(3.5);
    expect(b.body.x).toBeGreaterThan(3.5);
    for (const p of [0, 1] as const) {
      standUp(contextOf(sim), p);
      const body = sim.world.players[p].body;
      expect(body.y, 'relevé dans le couloir').toBeGreaterThan(4);
      expect(body.y).toBeLessThan(5);
    }
  });

  it('chacun se couche sur sa couchette', () => {
    const sim = prologue();
    put(sim, 0, 6.0, 4.4, -Math.PI / 2);
    put(sim, 1, 6.0, 4.6, Math.PI / 2);
    act(sim, 0, { type: 'use_brick', target: 'couchette-nord', brick: 'sleep' });
    act(sim, 1, { type: 'use_brick', target: 'couchette-sud', brick: 'sleep' });
    wait(sim, 1.5);
    const place = sim.world.places[PLACE];
    if (place === undefined) throw new Error('état du wagon absent');
    expect(postureOf(place, 0)?.kind).toBe('sleep');
    expect(postureOf(place, 1)?.kind).toBe('sleep');
  });
});

describe('sols d’intérieur des petits lieux', () => {
  it('toutes les natures citées par les cartes sont connues du rendu', () => {
    for (const place of Object.values(content.places)) {
      const floor = place.map.floor;
      if (floor === undefined) continue;
      for (const nature of [floor.nature, ...(floor.areas ?? []).map((a) => a.nature)])
        expect(GROUND_LOOKS[nature], `${place.def.id}: ${nature}`).toBeDefined();
    }
  });

  it('un sol ajouté à une carte (exemplaire factice) arrive au rendu sans autre changement', () => {
    const fake = contentWith((data) => {
      const map = data['lieux/essai-gare/carte.json'] as Record<string, unknown>;
      map.floor = { nature: 'vide', areas: [{ x: 2, y: 2, w: 3, h: 2, nature: 'plancher' }] };
    });
    const place = fake.places['essai-gare'];
    if (place === undefined) throw new Error('gare d’essai absente');
    const description = describePlace(fake, place);
    expect(description.floor?.areas?.[0]?.nature).toBe('plancher');
    if (description.floor === undefined) throw new Error('sol absent de la description');
    const geometry = floorGeometry(description.floor, description.width, description.height);
    // 6 cases de plancher en lames de 0,2 m (5 lames), et la tranche autour: 10 côtés.
    expect(geometry.getIndex()?.count).toBe((6 * 5 + 10) * 6);
    const box = geometry.boundingBox;
    expect(box?.min.x).toBe(2);
    expect(box?.max.z).toBe(4);
    geometry.dispose();
  });
});
