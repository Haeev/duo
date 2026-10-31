/**
 * Lecture de la carte du level designer (`donnees/cartes/halte.json`, format
 * décrit en section 9 de `docs/jeux/jeu-1/carte-halte.md`), contrôlée à
 * l'exécution et traduite en `GameMap`.
 */
import type { GameMap, GroundKind, MapProp, MapTree, Rect } from '../etat/carte';
import type { Cell, Vec2 } from '../etat/types';
import { ContentError, Reader } from './lecteur';

const GROUND_KINDS: readonly GroundKind[] = ['grass', 'path', 'dirt', 'gravel', 'wood', 'floor', 'water', 'rail', 'stone'];
const TREE_TYPES: Readonly<Record<string, MapTree['kind']>> = { tree_oak: 'oak', tree_fir: 'fir' };
/** Fichier de la carte du bourg dans `donnees/cartes/`. */
export const LEVEL_MAP_FILE = 'halte.json';

/** La valeur, ou une erreur qui cite le champ. */
function need<T>(value: T | undefined, r: Reader, message: string): T {
  if (value === undefined) return r.fail(message);
  return value;
}

function rect(r: Reader): Rect {
  return { x: r.at('x').integer(), y: r.at('y').integer(), w: r.at('w').integer(1), h: r.at('h').integer(1) };
}

export function parseLevelMap(files: Record<string, unknown>): GameMap {
  const raw = files[LEVEL_MAP_FILE];
  if (raw === undefined) throw new ContentError(`cartes: ${LEVEL_MAP_FILE} absent (${Object.keys(files).join(', ')})`);
  const r = new Reader(`cartes/${LEVEL_MAP_FILE}`, '', raw);
  const size = r.at('taille');
  const width = size.at('largeur').integer(8, 512);
  const height = size.at('hauteur').integer(8, 512);

  // Sol, d'après la légende du terrain.
  const terrain = r.at('terrain');
  const legend = new Map<string, GroundKind>();
  for (const [code, entry] of terrain.at('legende').entries()) {
    legend.set(code, entry.at('sol').oneOf(GROUND_KINDS));
  }
  const lines = terrain.at('lignes').items();
  if (lines.length !== height) terrain.at('lignes').fail(`${height} lignes attendues`);
  const ground: GroundKind[] = [];
  lines.forEach((line) => {
    const text = line.string();
    if (text.length !== width) line.fail(`${width} cases attendues`);
    for (const code of text) {
      ground.push(need(legend.get(code), line, `code de terrain inconnu « ${code} »`));
    }
  });

  // Cases infranchissables, recalculées par le validateur du level designer.
  const grid = r.at('infranchissable').at('grille').items();
  if (grid.length !== height) r.at('infranchissable').at('grille').fail(`${height} lignes attendues`);
  const blocked: boolean[] = [];
  grid.forEach((line) => {
    const text = line.string();
    if (text.length !== width) line.fail(`${width} cases attendues`);
    for (const code of text) {
      if (code !== '#' && code !== '.') line.fail(`« # » ou « . » attendu, reçu « ${code} »`);
      blocked.push(code === '#');
    }
  });

  const points: Record<string, Vec2> = {};
  for (const p of r.at('points').items()) {
    points[p.at('id').string()] = { x: p.at('x').number(), y: p.at('y').number() };
  }
  const zones: Record<string, Rect> = {};
  for (const z of r.at('zones').items()) {
    zones[z.at('id').string()] = rect(z.at('rect'));
  }

  // Catalogue des types: hauteur et catégorie pour le rendu.
  const typeInfo = new Map<string, { height: number; category: string }>();
  for (const [name, def] of r.at('types').entries()) {
    const height = def.opt('hauteur');
    const category = def.opt('categorie');
    typeInfo.set(name, { height: height === null ? 0 : height.number(), category: category === null ? 'decor' : category.string() });
  }

  // Arbres de la lisière (à couper) et décor.
  const trees: MapTree[] = [];
  const props: MapProp[] = [];
  for (const o of r.at('objets').items()) {
    const id = o.at('id').string();
    const type = o.at('type').string();
    const pos = { x: o.at('x').number(), y: o.at('y').number() };
    const rotation = o.at('rotation').integer(0, 3);
    const kind = TREE_TYPES[type];
    const cuttable = o.opt('coupable')?.boolean() ?? false;
    if (kind !== undefined && cuttable) {
      trees.push({ id, kind, pos });
      // Un arbre à couper bloque tant qu'il est debout: la couche dynamique s'en charge.
      blocked[Math.floor(pos.y) * width + Math.floor(pos.x)] = false;
      continue;
    }
    const area = o.opt('rect');
    const info = typeInfo.get(type);
    props.push({
      id,
      model: type,
      pos,
      rotation,
      rect: area === null ? null : rect(area),
      height: info?.height ?? 0,
      category: info?.category ?? 'decor',
    });
  }

  // La maisonnette.
  const house = r.at('maison');
  const roomId = house.at('piece').string();
  const room = need(zones[roomId], house.at('piece'), `zone « ${roomId} » absente`);
  const door: Cell = { cx: house.at('porte').at('cx').integer(0, width - 1), cy: house.at('porte').at('cy').integer(0, height - 1) };
  const spawnId = house.at('retour_de_minuit').string();
  const spawn = need(points[spawnId], house.at('retour_de_minuit'), `point « ${spawnId} » absent`);
  const startFurniture = house
    .at('mobilier_depart')
    .items()
    .map((f) => ({
      item: f.at('item').string(),
      cell: { cx: f.at('cx').integer(0, width - 1), cy: f.at('cy').integer(0, height - 1) },
      rotation: f.at('rotation').integer(0, 3),
    }));

  // Le potager: les cases de la zone, ligne par ligne, d'ouest en est.
  const gardenZone = need(zones.garden, r.at('zones'), 'zone « garden » absente');
  const garden: Cell[] = [];
  for (let cy = gardenZone.y; cy < gardenZone.y + gardenZone.h; cy++) {
    for (let cx = gardenZone.x; cx < gardenZone.x + gardenZone.w; cx++) garden.push({ cx, cy });
  }

  // Hors de la carte: les habitants « chez eux » loin du bourg.
  points.offstage ??= { x: -20, y: -20 };

  return {
    id: r.at('id').string(),
    name: r.at('nom').string(),
    width,
    height,
    ground,
    blocked,
    points,
    zones,
    house: { room, door, spawn },
    garden,
    trees,
    props,
    startFurniture,
  };
}
