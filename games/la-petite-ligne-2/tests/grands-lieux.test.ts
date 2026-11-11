// Grands lieux (ADR 0022): le plan d'Aubrune devient une carte valide, sans fuite vers les zones
// fermées; tuiles, terrain, intérieurs et portes; tailles réseau d'un grand lieu au pire.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  decodeTerrain,
  encodeRuns,
  terrainProblem,
  tileGrid,
  tilesAround,
} from '../src/donnees/carte';
import { ContentError, loadContent } from '../src/donnees/charger';
import { MapSchema, PLACE_BRICK_OBJECTS_MAX, type MapDef } from '../src/donnees/schemas/lieu';
import {
  BUDGET_BYTES,
  FastSchema,
  PLACE_OBJECTS_STATE_BYTES,
  SLICE_SCHEMAS,
} from '../src/reseau/canaux';
import { PLACE_PART_BUDGET_BYTES } from '../src/reseau/etat-lieu';
import { keyedParts } from '../src/reseau/par-cles';
import { NET_SETTINGS } from '../src/reseau/reglages';
import { byteLength, currentPlace, fastMessage, sliceMessage } from '../src/reseau/tranches';
import { planToMap } from '../outils/plan-vers-lieu';
import { dataFiles, gameContent, newSim, withAssembly } from './aides';

const PLAN = fileURLToPath(new URL('../donnees/lieux/aubrune/plan.json', import.meta.url));

function aubrune(): { map: MapDef; report: ReturnType<typeof planToMap>['report'] } {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8')) as unknown;
  const { map, report } = planToMap(plan, { place: 'aubrune', annex: 48 });
  return { map: v.parse(MapSchema, JSON.parse(JSON.stringify(map))), report };
}

describe('plan vers lieu (Aubrune)', () => {
  const { map, report } = aubrune();

  it('produit une carte valide, fermée là où l’histoire la ferme', () => {
    expect([map.width, map.height]).toEqual([384, 256]);
    expect(report.leaks).toEqual({});
    expect(report.unreachableNodes).toEqual([]);
    expect(report.firstActCut).toEqual([]);
    expect(report.blockedNodes).toEqual([]);
    expect(Object.keys(map.locks ?? {})).toHaveLength(12);
    // Plan version 3: portillon de la berge du moulin (`mp`) et allée du poulailler (`jo`).
    expect(Object.keys(map.graph?.nodes ?? {})).toHaveLength(119);
    expect(Object.keys(map.interests ?? {})).toHaveLength(68);
    expect(Object.keys(map.buildings ?? {})).toHaveLength(28);
    expect(map.terrain && terrainProblem(map.terrain, map.width, map.height)).toBeNull();
  });

  it('se charge comme un lieu du jeu (contrôles de cohérence compris)', () => {
    const files = dataFiles();
    // La grille brute de l'outil, avec les points, les meubles et les portes de l'assemblage
    // (`assembler_lieu.py` du plan): les intérieurs et les fiches livrés s'y chargent tels quels.
    files['lieux/aubrune/carte.json'] = v.parse(
      MapSchema,
      withAssembly(map, files['lieux/aubrune/carte.json']),
    );
    files['lieux/aubrune/lieu.json'] = {
      schema: 1,
      id: 'aubrune',
      name: 'Aubrune',
      station: { arrival: 'quai', platform: 'quai', platformRadius: 3 },
      links: [],
      activities: [],
      music: null,
    };
    const content = loadContent(files);
    expect(content.places.aubrune?.map.blocked.length).toBeGreaterThan(100);
  });

  it('se découpe en tuiles: 9 au plus autour d’un joueur, vue de 28 m comprise', () => {
    expect(tileGrid(map)).toEqual({ cols: 12, rows: 8 });
    const quai = map.points.quai;
    expect(quai).toBeDefined();
    if (quai === undefined) return;
    // Rayon de vue de la caméra la plus large (28 m de large: demi-diagonale sous 24 m) plus 8 m de marge.
    expect(tilesAround(map, quai.x, quai.y, 32).length).toBeLessThanOrEqual(9);
    expect(tilesAround(map, 0, 0, 10)).toEqual([0]);
  });
});

describe('terrain en plages', () => {
  it('se décode à l’identique', () => {
    const codes = Uint8Array.from([0, 0, 1, 2, 2, 2, 0, 1, 1, 1, 1, 0]);
    const terrain = { legend: ['a', 'b', 'c'], runs: encodeRuns(codes) };
    expect(terrainProblem(terrain, 4, 3)).toBeNull();
    expect(decodeTerrain({ terrain, width: 4, height: 3 })).toEqual(codes);
    expect(terrainProblem(terrain, 4, 4)).toMatch(/12 cases pour 16/);
    expect(terrainProblem({ legend: ['a'], runs: [3, 12] }, 4, 3)).toMatch(/hors de la légende/);
  });
});

describe('intérieurs et portes', () => {
  /** La halte d'essai agrandie d'une annexe, avec une salle reliée par une paire de portes. */
  function withRoom(
    edit?: (room: Record<string, unknown>) => void,
  ): ReturnType<typeof loadContent> {
    const files = dataFiles() as Record<string, Record<string, unknown>>;
    const map = files['lieux/essai-halte/carte.json'];
    if (map === undefined) throw new Error('carte absente');
    map.height = 48;
    map.outdoor = { x: 0, y: 0, w: 32, h: 32 };
    map.doors = { 'porte-dehors': { x: 20, y: 20, facing: 0, to: 'porte-salle' } };
    const room: Record<string, unknown> = {
      schema: 1,
      id: 'salle-d-essai',
      name: "Salle d'essai",
      width: 8,
      height: 6,
      at: { x: 2, y: 36 },
      blocked: [{ x: 0, y: 0, w: 8, h: 1 }],
      points: { 'milieu-salle': { x: 4, y: 3 } },
      objects: [],
      doors: { 'porte-salle': { x: 4, y: 5, facing: 2, to: 'porte-dehors' } },
    };
    edit?.(room);
    files['lieux/essai-halte/interieurs/salle-d-essai.json'] = room;
    return loadContent(files);
  }

  it('se posent sur la grille du lieu, murés, avec leurs portes', () => {
    const place = withRoom().places['essai-halte'];
    expect(place?.interiors.map((r) => r.id)).toEqual(['salle-d-essai']);
    expect(place?.map.points['milieu-salle']).toEqual({ x: 6, y: 39 });
    expect(place?.map.doors?.['porte-salle']).toMatchObject({ x: 6, y: 41 });
    // Mur du haut de la salle (décalé) et anneau de quatre murs autour.
    expect(place?.map.blocked).toContainEqual({ x: 2, y: 36, w: 8, h: 1 });
    expect(place?.map.blocked).toContainEqual({ x: 1, y: 35, w: 10, h: 1 });
  });

  it('refusent une salle posée sur le dehors ou une porte sans retour', () => {
    expect(() => withRoom((room) => (room.at = { x: 2, y: 20 }))).toThrow(/posé sur le dehors/);
    expect(() =>
      withRoom(
        (room) => (room.doors = { 'porte-salle': { x: 4, y: 5, facing: 2, to: 'ailleurs' } }),
      ),
    ).toThrow(ContentError);
  });
});

describe('réseau d’un grand lieu', () => {
  it('tient les budgets au pire d’Aubrune: tous les meubles à état, habitants loin du quai', () => {
    const content = gameContent();
    const sim = newSim(content);
    const place = currentPlace(sim.world);
    // Pire d'un grand lieu: le plafond de meubles à briques de la carte, chacun avec un état non vide.
    for (let i = 0; i < PLACE_BRICK_OBJECTS_MAX; i++) {
      const id = `cueillette-du-verger-${String(i)}`;
      place.objects[id] =
        i % 40 === 0
          ? { store: Array.from({ length: 40 }, () => ({ item: 'planche', count: 99 })) }
          : { gather: { left: 3, refillAt: 1_234_567 } };
    }
    for (let i = 0; i < 80; i++)
      place.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 287.123, y: 199.456 });
    for (let i = 0; i < 200; i++)
      place.placed.push({ id: `pose-${String(i)}`, type: 'banc', x: 312.5, y: 203.5, rotation: 1 });
    for (let i = 0; i < 32; i++)
      place.villagers[`habitant-${String(i)}`] = {
        met: [true, true],
        talkingWith: null,
        body: { x: 319.123456789, y: 207.98765432, facing: -3.14159265358, speed: 2.718281828 },
      };
    const message = sliceMessage(sim.world, 'place');
    expect(v.safeParse(SLICE_SCHEMAS.place, JSON.parse(JSON.stringify(message))).success).toBe(
      true,
    );
    // Le canal rapide porte les 32 mobiles du lieu, où qu'ils soient (pas de tri par distance).
    const fast = {
      ...fastMessage(sim.world, content, 123_456),
      villagers: Array.from({ length: 32 }, (): [number, number, number, number] => [
        319.123456789, 207.98765432, -3.14159265358, 2.718281828,
      ]),
    };
    expect(v.safeParse(FastSchema, JSON.parse(JSON.stringify(fast))).success).toBe(true);
    const { objects, ...rest } = message.place;
    const sizes = {
      tranche: byteLength(message),
      horsMeubles: byteLength({ ...message, place: rest }),
      meubles: byteLength(objects),
      fast: byteLength(fast),
    };
    process.stdout.write(`grand lieu au pire (octets): ${JSON.stringify(sizes)}\n`);
    // La tranche entière déborderait (ADR 0022): l'état du lieu part par morceaux (mission M3).
    expect(sizes.tranche).toBeGreaterThan(BUDGET_BYTES.place);
    const head = { target: 'aubrune', rev: 0, baseRev: -1, tick: 1 };
    const { parts } = keyedParts(null, message.place, head, NET_SETTINGS.place.partBytes);
    for (const part of parts) expect(byteLength(part)).toBeLessThanOrEqual(PLACE_PART_BUDGET_BYTES);
    expect(sizes.horsMeubles).toBeLessThanOrEqual(BUDGET_BYTES.place);
    expect(sizes.meubles).toBeLessThanOrEqual(PLACE_OBJECTS_STATE_BYTES);
    expect(sizes.fast).toBeLessThanOrEqual(BUDGET_BYTES.fast);
  });
});
