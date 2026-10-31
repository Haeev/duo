import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Box3, Matrix4, OrthographicCamera, Quaternion, Ray, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import type { GameMap, MapProp } from '../etat/carte';
import { cellIndex, inRect } from '../etat/carte';
import { CyclicCurve, wrapDegrees } from './courbes';
import { DaylightRig } from './lumiere';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';
import { RENDER_SETTINGS } from './reglages';

const MINUTES_PER_DAY = 1440;
const HOUR = 60;
const FOCUS = new Vector3(38, 0, 20);
const VIEW_RADIUS = 17;
const CAMERA_DISTANCE = 80;

// ---------------------------------------------------------------------------
// Lecture minimale d'un GLB (en-tête, JSON, binaire): positions d'un nœud.

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;
const FLOAT_BYTES = 4;
const VEC3 = 3;

interface GltfJson {
  nodes: {
    name?: string;
    mesh?: number;
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  }[];
  meshes: { primitives: { attributes: { POSITION: number } }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}

function nodePositions(file: string, nodeName: string): Vector3[] {
  const path = fileURLToPath(new URL(`../../assets/modeles/${file}`, import.meta.url));
  const data = readFileSync(path);
  const jsonLength = data.readUInt32LE(GLB_HEADER);
  const json = JSON.parse(
    data
      .subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + jsonLength)
      .toString('utf8'),
  ) as GltfJson;
  const binary = GLB_HEADER + CHUNK_HEADER + jsonLength + CHUNK_HEADER;
  const node = json.nodes.find((candidate) => candidate.name === nodeName);
  if (node?.mesh === undefined) {
    throw new Error(`Nœud ${nodeName} absent de ${file}`);
  }
  const t = node.translation ?? [0, 0, 0];
  const r = node.rotation ?? [0, 0, 0, 1];
  const s = node.scale ?? [1, 1, 1];
  const matrix = new Matrix4().compose(
    new Vector3(t[0], t[1], t[2]),
    new Quaternion(r[0], r[1], r[2], r[3]),
    new Vector3(s[0], s[1], s[2]),
  );
  const points: Vector3[] = [];
  for (const primitive of json.meshes[node.mesh]?.primitives ?? []) {
    const accessor = json.accessors[primitive.attributes.POSITION];
    const view = accessor === undefined ? undefined : json.bufferViews[accessor.bufferView];
    if (accessor === undefined || view === undefined) {
      continue;
    }
    const stride = view.byteStride ?? FLOAT_BYTES * VEC3;
    const start = binary + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    for (let i = 0; i < accessor.count; i += 1) {
      const at = start + i * stride;
      points.push(
        new Vector3(
          data.readFloatLE(at),
          data.readFloatLE(at + FLOAT_BYTES),
          data.readFloatLE(at + 2 * FLOAT_BYTES),
        ).applyMatrix4(matrix),
      );
    }
  }
  return points;
}

/** Hauteur du sol sous un point, comme le terrain du rendu (quai et ponton compris). */
function groundAt(map: GameMap, x: number, y: number): number {
  for (const prop of map.props) {
    const floor = RENDER_SETTINGS.floorProps[prop.model];
    if (floor !== undefined && prop.rect !== null && inRect(prop.rect, x, y)) {
      return floor;
    }
  }
  const kind = map.ground[cellIndex(map, Math.floor(x), Math.floor(y))] ?? 'grass';
  return RENDER_SETTINGS.terrain.heights[kind];
}

/** Pose d'un objet de la carte (centre de l'emprise, au sol, quarts de tour). */
function placement(map: GameMap, prop: MapProp): Matrix4 {
  return new Matrix4().compose(
    new Vector3(prop.pos.x, groundAt(map, prop.pos.x, prop.pos.y), prop.pos.y),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), prop.rotation * (Math.PI / 2)),
    new Vector3(1, 1, 1),
  );
}

// La cloche: la partie du poteau qui pend au bout du bras (à l'est du poteau), à hauteur de cloche.
const BELL_MIN_X = 0.35;
const BELL_MIN_Y = 1.85;
const BELL_MAX_Y = 2.4;
/** Assise du banc (0,42 à 0,45 m) et dossier (au-dessus de 0,5 m). */
const SEAT_MIN_Y = 0.38;
const BACK_MIN_Y = 0.5;

describe('courbes de la journée', () => {
  it('passent par chaque clé et bouclent à minuit', () => {
    const curve = new CyclicCurve([0, 600, 1200], [1, 3, 2], { period: MINUTES_PER_DAY });
    expect(curve.at(600)).toBeCloseTo(3, 9);
    expect(curve.at(1200)).toBeCloseTo(2, 9);
    expect(curve.at(MINUTES_PER_DAY)).toBeCloseTo(curve.at(0), 9);
    expect(curve.at(-1)).toBeCloseTo(curve.at(MINUTES_PER_DAY - 1), 9);
  });

  it('ne dépassent jamais leurs voisines (pas de couleur qui part trop loin)', () => {
    const curve = new CyclicCurve([0, 300, 360, 1000], [0, 0, 1, 1], { period: MINUTES_PER_DAY });
    for (let m = 0; m < MINUTES_PER_DAY; m += 1) {
      expect(curve.at(m)).toBeGreaterThanOrEqual(-1e-9);
      expect(curve.at(m)).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('suivent les angles par le plus court chemin', () => {
    expect(wrapDegrees(350)).toBeCloseTo(-10, 9);
    const curve = new CyclicCurve([0, 720], [350, 10], { period: MINUTES_PER_DAY, angular: true });
    const middle = curve.at(360);
    expect(Math.abs(wrapDegrees(middle))).toBeLessThan(10);
  });

  it('donnent une lumière continue: aucun saut d’une minute à la suivante', () => {
    const rig = new DaylightRig(new Scene());
    let previous: { x: number; y: number; z: number; sun: number; night: number } | null = null;
    for (let m = 0; m <= MINUTES_PER_DAY; m += 1) {
      rig.update(m, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
      const now = {
        x: rig.direction.x,
        y: rig.direction.y,
        z: rig.direction.z,
        sun: rig.sun.intensity,
        night: rig.night,
      };
      if (previous !== null) {
        // Le plus grand pas: le changement de côté de la lumière au crépuscule (ombres presque effacées).
        expect(Math.abs(now.x - previous.x)).toBeLessThan(0.05);
        expect(Math.abs(now.z - previous.z)).toBeLessThan(0.05);
        expect(Math.abs(now.sun - previous.sun)).toBeLessThan(0.05);
        expect(Math.abs(now.night - previous.night)).toBeLessThan(0.05);
      }
      previous = now;
    }
  });
});

describe('lumière du jour', () => {
  it('suit la bible: soleil à l’est le matin, au sud à midi, à l’ouest le soir', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(8 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.direction.x).toBeGreaterThan(0.5);
    rig.update(13 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.direction.z).toBeGreaterThan(0);
    expect(rig.direction.y).toBeGreaterThan(Math.sin((55 * Math.PI) / 180));
    rig.update(18 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.direction.x).toBeLessThan(-0.9);
  });

  it('allume les lueurs au crépuscule et les éteint le jour', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(12 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.night).toBe(0);
    rig.update(18 * HOUR + 30, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.night).toBeGreaterThan(0);
    expect(rig.night).toBeLessThan(0.5);
    rig.update(23 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.night).toBe(1);
  });

  it('sous la pluie: soleil voilé, ombres douces, sol mouillé, pluie', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(12 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    const sun = rig.sun.intensity;
    const shadow = rig.sun.shadow.intensity;
    expect(rig.wet).toBe(0);
    rig.update(12 * HOUR, 'rain', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.sun.intensity).toBeCloseTo(sun * AMBIANCE_SETTINGS.weather.rain.sunFactor, 6);
    expect(rig.sun.shadow.intensity).toBeLessThan(shadow);
    expect(rig.wet).toBe(1);
    expect(rig.rain).toBe(1);
    expect(rig.cloudCover).toBe(0);
  });
});

describe('ombre de la cloche (énigme S4)', () => {
  const map = loadMap(MAP_FILES).map;
  const bellProp = map.props.find((prop) => prop.model === 'bell_post');
  const benchProp = map.props.find((prop) => prop.id === 'quay_bench');
  if (bellProp === undefined || benchProp === undefined) {
    throw new Error('La cloche et le banc du quai doivent être sur la carte.');
  }
  const bellMatrix = placement(map, bellProp);
  const bell = nodePositions('bourg.glb', 'bell_post')
    .filter((p) => p.x > BELL_MIN_X && p.y > BELL_MIN_Y && p.y < BELL_MAX_Y)
    .map((p) => p.applyMatrix4(bellMatrix));
  // Le banc: son assise et son dossier (l'ombre qui passe entre les pieds ne compte pas).
  const benchMatrix = placement(map, benchProp);
  const benchPoints = nodePositions('bourg.glb', 'bench');
  const seat = new Box3().setFromPoints(
    benchPoints
      .filter((p) => p.y > SEAT_MIN_Y && p.y < BACK_MIN_Y)
      .map((p) => p.clone().applyMatrix4(benchMatrix)),
  );
  const back = new Box3().setFromPoints(
    benchPoints.filter((p) => p.y >= BACK_MIN_Y).map((p) => p.clone().applyMatrix4(benchMatrix)),
  );

  /** Part des points de la cloche dont l'ombre tombe sur le banc, à l'heure dite, par soleil. */
  function shadowOnBench(minutes: number): number {
    const rig = new DaylightRig(new Scene());
    rig.update(minutes, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    const towardGround = rig.direction.clone().negate();
    let hits = 0;
    for (const point of bell) {
      const ray = new Ray(point, towardGround);
      if (ray.intersectsBox(seat) || ray.intersectsBox(back)) {
        hits += 1;
      }
    }
    return hits / bell.length;
  }

  it('trouve la cloche dans le modèle, au bout de son bras', () => {
    expect(bell.length).toBeGreaterThan(50);
    expect(seat.min.x).toBeGreaterThan(bellProp.pos.x + 2);
    expect(back.max.y).toBeGreaterThan(seat.max.y);
  });

  it('touche le banc de 17 h à 17 h 45', () => {
    for (let minutes = 17 * HOUR; minutes <= 17 * HOUR + 45; minutes += 5) {
      expect(shadowOnBench(minutes), `à ${minutes} minutes`).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('ne le touche pas à 16 h 30 ni à 18 h 15', () => {
    expect(shadowOnBench(16 * HOUR + 30)).toBe(0);
    expect(shadowOnBench(18 * HOUR + 15)).toBe(0);
  });
});

describe('ombre portée', () => {
  function rigWithCamera(zoomWidth: number): { rig: DaylightRig; camera: OrthographicCamera } {
    const rig = new DaylightRig(new Scene());
    const aspect = 16 / 9;
    const halfWidth = zoomWidth / 2;
    const camera = new OrthographicCamera(
      -halfWidth,
      halfWidth,
      halfWidth / aspect,
      -halfWidth / aspect,
      1,
      220,
    );
    const elevation = (RENDER_SETTINGS.camera.elevationDeg * Math.PI) / 180;
    const azimuth = Math.PI / 4;
    camera.position.set(
      FOCUS.x + Math.cos(azimuth) * Math.cos(elevation) * CAMERA_DISTANCE,
      Math.sin(elevation) * CAMERA_DISTANCE,
      FOCUS.z + Math.sin(azimuth) * Math.cos(elevation) * CAMERA_DISTANCE,
    );
    camera.lookAt(FOCUS);
    camera.updateMatrixWorld();
    rig.attachCamera(camera);
    return { rig, camera };
  }

  it('cale le cadre de l’ombre sur ce que voit la caméra, plus serré que le cercle', () => {
    const { rig } = rigWithCamera(24);
    rig.update(13 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    const tight = rig.shadowTexel();
    const loose = new DaylightRig(new Scene());
    loose.update(13 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(tight).toBeLessThan(loose.shadowTexel());
    // Le point suivi est bien dans le cadre de l'ombre.
    const shadowCamera = rig.sun.shadow.camera;
    shadowCamera.updateMatrixWorld();
    rig.sun.shadow.updateMatrices(rig.sun);
    const projected = FOCUS.clone().applyMatrix4(rig.sun.shadow.matrix);
    expect(projected.x).toBeGreaterThan(0.1);
    expect(projected.x).toBeLessThan(0.9);
    expect(projected.y).toBeGreaterThan(0.1);
    expect(projected.y).toBeLessThan(0.9);
  });

  it('règle le biais selon la taille d’un texel, à chaque zoom (pas d’acné d’ombre)', () => {
    for (const width of RENDER_SETTINGS.camera.viewWidths) {
      const { rig } = rigWithCamera(width);
      rig.update(7 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
      const texel = rig.shadowTexel();
      expect(rig.sun.shadow.normalBias).toBeCloseTo(
        texel * AMBIANCE_SETTINGS.shadows.normalBiasTexels,
        6,
      );
      expect(rig.sun.shadow.bias).toBeLessThan(0);
    }
  });

  it('affine la carte d’ombre à l’heure de l’énigme, et seulement alors', () => {
    const rig = new DaylightRig(new Scene());
    rig.update(17 * HOUR + 15, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.sun.shadow.mapSize.x).toBe(AMBIANCE_SETTINGS.shadows.detailMapSize);
    // Ombres plus pleines et plus nettes en fin d'après-midi qu'à midi.
    const evening = { intensity: rig.sun.shadow.intensity, radius: rig.sun.shadow.radius };
    rig.update(12 * HOUR, 'sunny', FOCUS, VIEW_RADIUS, CAMERA_DISTANCE);
    expect(rig.sun.shadow.mapSize.x).toBe(AMBIANCE_SETTINGS.shadows.mapSize);
    expect(evening.intensity).toBeGreaterThan(rig.sun.shadow.intensity);
    expect(evening.radius).toBeLessThan(rig.sun.shadow.radius);
    // Budget de la plateforme: 2048 au plus.
    expect(AMBIANCE_SETTINGS.shadows.detailMapSize).toBeLessThanOrEqual(2048);
  });

  it('ne garde qu’une lumière directionnelle avec ombre', () => {
    const scene = new Scene();
    new DaylightRig(scene);
    let casting = 0;
    scene.traverse((object) => {
      if (
        (object as { isDirectionalLight?: boolean }).isDirectionalLight === true &&
        object.castShadow
      ) {
        casting += 1;
      }
    });
    expect(casting).toBe(1);
  });
});
