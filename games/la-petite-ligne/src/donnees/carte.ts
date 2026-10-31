/**
 * Carte du bourg: celle du level designer (`donnees/cartes/*.json`) si elle
 * est là et lisible, sinon la carte de secours tracée d'après `demo.md`.
 */
import type { GameMap } from '../etat/carte';
import { buildFallbackMap } from './carte-secours';
import { parseLevelMap } from './carte-niveau';
import { ContentError } from './lecteur';

/** Points que le code et les données attendent sur toute carte. */
export const REQUIRED_POINTS: readonly string[] = [
  'train_stop',
  'quay_bell',
  'quay_bench',
  'bell_shadow_spot',
  'coop_crate',
  'notice_board',
  'house_door',
  'house_beam_spot',
  'house_attic',
  'beam_pickup',
  'water_barrel',
  'well',
  'chicken_coop',
  'hen_feeder',
  'village_square',
  'grocery_counter',
  'grocery_door',
  'grocery_terrace',
  'firmin_house',
  'sawmill_workbench',
  'sawmill_yard',
  'riverbank',
  'offstage',
];

export interface MapLoadResult {
  map: GameMap;
  /** `level`: carte du level designer; `fallback`: carte de secours (avec la raison). */
  source: 'level' | 'fallback';
  warning: string | null;
}

/** Contrôle qu'une carte a tout ce que le jeu attend. */
export function checkMap(map: GameMap): void {
  const size = map.width * map.height;
  if (map.ground.length !== size || map.blocked.length !== size) {
    throw new ContentError(`carte ${map.id}: ${size} cases attendues dans ground et blocked`);
  }
  for (const point of REQUIRED_POINTS) {
    if (!(point in map.points)) throw new ContentError(`carte ${map.id}: point « ${point} » absent`);
  }
  if (map.garden.length === 0) throw new ContentError(`carte ${map.id}: potager vide`);
  if (map.trees.length === 0) throw new ContentError(`carte ${map.id}: aucun arbre`);
}

/**
 * Choisit la carte. `files`: contenu des JSON de `donnees/cartes/`, par nom de fichier.
 * Une carte du level designer illisible ne bloque pas la démo: on garde la carte de
 * secours et on renvoie la raison, que `main.ts` journalise.
 */
export function loadMap(files: Record<string, unknown>): MapLoadResult {
  const names = Object.keys(files).sort();
  if (names.length === 0) {
    const map = buildFallbackMap();
    checkMap(map);
    return { map, source: 'fallback', warning: null };
  }
  try {
    const map = parseLevelMap(files);
    checkMap(map);
    return { map, source: 'level', warning: null };
  } catch (error) {
    const map = buildFallbackMap();
    checkMap(map);
    const reason = error instanceof Error ? error.message : String(error);
    return { map, source: 'fallback', warning: reason };
  }
}
