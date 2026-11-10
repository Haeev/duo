/**
 * Formes provisoires: la géométrie d'un volume dont le modèle n'est pas livré, à la taille de ses
 * données. Elles se reconnaissent comme provisoires (volume uni, socle sombre, bande claire sur la
 * façade pour contrôler le sens de pose) et tiennent en un seul maillage à couleurs de sommets:
 * un appel de dessin par volume, un seul matériau pour toutes.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RENDER_SETTINGS } from '../reglages';
import type { SceneVolume } from './description';
import { TILE_SETTINGS } from './reglages-tuiles';

type StandInSettings = typeof RENDER_SETTINGS.standIn;

/** Teinte stable tirée d'un identifiant: deux modèles différents se distinguent sans rien nommer. */
export function hueOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return hash / 360;
}

function paint(geometry: BufferGeometry, color: Color): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function box(w: number, h: number, d: number, y: number, z: number, color: Color): BufferGeometry {
  return paint(new BoxGeometry(w, h, d).translate(0, y + h / 2, z), color);
}

function boxAt(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  color: string,
): BufferGeometry {
  return paint(new BoxGeometry(w, h, d).translate(x, y + h / 2, z), new Color(color));
}

type DoorLook = typeof TILE_SETTINGS.interior;

/** `userData` de la géométrie d'une porte: nombre d'index de sa partie basse (porte coupée). */
export const DOOR_CUT_COUNT = 'doorCutCount';

/**
 * Porte d'une pièce: deux montants, un linteau, une barre de seuil, et le vantail fermé avec ses
 * deux panneaux et sa poignée du côté de la pièce (+Z). `w`: largeur hors tout, `h`: profondeur
 * de l'encadrement, à cheval sur le mur. Avec `cutHeight`, la porte se fabrique en deux parts,
 * le bas d'abord (jusqu'à la coupe, coiffé d'une tranche à l'encre) puis le haut: quand son mur
 * est coupé devant la caméra, on n'en dessine que le bas (`low`: nombre de boîtes du bas).
 */
function doorParts(volume: SceneVolume, look: DoorLook): { parts: BufferGeometry[]; low: number } {
  const { w, h: depth, height } = volume;
  const d = look.door;
  const jamb = look.doorJamb;
  const head = jamb;
  const clear = w - jamb * 2;
  const leafZ = depth / 2 - d.leafDepth / 2 - 0.02;
  const face = leafZ + d.leafDepth / 2;
  const cut = volume.cutHeight ?? 0;
  const lip = 0.006;
  const low: BufferGeometry[] = [];
  const high: BufferGeometry[] = [];
  const caps: BufferGeometry[] = [];
  // Chaque boîte est tranchée à la hauteur de coupe; `cap`: sa tranche se voit une fois coupée.
  const part = (
    bw: number,
    bh: number,
    bd: number,
    x: number,
    y: number,
    z: number,
    color: string,
    cap = false,
  ): void => {
    if (cut <= 0 || y >= cut) {
      high.push(boxAt(bw, bh, bd, x, y, z, color));
      return;
    }
    const top = Math.min(y + bh, cut - lip);
    if (top > y) low.push(boxAt(bw, top - y, bd, x, y, z, color));
    if (y + bh > cut) {
      high.push(boxAt(bw, y + bh - cut, bd, x, cut, z, color));
      if (cap) caps.push(boxAt(bw - lip, lip, bd - lip, x, cut - lip, z, look.door.cutColor));
    }
  };
  part(jamb, height, depth, -(w - jamb) / 2, 0, 0, d.frameColor, true);
  part(jamb, height, depth, (w - jamb) / 2, 0, 0, d.frameColor, true);
  part(w, head, depth, 0, height - head, 0, d.frameColor);
  part(clear, 0.04, depth, 0, 0, 0, d.frameColor);
  part(clear, height - head - 0.04, d.leafDepth, 0, 0.04, leafZ, d.leafColor, true);
  part(clear * 0.64, height * 0.3, 0.02, 0, height * 0.14, face + 0.01, d.panelColor);
  part(clear * 0.64, height * 0.34, 0.02, 0, height * 0.52, face + 0.01, d.panelColor);
  part(0.07, 0.07, 0.06, clear / 2 - 0.13, height * 0.47, face + 0.03, d.knobColor);
  return { parts: [...low, ...caps, ...high], low: low.length + caps.length };
}

/** Paillasson: une natte bordée, à plat devant la porte. */
function matParts(volume: SceneVolume, look: DoorLook): BufferGeometry[] {
  const { w, h: depth, height } = volume;
  const m = look.mat;
  const edge = Math.min(0.07, w / 6, depth / 6);
  return [
    boxAt(w, height, depth, 0, 0, 0, m.edgeColor),
    boxAt(w - edge * 2, height + 0.008, depth - edge * 2, 0, 0, 0, m.color),
  ];
}

/** Porte au sol: un cadre bas autour d'un puits sombre, et trois marches qui y descendent. */
function hatchParts(volume: SceneVolume, look: DoorLook): BufferGeometry[] {
  const { w: size, height } = volume;
  const t = look.hatch;
  const half = size / 2 - t.curb / 2;
  const inner = size - t.curb * 2;
  const parts = [
    boxAt(size, height, t.curb, 0, 0, -half, t.curbColor),
    boxAt(t.curb, height, inner, -half, 0, 0, t.curbColor),
    boxAt(t.curb, height, inner, half, 0, 0, t.curbColor),
    boxAt(inner, 0.02, inner, 0, 0, 0, t.wellColor),
  ];
  // Les marches partent du côté d'où l'on arrive (+Z) et s'enfoncent vers le fond.
  const tread = inner / 3;
  [0.1, 0.065, 0.03].forEach((top, i) => {
    parts.push(
      boxAt(inner, top, tread - 0.02, 0, 0, inner / 2 - tread * (i + 0.5), look.door.leafColor),
    );
  });
  return parts;
}

/**
 * Géométrie d'une forme provisoire, dans le repère local du volume: origine au centre de l'emprise,
 * au niveau du bas du volume, façade vers +Z (le sud à la rotation 0). L'appelant la libère.
 */
export function standInGeometry(
  volume: SceneVolume,
  settings: StandInSettings = RENDER_SETTINGS.standIn,
  doors: DoorLook = TILE_SETTINGS.interior,
): BufferGeometry {
  const body =
    volume.color !== undefined
      ? new Color(volume.color)
      : new Color().setHSL(
          hueOf(volume.model ?? volume.id),
          settings.saturation,
          settings.lightness,
        );
  const parts: BufferGeometry[] = [];
  let cutCount = 0;
  switch (volume.shape) {
    case 'door': {
      const door = doorParts(volume, doors);
      parts.push(...door.parts);
      for (const part of door.parts.slice(0, door.low)) cutCount += part.getIndex()?.count ?? 0;
      break;
    }
    case 'mat':
      parts.push(...matParts(volume, doors));
      break;
    case 'hatch':
      parts.push(...hatchParts(volume, doors));
      break;
    case 'slab': {
      parts.push(
        box(
          volume.w,
          volume.height,
          volume.h,
          0,
          0,
          new Color(volume.color ?? settings.blockedColor),
        ),
      );
      break;
    }
    case 'ball': {
      const sphere = new SphereGeometry(0.5, 20, 14)
        .scale(volume.w, volume.height, volume.h)
        .translate(0, volume.height / 2, 0);
      parts.push(paint(sphere, body));
      break;
    }
    case 'post': {
      const post = new CylinderGeometry(0.5, 0.5, 1, 16)
        .scale(volume.w, volume.height, volume.h)
        .translate(0, volume.height / 2, 0);
      parts.push(paint(post, body));
      break;
    }
    case 'box': {
      const inset = Math.min(settings.inset, volume.w / 4, volume.h / 4);
      const w = volume.w - inset * 2;
      const d = volume.h - inset * 2;
      // Socle et bande de façade: seulement pour ce qui attend un modèle (un mur d'essai reste uni).
      const plinth =
        volume.model !== null && volume.base === 0
          ? Math.min(settings.plinthHeight, volume.height / 3)
          : 0;
      if (plinth > 0) parts.push(box(w, plinth, d, 0, 0, new Color(settings.plinthColor)));
      const shrink = plinth > 0 ? 0.04 : 0;
      parts.push(box(w - shrink, volume.height - plinth, d - shrink, plinth, 0, body));
      if (plinth > 0) {
        // Bande de façade: collée à la face avant, en haut, elle dit où est le devant du meuble.
        const band = Math.min(settings.facadeHeight, volume.height / 3);
        parts.push(
          box(
            (w - shrink) * 0.7,
            band,
            0.04,
            volume.height - band * 1.6,
            (d - shrink) / 2 + 0.02,
            new Color(settings.facadeColor),
          ),
        );
      }
      break;
    }
  }
  const merged = parts.length === 1 ? parts[0] : mergeGeometries(parts);
  if (parts.length > 1) for (const part of parts) part.dispose();
  if (merged === undefined)
    throw new Error(`forme provisoire impossible pour le volume ${volume.id}`);
  if (cutCount > 0) merged.userData[DOOR_CUT_COUNT] = cutCount;
  return merged;
}

/**
 * Sol d'un lieu: une plaque de maquette, une case de 1 m sur deux un peu plus sombre (la grille se
 * lit sur le prototype), et sa tranche. Origine au coin nord-ouest de la carte, dessus à y = 0.
 */
export function groundGeometry(
  width: number,
  height: number,
  settings: typeof RENDER_SETTINGS.ground = RENDER_SETTINGS.ground,
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const light = new Color(settings.color);
  const dark = new Color(settings.color).multiplyScalar(settings.checker);
  const quad = (
    corners: readonly [number, number, number][],
    normal: readonly [number, number, number],
    color: Color,
  ): void => {
    const start = positions.length / 3;
    for (const corner of corners) {
      positions.push(...corner);
      normals.push(...normal);
      colors.push(color.r, color.g, color.b);
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      quad(
        [
          [x, 0, y],
          [x, 0, y + 1],
          [x + 1, 0, y + 1],
          [x + 1, 0, y],
        ],
        [0, 1, 0],
        (x + y) % 2 === 0 ? light : dark,
      );
    }
  }
  const t = -settings.thickness;
  const edge = new Color(settings.edgeColor);
  quad(
    [
      [0, 0, height],
      [0, t, height],
      [width, t, height],
      [width, 0, height],
    ],
    [0, 0, 1],
    edge,
  );
  quad(
    [
      [width, 0, 0],
      [width, t, 0],
      [0, t, 0],
      [0, 0, 0],
    ],
    [0, 0, -1],
    edge,
  );
  quad(
    [
      [width, 0, height],
      [width, t, height],
      [width, t, 0],
      [width, 0, 0],
    ],
    [1, 0, 0],
    edge,
  );
  quad(
    [
      [0, 0, 0],
      [0, t, 0],
      [0, t, height],
      [0, 0, height],
    ],
    [-1, 0, 0],
    edge,
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}
