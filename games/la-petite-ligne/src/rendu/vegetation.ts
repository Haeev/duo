/**
 * Végétation semée par le rendu (aucun effet sur le jeu): touffes d'herbe,
 * fleurs des prés, galets des berges, et la forêt du pourtour qui ferme
 * l'horizon. Tout est instancié (quelques appels de dessin) et placé par un
 * bruit déterministe, identique sur les deux machines.
 */
import { Color, Euler, Group, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import type { GameMap } from '../etat/carte';
import { inRect } from '../etat/carte';
import { hash2 } from './bruit';
import { ShapeBuilder } from './geometrie';
import { createInstanced, finishInstances } from './instances';
import type { SharedMaterials } from './materiaux';
import type { PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import type { ResourceTracker } from './ressources';
import type { Terrain } from './terrain';

const SETTINGS = RENDER_SETTINGS.terrain;
const SEED_TUFT = 11;
const SEED_FLOWER = 12;
const SEED_PEBBLE = 13;
const SEED_TREE = 14;
const SEED_JITTER_X = 15;
const SEED_JITTER_Y = 16;
const SEED_SCALE = 17;
const SEED_KIND = 18;
const SEED_ANGLE = 19;
const TUFT_CELLS: readonly PaletteCell[] = [
  'grass_light',
  'grass_dark',
  'grass',
  'grass_dry',
  'moss',
];
const FLOWER_CELLS: readonly PaletteCell[] = [
  'flower_yellow',
  'flower_white',
  'flower_red',
  'flower_blue',
  'flower_pink',
  'flower_violet',
];
const PEBBLE_CELLS: readonly PaletteCell[] = ['rock', 'rock_light', 'stone_light'];
/** Marge sans arbre au-delà du bord jouable, puis densité qui monte avec la distance. */
const TREE_RAMP = 0.035;
const TREE_MAX_DENSITY = 0.42;
const TREE_BAND_DEPTH = 11;
const TREE_SCALE_MIN = 0.8;
const TREE_SCALE_SPREAD = 0.6;
const TINT_MIN = 0.86;
const TINT_SPREAD = 0.24;
const JITTER = 0.7;
/** Bord infranchissable de la carte (`bord` du level designer), en cases. */
const PLAYABLE_BORDER = 2;
const STRIPS = 4;
/** Tronçons par côté au plus (côté prolongé divisé par `chunkSize`, large marge). */
const FOREST_SEGMENTS_MAX = 16;

function pick<T>(items: readonly T[], value: number): T {
  const item = items[Math.min(items.length - 1, Math.floor(value * items.length))];
  if (item === undefined) {
    throw new Error('liste vide');
  }
  return item;
}

export class Vegetation {
  readonly group = new Group();

  constructor(
    map: GameMap,
    terrain: Terrain,
    materials: SharedMaterials,
    resources: ResourceTracker,
    /** Part gardée (1 en mode normal, moins en mode léger). */
    private readonly share = 1,
  ) {
    this.group.name = 'vegetation';
    const occupied = map.props.filter((prop) => prop.rect !== null).map((prop) => prop.rect);
    const garden = new Set(map.garden.map((cell) => `${cell.cx}:${cell.cy}`));
    const free = (cx: number, cy: number): boolean =>
      terrain.isGrass(cx, cy) &&
      !garden.has(`${cx}:${cy}`) &&
      !occupied.some((rect) => rect !== null && inRect(rect, cx + 0.5, cy + 0.5));

    const tuft = new ShapeBuilder();
    for (const [x, z, tilt] of [
      [0, 0, 0],
      [0.06, 0.03, 18],
      [-0.05, 0.04, -16],
      [0.01, -0.06, 12],
    ] as const) {
      tuft.cone(0.035, 0.26, [x, 0, z], 'white_paint', {
        base: true,
        segments: 3,
        rotation: [tilt, 0, tilt / 2],
      });
    }
    const flower = new ShapeBuilder()
      .cone(0.012, 0.24, [0, 0, 0], 'leaf_crop', { base: true, segments: 3 })
      .ball(0.05, [0, 0.25, 0], 'white_paint')
      .ball(0.02, [0, 0.27, 0.03], 'flower_center');
    const pebble = new ShapeBuilder().ball(0.12, [0, 0.02, 0], 'white_paint', {
      scale: [1.2, 0.45, 1],
    });

    const cells: { cx: number; cy: number }[] = [];
    for (let cy = 0; cy < map.height; cy += 1) {
      for (let cx = 0; cx < map.width; cx += 1) {
        cells.push({ cx, cy });
      }
    }
    const tufts = cells.filter(
      ({ cx, cy }) => free(cx, cy) && hash2(cx, cy, SEED_TUFT) < SETTINGS.tuftDensity * this.share,
    );
    const flowers = cells.filter(
      ({ cx, cy }) =>
        free(cx, cy) && hash2(cx, cy, SEED_FLOWER) < SETTINGS.flowerDensity * this.share,
    );
    const pebbles = cells.filter(
      ({ cx, cy }) =>
        terrain.look(cx, cy).kind === 'gravel' &&
        hash2(cx, cy, SEED_PEBBLE) < SETTINGS.pebbleDensity * 3 * this.share,
    );

    const color = new Color();
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();

    const scatter = (
      name: string,
      builder: ShapeBuilder,
      list: { cx: number; cy: number }[],
      tints: readonly PaletteCell[],
      seed: number,
      shadows: boolean,
    ): void => {
      const mesh = createInstanced(
        name,
        resources.track(builder.build()),
        materials.palette,
        list.length,
      );
      mesh.castShadow = shadows;
      for (const { cx, cy } of list) {
        const x = cx + 0.5 + (hash2(cx, cy, SEED_JITTER_X + seed) - 0.5) * JITTER;
        const y = cy + 0.5 + (hash2(cx, cy, SEED_JITTER_Y + seed) - 0.5) * JITTER;
        const size = TREE_SCALE_MIN + hash2(cx, cy, SEED_SCALE + seed) * TREE_SCALE_SPREAD;
        position.set(x, terrain.heightAt(x, y), y);
        rotation.setFromEuler(euler.set(0, hash2(cx, cy, SEED_ANGLE + seed) * Math.PI * 2, 0));
        scale.set(size, size, size);
        mesh.setMatrixAt(mesh.count, matrix.compose(position, rotation, scale));
        mesh.setColorAt(
          mesh.count,
          materials.paletteColor(pick(tints, hash2(cx, cy, SEED_KIND + seed)), color),
        );
        mesh.count += 1;
      }
      finishInstances(mesh);
      this.group.add(mesh);
    };
    scatter('touffes', tuft, tufts, TUFT_CELLS, SEED_TUFT, false);
    scatter('fleurs', flower, flowers, FLOWER_CELLS, SEED_FLOWER, false);
    scatter('galets', pebble, pebbles, PEBBLE_CELLS, SEED_PEBBLE, false);
    this.plantOuterForest(map, terrain, materials, resources);
  }

  /** Forêt du pourtour: hors du bord jouable, de plus en plus dense en s'éloignant. */
  private plantOuterForest(
    map: GameMap,
    terrain: Terrain,
    materials: SharedMaterials,
    resources: ResourceTracker,
  ): void {
    const fir = new ShapeBuilder()
      .cylinder(0.12, 0.16, 0.7, [0, 0, 0], 'bark_dark', { base: true, segments: 5 })
      .cone(1.0, 1.9, [0, 0.55, 0], 'leaf_fir', { base: true, segments: 6 })
      .cone(0.7, 1.7, [0, 1.6, 0], 'leaf_fir_light', {
        base: true,
        segments: 6,
        rotation: [0, 30, 0],
      });
    const oak = new ShapeBuilder()
      .cylinder(0.15, 0.2, 1.3, [0, 0, 0], 'bark', { base: true, segments: 5 })
      .blob(1.15, [0, 2.2, 0], 'leaf_oak')
      .blob(0.75, [0.5, 2.9, 0.2], 'leaf_oak_light', { rotation: [0, 40, 20] });
    const firGeometry = resources.track(fir.build());
    const oakGeometry = resources.track(oak.build());
    const ext = SETTINGS.extension;
    const strips: InstancedMesh[][] = [];
    const cells: { cx: number; cy: number; strip: number }[] = [];
    const min = PLAYABLE_BORDER;
    const maxX = map.width - PLAYABLE_BORDER;
    const maxY = map.height - PLAYABLE_BORDER;
    for (let cy = -ext; cy < map.height + ext; cy += 1) {
      for (let cx = -ext; cx < map.width + ext; cx += 1) {
        const dx = cx < min ? min - cx : cx >= maxX ? cx - maxX + 1 : 0;
        const dy = cy < min ? min - cy : cy >= maxY ? cy - maxY + 1 : 0;
        const distance = Math.max(dx, dy);
        if (
          distance < SETTINGS.outerTreeStart ||
          distance > TREE_BAND_DEPTH ||
          !terrain.isGrass(cx, cy)
        ) {
          continue;
        }
        const density = Math.min(
          TREE_MAX_DENSITY,
          SETTINGS.outerTreeDensity * 0.3 + TREE_RAMP * distance,
        );
        if (hash2(cx, cy, SEED_TREE) >= density * this.share) {
          continue;
        }
        const side = dy >= dx ? (cy < min ? 0 : 1) : cx < min ? 2 : 3;
        // Chaque côté coupé en tronçons: ceux hors du cadre sont éliminés (ni triangles ni appel).
        const along = side < 2 ? cx : cy;
        const segment = Math.floor((along + ext) / RENDER_SETTINGS.terrain.chunkSize);
        cells.push({ cx, cy, strip: side * FOREST_SEGMENTS_MAX + segment });
      }
    }
    const color = new Color();
    const matrix = new Matrix4();
    const position = new Vector3();
    const rotation = new Quaternion();
    const euler = new Euler();
    const scale = new Vector3();
    for (let strip = 0; strip < STRIPS * FOREST_SEGMENTS_MAX; strip += 1) {
      const inStrip = cells.filter((cell) => cell.strip === strip);
      if (inStrip.length === 0) {
        continue;
      }
      const firs = createInstanced(
        `foret sapins ${strip}`,
        firGeometry,
        materials.palette,
        inStrip.length,
      );
      const oaks = createInstanced(
        `foret chenes ${strip}`,
        oakGeometry,
        materials.palette,
        inStrip.length,
      );
      for (const { cx, cy } of inStrip) {
        const isFir = hash2(cx, cy, SEED_KIND) < 0.5;
        const mesh = isFir ? firs : oaks;
        const x = cx + 0.5 + (hash2(cx, cy, SEED_JITTER_X) - 0.5) * JITTER;
        const y = cy + 0.5 + (hash2(cx, cy, SEED_JITTER_Y) - 0.5) * JITTER;
        const size = TREE_SCALE_MIN + hash2(cx, cy, SEED_SCALE) * TREE_SCALE_SPREAD * 2;
        position.set(x, terrain.heightAt(x, y), y);
        rotation.setFromEuler(euler.set(0, hash2(cx, cy, SEED_ANGLE) * Math.PI * 2, 0));
        scale.set(size, size * (1 + hash2(cx, cy, SEED_SCALE + 1) * 0.3), size);
        const tint = TINT_MIN + hash2(cx, cy, SEED_KIND + 1) * TINT_SPREAD;
        mesh.setMatrixAt(mesh.count, matrix.compose(position, rotation, scale));
        mesh.setColorAt(mesh.count, color.setRGB(tint, tint, tint));
        mesh.count += 1;
      }
      // Hors du terrain jouable, l'ombre de la forêt n'apporterait rien: autant d'appels de dessin en moins.
      firs.castShadow = false;
      oaks.castShadow = false;
      finishInstances(firs);
      finishInstances(oaks);
      strips.push([firs, oaks]);
      this.group.add(firs, oaks);
    }
  }
}
