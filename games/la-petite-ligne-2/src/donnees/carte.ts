/**
 * Lecture des grands lieux (ADR 0022): terrain en plages, tuiles de rendu, intérieurs fusionnés
 * sur la grille du lieu. Fonctions pures, sans Three.js: partagées par le chargement, la
 * simulation, le rendu et les tests.
 */
import type { InteriorDef, MapDef, TerrainDef } from './schemas/lieu';
import { TILE_SIZE } from './schemas/lieu';

export { TILE_SIZE };

/** Plages d'un tableau de codes: code, longueur, code, longueur... */
export function encodeRuns(codes: ArrayLike<number>): number[] {
  const runs: number[] = [];
  let i = 0;
  while (i < codes.length) {
    const code = codes[i] ?? 0;
    let n = 1;
    while (i + n < codes.length && codes[i + n] === code) n++;
    runs.push(code, n);
    i += n;
  }
  return runs;
}

/** Problème d'un terrain (plages qui ne couvrent pas la carte, code hors légende), `null` s'il est sain. */
export function terrainProblem(terrain: TerrainDef, width: number, height: number): string | null {
  const { runs, legend } = terrain;
  if (runs.length % 2 !== 0) return 'plages: nombre impair de valeurs';
  let total = 0;
  for (let i = 0; i < runs.length; i += 2) {
    const code = runs[i] ?? 0;
    if (code >= legend.length) return `plages: code ${String(code)} hors de la légende`;
    total += runs[i + 1] ?? 0;
  }
  if (total !== width * height)
    return `plages: ${String(total)} cases pour ${String(width * height)} attendues`;
  return null;
}

/** Le terrain case par case (index `y * width + x`), `null` si la carte n'en a pas. */
export function decodeTerrain(
  map: Pick<MapDef, 'terrain' | 'width' | 'height'>,
): Uint8Array | null {
  const terrain = map.terrain;
  if (terrain === undefined) return null;
  const cells = new Uint8Array(map.width * map.height);
  let at = 0;
  for (let i = 0; i + 1 < terrain.runs.length; i += 2) {
    const n = terrain.runs[i + 1] ?? 0;
    cells.fill(terrain.runs[i] ?? 0, at, Math.min(cells.length, at + n));
    at += n;
  }
  return cells;
}

/** Nombre de tuiles en largeur et en hauteur. */
export function tileGrid(map: Pick<MapDef, 'width' | 'height'>): { cols: number; rows: number } {
  return { cols: Math.ceil(map.width / TILE_SIZE), rows: Math.ceil(map.height / TILE_SIZE) };
}

/** Index de la tuile qui contient (x, y), borné à la carte. */
export function tileOf(map: Pick<MapDef, 'width' | 'height'>, x: number, y: number): number {
  const { cols, rows } = tileGrid(map);
  const col = Math.min(cols - 1, Math.max(0, Math.floor(x / TILE_SIZE)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(y / TILE_SIZE)));
  return row * cols + col;
}

/**
 * Tuiles qui touchent le disque de centre (x, y) et de rayon `radius` (m), dans l'ordre des index.
 * Le rendu de chaque machine les tient chargées autour de son joueur local (rayon de vue plus une
 * marge); les deux joueurs peuvent être loin l'un de l'autre.
 */
export function tilesAround(
  map: Pick<MapDef, 'width' | 'height'>,
  x: number,
  y: number,
  radius: number,
): number[] {
  const { cols, rows } = tileGrid(map);
  const out: number[] = [];
  const c0 = Math.max(0, Math.floor((x - radius) / TILE_SIZE));
  const c1 = Math.min(cols - 1, Math.floor((x + radius) / TILE_SIZE));
  const r0 = Math.max(0, Math.floor((y - radius) / TILE_SIZE));
  const r1 = Math.min(rows - 1, Math.floor((y + radius) / TILE_SIZE));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      // Distance du centre au rectangle de la tuile.
      const dx = Math.max(col * TILE_SIZE - x, 0, x - (col + 1) * TILE_SIZE);
      const dy = Math.max(row * TILE_SIZE - y, 0, y - (row + 1) * TILE_SIZE);
      if (dx * dx + dy * dy <= radius * radius) out.push(row * cols + col);
    }
  }
  return out;
}

/** Range des éléments par tuile (selon leur position): ce que le rendu construit tuile par tuile. */
export function byTile<T extends { readonly x: number; readonly y: number }>(
  map: Pick<MapDef, 'width' | 'height'>,
  items: Iterable<T>,
): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const item of items) {
    const tile = tileOf(map, item.x, item.y);
    const list = out.get(tile);
    if (list === undefined) out.set(tile, [item]);
    else list.push(item);
  }
  return out;
}

/**
 * La carte du lieu avec ses intérieurs posés dessus: murs, points, meubles et portes décalés de
 * `at`, plus un mur d'une case tout autour de chaque intérieur. Les identifiants restent ceux des
 * fichiers (le contrôle refuse les doublons entre le dehors et les intérieurs).
 */
export function withInteriors(map: MapDef, interiors: readonly InteriorDef[]): MapDef {
  if (interiors.length === 0) return map;
  const blocked = [...map.blocked];
  const points = { ...map.points };
  const objects = [...map.objects];
  const doors = { ...map.doors };
  for (const room of interiors) {
    const { x: ox, y: oy } = room.at;
    const { width: w, height: h } = room;
    blocked.push(
      { x: ox - 1, y: oy - 1, w: w + 2, h: 1 },
      { x: ox - 1, y: oy + h, w: w + 2, h: 1 },
      { x: ox - 1, y: oy, w: 1, h },
      { x: ox + w, y: oy, w: 1, h },
    );
    for (const r of room.blocked) blocked.push({ ...r, x: r.x + ox, y: r.y + oy });
    for (const [id, p] of Object.entries(room.points)) points[id] = { x: p.x + ox, y: p.y + oy };
    for (const o of room.objects) objects.push({ ...o, x: o.x + ox, y: o.y + oy });
    for (const [id, d] of Object.entries(room.doors ?? {}))
      doors[id] = { ...d, x: d.x + ox, y: d.y + oy };
  }
  return { ...map, blocked, points, objects, doors };
}
