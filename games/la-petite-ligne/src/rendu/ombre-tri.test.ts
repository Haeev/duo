import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { IsoCameraRig } from './camera';
import { applyShadows, castsVisibleShadow, ShadowCasterCulling } from './ombre-tri';
import { RENDER_SETTINGS } from './reglages';

const FOCUS = { x: 38.5, y: 30.5 };
const GRID_STEP = 3;
const GRID_MIN = -10;
const GRID_MAX = 80;
const BOX_SIZE = 1.5;
const BOX_HEIGHT = 4;
const RAY_SAMPLES = 40;
const DEG = Math.PI / 180;

/** Soleil (vers la lumière) à cette hauteur et cet azimut (degrés). */
function sunDirection(elevation: number, azimuth: number): Vector3 {
  return new Vector3(
    Math.cos(elevation * DEG) * Math.cos(azimuth * DEG),
    Math.sin(elevation * DEG),
    Math.cos(elevation * DEG) * Math.sin(azimuth * DEG),
  ).normalize();
}

function boxes(): { scene: Group; meshes: Mesh[] } {
  const scene = new Group();
  const geometry = new BoxGeometry(BOX_SIZE, BOX_HEIGHT, BOX_SIZE).translate(0, BOX_HEIGHT / 2, 0);
  const material = new MeshBasicMaterial();
  const meshes: Mesh[] = [];
  for (let x = GRID_MIN; x <= GRID_MAX; x += GRID_STEP) {
    for (let z = GRID_MIN; z <= GRID_MAX; z += GRID_STEP) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, 0, z);
      mesh.castShadow = true;
      scene.add(mesh);
      meshes.push(mesh);
    }
  }
  scene.updateMatrixWorld(true);
  return { scene, meshes };
}

/** L'ombre d'un coin de la boîte tombe-t-elle à l'écran, sur un receveur de la bande de hauteurs ? */
function shadowOnScreen(mesh: Mesh, toSun: Vector3, rig: IsoCameraRig): boolean {
  const heights = RENDER_SETTINGS.shadowCasters.receiverHeights;
  const low = Math.min(...heights);
  const high = Math.max(...heights);
  const point = new Vector3();
  for (const cx of [-1, 1]) {
    for (const cy of [0, 1]) {
      for (const cz of [-1, 1]) {
        const corner = new Vector3(
          mesh.position.x + (cx * BOX_SIZE) / 2,
          cy * BOX_HEIGHT,
          mesh.position.z + (cz * BOX_SIZE) / 2,
        );
        for (let i = 0; i <= RAY_SAMPLES; i += 1) {
          const height = high - ((high - low) * i) / RAY_SAMPLES;
          if (height > corner.y) {
            continue;
          }
          // L'ombre file à l'opposé du soleil jusqu'à cette hauteur.
          const t = (corner.y - height) / toSun.y;
          point.copy(corner).addScaledVector(toSun, -t).project(rig.camera);
          if (Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

describe("tri fin de la passe d'ombre", () => {
  const cases = [
    { name: 'soir, zoom large', elevation: 12, azimuth: 175, quarter: 0, zoomOut: true },
    { name: 'soir, zoom moyen, tourné', elevation: 12, azimuth: 175, quarter: 2, zoomOut: false },
    { name: 'midi', elevation: 60, azimuth: 95, quarter: 1, zoomOut: false },
    { name: 'matin', elevation: 20, azimuth: 10, quarter: 3, zoomOut: true },
  ];
  for (const sample of cases) {
    it(`${sample.name}: ne retire que des objets dont l'ombre ne tombe pas à l'écran`, () => {
      const rig = new IsoCameraRig(true);
      rig.setAspect(1366 / 768);
      for (let i = 0; i < sample.quarter; i += 1) {
        rig.command('rotate_right');
      }
      if (sample.zoomOut) {
        rig.command('zoom_out');
      }
      rig.update(0, FOCUS.x, FOCUS.y, 0, 0, null);
      rig.camera.updateMatrixWorld();
      const toSun = sunDirection(sample.elevation, sample.azimuth);
      const { scene, meshes } = boxes();
      const culling = new ShadowCasterCulling();
      culling.begin(scene, rig.camera, toSun);
      const removed = meshes.filter((mesh) => !mesh.castShadow);
      const kept = meshes.filter((mesh) => mesh.castShadow);
      expect(removed.length).toBeGreaterThan(meshes.length / 4);
      for (const mesh of removed) {
        expect(
          shadowOnScreen(mesh, toSun, rig),
          `boîte en ${mesh.position.x}, ${mesh.position.z}`,
        ).toBe(false);
      }
      // Au moins une boîte gardée par visible: tout ce qui ombre l'écran reste.
      expect(kept.some((mesh) => shadowOnScreen(mesh, toSun, rig))).toBe(true);
      culling.end();
      expect(meshes.every((mesh) => mesh.castShadow)).toBe(true);
    });
  }
});

describe('pièces sans ombre visible', () => {
  it('roues et bielles du train, cadre au mur; la caisse, les poules et le reste gardent leur ombre', () => {
    for (const name of [
      'locomotive_wheels_1',
      'van_wheels_2',
      'coach_wheels',
      'locomotive_rod_l',
    ]) {
      expect(castsVisibleShadow(name), name).toBe(false);
    }
    for (const name of ['locomotive_body', 'hen_white', 'bell_post', 'table', 'player_base']) {
      expect(castsVisibleShadow(name), name).toBe(true);
    }
    const root = new Group();
    const body = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    body.name = 'van_body';
    const wheels = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    wheels.name = 'van_wheels_1';
    root.add(body, wheels);
    applyShadows(root);
    expect(body.castShadow).toBe(true);
    expect(wheels.castShadow).toBe(false);
    expect(wheels.receiveShadow).toBe(true);
  });
});
