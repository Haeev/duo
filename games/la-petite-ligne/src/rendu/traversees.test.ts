import { Mesh, MeshBasicMaterial, type BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import type { SharedMaterials } from './materiaux';
import { paletteUv, type PaletteCell } from './palette';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { Terrain } from './terrain';

const CROSSING = RENDER_SETTINGS.terrain.crossing;
const UV_TOLERANCE = 1e-4;
/** Une face est verticale si sa normale ne monte presque pas. */
const VERTICAL_NORMAL_Y = 0.1;
/** Marches de quelques centimètres (herbe, chemin) tolérées: on cherche les joues de rampe. */
const MIN_BLADE_HEIGHT = 0.05;
/** Lame qui longe un rail: centre d'un de ses triangles à moins de cette distance du rail (m). */
const RAIL_SIDE_DISTANCE = 0.3;
const EPSILON = 1e-3;

/** Passage à niveau (route en x 17 à 20) et traversée de service (x 50), voie de y 12 à 15. */
const AREAS = [
  { x0: 14, x1: 23, z0: 9, z1: 18 },
  { x0: 47, x1: 54, z0: 9, z1: 16 },
] as const;
const TRACK_AXIS = 13.5;

interface Triangle {
  points: [number, number, number][];
  normal: [number, number, number];
  u: number;
  v: number;
}

function terrain(): Terrain {
  // Le terrain ne lit que ces deux matériaux; pas de texture ni de WebGL dans Node.
  const materials = {
    palette: new MeshBasicMaterial(),
    water: new MeshBasicMaterial(),
  } as unknown as SharedMaterials;
  return new Terrain(loadMap(MAP_FILES).map, materials, new ResourceTracker());
}

function groundTriangles(t: Terrain): Triangle[] {
  const ground = t.group.getObjectByName('sol');
  const triangles: Triangle[] = [];
  expect(ground).toBeInstanceOf(Mesh);
  if (!(ground instanceof Mesh)) {
    return triangles;
  }
  const geometry = ground.geometry as BufferGeometry;
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  const vertex = (k: number): [number, number, number] => [
    position.getX(k),
    position.getY(k),
    position.getZ(k),
  ];
  for (let i = 0; i < position.count; i += 3) {
    const points = [vertex(i), vertex(i + 1), vertex(i + 2)];
    triangles.push({
      points,
      normal: [normal.getX(i), normal.getY(i), normal.getZ(i)],
      u: uv.getX(i),
      v: uv.getY(i),
    });
  }
  return triangles;
}

function is(triangle: Triangle, cell: PaletteCell): boolean {
  const uv = paletteUv(cell);
  return Math.abs(triangle.u - uv.u) < UV_TOLERANCE && Math.abs(triangle.v - uv.v) < UV_TOLERANCE;
}

function inAreas(triangle: Triangle): boolean {
  return triangle.points.every(([x, , z]) =>
    AREAS.some((area) => x >= area.x0 && x <= area.x1 && z >= area.z0 && z <= area.z1),
  );
}

describe('traversées en planches (revue du directeur artistique, tour 5)', () => {
  const t = terrain();
  const triangles = groundTriangles(t);

  it('n’a plus de joue verticale au bord des rampes: des talus en pente', () => {
    const blades = triangles.filter((triangle) => {
      const heights = triangle.points.map((p) => p[1]);
      const span = Math.max(...heights) - Math.min(...heights);
      return (
        inAreas(triangle) &&
        is(triangle, CROSSING.rampSideTone) &&
        Math.abs(triangle.normal[1]) < VERTICAL_NORMAL_Y &&
        span > MIN_BLADE_HEIGHT
      );
    });
    expect(blades).toEqual([]);
    const talus = triangles.filter(
      (triangle) => inAreas(triangle) && is(triangle, CROSSING.rampSideTone),
    );
    expect(talus.length).toBeGreaterThan(0);
    for (const triangle of talus) {
      // Pente d'environ 1 pour 1: normale à 45 degrés, toujours vers le ciel.
      expect(triangle.normal[1]).toBeGreaterThan(0.5);
      expect(triangle.normal[1]).toBeLessThan(0.75);
    }
  });

  it('pose le sol des talus dans le prolongement de la rampe (personnages, touffes)', () => {
    // Bord ouest de la route du passage à niveau (x 17), sur les deux rampes.
    for (const y of [11.8, 15.4]) {
      const onRamp = t.heightAt(17 + EPSILON, y);
      expect(t.heightAt(17 - EPSILON, y)).toBeCloseTo(onRamp, 2);
      // Un pas de 0,1 m vers l'extérieur: 0,1 m plus bas (pente 1 pour 1).
      expect(onRamp - t.heightAt(17 - 0.1, y)).toBeCloseTo(0.1 / CROSSING.talusRun, 2);
    }
  });

  it('ferme le flanc sans rampe (contre le quai) jusque sous le sol', () => {
    const flank = triangles.filter(
      (triangle) =>
        is(triangle, CROSSING.endTone) &&
        triangle.normal[2] > 1 - EPSILON &&
        triangle.points.every(([x, , z]) => x >= 50 && x <= 51 && Math.abs(z - 15) < EPSILON),
    );
    expect(flank.length).toBeGreaterThan(0);
    const lowest = Math.min(...flank.flatMap((triangle) => triangle.points.map((p) => p[1])));
    expect(lowest).toBeLessThanOrEqual(RENDER_SETTINGS.terrain.heights.rail);
  });

  it('borde chaque rail de lames au ton franc: pas de lame grise contre l’ornière', () => {
    const top = RENDER_SETTINGS.terrain.heights.wood;
    const rails = [TRACK_AXIS - CROSSING.railOffset, TRACK_AXIS + CROSSING.railOffset];
    const grey = triangles.filter((triangle) => {
      if (!is(triangle, 'wood_old') || triangle.normal[1] < 1 - EPSILON) {
        return false;
      }
      if (!triangle.points.every((p) => Math.abs(p[1] - top) < EPSILON)) {
        return false;
      }
      const z = triangle.points.reduce((sum, p) => sum + p[2], 0) / triangle.points.length;
      return rails.some((rail) => Math.abs(z - rail) < RAIL_SIDE_DISTANCE);
    });
    expect(grey).toEqual([]);
    // Le gris `wood_old` se lisait comme une autre matière: il ne sert plus du tout au platelage.
    expect(triangles.some((triangle) => inAreas(triangle) && is(triangle, 'wood_old'))).toBe(false);
  });
});
