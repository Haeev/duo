/**
 * Petites textures de données calculées au chargement, partagées par les
 * shaders de l'ambiance (rien n'est téléchargé, tout est déterministe):
 *
 * - `noise`: bruit lisse qui se répète sans couture (nuages, flaques, rides de
 *   l'eau), 128 x 128 pixels, un canal;
 * - `field`: une case de la carte par pixel, bande prolongée comprise: hauteur
 *   du sol (R), profondeur de l'eau depuis la berge (G), bâtiment (B), eau (A).
 *   La pluie y lit le sol où éclabousser et où ne pas tomber (sous un toit),
 *   l'eau y lit son bord (écume, couleur du fond).
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NearestFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  Vector4,
} from 'three';
import type { GameMap } from '../etat/carte';
import { cellIndex } from '../etat/carte';
import { hash2 } from './bruit';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { Terrain } from './terrain';

const NOISE_SIZE = 128;
/** Mailles du bruit à chaque octave (doit diviser la taille pour boucler sans couture). */
const NOISE_OCTAVES = [8, 16, 32] as const;
const NOISE_WEIGHTS = [0.6, 0.28, 0.12] as const;
const NOISE_SEED = 31;
const BYTE = 255;
const RGBA = 4;
const HALF_CELL = 0.5;
/** Hauteurs codées dans le canal R: de `HEIGHT_MIN` à `HEIGHT_MIN + HEIGHT_RANGE` mètres. */
export const FIELD_HEIGHT_MIN = -0.5;
export const FIELD_HEIGHT_RANGE = 1.5;
/** Catégorie des bâtiments de la carte (pas de pluie dessous). */
const BUILDING_CATEGORY = 'batiment';
/** Le gué: gravier dans le lit de la rivière, sans eau dans sa colonne à moins de ces cases. */
const FORD_COLUMN_REACH = 5;
const FORD_ROW_REACH = 6;
/** Voisins d'une case (quatre directions). */
const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bruit de valeur périodique (maille `cells`), de 0 à 1. */
function periodicNoise(x: number, y: number, cells: number, seed: number): number {
  const fx = (x / NOISE_SIZE) * cells;
  const fy = (y / NOISE_SIZE) * cells;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = smooth(fx - ix);
  const ty = smooth(fy - iy);
  const wrap = (v: number): number => ((v % cells) + cells) % cells;
  const a = hash2(wrap(ix), wrap(iy), seed);
  const b = hash2(wrap(ix + 1), wrap(iy), seed);
  const c = hash2(wrap(ix), wrap(iy + 1), seed);
  const d = hash2(wrap(ix + 1), wrap(iy + 1), seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

/** Texture de bruit lisse, sans couture, filtrée et avec mipmaps (pas de crénelage au zoom large). */
export function createNoiseTexture(): DataTexture {
  const data = new Uint8Array(NOISE_SIZE * NOISE_SIZE);
  for (let y = 0; y < NOISE_SIZE; y += 1) {
    for (let x = 0; x < NOISE_SIZE; x += 1) {
      let value = 0;
      NOISE_OCTAVES.forEach((cells, octave) => {
        value += periodicNoise(x, y, cells, NOISE_SEED + octave) * (NOISE_WEIGHTS[octave] ?? 0);
      });
      data[y * NOISE_SIZE + x] = Math.round(Math.min(1, Math.max(0, value)) * BYTE);
    }
  }
  const texture = new DataTexture(data, NOISE_SIZE, NOISE_SIZE, RedFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Ce que les shaders doivent savoir pour lire le champ du terrain. */
export interface TerrainField {
  texture: DataTexture;
  /** Origine (x, z) du premier pixel et inverse de la taille (1 / largeur, 1 / hauteur), pour `uv = (xz - origine) * inverse`. */
  rect: Vector4;
  /** Hauteur codée: minimum et étendue (m). */
  height: Vector2;
  /** Cases du gué (lame d'eau sur les galets), en coordonnées de la carte. */
  fordCells: { cx: number; cy: number }[];
}

/**
 * Le gué n'est pas de l'eau dans la carte (gravier franchissable): une case de
 * gravier est du gué si l'eau la borde à l'est et à l'ouest sur sa rangée, et
 * si sa colonne n'a pas d'eau tout près (ce qui écarte les berges en avancée).
 */
function isFord(map: GameMap, cx: number, cy: number): boolean {
  const kind = (x: number, y: number): string =>
    x >= 0 && y >= 0 && x < map.width && y < map.height
      ? (map.ground[cellIndex(map, x, y)] ?? 'grass')
      : 'grass';
  if (kind(cx, cy) !== 'gravel') {
    return false;
  }
  for (let dy = -FORD_COLUMN_REACH; dy <= FORD_COLUMN_REACH; dy += 1) {
    if (kind(cx, cy + dy) === 'water') {
      return false;
    }
  }
  let west = false;
  let east = false;
  for (let d = 1; d <= FORD_ROW_REACH; d += 1) {
    west ||= kind(cx - d, cy) === 'water';
    east ||= kind(cx + d, cy) === 'water';
  }
  return west && east;
}

/** Champ du terrain: hauteur, profondeur de l'eau, bâtiments, eau (une case par pixel). */
export function createTerrainField(map: GameMap, terrain: Terrain): TerrainField {
  const ext = RENDER_SETTINGS.terrain.extension;
  const width = map.width + 2 * ext;
  const height = map.height + 2 * ext;
  const count = width * height;
  const water = new Uint8Array(count);
  const fordCells: { cx: number; cy: number }[] = [];
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const cx = px - ext;
      const cy = py - ext;
      if (terrain.look(cx, cy).kind === 'water') {
        water[py * width + px] = 1;
      } else if (isFord(map, cx, cy)) {
        fordCells.push({ cx, cy });
      }
    }
  }
  // Distance à la berge (en cases), par vagues depuis toutes les cases sèches.
  const distance = new Float32Array(count).fill(Number.POSITIVE_INFINITY);
  const queue: number[] = [];
  for (let i = 0; i < count; i += 1) {
    if (water[i] === 0) {
      distance[i] = 0;
      queue.push(i);
    }
  }
  // L'itérateur d'un tableau voit les cases ajoutées pendant le parcours (file d'attente).
  for (const index of queue) {
    const x = index % width;
    const y = Math.floor(index / width);
    const next = (distance[index] ?? 0) + 1;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
        continue;
      }
      const neighbour = ny * width + nx;
      if (next < (distance[neighbour] ?? 0)) {
        distance[neighbour] = next;
        queue.push(neighbour);
      }
    }
  }
  const buildings = map.props.filter(
    (prop) => prop.category === BUILDING_CATEGORY && prop.rect !== null,
  );
  const depthCells = AMBIANCE_SETTINGS.water.depthCells;
  const data = new Uint8Array(count * RGBA);
  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const i = py * width + px;
      const x = px - ext + HALF_CELL;
      const y = py - ext + HALF_CELL;
      const ground = terrain.heightAt(x, y);
      const inBuilding = buildings.some(
        (prop) =>
          prop.rect !== null &&
          x >= prop.rect.x &&
          y >= prop.rect.y &&
          x < prop.rect.x + prop.rect.w &&
          y < prop.rect.y + prop.rect.h,
      );
      const depth = water[i] === 1 ? Math.min(1, ((distance[i] ?? 0) - HALF_CELL) / depthCells) : 0;
      data[i * RGBA] = Math.round(
        Math.min(1, Math.max(0, (ground - FIELD_HEIGHT_MIN) / FIELD_HEIGHT_RANGE)) * BYTE,
      );
      data[i * RGBA + 1] = Math.round(Math.max(0, depth) * BYTE);
      data[i * RGBA + 2] = inBuilding ? BYTE : 0;
      data[i * RGBA + 3] = water[i] === 1 ? BYTE : 0;
    }
  }
  for (const cell of fordCells) {
    const i = (cell.cy + ext) * width + (cell.cx + ext);
    data[i * RGBA + 3] = BYTE;
  }
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return {
    texture,
    rect: new Vector4(-ext, -ext, 1 / width, 1 / height),
    height: new Vector2(FIELD_HEIGHT_MIN, FIELD_HEIGHT_RANGE),
    fordCells,
  };
}

/** Valeur de la carte du vent pour le feuillage et les herbes (balancement selon la hauteur). */
const WIND_FOLIAGE = 255;
/** Valeur pour les tissus (frisson). */
const WIND_CLOTH = 128;
/** Cases de tissu qui frissonnent au vent (store de l'épicerie). */
const WIND_CLOTH_CELLS: readonly string[] = ['awning_red', 'awning_cream'];
/** Cases de feuillage en dehors de la première rangée de la palette. */
const WIND_EXTRA_FOLIAGE = /^(flower_|ivy$)/;

/**
 * Carte du vent: une valeur par case de la palette (16 x 16), lue par le
 * nuanceur de sommets. Feuillage, herbes et cultures (toute la première
 * rangée), fleurs et lierre se balancent; le store frissonne.
 */
export function createWindMask(cells: readonly string[], grid: number): DataTexture {
  const data = new Uint8Array(grid * grid);
  cells.forEach((cell, index) => {
    const row = Math.floor(index / grid);
    if (row === 0 || WIND_EXTRA_FOLIAGE.test(cell)) {
      data[index] = WIND_FOLIAGE;
    } else if (WIND_CLOTH_CELLS.includes(cell)) {
      data[index] = WIND_CLOTH;
    }
  });
  const texture = new DataTexture(data, grid, grid, RedFormat, UnsignedByteType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
