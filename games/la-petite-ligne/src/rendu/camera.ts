/**
 * Caméra isométrique orthographique: quatre orientations par quarts de tour
 * (A et E), trois zooms (R et F), suivi doux du personnage du joueur local.
 *
 * Convention de `yaw`: direction « haut de l'écran » posée au sol, avec la
 * convention de `facing` (0 vers l'est, PI/2 vers le sud). La caméra est donc
 * derrière le point suivi, à l'opposé de `yaw`, inclinée de 35,264° (isométrie
 * vraie). `yaw()` renvoie l'orientation visée, pas l'animation: la marche
 * tourne d'un coup avec la touche.
 */
import { MathUtils, OrthographicCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { RENDER_SETTINGS } from './reglages';

export type CameraCommand = 'rotate_left' | 'rotate_right' | 'zoom_in' | 'zoom_out';

const DEG = Math.PI / 180;
const QUARTER_TURN = Math.PI / 2;
/** Première orientation: haut de l'écran vers le nord-ouest. */
const FIRST_YAW = -Math.PI + RENDER_SETTINGS.camera.firstAzimuthDeg * DEG;
const SHAKE_SECONDARY = 0.73;
const SHAKE_TERTIARY = 1.37;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Courbe douce pour les transitions de rotation et de zoom. */
function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Facteur de lissage exponentiel indépendant de la fréquence d'image. */
export function smoothFactor(dt: number, halfLife: number): number {
  if (halfLife <= 0) {
    return 1;
  }
  return 1 - Math.pow(2, -dt / halfLife);
}

export class IsoCameraRig {
  readonly camera: OrthographicCamera;
  private readonly settings = RENDER_SETTINGS.camera;
  private orientation = 0;
  private yawFrom = FIRST_YAW;
  private yawTo = FIRST_YAW;
  private yawShown = FIRST_YAW;
  private yawElapsed = Number.POSITIVE_INFINITY;
  private zoomIndex: number;
  private widthFrom: number;
  private widthTo: number;
  private widthShown: number;
  private zoomElapsed = Number.POSITIVE_INFINITY;
  private aspect = 1;
  private trauma = 0;
  private time = 0;
  private hasFocus = false;
  /** Point suivi (lissé), au sol. */
  readonly focus = new Vector3();
  private readonly lead = new Vector3();
  private readonly tmpGoal = new Vector3();
  private readonly tmpLead = new Vector3();
  private readonly offset = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  private readonly hit = new Vector3();

  constructor(private reducedMotion: boolean) {
    this.zoomIndex = this.settings.initialZoom;
    const width = this.widthAt(this.zoomIndex);
    this.widthFrom = width;
    this.widthTo = width;
    this.widthShown = width;
    this.camera = new OrthographicCamera(-1, 1, 1, -1, this.settings.near, this.settings.far);
    this.applyProjection();
  }

  private widthAt(index: number): number {
    const widths = this.settings.viewWidths;
    return widths[MathUtils.clamp(index, 0, widths.length - 1)] ?? widths[0];
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  command(command: CameraCommand): void {
    switch (command) {
      case 'rotate_left':
        this.rotate(-1);
        break;
      case 'rotate_right':
        this.rotate(1);
        break;
      case 'zoom_in':
        this.zoom(-1);
        break;
      case 'zoom_out':
        this.zoom(1);
        break;
    }
  }

  private rotate(direction: number): void {
    this.orientation += direction;
    this.yawFrom = this.yawShown;
    this.yawTo = FIRST_YAW + this.orientation * QUARTER_TURN;
    this.yawElapsed = this.reducedMotion ? Number.POSITIVE_INFINITY : 0;
  }

  private zoom(direction: number): void {
    const next = MathUtils.clamp(this.zoomIndex + direction, 0, this.settings.viewWidths.length - 1);
    if (next === this.zoomIndex) {
      return;
    }
    this.zoomIndex = next;
    this.widthFrom = this.widthShown;
    this.widthTo = this.widthAt(next);
    this.zoomElapsed = this.reducedMotion ? Number.POSITIVE_INFINITY : 0;
  }

  /** Orientation visée (radians), convention décrite en tête du fichier. */
  yaw(): number {
    return MathUtils.euclideanModulo(this.yawTo + Math.PI, Math.PI * 2) - Math.PI;
  }

  /** Orientation affichée (pendant l'animation de 0,3 s). */
  shownYaw(): number {
    return this.yawShown;
  }

  /** Quart de tour courant (0 à 3). */
  quarter(): number {
    return MathUtils.euclideanModulo(this.orientation, 4);
  }

  /** Largeur de vue affichée (m). */
  viewWidth(): number {
    return this.widthShown;
  }

  /** Rayon au sol de ce que la caméra voit (pour caler l'ombre et la pluie). */
  viewRadius(): number {
    const halfWidth = this.widthShown / 2;
    const halfHeight = halfWidth / this.aspect / Math.sin(this.settings.elevationDeg * DEG);
    return Math.hypot(halfWidth, halfHeight);
  }

  setAspect(aspect: number): void {
    this.aspect = aspect > 0 ? aspect : 1;
    this.applyProjection();
  }

  addTrauma(amount: number): void {
    if (!this.reducedMotion) {
      this.trauma = Math.min(1, this.trauma + amount);
    }
  }

  /** Recentre sans lissage (chargement, retour de minuit). */
  snapTo(x: number, y: number): void {
    this.focus.set(x, 0, y);
    this.lead.set(0, 0, 0);
    this.hasFocus = true;
  }

  /**
   * Avance d'une image: transitions, suivi doux de `(x, y)` avec une légère
   * anticipation dans le sens de la marche, tremblement, puis place la caméra.
   */
  update(dt: number, x: number, y: number, velocityX: number, velocityY: number, bounds: Bounds | null): void {
    this.time += dt;
    if (!this.hasFocus) {
      this.snapTo(x, y);
    }
    this.yawElapsed += dt;
    const rotateT = Math.min(1, this.yawElapsed / this.settings.rotateSeconds);
    this.yawShown = MathUtils.lerp(this.yawFrom, this.yawTo, easeInOut(rotateT));
    this.zoomElapsed += dt;
    const zoomT = Math.min(1, this.zoomElapsed / this.settings.zoomSeconds);
    const width = MathUtils.lerp(this.widthFrom, this.widthTo, easeInOut(zoomT));
    if (width !== this.widthShown) {
      this.widthShown = width;
      this.applyProjection();
    }

    const speed = Math.hypot(velocityX, velocityY);
    const leadAmount = speed > 0 ? (this.settings.lookAhead * Math.min(1, speed / this.settings.lookAheadSpeed)) / speed : 0;
    this.tmpLead.set(velocityX * leadAmount, 0, velocityY * leadAmount);
    this.lead.lerp(this.tmpLead, smoothFactor(dt, this.settings.lookAheadHalfLife));
    this.tmpGoal.set(x, 0, y).add(this.lead);
    if (bounds !== null) {
      const margin = this.settings.edgeMargin;
      this.tmpGoal.x = MathUtils.clamp(this.tmpGoal.x, bounds.minX + margin, bounds.maxX - margin);
      this.tmpGoal.z = MathUtils.clamp(this.tmpGoal.z, bounds.minY + margin, bounds.maxY - margin);
    }
    this.focus.lerp(this.tmpGoal, smoothFactor(dt, this.settings.followHalfLife));
    this.place(dt);
  }

  private place(dt: number): void {
    const elevation = this.settings.elevationDeg * DEG;
    const distance = this.settings.distance;
    const horizontal = Math.cos(elevation) * distance;
    this.offset.set(-Math.cos(this.yawShown) * horizontal, Math.sin(elevation) * distance, -Math.sin(this.yawShown) * horizontal);
    this.camera.position.copy(this.focus).add(this.offset);
    this.camera.lookAt(this.focus);

    if (this.trauma > 0) {
      const shake = this.trauma * this.trauma * this.settings.shakeAmplitude;
      const phase = this.time * this.settings.shakeFrequency;
      this.right.setFromMatrixColumn(this.camera.matrix, 0);
      this.up.setFromMatrixColumn(this.camera.matrix, 1);
      const dx = Math.sin(phase) * Math.cos(phase * SHAKE_SECONDARY);
      const dy = Math.sin(phase * SHAKE_TERTIARY + 1);
      this.camera.position.addScaledVector(this.right, dx * shake).addScaledVector(this.up, dy * shake);
      this.trauma = Math.max(0, this.trauma - this.settings.shakeDecay * dt);
    }
    this.camera.updateMatrixWorld();
  }

  private applyProjection(): void {
    const halfWidth = this.widthShown / 2;
    const halfHeight = halfWidth / this.aspect;
    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Rayon depuis un point de l'écran (coordonnées normalisées de -1 à 1). */
  ray(ndcX: number, ndcY: number): Raycaster {
    this.ndc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster;
  }

  /** Point du sol (hauteur `height`) sous un point de l'écran, ou `null`. */
  groundAt(ndcX: number, ndcY: number, height = 0): Vector3 | null {
    this.groundPlane.constant = -height;
    const hit = this.ray(ndcX, ndcY).ray.intersectPlane(this.groundPlane, this.hit);
    return hit === null ? null : hit;
  }
}
