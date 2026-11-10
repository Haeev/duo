/**
 * Sol d'un petit lieu déclaré par sa carte (`floor`): une nature par case, aux couleurs de
 * `GROUND_LOOKS` (lames d'un plancher comprises). Les natures cachées (`vide`) ne sont pas
 * dessinées: on y voit le fond de la scène, et la plaque garde sa tranche au bord de ce qui l'est.
 * Logique pure, sans WebGL: testable dans Node.
 */
import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import type { FloorDef } from '../../donnees/schemas/lieu';
import { RENDER_SETTINGS } from '../reglages';
import { DEFAULT_LOOK, GROUND_LOOKS, type GroundLook } from './reglages-tuiles';

/** Rendu d'une nature de sol (repli pour une nature inconnue de la table). */
export function floorLook(nature: string): GroundLook {
  return GROUND_LOOKS[nature] ?? DEFAULT_LOOK;
}

/** Nature de chaque case, ligne après ligne depuis le coin nord-ouest. */
export function floorNatures(floor: FloorDef, width: number, height: number): string[] {
  const cells = new Array<string>(width * height).fill(floor.nature);
  for (const area of floor.areas ?? [])
    for (let y = Math.max(0, area.y); y < Math.min(height, area.y + area.h); y++)
      for (let x = Math.max(0, area.x); x < Math.min(width, area.x + area.w); x++)
        cells[y * width + x] = area.nature;
  return cells;
}

/**
 * Géométrie du sol déclaré: dessus à y = 0, tranche de `thickness` au bord de ce qui est dessiné.
 * Origine au coin nord-ouest de la carte, couleurs de sommets (même matériau que la plaque d'essai).
 * L'appelant la libère.
 */
export function floorGeometry(
  floor: FloorDef,
  width: number,
  height: number,
  settings: typeof RENDER_SETTINGS.ground = RENDER_SETTINGS.ground,
): BufferGeometry {
  const natures = floorNatures(floor, width, height);
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const quad = (
    corners: readonly (readonly [number, number, number])[],
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
  const shown = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    floorLook(natures[y * width + x] ?? floor.nature).hidden !== true;
  const base = new Map<string, Color>();
  const tone = new Color();
  const edge = new Color(settings.edgeColor);
  const t = -settings.thickness;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!shown(x, y)) continue;
      const nature = natures[y * width + x] ?? floor.nature;
      const look = floorLook(nature);
      let color = base.get(nature);
      if (color === undefined) {
        color = new Color(look.color);
        base.set(nature, color);
      }
      const strips = look.planks === undefined ? 1 : Math.max(1, Math.round(1 / look.planks.width));
      for (let k = 0; k < strips; k += 1) {
        // Lames d'un mètre aux tons décalés d'une rangée à l'autre: les joints ne s'alignent pas.
        const row = y * strips + k;
        const step = look.planks === undefined ? 0 : ((x * 5 + row * 3) % 4) / 3;
        tone.copy(color).multiplyScalar(1 - step * (1 - (look.planks?.shade ?? 1)));
        const z0 = y + k / strips;
        const z1 = y + (k + 1) / strips;
        quad(
          [
            [x, 0, z0],
            [x, 0, z1],
            [x + 1, 0, z1],
            [x + 1, 0, z0],
          ],
          [0, 1, 0],
          tone,
        );
      }
      if (!shown(x, y + 1))
        quad(
          [
            [x, 0, y + 1],
            [x, t, y + 1],
            [x + 1, t, y + 1],
            [x + 1, 0, y + 1],
          ],
          [0, 0, 1],
          edge,
        );
      if (!shown(x, y - 1))
        quad(
          [
            [x + 1, 0, y],
            [x + 1, t, y],
            [x, t, y],
            [x, 0, y],
          ],
          [0, 0, -1],
          edge,
        );
      if (!shown(x + 1, y))
        quad(
          [
            [x + 1, 0, y + 1],
            [x + 1, t, y + 1],
            [x + 1, t, y],
            [x + 1, 0, y],
          ],
          [1, 0, 0],
          edge,
        );
      if (!shown(x - 1, y))
        quad(
          [
            [x, 0, y],
            [x, t, y],
            [x, t, y + 1],
            [x, 0, y + 1],
          ],
          [-1, 0, 0],
          edge,
        );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
}
