import { Mesh, MeshBasicMaterial, Raycaster, Vector3, type Color } from 'three';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import type { GameMap } from '../etat/carte';
import type { SharedMaterials } from './materiaux';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { Terrain } from './terrain';
import { Vegetation } from './vegetation';

/**
 * Lignes de vue des moments du pourtour (tour 7): depuis le corps d'une bête ou d'un joueur,
 * un rayon vers la caméra (isométrique, rayons parallèles) ne doit toucher aucun arbre de la
 * forêt du pourtour. On lance les rayons sur les vrais maillages instanciés de `Vegetation`.
 */

const DEG = Math.PI / 180;

interface Target {
  label: string;
  x: number;
  y: number;
  /** Hauteur au-dessus du sol (m). */
  h: number;
}

function setup(): { map: GameMap; terrain: Terrain; forest: Mesh[]; trees: number } {
  // Le terrain et la végétation ne lisent que ces membres; pas de texture ni de WebGL dans Node.
  const materials = {
    palette: new MeshBasicMaterial(),
    water: new MeshBasicMaterial(),
    paletteColor: (_cell: string, out: Color): Color => out.setRGB(1, 1, 1),
    onPaletteChange: (): (() => void) => () => undefined,
  } as unknown as SharedMaterials;
  const map = loadMap(MAP_FILES).map;
  const resources = new ResourceTracker();
  const terrain = new Terrain(map, materials, resources);
  const vegetation = new Vegetation(map, terrain, materials, resources);
  vegetation.group.updateMatrixWorld(true);
  const forest = vegetation.group.children.filter(
    (child): child is Mesh =>
      child instanceof Mesh && child.name.startsWith('foret'),
  );
  return { map, terrain, forest, trees: vegetation.forestTrees };
}

/** Direction vers la caméra pour une orientation (0: caméra au sud-est, 1: au sud-ouest). */
function towardCamera(orientation: number): Vector3 {
  const camera = RENDER_SETTINGS.camera;
  const yaw = -Math.PI + camera.firstAzimuthDeg * DEG + (orientation * Math.PI) / 2;
  const elevation = camera.elevationDeg * DEG;
  return new Vector3(
    -Math.cos(yaw) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.sin(yaw) * Math.cos(elevation),
  ).normalize();
}

function hidden(
  { terrain, forest }: ReturnType<typeof setup>,
  targets: readonly Target[],
  orientation: number,
): string[] {
  const ray = new Raycaster();
  const direction = towardCamera(orientation);
  return targets
    .filter((t) => {
      ray.set(new Vector3(t.x, terrain.heightAt(t.x, t.y) + t.h, t.y), direction);
      return ray.intersectObjects(forest, false).length > 0;
    })
    .map((t) => t.label);
}

function point(map: GameMap, id: string): { x: number; y: number } {
  const p = map.points[id];
  if (p === undefined) {
    throw new Error(`point absent de la carte: ${id}`);
  }
  return p;
}

/** La chevrette (corps et tête), son faon et les deux joueurs figés à l'ouest d'elle. */
function roeDeerTargets(map: GameMap): Target[] {
  const graze = point(map, 'roe_deer_graze');
  const fawn = point(map, 'fawn_bed');
  const edge = point(map, 'roe_deer_edge');
  const targets: Target[] = [];
  // Du pré jusqu'à 1 m de la haie (au-delà, elle entre dans la haie: elle peut s'y cacher).
  for (let x = graze.x; x <= edge.x - 1; x += 0.5) {
    for (const h of [0.6, 1.0]) {
      targets.push({ label: `chevrette ${x.toFixed(1)} h${h}`, x, y: graze.y, h });
    }
  }
  for (let k = 0; k <= 4; k += 1) {
    const x = fawn.x + ((graze.x + 0.5 - fawn.x) * k) / 4;
    const y = fawn.y + ((graze.y - 0.3 - fawn.y) * k) / 4;
    targets.push({ label: `faon ${k}`, x, y, h: 0.3 });
  }
  for (const [x, y] of [
    [54.5, 28.0],
    [55.0, 25.5],
  ] as const) {
    for (const h of [0.9, 1.6]) {
      targets.push({ label: `joueur ${x};${y} h${h}`, x, y, h });
    }
  }
  return targets;
}

/** Les deux rives de la brume: tout le banc de sable de l'anse sud, et la place nord. */
function mistTargets(map: GameMap): Target[] {
  const south = point(map, 'mist_bank_south');
  const north = point(map, 'mist_bank_north');
  const targets: Target[] = [];
  for (let x = south.x - 6; x <= south.x + 2; x += 1) {
    for (const y of [south.y, south.y + 0.9]) {
      for (const h of [0.9, 1.6]) {
        targets.push({ label: `rive sud ${x};${y} h${h}`, x, y, h });
      }
    }
  }
  for (const h of [0.9, 1.6]) {
    targets.push({ label: `rive nord h${h}`, x: north.x, y: north.y, h });
  }
  return targets;
}

describe('forêt du pourtour: éclaircies des moments du tour 7', () => {
  const scene = setup();

  it('ne cache ni la chevrette, ni le faon, ni les joueurs du pré (orientations 0 et 1)', () => {
    const targets = roeDeerTargets(scene.map);
    expect(hidden(scene, targets, 0)).toEqual([]);
    expect(hidden(scene, targets, 1)).toEqual([]);
  });

  it('ne cache aucun joueur sur les rives de la brume (orientations 0 et 1)', () => {
    const targets = mistTargets(scene.map);
    expect(hidden(scene, targets, 0)).toEqual([]);
    expect(hidden(scene, targets, 1)).toEqual([]);
  });

  it('garde la forêt partout ailleurs (la lisière recule, elle ne disparaît pas)', () => {
    const trees = scene.trees;
    // 702 arbres sans éclaircie, 679 avec: la lisière recule, le bois reste aussi profond.
    expect(trees).toBeGreaterThan(650);
  });
});
