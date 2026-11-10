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

/**
 * Géométrie d'une forme provisoire, dans le repère local du volume: origine au centre de l'emprise,
 * au niveau du bas du volume, façade vers +Z (le sud à la rotation 0). L'appelant la libère.
 */
export function standInGeometry(
  volume: SceneVolume,
  settings: StandInSettings = RENDER_SETTINGS.standIn,
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
  switch (volume.shape) {
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
