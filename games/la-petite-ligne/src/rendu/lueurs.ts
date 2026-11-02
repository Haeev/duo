/**
 * Les lueurs de nuit du bourg: lanternes des lampadaires, fenêtres, flammes.
 * On les trouve dans les modèles mêmes de l'artiste (faces qui pointent une
 * case lumineuse de la palette: vitres, verre des lanternes, flamme...), donc
 * elles suivent le décor sans liste à tenir. Chaque lueur donne un halo (sprite
 * doux, `ciel.ts`) et, regroupées par façade, des flaques de lumière au sol
 * (`surfaces.ts`).
 */
import { Matrix4, Vector3, type BufferGeometry } from 'three';
import type { GameMap, MapProp } from '../etat/carte';
import { DYNAMIC_PROP_MODELS, propHints, propMatrix } from './decor';
import type { ModelLibrary } from './modeles';
import { PALETTE_CELLS, PALETTE_GRID, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import type { Terrain } from './terrain';
import { LAMP_MODELS } from './lampes';

export type GlowKind = keyof typeof AMBIANCE_SETTINGS.glow.kinds;

/** Cases lumineuses de la palette (émission de nuit, bible section 2) et la lueur qu'elles donnent. */
export const GLOWING_CELLS: Readonly<Partial<Record<PaletteCell, GlowKind>>> = {
  glass: 'window',
  glass_lamp: 'lantern',
  flame: 'flame',
  ember: 'flame',
  lamp_shade: 'lantern',
  radio_dial: 'flame',
};

/** Une lueur: où, vers où elle regarde (vitre) ou nulle part (lanterne), et sa sorte. */
export interface GlowSource {
  position: Vector3;
  normal: Vector3;
  kind: GlowKind;
  /** Lampadaire d'où vient la lueur (`lampes.ts`: allumé ou non), `null` pour le reste. */
  lamp: string | null;
}

/** Une normale moyenne plus courte que cela: la lueur rayonne de tous côtés (lanterne). */
const OMNI_BELOW = 0.35;
const TRIANGLE = 3;
const UV_SIZE = 2;
/** Les modèles de sol posés (quai) partent du terrain, pas du sol surélevé qu'ils créent. */
const FLOOR_CATEGORY = 'sol';

/** Case de la palette pointée par une coordonnée de texture. */
export function cellAt(u: number, v: number): PaletteCell | undefined {
  const column = Math.min(PALETTE_GRID - 1, Math.max(0, Math.floor(u * PALETTE_GRID)));
  const row = Math.min(PALETTE_GRID - 1, Math.max(0, Math.floor(v * PALETTE_GRID)));
  return PALETTE_CELLS[row * PALETTE_GRID + column];
}

interface Face {
  centre: Vector3;
  normal: Vector3;
  kind: GlowKind;
}

/** Faces lumineuses d'une géométrie, placées par `matrix`. */
function glowingFaces(geometry: BufferGeometry, matrix: Matrix4, out: Face[]): void {
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
  for (let i = 0; i + TRIANGLE - 1 < count; i += TRIANGLE) {
    const ia = index === null ? i : index.getX(i);
    const ib = index === null ? i + 1 : index.getX(i + 1);
    const ic = index === null ? i + 2 : index.getX(i + 2);
    if (uv.itemSize < UV_SIZE) {
      return;
    }
    const cell = cellAt(uv.getX(ia), uv.getY(ia));
    const kind = cell === undefined ? undefined : GLOWING_CELLS[cell];
    if (kind === undefined) {
      continue;
    }
    a.fromBufferAttribute(position, ia).applyMatrix4(matrix);
    b.fromBufferAttribute(position, ib).applyMatrix4(matrix);
    c.fromBufferAttribute(position, ic).applyMatrix4(matrix);
    const centre = new Vector3().add(a).add(b).add(c).divideScalar(TRIANGLE);
    const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
    if (normal.lengthSq() > 0) {
      normal.normalize();
    }
    out.push({ centre, normal, kind });
  }
}

/** Regroupe des faces proches en lueurs (moyenne des centres et des normales). */
function cluster(faces: readonly Face[], radius: number, lamp: string | null): GlowSource[] {
  const groups: { sum: Vector3; normal: Vector3; count: number; votes: Map<GlowKind, number> }[] =
    [];
  for (const face of faces) {
    let group = groups.find(
      (candidate) =>
        candidate.sum.clone().divideScalar(candidate.count).distanceTo(face.centre) < radius,
    );
    if (group === undefined) {
      group = { sum: new Vector3(), normal: new Vector3(), count: 0, votes: new Map() };
      groups.push(group);
    }
    group.sum.add(face.centre);
    group.normal.add(face.normal);
    group.count += 1;
    group.votes.set(face.kind, (group.votes.get(face.kind) ?? 0) + 1);
  }
  return groups.map((group) => {
    const normal = group.normal.divideScalar(group.count);
    let kind: GlowKind = 'window';
    let best = 0;
    for (const [candidate, votes] of group.votes) {
      if (votes > best) {
        best = votes;
        kind = candidate;
      }
    }
    return {
      position: group.sum.divideScalar(group.count),
      normal: normal.length() < OMNI_BELOW ? new Vector3() : normal.normalize(),
      kind,
      lamp,
    };
  });
}

/**
 * Lueurs du décor statique (les bâtiments qui changent pendant la partie, comme
 * la maisonnette, ont leur propre lampe dans `maison.ts`).
 */
export function collectGlowSources(
  map: GameMap,
  library: ModelLibrary,
  terrain: Terrain,
): GlowSource[] {
  const settings = AMBIANCE_SETTINGS.glow;
  const sources: GlowSource[] = [];
  const placement = new Matrix4();
  const world = new Matrix4();
  // Tour 9: le réverbère du chemin (chantier) a ses lueurs, éteintes tant qu'il n'est pas bâti.
  const lamps: readonly MapProp[] = Object.values(map.improvements ?? {}).filter((x) => LAMP_MODELS.has(x.model));
  for (const prop of [...map.props, ...lamps]) {
    if (DYNAMIC_PROP_MODELS.has(prop.model) || RENDER_SETTINGS.propsDrawnElsewhere.includes(prop.model)) {
      continue;
    }
    const ground = prop.category === FLOOR_CATEGORY ? 0 : terrain.heightAt(prop.pos.x, prop.pos.y);
    propMatrix(prop, ground, placement);
    const faces: Face[] = [];
    for (const part of library.parts(prop.model, propHints(prop), prop.id)) {
      world.multiplyMatrices(placement, part.matrix);
      glowingFaces(part.geometry, world, faces);
    }
    sources.push(...cluster(faces, settings.clusterRadius, LAMP_MODELS.has(prop.model) ? prop.id : null));
  }
  return sources;
}

/** Une lumière de sol: position (la lueur poussée devant sa façade), rayon, couleur et force. */
export interface GroundLight {
  position: Vector3;
  radius: number;
  kind: GlowKind;
  /** Lampadaire d'où vient la lumière (`lampes.ts`), `null` pour une façade ou une flamme. */
  lamp: string | null;
  /** Phase du scintillement (flammes), stable d'un chargement à l'autre. */
  phase: number;
}

/**
 * Lumières de sol: une par lanterne ou flamme, une par façade éclairée (les
 * fenêtres d'une même façade, qui regardent du même côté, ne font qu'une flaque).
 */
export function groundLights(sources: readonly GlowSource[]): GroundLight[] {
  const settings = AMBIANCE_SETTINGS.glow;
  const lights: GroundLight[] = [];
  const windows: GlowSource[] = [];
  for (const source of sources) {
    if (source.kind === 'window') {
      windows.push(source);
      continue;
    }
    const kind = settings.kinds[source.kind];
    lights.push({
      position: source.position.clone().addScaledVector(source.normal, kind.push),
      radius: kind.radius,
      kind: source.kind,
      lamp: source.lamp,
      phase: lights.length,
    });
  }
  const facades: { sum: Vector3; normal: Vector3; count: number }[] = [];
  for (const source of windows) {
    let facade = facades.find(
      (candidate) =>
        candidate.normal.dot(source.normal) > 1 - OMNI_BELOW &&
        candidate.sum.clone().divideScalar(candidate.count).distanceTo(source.position) <
          settings.facadeRadius,
    );
    if (facade === undefined) {
      facade = { sum: new Vector3(), normal: source.normal.clone(), count: 0 };
      facades.push(facade);
    }
    facade.sum.add(source.position);
    facade.count += 1;
  }
  const window = settings.kinds.window;
  for (const facade of facades) {
    const position = facade.sum
      .divideScalar(facade.count)
      .addScaledVector(facade.normal, window.push);
    position.y += settings.windowDrop;
    lights.push({ position, radius: window.radius, kind: 'window', lamp: null, phase: lights.length });
  }
  return lights;
}
