/**
 * Bouches de cheminée du bourg, trouvées dans les modèles de l'artiste: faces
 * de la case sombre `shadow` tournées vers le haut, tout en haut d'un bâtiment
 * (l'intérieur du conduit). La maisonnette compte à part: elle ne fume qu'une
 * fois son toit réparé (`ambiance.ts`).
 */
import { Matrix4, Vector3, type BufferGeometry } from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import { propHints, propMatrix } from './decor';
import type { ModelLibrary } from './modeles';
import { PALETTE_CELLS, PALETTE_GRID } from './palette';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { Terrain } from './terrain';

export interface Chimney {
  position: Vector3;
  /** Cheminée de la maisonnette des joueurs (sinon: une maison du bourg). */
  house: boolean;
}

const BUILDING_CATEGORY = 'batiment';
const HOUSE_MODEL = 'gatekeeper_house';
const REPAIRED_SUFFIX = '_repaired';
/** Une face tournée vers le haut (composante verticale de sa normale). */
const FACING_UP = 0.7;
const TRIANGLE = 3;

interface Face {
  centre: Vector3;
  up: number;
  opening: boolean;
}

function faces(geometry: BufferGeometry, matrix: Matrix4, out: Face[]): void {
  if (!geometry.hasAttribute('uv')) {
    return;
  }
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const index = geometry.getIndex();
  const count = index === null ? position.count : index.count;
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const opening = AMBIANCE_SETTINGS.chimneys.openingCell;
  for (let i = 0; i + TRIANGLE - 1 < count; i += TRIANGLE) {
    const ia = index === null ? i : index.getX(i);
    const ib = index === null ? i + 1 : index.getX(i + 1);
    const ic = index === null ? i + 2 : index.getX(i + 2);
    a.fromBufferAttribute(position, ia).applyMatrix4(matrix);
    b.fromBufferAttribute(position, ib).applyMatrix4(matrix);
    c.fromBufferAttribute(position, ic).applyMatrix4(matrix);
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize();
    const column = Math.min(PALETTE_GRID - 1, Math.floor(uv.getX(ia) * PALETTE_GRID));
    const row = Math.min(PALETTE_GRID - 1, Math.floor(uv.getY(ia) * PALETTE_GRID));
    out.push({
      centre: new Vector3().add(a).add(b).add(c).divideScalar(TRIANGLE),
      up: normal.y,
      opening: PALETTE_CELLS[row * PALETTE_GRID + column] === opening,
    });
  }
}

/** Bouches d'un modèle posé par `placement`. */
function openings(library: ModelLibrary, model: string, prop: MapProp, placement: Matrix4): Vector3[] {
  const settings = AMBIANCE_SETTINGS.chimneys;
  const all: Face[] = [];
  const world = new Matrix4();
  for (const part of library.parts(model, propHints(prop), prop.id)) {
    world.multiplyMatrices(placement, part.matrix);
    faces(part.geometry, world, all);
  }
  if (all.length === 0) {
    return [];
  }
  const top = Math.max(...all.map((face) => face.centre.y));
  const groups: { sum: Vector3; count: number }[] = [];
  for (const face of all) {
    if (!face.opening || face.up < FACING_UP || face.centre.y < top - settings.topBand) {
      continue;
    }
    let group = groups.find(
      (candidate) =>
        candidate.sum.clone().divideScalar(candidate.count).distanceTo(face.centre) <
        settings.clusterRadius,
    );
    if (group === undefined) {
      group = { sum: new Vector3(), count: 0 };
      groups.push(group);
    }
    group.sum.add(face.centre);
    group.count += 1;
  }
  return groups.map((group) => group.sum.divideScalar(group.count));
}

/** Cheminées des bâtiments de la carte, maisonnette comprise (dans son état réparé). */
export function collectChimneys(
  map: GameMap,
  library: ModelLibrary,
  terrain: Terrain,
): Chimney[] {
  const chimneys: Chimney[] = [];
  const placement = new Matrix4();
  for (const prop of map.props) {
    if (prop.category !== BUILDING_CATEGORY) {
      continue;
    }
    const house = prop.model === HOUSE_MODEL;
    const model = house ? `${prop.model}${REPAIRED_SUFFIX}` : prop.model;
    if (!library.has(model)) {
      continue;
    }
    propMatrix(prop, terrain.heightAt(prop.pos.x, prop.pos.y), placement);
    for (const position of openings(library, model, prop, placement)) {
      chimneys.push({ position, house });
    }
  }
  return chimneys;
}
