/**
 * Lecture de la carte du level designer (`donnees/cartes/halte.json`, format
 * décrit en section 9 de `docs/jeux/jeu-1/carte-halte.md`), contrôlée à
 * l'exécution et traduite en `GameMap`.
 */
import {
  type GameMap,
  type GroundKind,
  type GroundStyle,
  type MapHook,
  type MapImprovement,
  type MapProp,
  type MapTree,
  type Rect,
  cellIndex,
  inMap,
  mapMaxX,
  mapMaxY,
  offstagePoint,
} from '../etat/carte';
import { BENCH_MODEL } from '../etat/bancs';
import type { Cell, Vec2 } from '../etat/types';
import { houseBuilding, houseFromBuilding, parseBuildings, parseCrossings, parseStream } from './carte-interieurs';
import { ContentError, Reader } from './lecteur';

const GROUND_KINDS: readonly GroundKind[] = ['grass', 'path', 'dirt', 'gravel', 'wood', 'floor', 'water', 'rail', 'stone'];
/** `rendu` d'un code de terrain (0.13): aspect pour le rendu seul. */
const GROUND_STYLES: Readonly<Record<string, GroundStyle>> = {
  sous_bois: 'undergrowth',
  sentier_foret: 'forestPath',
  bief: 'millrace',
};
const TREE_TYPES: Readonly<Record<string, MapTree['kind']>> = { tree_oak: 'oak', tree_fir: 'fir' };
/** `regarde` d'une accroche, en quarts de tour (convention des objets: 0 tourné vers le sud). */
const FACING_QUARTERS: Readonly<Record<string, number>> = { sud: 0, est: 1, nord: 2, ouest: 3 };
const DEGREES = Math.PI / 180;
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
  // 0.13 (v0-13-carte.md, section 2): la grille commence en `origine` (x -24, y -30 pour la carte agrandie).
  // Les coordonnées du monde ne bougent pas: la ligne 0 du terrain est la rangée `originY`.
  const origin = size.opt('origine');
  const originX = origin === null ? 0 : origin.at('x').integer(-512, 512);
  const originY = origin === null ? 0 : origin.at('y').integer(-512, 512);
  const grid = { originX, originY, width, height };
  const cellAt = (r: Reader): Cell => ({
    cx: r.at('cx').integer(originX, mapMaxX(grid)),
    cy: r.at('cy').integer(originY, mapMaxY(grid)),
  });

  // Sol, d'après la légende du terrain.
  const terrain = r.at('terrain');
  const legend = new Map<string, GroundKind>();
  const styles = new Map<string, GroundStyle>();
  for (const [code, entry] of terrain.at('legende').entries()) {
    legend.set(code, entry.at('sol').oneOf(GROUND_KINDS));
    const style = entry.opt('rendu');
    if (style !== null) styles.set(code, need(GROUND_STYLES[style.oneOf(Object.keys(GROUND_STYLES))], style, 'aspect inconnu'));
  }
  const lines = terrain.at('lignes').items();
  if (lines.length !== height) terrain.at('lignes').fail(`${height} lignes attendues`);
  const ground: GroundKind[] = [];
  const groundStyles: (GroundStyle | null)[] = [];
  lines.forEach((line) => {
    const text = line.string();
    if (text.length !== width) line.fail(`${width} cases attendues`);
    for (const code of text) {
      ground.push(need(legend.get(code), line, `code de terrain inconnu « ${code} »`));
      groundStyles.push(styles.get(code) ?? null);
    }
  });

  // Cases infranchissables, recalculées par le validateur du level designer.
  const blockedLines = r.at('infranchissable').at('grille').items();
  if (blockedLines.length !== height) r.at('infranchissable').at('grille').fail(`${height} lignes attendues`);
  const blocked: boolean[] = [];
  blockedLines.forEach((line) => {
    const text = line.string();
    if (text.length !== width) line.fail(`${width} cases attendues`);
    for (const code of text) {
      if (code !== '#' && code !== '.') line.fail(`« # » ou « . » attendu, reçu « ${code} »`);
      blocked.push(code === '#');
    }
  });

  const points: Record<string, Vec2> = {};
  const pointFacings: Record<string, number> = {};
  for (const p of r.at('points').items()) {
    const id = p.at('id').string();
    points[id] = { x: p.at('x').number(), y: p.at('y').number() };
    // Cap de boussole (0 nord, 90 est) vers le `facing` de la simulation (0 est, y vers le sud).
    const heading = p.opt('cap_degres');
    // Sinon, `rotation` (quarts de tour, 0 vers le sud comme les objets): où regarde un habitant posté là.
    const quarter = p.opt('rotation');
    if (heading !== null) pointFacings[id] = (heading.number() - 90) * DEGREES;
    else if (quarter !== null) pointFacings[id] = Math.PI / 2 - quarter.number() * (Math.PI / 2);
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
      const cx = Math.floor(pos.x);
      const cy = Math.floor(pos.y);
      if (!inMap(grid, cx, cy)) o.fail('arbre hors de la carte');
      blocked[cellIndex(grid, cx, cy)] = false;
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
  const door: Cell = cellAt(house.at('porte'));
  const spawnId = house.at('retour_de_minuit').string();
  const spawn = need(points[spawnId], house.at('retour_de_minuit'), `point « ${spawnId} » absent`);
  const startFurniture = house
    .at('mobilier_depart')
    .items()
    .map((f) => ({
      item: f.at('item').string(),
      cell: cellAt(f),
      rotation: f.at('rotation').integer(0, 3),
    }));

  // Tour 10 (ADR 0016): bâtiments visitables, ru et passages. Une carte d'avant n'a que la maisonnette.
  const frame = { ...grid, points };
  const list = r.opt('interieurs');
  const buildings =
    list === null
      ? { house: houseBuilding(house.at('objet').string(), { room, door, spawn }, spawnId, 'house_door') }
      : parseBuildings(list, frame);
  const houseFromMap = need(buildings.house, r, 'bâtiment « house » absent');
  const ru = r.opt('ru');
  const stream = ru === null ? null : parseStream(ru, frame);
  const crossings = parseCrossings(r.opt('ouvrages') ?? new Reader(`cartes/${LEVEL_MAP_FILE}`, 'ouvrages', []), frame);

  // Le potager: les cases de la zone, ligne par ligne, d'ouest en est.
  const gardenZone = need(zones.garden, r.at('zones'), 'zone « garden » absente');
  const garden: Cell[] = [];
  for (let cy = gardenZone.y; cy < gardenZone.y + gardenZone.h; cy++) {
    for (let cx = gardenZone.x; cx < gardenZone.x + gardenZone.w; cx++) garden.push({ cx, cy });
  }

  // Petits objets accrochés (nichoir, chicot, pieu): facultatifs, sans emprise.
  const hooks: MapHook[] = (r.opt('accroches')?.items() ?? []).map((h) => ({
    id: h.at('id').string(),
    model: h.at('modele').string(),
    on: h.at('sur').string(),
    pos: { x: h.at('x').number(), y: h.at('y').number(), z: h.at('z').number() },
    rotation: h.has('regarde') ? need(FACING_QUARTERS[h.at('regarde').string()], h.at('regarde'), 'sud, est, nord ou ouest attendu') : 0,
    tiltDeg: h.opt('penche_degres')?.number() ?? 0,
    scale: h.opt('echelle')?.number() ?? 1,
  }));

  // Hors de la carte: les habitants « chez eux » loin du bourg.
  if (!('offstage' in points)) points.offstage = offstagePoint(grid);

  // Tour 9: sièges sans modèle (des bancs sans objet) et chantiers (posés une fois bâtis).
  const seats: MapProp[] = (r.opt('sieges')?.items() ?? []).map((s) => ({
    id: s.at('id').string(),
    model: BENCH_MODEL,
    pos: { x: s.at('x').number(), y: s.at('y').number() },
    rotation: s.at('rotation').integer(0, 3),
    rect: null,
    height: 0,
    category: 'siege',
  }));
  const improvements: Record<string, MapImprovement> = {};
  for (const s of r.opt('chantiers')?.items() ?? []) {
    const type = s.at('type').string();
    const area = s.opt('rect');
    const info = typeInfo.get(type);
    const id = s.at('id').string();
    improvements[id] = {
      id,
      model: type,
      pos: { x: s.at('x').number(), y: s.at('y').number() },
      rotation: s.at('rotation').integer(0, 3),
      rect: area === null || area.isNull() ? null : rect(area),
      height: info?.height ?? 0,
      category: info?.category ?? 'decor',
      cells: s
        .at('cases')
        .items()
        .map((cell) => {
          const [cx, cy] = cell.numberList();
          if (cx === undefined || cy === undefined) return cell.fail('[cx, cy] attendu');
          return { cx, cy };
        }),
    };
  }

  return {
    id: r.at('id').string(),
    name: r.at('nom').string(),
    originX,
    originY,
    width,
    height,
    ground,
    blocked,
    ...(styles.size === 0 ? {} : { groundStyles }),
    points,
    pointFacings,
    hooks,
    zones,
    buildings,
    stream,
    crossings,
    house: houseFromBuilding(houseFromMap, list ?? house),
    garden,
    trees,
    props,
    startFurniture,
    seats,
    improvements,
    fishingZones: (r.opt('peche')?.opt('coins')?.items() ?? []).map((z) => ({
      id: z.at('id').string(),
      name: z.at('nom').string(),
      at: z.at('a').string(),
      rects: z.at('rects').items().map(rect),
    })),
  };
}
