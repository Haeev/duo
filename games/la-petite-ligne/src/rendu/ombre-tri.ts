/**
 * Tri fin de la passe d'ombre. La caméra d'ombre (`lumiere.ts`) est un cadre
 * droit dans le repère de la lumière, autour de l'empreinte de la vue: dès que
 * le soleil et la caméra ne sont pas alignés, ce cadre déborde largement de
 * l'empreinte (jusqu'au double de sa surface), et ce qui est dans ses coins est
 * dessiné dans la carte d'ombre sans que son ombre tombe dans la vue.
 *
 * L'ombre d'un point file droit à l'opposé du soleil: sa trace dans le plan de
 * la lumière ne bouge pas. Un objet dont la trace ne touche pas l'enveloppe de
 * l'empreinte (polygone convexe dans ce plan) n'ombre rien de visible: il sort
 * de la passe d'ombre pour cette image (`castShadow` remis juste après).
 */
import {
  InstancedMesh,
  Mesh,
  SkinnedMesh,
  Vector3,
  type BufferGeometry,
  type Object3D,
  type OrthographicCamera,
} from 'three';
import { RENDER_SETTINGS } from './reglages';

/** Coins de l'écran en coordonnées normalisées (plan proche). */
const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
const NEAR_PLANE_NDC = -1;
const MAX_POINTS = SCREEN_CORNERS.length * 4;

export class ShadowCasterCulling {
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly forward = new Vector3();
  private readonly corner = new Vector3();
  private readonly point = new Vector3();
  private readonly center = new Vector3();
  /** Points de l'empreinte dans le plan de la lumière, puis enveloppe convexe (sens direct). */
  private readonly pu = new Float64Array(MAX_POINTS);
  private readonly pv = new Float64Array(MAX_POINTS);
  private readonly order: number[] = [];
  private readonly hull: number[] = [];
  private hullSize = 0;
  /** Normales sortantes des côtés de l'enveloppe et leur décalage. */
  private readonly nu = new Float64Array(MAX_POINTS);
  private readonly nv = new Float64Array(MAX_POINTS);
  private readonly offset = new Float64Array(MAX_POINTS);
  private minU = 0;
  private maxU = 0;
  private minV = 0;
  private maxV = 0;
  private readonly suppressed: Object3D[] = [];
  private readonly visit = (object: Object3D): void => {
    this.consider(object);
  };
  private readonly byU = (a: number, b: number): number =>
    (this.pu[a] ?? 0) - (this.pu[b] ?? 0) || (this.pv[a] ?? 0) - (this.pv[b] ?? 0);
  /** Objets testés et retirés à la dernière image (diagnostic). */
  tested = 0;

  /**
   * Retire de la passe d'ombre ce qui n'ombre rien dans la vue de `camera`,
   * le soleil venant de `toSun` (vecteur unitaire vers la lumière).
   */
  begin(scene: Object3D, camera: OrthographicCamera, toSun: Vector3): void {
    this.end();
    if (!RENDER_SETTINGS.shadowCasters.cull || !this.footprint(camera, toSun)) {
      return;
    }
    this.tested = 0;
    scene.traverseVisible(this.visit);
  }

  /** Rend leur ombre aux objets retirés par `begin`. */
  end(): void {
    for (const object of this.suppressed) {
      object.castShadow = true;
    }
    this.suppressed.length = 0;
  }

  /** Nombre d'objets retirés à la dernière image (diagnostic). */
  culled(): number {
    return this.suppressed.length;
  }

  /** Enveloppe de l'empreinte de la vue dans le plan de la lumière; faux si dégénérée. */
  private footprint(camera: OrthographicCamera, toSun: Vector3): boolean {
    const settings = RENDER_SETTINGS.shadowCasters;
    this.right.crossVectors(this.worldUp, toSun);
    if (this.right.lengthSq() < Number.EPSILON) {
      return false;
    }
    this.right.normalize();
    this.up.crossVectors(toSun, this.right).normalize();
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
    const forwardY = Math.min(-Number.EPSILON, this.forward.y);
    let count = 0;
    for (const [x, y] of SCREEN_CORNERS) {
      this.corner.set(x, y, NEAR_PLANE_NDC).unproject(camera);
      for (const height of settings.receiverHeights) {
        const t = (height - this.corner.y) / forwardY;
        this.point.copy(this.corner).addScaledVector(this.forward, t);
        this.pu[count] = this.point.dot(this.right);
        this.pv[count] = this.point.dot(this.up);
        count += 1;
      }
    }
    this.convexHull(count);
    if (this.hullSize < 3) {
      return false;
    }
    this.minU = Number.POSITIVE_INFINITY;
    this.maxU = Number.NEGATIVE_INFINITY;
    this.minV = Number.POSITIVE_INFINITY;
    this.maxV = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < this.hullSize; i += 1) {
      const a = this.hull[i] ?? 0;
      const b = this.hull[(i + 1) % this.hullSize] ?? 0;
      const au = this.pu[a] ?? 0;
      const av = this.pv[a] ?? 0;
      this.minU = Math.min(this.minU, au);
      this.maxU = Math.max(this.maxU, au);
      this.minV = Math.min(this.minV, av);
      this.maxV = Math.max(this.maxV, av);
      // Sens direct: la normale sortante est l'arête tournée d'un quart de tour en arrière.
      const eu = (this.pu[b] ?? 0) - au;
      const ev = (this.pv[b] ?? 0) - av;
      const length = Math.hypot(eu, ev) || 1;
      this.nu[i] = ev / length;
      this.nv[i] = -eu / length;
      this.offset[i] = au * (this.nu[i] ?? 0) + av * (this.nv[i] ?? 0) + settings.margin;
    }
    this.minU -= settings.margin;
    this.maxU += settings.margin;
    this.minV -= settings.margin;
    this.maxV += settings.margin;
    return true;
  }

  /** Enveloppe convexe (chaîne monotone d'Andrew), sans allocation. */
  private convexHull(count: number): void {
    const order = this.order;
    order.length = 0;
    for (let i = 0; i < count; i += 1) {
      order.push(i);
    }
    order.sort(this.byU);
    const hull = this.hull;
    hull.length = 0;
    for (const index of order) {
      while (
        hull.length >= 2 &&
        this.cross(hull[hull.length - 2] ?? 0, hull[hull.length - 1] ?? 0, index) <= 0
      ) {
        hull.pop();
      }
      hull.push(index);
    }
    const lower = hull.length + 1;
    for (let i = order.length - 2; i >= 0; i -= 1) {
      const index = order[i] ?? 0;
      while (
        hull.length >= lower &&
        this.cross(hull[hull.length - 2] ?? 0, hull[hull.length - 1] ?? 0, index) <= 0
      ) {
        hull.pop();
      }
      hull.push(index);
    }
    hull.pop();
    this.hullSize = hull.length;
  }

  private cross(o: number, a: number, b: number): number {
    const pu = this.pu;
    const pv = this.pv;
    return (
      ((pu[a] ?? 0) - (pu[o] ?? 0)) * ((pv[b] ?? 0) - (pv[o] ?? 0)) -
      ((pv[a] ?? 0) - (pv[o] ?? 0)) * ((pu[b] ?? 0) - (pu[o] ?? 0))
    );
  }

  private consider(object: Object3D): void {
    if (!object.castShadow || !object.frustumCulled || !(object instanceof Mesh)) {
      return;
    }
    this.tested += 1;
    const m = object.matrixWorld.elements;
    let halfU: number;
    let halfV: number;
    if (object instanceof InstancedMesh || object instanceof SkinnedMesh) {
      // Sphère englobante propre à l'objet (instances, ou corps posé une fois pour toutes).
      if (object.boundingSphere === null) {
        object.computeBoundingSphere();
      }
      const sphere = object.boundingSphere;
      if (sphere === null) {
        return;
      }
      this.center.copy(sphere.center).applyMatrix4(object.matrixWorld);
      const radius = sphere.radius * object.matrixWorld.getMaxScaleOnAxis();
      halfU = radius;
      halfV = radius;
    } else {
      const geometry = object.geometry as BufferGeometry;
      if (geometry.boundingBox === null) {
        geometry.computeBoundingBox();
      }
      const box = geometry.boundingBox;
      if (box === null || box.isEmpty()) {
        return;
      }
      box.getCenter(this.center);
      const hx = (box.max.x - box.min.x) * 0.5;
      const hy = (box.max.y - box.min.y) * 0.5;
      const hz = (box.max.z - box.min.z) * 0.5;
      this.center.applyMatrix4(object.matrixWorld);
      // Demi-étendue de la boîte tournée le long d'un axe: somme des colonnes de la matrice projetées.
      const r = this.right;
      const u = this.up;
      halfU =
        Math.abs(r.x * m[0] + r.y * m[1] + r.z * m[2]) * hx +
        Math.abs(r.x * m[4] + r.y * m[5] + r.z * m[6]) * hy +
        Math.abs(r.x * m[8] + r.y * m[9] + r.z * m[10]) * hz;
      halfV =
        Math.abs(u.x * m[0] + u.y * m[1] + u.z * m[2]) * hx +
        Math.abs(u.x * m[4] + u.y * m[5] + u.z * m[6]) * hy +
        Math.abs(u.x * m[8] + u.y * m[9] + u.z * m[10]) * hz;
    }
    if (!this.touches(this.center.dot(this.right), this.center.dot(this.up), halfU, halfV)) {
      object.castShadow = false;
      this.suppressed.push(object);
    }
  }

  /** Le rectangle (centre, demi-côtés) dans le plan de la lumière touche-t-il l'enveloppe ? */
  private touches(cu: number, cv: number, halfU: number, halfV: number): boolean {
    if (cu + halfU < this.minU || cu - halfU > this.maxU) {
      return false;
    }
    if (cv + halfV < this.minV || cv - halfV > this.maxV) {
      return false;
    }
    for (let i = 0; i < this.hullSize; i += 1) {
      const nu = this.nu[i] ?? 0;
      const nv = this.nv[i] ?? 0;
      const nearest = cu * nu + cv * nv - (Math.abs(nu) * halfU + Math.abs(nv) * halfV);
      if (nearest > (this.offset[i] ?? 0)) {
        return false;
      }
    }
    return true;
  }
}

/** Une pièce porte-t-elle une ombre visible ? (`RENDER_SETTINGS.shadowCasters.shadowlessParts`) */
export function castsVisibleShadow(name: string): boolean {
  return !RENDER_SETTINGS.shadowCasters.shadowlessParts.some((pattern) => pattern.test(name));
}

/** Ombres d'un modèle instancié: portée sauf par les pièces sans ombre visible, reçue partout. */
export function applyShadows(root: Object3D, receive = true): void {
  root.traverse((child) => {
    child.castShadow = castsVisibleShadow(child.name);
    if (receive) {
      child.receiveShadow = true;
    }
  });
}
