/**
 * Petites eaux creusées par le rendu (0.13). Le bief du moulin: l'eau vive amenée à la roue, puis
 * le canal de fuite qui la rend à l'Aubrune. Les petits bassins d'eau dormante (bassin de la source,
 * mare de la pâture): quelques cases seulement. Comme le ru, le rendu les creuse lui-même (berges
 * raides, fond de galets, eau du programme de la rivière), au lieu d'en faire un bout de grève: deux
 * rangées d'eau ne laissaient que des flaques dans le lit de la rivière. La mare du bois, assez
 * grande, garde le lit de la rivière (rives de sable).
 *
 * Ce module ne fait que la forme (pur, testable dans Node): des tronçons droits tirés des cases
 * `millrace` de la carte, des ouvrages qui le franchissent et des petites eaux; `terrain.ts` écrit
 * la géométrie.
 */
import type { GameMap } from '../etat/carte';
import { cellIndex, groundAt, inMap, mapMaxX, mapMinX, mapMinY, mapMaxY } from '../etat/carte';
import { isStreamCell, streamHeight, type StreamLayout } from './ru';

/** Tronçon droit: rectangle de cases, sens du courant, bout aval dans la rivière. */
export interface ChannelReach {
  /** Axe du courant: le long de x (bief) ou de y (canal de fuite). */
  axis: 'x' | 'y';
  /** En travers du courant: première coordonnée, et la suivante après la dernière case (m). */
  across0: number;
  across1: number;
  /** Le long du courant (m), bande prolongée comprise quand le tronçon touche le bord de la carte. */
  along0: number;
  along1: number;
  /** Le bout aval (`along1`) débouche dans la rivière: le fond rejoint son lit sur la dernière rangée. */
  mouth: boolean;
  /** Eau dormante (bassin): aucun courant, ses deux bouts fermés. */
  still: boolean;
  /** Le tronçon vu comme le ru (en travers: `x0`, `x1`; le long: `fromY`, `mouthY`), pour son profil. */
  layout: StreamLayout;
}

function reach(
  axis: ChannelReach['axis'],
  across0: number,
  across1: number,
  along0: number,
  along1: number,
  mouth: boolean,
  still = false,
): ChannelReach {
  return {
    axis,
    across0,
    across1,
    along0,
    along1,
    mouth,
    still,
    layout: { x0: across0, x1: across1, fromY: along0, mouthY: along1, embankment: new Set<number>() },
  };
}

/** Rangées d'eau du bief: au moins autant de cases sur la rangée. */
const MAIN_ROW_CELLS = 4;

function key(cx: number, cy: number): string {
  return `${cx}:${cy}`;
}

/**
 * Tronçons du bief, `[]` sans bief. Le bief court d'ouest en est sur ses rangées pleines (celles qui
 * ont au moins `MAIN_ROW_CELLS` cases); les cases qui restent (canal de fuite) forment un second
 * tronçon, tourné vers la rivière qui le borde.
 */
export function millraceReaches(map: GameMap, extension: number): ChannelReach[] {
  const cells = new Set<string>();
  for (let cy = mapMinY(map); cy <= mapMaxY(map); cy += 1) {
    for (let cx = mapMinX(map); cx <= mapMaxX(map); cx += 1) {
      if (map.groundStyles?.[cellIndex(map, cx, cy)] === 'millrace') cells.add(key(cx, cy));
    }
  }
  if (cells.size === 0) return [];
  // Les ouvrages du bief (passerelle de la vanne, planches du halage) sont posés sur son eau.
  for (const crossing of map.crossings) {
    if (crossing.crosses !== 'bief') continue;
    for (let cy = crossing.rect.y; cy < crossing.rect.y + crossing.rect.h; cy += 1) {
      for (let cx = crossing.rect.x; cx < crossing.rect.x + crossing.rect.w; cx += 1) cells.add(key(cx, cy));
    }
  }
  const coords = [...cells].map((text) => text.split(':').map(Number) as [number, number]);
  const rowCount = new Map<number, number>();
  for (const [, cy] of coords) rowCount.set(cy, (rowCount.get(cy) ?? 0) + 1);
  const rows = [...rowCount].filter(([, n]) => n >= MAIN_ROW_CELLS).map(([cy]) => cy);
  if (rows.length === 0) return [];
  const y0 = Math.min(...rows);
  const y1 = Math.max(...rows) + 1;
  const full = (cx: number): boolean => {
    for (let cy = y0; cy < y1; cy += 1) if (!cells.has(key(cx, cy))) return false;
    return true;
  };
  const xs = coords.filter(([, cy]) => cy >= y0 && cy < y1).map(([cx]) => cx);
  let x0 = Math.min(...xs);
  while (!full(x0) && x0 <= mapMaxX(map)) x0 += 1;
  let x1 = x0;
  while (full(x1)) x1 += 1;
  const reaches: ChannelReach[] = [
    // Le bief vient de plus haut sur la rivière: il continue dans la bande prolongée.
    reach(
      'x',
      y0,
      y1,
      x0 <= mapMinX(map) ? mapMinX(map) - extension : x0,
      x1 > mapMaxX(map) ? mapMaxX(map) + 1 + extension : x1,
      false,
    ),
  ];
  const rest = coords.filter(([cx, cy]) => !(cx >= x0 && cx < x1 && cy >= y0 && cy < y1));
  if (rest.length > 0) {
    const rx0 = Math.min(...rest.map(([cx]) => cx));
    const rx1 = Math.max(...rest.map(([cx]) => cx)) + 1;
    const ry0 = Math.min(...rest.map(([, cy]) => cy));
    const ry1 = Math.max(...rest.map(([, cy]) => cy)) + 1;
    // Le canal de fuite descend vers la rivière, qui borde son bout aval.
    let river = true;
    for (let cx = rx0; cx < rx1; cx += 1) {
      river &&= inMap(map, cx, ry1) && groundAt(map, cx, ry1) === 'water' && map.groundStyles?.[cellIndex(map, cx, ry1)] !== 'millrace';
    }
    reaches.push(reach('y', rx0, rx1, ry0, ry1, river));
  }
  return reaches;
}

/** Vrai si le point (x, y) est dans le tronçon; `edges`: bords lointains compris (sommets de la géométrie). */
export function inReach(reach: ChannelReach, x: number, y: number, edges = false): boolean {
  const across = reach.axis === 'x' ? y : x;
  const along = reach.axis === 'x' ? x : y;
  const inside = (value: number, low: number, high: number): boolean =>
    value >= low && (edges ? value <= high : value < high);
  return inside(across, reach.across0, reach.across1) && inside(along, reach.along0, reach.along1);
}

/**
 * Hauteur du creux d'un tronçon au point, le haut des berges à `top`: le profil du ru, couché
 * dans le sens du tronçon (même crête, même berge raide, même fond).
 */
export function reachHeight(reach: ChannelReach, x: number, y: number, top: number): number {
  return reach.axis === 'x' ? streamHeight(reach.layout, y, x, top) : streamHeight(reach.layout, x, y, top);
}

/**
 * Petits bassins d'eau dormante: chaque groupe d'au plus `maxCells` cases d'eau d'un seul tenant
 * (hors rivière, ru et bief), rendu par son rectangle, dans le sens de sa longueur.
 */
export function stillBasins(map: GameMap, stream: StreamLayout | null, maxCells: number): ChannelReach[] {
  const millrace = (cx: number, cy: number): boolean => map.groundStyles?.[cellIndex(map, cx, cy)] === 'millrace';
  const water = (cx: number, cy: number): boolean =>
    inMap(map, cx, cy) && groundAt(map, cx, cy) === 'water' && !millrace(cx, cy) && !isStreamCell(stream, cx, cy);
  const seen = new Set<string>();
  const out: ChannelReach[] = [];
  for (let cy = mapMinY(map); cy <= mapMaxY(map); cy += 1) {
    for (let cx = mapMinX(map); cx <= mapMaxX(map); cx += 1) {
      if (!water(cx, cy) || seen.has(key(cx, cy))) continue;
      const group: [number, number][] = [];
      const queue: [number, number][] = [[cx, cy]];
      seen.add(key(cx, cy));
      // L'itérateur d'un tableau voit les cases ajoutées pendant le parcours (file d'attente).
      for (const cell of queue) {
        group.push(cell);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cell[0] + dx;
          const ny = cell[1] + dy;
          if (water(nx, ny) && !seen.has(key(nx, ny))) {
            seen.add(key(nx, ny));
            queue.push([nx, ny]);
          }
        }
      }
      // Un grand groupe (rivière, mare du bois) reste au lit de la rivière.
      if (group.length > maxCells) continue;
      const x0 = Math.min(...group.map(([x]) => x));
      const x1 = Math.max(...group.map(([x]) => x)) + 1;
      const y0 = Math.min(...group.map(([, y]) => y));
      const y1 = Math.max(...group.map(([, y]) => y)) + 1;
      out.push(x1 - x0 >= y1 - y0 ? reach('x', y0, y1, x0, x1, false, true) : reach('y', x0, x1, y0, y1, false, true));
    }
  }
  return out;
}
