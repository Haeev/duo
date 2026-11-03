/**
 * 0.13, lot L0 (v0-13-carte.md, section 2 et CA-C8): l'origine de la grille ne change pas la partie.
 * - Une petite carte, lue avec l'origine (0, 0) puis décalée de (-24, -30), donne les mêmes cases
 *   bloquées, les mêmes chemins, les mêmes déplacements et les mêmes bâtiments, à la translation près.
 * - La carte du jeu, entourée de cases bloquées (origine reculée, rien de franchissable en plus),
 *   donne exactement la même partie jouée par le robot: aucun calcul d'indice n'oublie l'origine.
 */
import { describe, expect, it } from 'vitest';
import { loadMap } from '../src/donnees/carte';
import { MAP_FILES } from '../src/donnees/cartes-fichiers';
import { LEVEL_MAP_FILE } from '../src/donnees/carte-niveau';
import {
  type GameMap,
  buildingAt,
  cellIndex,
  groundAt,
  inMap,
  mapMaxX,
  mapMaxY,
  mapMinX,
  mapMinY,
} from '../src/etat/carte';
import type { Vec2 } from '../src/etat/types';
import { type Blockers, bodyCollides, findPath, isBlockedCell, moveBody, nearestFreeCell } from '../src/simulation/grille';
import { REQUIRED_POINTS } from '../src/donnees/carte';
import { createWorld } from '../src/simulation/monde';
import { step } from '../src/simulation/pas';
import { createRobot } from '../src/simulation/robot';
import { SEED, contentAndMap } from './aides';

const DX = -24;
const DY = -30;

/**
 * Petite carte de 24 x 16 m: maisonnette (murs, pièce, porte au sud), mur nord-sud percé d'une
 * brèche (les chemins le contournent), mare, chemin, arbre à couper. Toutes les coordonnées du
 * monde sont décalées de (dx, dy), comme l'origine de la grille.
 */
const TERRAIN = [
  '...........+............',
  '...........+............',
  '..+++++++..+............',
  '..+sssss+..+............',
  '..+sssss+..+............',
  '..+sssss+...............',
  '..+sssss+..+............',
  '..+++s+++..+............',
  '...........+............',
  '...........+..~~~~~.....',
  '...........+..~~~~~.....',
  '..............~~~~~.....',
  '..............~~~~~.....',
  '::::::::::::::::::::::::',
  '........................',
  '........................',
];

function smallMap(dx: number, dy: number): Record<string, unknown> {
  const blocked = TERRAIN.map((line) => line.replace(/[+~]/g, '#').replace(/[^#]/g, '.'));
  const at = (x: number, y: number): { x: number; y: number } => ({ x: x + dx, y: y + dy });
  const rect = (x: number, y: number, w: number, h: number): Record<string, number> => ({ x: x + dx, y: y + dy, w, h });
  const points: Record<string, { x: number; y: number }> = {
    house_door: at(5.5, 8.5),
    house_spawn: at(5.5, 4.5),
    well: at(2.5, 12.5),
    village_square: at(16.5, 5.5),
    riverbank: at(13.5, 10.5),
  };
  // Les autres points attendus du code: au même endroit, sans importance ici.
  for (const id of REQUIRED_POINTS) if (id !== 'offstage') points[id] ??= at(20.5, 14.5);
  return {
    id: 'petite',
    nom: 'petite carte',
    taille: { largeur: 24, hauteur: 16, origine: { x: dx, y: dy } },
    terrain: {
      legende: { '.': { sol: 'grass' }, ':': { sol: 'path' }, '~': { sol: 'water' }, '+': { sol: 'stone' }, s: { sol: 'floor' } },
      lignes: TERRAIN,
    },
    infranchissable: { grille: blocked },
    types: { tree_oak: { categorie: 'arbre', hauteur: 8 }, house: { categorie: 'batiment', hauteur: 5 } },
    objets: [
      { id: 'tree_oak_01', type: 'tree_oak', ...at(20.5, 3.5), rotation: 0, coupable: true },
      { id: 'gatekeeper_house', type: 'house', ...at(5.5, 5), rotation: 0, rect: rect(2, 2, 7, 6) },
    ],
    points: Object.entries(points).map(([id, p]) => ({ id, x: p.x, y: p.y })),
    zones: [
      { id: 'garden', rect: rect(13, 2, 4, 3) },
      { id: 'house_interior', rect: rect(3, 3, 5, 4) },
    ],
    maison: {
      objet: 'gatekeeper_house',
      piece: 'house_interior',
      porte: { cx: 5 + dx, cy: 7 + dy },
      retour_de_minuit: 'house_spawn',
      mobilier_depart: [{ item: 'straw_bed', cx: 3 + dx, cy: 3 + dy, rotation: 0 }],
    },
    interieurs: [
      {
        id: 'house',
        objet: 'gatekeeper_house',
        nom: 'la maisonnette',
        pieces: [{ id: 'house_main', nom: 'la pièce', rect: rect(3, 3, 5, 4) }],
        fermees: [{ id: 'coin', rect: rect(3, 3, 1, 1) }],
        portes: [{ id: 'house_porte', cx: 5 + dx, cy: 7 + dy, dehors: { cx: 5 + dx, cy: 8 + dy }, point: 'house_door' }],
        apparition: 'house_spawn',
        heures: null,
        ambiance: null,
        mobilier: [{ id: 'banc', rotation: 0, cases: [[7 + dx, 6 + dy]] }],
      },
    ],
    ru: { colonnes: [22 + dx], de_y: dy, a_y: 8 + dy },
    ouvrages: [{ id: 'planche', nature: 'passerelle', franchit: 'ru', rect: rect(21, 5, 3, 1), modele: 'footbridge' }],
  };
}

function load(dx: number, dy: number): GameMap {
  const result = loadMap({ [LEVEL_MAP_FILE]: smallMap(dx, dy) });
  expect(result.warning).toBeNull();
  expect(result.source).toBe('level');
  return result.map;
}

function blockers(map: GameMap): Blockers {
  const dynamic = new Uint8Array(map.width * map.height);
  // L'arbre debout bloque par la couche dynamique, comme dans la partie.
  for (const t of map.trees) dynamic[cellIndex(map, Math.floor(t.pos.x), Math.floor(t.pos.y))] = 1;
  return { map, dynamic };
}

const shift = (p: Vec2, dx: number, dy: number): Vec2 => ({ x: p.x + dx, y: p.y + dy });

function expectSamePath(a: Vec2[] | null, b: Vec2[] | null, label: string): void {
  if (a === null || b === null) {
    expect(b === null, label).toBe(a === null);
    return;
  }
  expect(b.length, label).toBe(a.length);
  a.forEach((p, i) => {
    const q = b[i];
    expect(q?.x ?? Number.NaN, label).toBeCloseTo(p.x + DX, 9);
    expect(q?.y ?? Number.NaN, label).toBeCloseTo(p.y + DY, 9);
  });
}

/** Petit générateur congruentiel: les mêmes directions pour les deux cartes. */
function directions(seed: number, count: number): [number, number][] {
  let s = seed >>> 0;
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const angle = (s / 2 ** 32) * Math.PI * 2;
    out.push([Math.cos(angle) * 0.12, Math.sin(angle) * 0.12]);
  }
  return out;
}

describe('origine de la grille: invariance par translation (CA-C8)', () => {
  const a = load(0, 0);
  const b = load(DX, DY);
  const ba = blockers(a);
  const bb = blockers(b);

  it('lit l’origine, les bornes et les données décalées (pièces, portes et cases négatives comprises)', () => {
    expect([a.originX, a.originY, b.originX, b.originY]).toEqual([0, 0, DX, DY]);
    expect([mapMinX(b), mapMaxX(b), mapMinY(b), mapMaxY(b)]).toEqual([DX, DX + 23, DY, DY + 15]);
    expect(b.house.door).toEqual({ cx: 5 + DX, cy: 7 + DY });
    expect(b.buildings.house?.rooms[0]?.rect).toEqual({ x: 3 + DX, y: 3 + DY, w: 5, h: 4 });
    expect(b.buildings.house?.fixtures[0]?.cells).toEqual([{ cx: 7 + DX, cy: 6 + DY }]);
    expect(b.stream).toEqual({ columns: [22 + DX], fromY: DY, toY: 8 + DY });
    expect(b.startFurniture[0]?.cell).toEqual({ cx: 3 + DX, cy: 3 + DY });
    // Le point `offstage` par défaut est hors de la carte, quelle que soit l'origine.
    for (const map of [a, b]) {
      const off = map.points.offstage;
      expect(off === undefined ? true : inMap(map, Math.floor(off.x), Math.floor(off.y))).toBe(false);
    }
  });

  it('mêmes sols, mêmes cases bloquées et même index, bord extérieur compris', () => {
    for (let cy = -2; cy < a.height + 2; cy++) {
      for (let cx = -2; cx < a.width + 2; cx++) {
        const label = `(${String(cx)}, ${String(cy)})`;
        expect(inMap(b, cx + DX, cy + DY), label).toBe(inMap(a, cx, cy));
        expect(groundAt(b, cx + DX, cy + DY), label).toBe(groundAt(a, cx, cy));
        expect(isBlockedCell(bb, cx + DX, cy + DY), label).toBe(isBlockedCell(ba, cx, cy));
        if (inMap(a, cx, cy)) expect(cellIndex(b, cx + DX, cy + DY), label).toBe(cellIndex(a, cx, cy));
        const room = buildingAt(a, {}, cx + 0.5, cy + 0.5);
        expect(buildingAt(b, {}, cx + DX + 0.5, cy + DY + 0.5), label).toBe(room);
      }
    }
    // Le coin nord-ouest de la carte décalée est la première case de la grille.
    expect(cellIndex(b, DX, DY)).toBe(0);
    expect(isBlockedCell(bb, DX - 1, DY)).toBe(true);
  });

  it('mêmes chemins entre toutes les paires de cases libres (A*, but bloqué compris)', () => {
    const free: Vec2[] = [];
    for (let cy = 0; cy < a.height; cy += 2) {
      for (let cx = 0; cx < a.width; cx += 3) if (!isBlockedCell(ba, cx, cy)) free.push({ x: cx + 0.5, y: cy + 0.5 });
    }
    // Un but dans la mare (case libre la plus proche), un dans la pièce, un hors de la carte.
    const goals = [...free, { x: 16.2, y: 10.7 }, { x: 5.5, y: 4.5 }, { x: -3.5, y: 4.5 }];
    let found = 0;
    for (const from of free) {
      for (const to of goals) {
        const pa = findPath(ba, from, to);
        const pb = findPath(bb, shift(from, DX, DY), shift(to, DX, DY));
        expectSamePath(pa, pb, `${JSON.stringify(from)} vers ${JSON.stringify(to)}`);
        if (pa !== null) found++;
      }
    }
    expect(found).toBeGreaterThan(500);
    const near = nearestFreeCell(ba, { x: 16.2, y: 10.7 });
    const nearB = nearestFreeCell(bb, { x: 16.2 + DX, y: 10.7 + DY });
    expect(near).not.toBeNull();
    expect(nearB).toEqual(near === null ? null : shift(near, DX, DY));
  });

  it('mêmes déplacements (glissements contre les murs, la mare et l’arbre)', () => {
    const starts: Vec2[] = [{ x: 9.5, y: 5.5 }, { x: 5.5, y: 4.5 }, { x: 13.5, y: 11.2 }, { x: 19.7, y: 3.5 }];
    starts.forEach((start, k) => {
      const pa = { ...start };
      const pb = shift(start, DX, DY);
      for (const [mx, my] of directions(17 + k, 800)) {
        moveBody(ba, pa, mx, my);
        moveBody(bb, pb, mx, my);
        expect(pb.x).toBeCloseTo(pa.x + DX, 9);
        expect(pb.y).toBeCloseTo(pa.y + DY, 9);
        expect(bodyCollides(bb, pb.x, pb.y)).toBe(bodyCollides(ba, pa.x, pa.y));
      }
    });
  });
});

/** La carte du jeu entourée de `pad` cases bloquées (l'origine recule d'autant), même `offstage`. */
function paddedGameMap(pad: number): GameMap {
  const raw = structuredClone(MAP_FILES[LEVEL_MAP_FILE]) as {
    taille: { largeur: number; hauteur: number; origine?: { x: number; y: number } };
    terrain: { legende: Record<string, { sol: string }>; lignes: string[] };
    infranchissable: { grille: string[] };
    points: { id: string; x: number; y: number }[];
  };
  const grass = Object.entries(raw.terrain.legende).find(([, v]) => v.sol === 'grass')?.[0] ?? '.';
  const padLines = (lines: string[], fill: string): string[] => {
    const width = (lines[0]?.length ?? 0) + 2 * pad;
    const row = fill.repeat(width);
    const side = fill.repeat(pad);
    return [...Array<string>(pad).fill(row), ...lines.map((l) => side + l + side), ...Array<string>(pad).fill(row)];
  };
  raw.terrain.lignes = padLines(raw.terrain.lignes, grass);
  raw.infranchissable.grille = padLines(raw.infranchissable.grille, '#');
  const origin = raw.taille.origine ?? { x: 0, y: 0 };
  raw.taille = { ...raw.taille, largeur: raw.taille.largeur + 2 * pad, hauteur: raw.taille.hauteur + 2 * pad, origine: { x: origin.x - pad, y: origin.y - pad } };
  raw.points = [...raw.points.filter((p) => p.id !== 'offstage'), { id: 'offstage', x: -500, y: -500 }];
  const result = loadMap({ [LEVEL_MAP_FILE]: raw });
  expect(result.warning).toBeNull();
  return result.map;
}

describe('la carte du jeu, entourée de cases bloquées, donne la même partie', () => {
  it('robot sur 18 000 pas (10 min de simulation): le même monde, pas à pas', () => {
    const { content } = contentAndMap();
    const plain = paddedGameMap(0);
    const padded = paddedGameMap(7);
    expect(padded.originX).toBe(plain.originX - 7);
    const players = [
      { id: 'membre-a', name: 'Camille', color: '#e07a5f' },
      { id: 'membre-b', name: 'Sacha', color: '#3d85c6' },
    ] as const;
    const s1 = createWorld(content, plain, SEED, players);
    const s2 = createWorld(content, padded, SEED, players);
    const r1 = createRobot();
    const r2 = createRobot();
    for (let tick = 0; tick < 18_000; tick++) {
      step(s1, r1.decide(s1));
      step(s2, r2.decide(s2));
      if (tick % 1000 === 0) expect(JSON.stringify(s2.world), `pas ${String(tick)}`).toBe(JSON.stringify(s1.world));
    }
    expect(JSON.stringify(s2.world)).toBe(JSON.stringify(s1.world));
    // Le jour a commencé et l'horloge a tourné: la partie est vraiment jouée.
    expect(s1.world.phase).toBe('day');
    expect(s1.world.clock.minutes).toBeGreaterThan(s1.content.settings.clock.firstDay.start + 60);
    // La partie a bien bougé: les joueurs ont marché.
    expect(s1.world.characters.some((c) => Math.hypot(c.pos.x - (plain.points.house_spawn?.x ?? 0), c.pos.y - (plain.points.house_spawn?.y ?? 0)) > 5)).toBe(true);
  }, 300_000);
});
