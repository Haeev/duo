/**
 * Lecture simplifiée de la carte du level designer pour la page de
 * démonstration du rendu, en attendant que `donnees/carte-niveau.ts` (dev
 * gameplay) la prenne en charge. Seul ce que le rendu lit est rempli.
 */
import type { GameMap, GroundKind, MapProp, MapTree, Rect } from '../../etat/carte';
import type { Cell, Vec2 } from '../../etat/types';

interface LevelLegend {
  sol: GroundKind;
  franchissable: boolean;
}

interface LevelObject {
  id: string;
  type: string;
  x: number;
  y: number;
  rotation: number;
  rect: Rect | null;
}

interface LevelMap {
  id: string;
  nom: string;
  taille: { largeur: number; hauteur: number };
  terrain: { legende: Record<string, LevelLegend>; lignes: string[] };
  objets: LevelObject[];
  points: { id: string; x: number; y: number }[];
  zones: { id: string; rect: Rect }[];
  maison: {
    piece: string;
    porte: Cell;
    retour_de_minuit: string;
    mobilier_depart?: { item: string; cx: number; cy: number; rotation: number }[];
  };
}

const CHOPPABLE_TREE_PREFIX = 'tree_edge_';

function isLevelMap(value: unknown): value is LevelMap {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const map = value as Partial<LevelMap>;
  return typeof map.id === 'string' && Array.isArray(map.terrain?.lignes) && Array.isArray(map.objets);
}

export function parseDemoMap(raw: unknown): GameMap | null {
  if (!isLevelMap(raw)) {
    return null;
  }
  const width = raw.taille.largeur;
  const height = raw.taille.hauteur;
  const ground: GroundKind[] = [];
  const blocked: boolean[] = [];
  for (let cy = 0; cy < height; cy += 1) {
    const line = raw.terrain.lignes[cy] ?? '';
    for (let cx = 0; cx < width; cx += 1) {
      const legend = raw.terrain.legende[line[cx] ?? '.'];
      ground.push(legend?.sol ?? 'grass');
      blocked.push(legend !== undefined && !legend.franchissable);
    }
  }
  const points: Record<string, Vec2> = {};
  for (const point of raw.points) {
    points[point.id] = { x: point.x, y: point.y };
  }
  const zones: Record<string, Rect> = {};
  for (const zone of raw.zones) {
    zones[zone.id] = zone.rect;
  }
  const trees: MapTree[] = [];
  const props: MapProp[] = [];
  for (const object of raw.objets) {
    if (object.id.startsWith(CHOPPABLE_TREE_PREFIX)) {
      trees.push({ id: object.id, kind: object.type === 'tree_fir' ? 'fir' : 'oak', pos: { x: object.x, y: object.y } });
      continue;
    }
    props.push({ id: object.id, model: object.type, pos: { x: object.x, y: object.y }, rotation: object.rotation, rect: object.rect });
  }
  const gardenZone = zones.garden ?? { x: 0, y: 0, w: 0, h: 0 };
  const garden: Cell[] = [];
  for (let cy = gardenZone.y; cy < gardenZone.y + gardenZone.h; cy += 1) {
    for (let cx = gardenZone.x; cx < gardenZone.x + gardenZone.w; cx += 1) {
      garden.push({ cx, cy });
    }
  }
  const room = zones[raw.maison.piece] ?? { x: 0, y: 0, w: 1, h: 1 };
  return {
    id: raw.id,
    name: raw.nom,
    width,
    height,
    ground,
    blocked,
    points,
    zones,
    house: { room, door: raw.maison.porte, spawn: points[raw.maison.retour_de_minuit] ?? { x: room.x, y: room.y } },
    garden,
    trees,
    props,
    startFurniture: (raw.maison.mobilier_depart ?? []).map((piece) => ({
      item: piece.item,
      cell: { cx: piece.cx, cy: piece.cy },
      rotation: piece.rotation,
    })),
  };
}
