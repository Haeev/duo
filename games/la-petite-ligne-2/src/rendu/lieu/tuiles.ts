/**
 * Anneau de tuiles autour du joueur local (ADR 0022): ce que chaque machine construit et libère.
 * Logique pure, sans Three.js: chargement des tuiles qui touchent le disque (rayon de vue + marge),
 * déchargement seulement au-delà d'un rayon plus grand (hystérésis: pas d'aller-retour au bord).
 */
import { TILE_SIZE, tileGrid, tilesAround } from '../../donnees/carte';
import type { MapDef } from '../../donnees/schemas/lieu';
import { TILE_SETTINGS } from './reglages-tuiles';

type MapSize = Pick<MapDef, 'width' | 'height'>;

/** Distance (m) du point (x, y) au rectangle de la tuile, 0 dedans. */
export function tileDistance(map: MapSize, tile: number, x: number, y: number): number {
  const { cols } = tileGrid(map);
  const col = tile % cols;
  const row = Math.floor(tile / cols);
  const dx = Math.max(col * TILE_SIZE - x, 0, x - (col + 1) * TILE_SIZE);
  const dy = Math.max(row * TILE_SIZE - y, 0, y - (row + 1) * TILE_SIZE);
  return Math.hypot(dx, dy);
}

/** Rectangle de la tuile en mètres (borné à la carte). */
export function tileRect(
  map: MapSize,
  tile: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const { cols } = tileGrid(map);
  const x0 = (tile % cols) * TILE_SIZE;
  const y0 = Math.floor(tile / cols) * TILE_SIZE;
  return {
    x0,
    y0,
    x1: Math.min(map.width, x0 + TILE_SIZE),
    y1: Math.min(map.height, y0 + TILE_SIZE),
  };
}

export interface RingChange {
  /** Tuiles à construire, la plus proche d'abord. */
  readonly load: readonly number[];
  readonly unload: readonly number[];
}

type RingSettings = typeof TILE_SETTINGS.ring;

export class TileRing {
  private readonly held = new Set<number>();

  constructor(
    private readonly map: MapSize,
    private readonly settings: RingSettings = TILE_SETTINGS.ring,
  ) {}

  /** Nouvelle position du joueur local et rayon de vue (m): ce qui entre et ce qui sort. */
  update(x: number, y: number, viewRadius: number): RingChange {
    const wanted = tilesAround(this.map, x, y, viewRadius + this.settings.loadMargin);
    const keep = new Set(tilesAround(this.map, x, y, viewRadius + this.settings.unloadMargin));
    const load: number[] = [];
    for (const tile of wanted) {
      if (this.held.has(tile)) continue;
      this.held.add(tile);
      load.push(tile);
    }
    const unload: number[] = [];
    for (const tile of this.held) {
      if (keep.has(tile)) continue;
      unload.push(tile);
    }
    for (const tile of unload) this.held.delete(tile);
    load.sort((a, b) => tileDistance(this.map, a, x, y) - tileDistance(this.map, b, x, y));
    return { load, unload };
  }

  has(tile: number): boolean {
    return this.held.has(tile);
  }

  /** Tuiles tenues, dans l'ordre des index. */
  tiles(): number[] {
    return [...this.held].sort((a, b) => a - b);
  }

  get size(): number {
    return this.held.size;
  }

  clear(): void {
    this.held.clear();
  }
}
