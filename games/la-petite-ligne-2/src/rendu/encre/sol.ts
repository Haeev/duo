/**
 * Rendu encré: la carte du sol d'un grand lieu (ADR 0023). Une texture d'un point par case de
 * 1 m: la teinte d'écran de la nature de la case (telle qu'écrite dans `reglages-tuiles.ts`), et
 * dans l'alpha la couche de traits (4 bits), « herbe » (bit 4: trois tons en plages) et « sol
 * posé par l'homme » (bit 7: son bord reste droit). Le nuanceur la lit en un point qui ondule:
 * le bord entre un pré et un chemin est sinueux, la grille ne se voit plus. Une seule texture
 * pour tout le lieu (512 x 512 au plus, 1 Mo), libérée avec lui.
 */
import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from 'three';
import type { FloorDef } from '../../donnees/schemas/lieu';
import type { GroundLook } from '../lieu/reglages-tuiles';
import { floorLook, floorNatures } from '../lieu/sol';
import type { GroundField, InteriorRect } from '../lieu/terrain-rendu';
import { hex, LAYER, type Rgb } from './couches';
import { INK_SETTINGS } from './reglages';

/**
 * Point de la carte pour une nature de sol. L'eau se lit comme la terre de sa berge (la surface
 * de l'eau est un maillage à part); une nature cachée prend la teinte du dehors, sans trait.
 */
function texelOf(
  look: GroundLook,
  bank: Rgb,
  outside: Rgb | null,
  settings: typeof INK_SETTINGS.ground,
): number[] {
  const water = look.water === true;
  const hidden = look.hidden === true;
  const [r, g, b] = hidden ? (outside ?? hex(look.color)) : water ? bank : hex(look.color);
  const layer = hidden ? LAYER.plain : water ? LAYER.dirt : LAYER[settings.layers[look.surface]];
  const grassy = layer === LAYER.grass ? 16 : 0;
  const fine = !hidden && !water && settings.fine.includes(look.surface) ? 64 : 0;
  const hard = hidden || (!water && settings.hard.includes(look.surface)) ? 128 : 0;
  return [
    Math.round(r * 255),
    Math.round(g * 255),
    Math.round(b * 255),
    layer + grassy + fine + hard,
  ];
}

/** Octets de la carte du sol (RGBA par case), sans Three.js: testable. */
export function groundMapBytes(
  field: GroundField,
  bankColor: string,
  settings: typeof INK_SETTINGS.ground = INK_SETTINGS.ground,
  rooms: readonly InteriorRect[] = [],
  floorColor = '#b98f5e',
): Uint8Array {
  const data = new Uint8Array(field.width * field.height * 4);
  const bank = hex(bankColor);
  const looks = field.looks.map((look) => texelOf(look, bank, null, settings));
  for (let i = 0; i < field.cells.length; i++) {
    const look = looks[field.cells[i] ?? 0];
    if (look === undefined) continue;
    data.set(look, i * 4);
  }
  // Pièces: un plancher lame par lame (sol posé par l'homme: son bord reste droit).
  const [r, g, b] = hex(floorColor);
  const floor = [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), LAYER.wood + 128];
  for (const room of rooms)
    for (let y = room.at.y; y < room.at.y + room.height; y++)
      for (let x = room.at.x; x < room.at.x + room.width; x++)
        if (x >= 0 && y >= 0 && x < field.width && y < field.height)
          data.set(floor, (y * field.width + x) * 4);
  return data;
}

function textureOf(data: Uint8Array, width: number, height: number): DataTexture {
  const texture = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Octets de la carte du sol d'un petit lieu à sol déclaré (`floor` de sa carte). */
export function floorMapBytes(
  floor: FloorDef,
  width: number,
  height: number,
  outside: string | null,
  settings: typeof INK_SETTINGS.ground = INK_SETTINGS.ground,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  const out = outside === null ? null : hex(outside);
  floorNatures(floor, width, height).forEach((nature, i) => {
    data.set(texelOf(floorLook(nature), [0, 0, 0], out, settings), i * 4);
  });
  return data;
}

/** Carte du sol d'un petit lieu à sol déclaré; l'appelant la suit et la libère avec le lieu. */
export function createFloorMap(
  floor: FloorDef,
  width: number,
  height: number,
  outside: string | null,
): DataTexture {
  return textureOf(floorMapBytes(floor, width, height, outside), width, height);
}

/** La texture de la carte du sol; l'appelant la suit et la libère avec le lieu. */
export function createGroundMap(
  field: GroundField,
  bankColor: string,
  rooms: readonly InteriorRect[] = [],
  floorColor?: string,
): DataTexture {
  return textureOf(
    groundMapBytes(field, bankColor, INK_SETTINGS.ground, rooms, floorColor),
    field.width,
    field.height,
  );
}
