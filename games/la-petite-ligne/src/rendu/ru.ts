/**
 * Le ru de la Côte (tour 10): un filet d'eau vive dans un creux à berges raides,
 * qui descend du coteau (nord) vers l'Aubrune (sud). Le rendu le creuse lui-même
 * dans ses colonnes de la carte (`map.stream`), sous les ouvrages compris (pont,
 * passerelle, gué de pierres), sauf sous le remblai de la voie (le ponceau du
 * modèle `culvert` s'y appuie). À l'embouchure, le lit rejoint celui de la
 * rivière (`riviere.ts`) à sa hauteur.
 *
 * Ce module ne fait que la forme (pur, testable dans Node): `terrain.ts` écrit
 * la géométrie et la surface de l'eau.
 */
import type { GameMap, GroundKind } from '../etat/carte';
import { cellIndex, mapMaxX, mapMaxY, mapMinX, mapMinY } from '../etat/carte';
import { valueNoise } from './bruit';
import { RENDER_SETTINGS } from './reglages';

const SETTINGS = RENDER_SETTINGS.terrain.stream;
const NOISE_SEED_WIDTH = 41;
const NOISE_SEED_SHIFT = 43;

export interface StreamLayout {
  /** Bord ouest et bord est du creux (m). */
  x0: number;
  x1: number;
  /** Première rangée creusée (bande prolongée comprise, négative au nord). */
  fromY: number;
  /** Rangée de l'embouchure: à partir d'elle, c'est le lit de la rivière. */
  mouthY: number;
  /** Rangées du remblai de la voie (non creusées: le ponceau y passe). */
  embankment: ReadonlySet<number>;
}

function kindAt(map: GameMap, cx: number, cy: number): GroundKind {
  const x = Math.min(mapMaxX(map), Math.max(mapMinX(map), cx));
  const y = Math.min(mapMaxY(map), Math.max(mapMinY(map), cy));
  return map.ground[cellIndex(map, x, y)] ?? 'grass';
}

/**
 * Forme du ru sur la carte, ou `null` sans ru. L'embouchure est la première rangée où l'eau de la
 * rivière borde le ru des deux côtés.
 */
export function streamLayout(map: GameMap, extension: number): StreamLayout | null {
  const stream = map.stream;
  if (stream === null || stream.columns.length === 0) {
    return null;
  }
  const x0 = Math.min(...stream.columns);
  const x1 = Math.max(...stream.columns) + 1;
  let mouthY = stream.toY + 1;
  for (let cy = stream.fromY; cy <= stream.toY; cy += 1) {
    // L'embouchure: là où la rivière borde le ru des deux côtés (au-dessus, sur la grève, le ru
    // garde son creux jusqu'à l'eau de l'Aubrune, sinon il s'arrête en sable au pied de la passerelle).
    if (kindAt(map, x0 - 1, cy) === 'water' && kindAt(map, x1, cy) === 'water') {
      mouthY = cy;
      break;
    }
  }
  const embankment = new Set<number>();
  for (let cy = stream.fromY; cy < mouthY; cy += 1) {
    if (stream.columns.some((cx) => kindAt(map, cx, cy) === 'rail')) {
      embankment.add(cy);
    }
  }
  // Le ru vient du coteau: il continue dans la bande prolongée s'il touche le bord nord.
  const fromY = stream.fromY <= mapMinY(map) ? mapMinY(map) - extension : stream.fromY;
  return { x0, x1, fromY, mouthY, embankment };
}

/** Vrai si la case est creusée par le ru (dessinée par lui, pas par le sol ni par la rivière). */
export function isStreamCell(layout: StreamLayout | null, cx: number, cy: number): boolean {
  return (
    layout !== null &&
    cx >= layout.x0 &&
    cx < layout.x1 &&
    cy >= layout.fromY &&
    cy < layout.mouthY &&
    !layout.embankment.has(cy)
  );
}

/** Demi-largeur du creux en haut des berges et décalage de son axe à la hauteur `y` (rien de droit). */
export function streamAxis(layout: StreamLayout, y: number): { centre: number; half: number } {
  const half = (layout.x1 - layout.x0) / 2;
  const width = 1 + (valueNoise(0, y, SETTINGS.wobbleScale, NOISE_SEED_WIDTH) - 0.5) * 2 * SETTINGS.widthWobble;
  const shift = (valueNoise(y, 0, SETTINGS.wobbleScale, NOISE_SEED_SHIFT) - 0.5) * 2 * SETTINGS.axisWobble;
  return { centre: (layout.x0 + layout.x1) / 2 + shift, half: half * width };
}

/**
 * Hauteur du creux au point (x, y), le haut des berges étant à `top`: crête arrondie, berge
 * raide, fond de galets presque plat. Le haut rejoint toujours le sol voisin au bord des colonnes.
 */
export function streamHeight(layout: StreamLayout, x: number, y: number, top: number): number {
  const { centre, half } = streamAxis(layout, y);
  const edge = Math.min(x - layout.x0, layout.x1 - x);
  const u = Math.abs(x - centre) / half;
  const bed = SETTINGS.bed;
  let h: number;
  if (u >= SETTINGS.crest) {
    const t = Math.min(1, (u - SETTINGS.crest) / (1 - SETTINGS.crest));
    h = top - SETTINGS.crestDrop * (1 - t) * (1 - t);
  } else if (u >= SETTINGS.toe) {
    const t = (u - SETTINGS.toe) / (SETTINGS.crest - SETTINGS.toe);
    const smooth = t * t * (3 - 2 * t);
    h = bed + SETTINGS.toeRise + (top - SETTINGS.crestDrop - bed - SETTINGS.toeRise) * smooth;
  } else {
    const t = u / SETTINGS.toe;
    h = bed + SETTINGS.toeRise * t * t;
  }
  // Tout près du bord des colonnes, la berge remonte au sol voisin (aucune marche, aucun trou).
  if (edge < SETTINGS.edgeBlend) {
    const t = edge / SETTINGS.edgeBlend;
    h = top + (h - top) * t;
  }
  return Math.min(h, top);
}
