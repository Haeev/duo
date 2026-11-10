/**
 * Caméra libre (technique 3.5): orthographique, proche du personnage, lacet continu sur 360
 * degrés, zoom continu, suivi avec un léger retard, limites douces. Logique pure, sans WebGL:
 * le moteur pose la caméra Three.js d'après `pose()`, les tests donnent des pas fabriqués.
 *
 * Repères: la carte a x vers l'est et y vers le sud (1 m par case). Lacet 0: l'écran regarde vers
 * le nord (le haut de l'écran est au nord); le lacet croît dans le sens horaire vu du dessus
 * (PI/2: le haut de l'écran est à l'est).
 */
import { RENDER_SETTINGS } from './reglages';

export type CameraSettings = { readonly [K in keyof typeof RENDER_SETTINGS.camera]: number } & {
  /** Largeur à partir de laquelle la plongée est entière (m); absente: au zoom le plus large. */
  readonly pitchFullWidth?: number;
};

/** Commandes de caméra d'une image. Tout est facultatif: une commande absente vaut zéro. */
export interface CameraInput {
  /** Rotation tenue (touches A et E): -1 vers la gauche, 1 vers la droite. */
  readonly turn?: number;
  /** Glissé au bouton droit depuis la dernière image, en points CSS (positif vers la droite). */
  readonly dragPixels?: number;
  /** Crans de molette depuis la dernière image (positif: on s'éloigne). */
  readonly wheel?: number;
  /** Zoom tenu (flèches haut et bas): 1 rapproche, -1 éloigne. */
  readonly zoom?: number;
}

/** Ce que la caméra suit: le personnage local, dans le repère de la carte. */
export interface CameraTarget {
  readonly x: number;
  readonly y: number;
  /** Vitesse au sol (m/s) et cap (radians, 0 vers l'est, PI/2 vers le sud), pour l'anticipation. */
  readonly speed: number;
  readonly facing: number;
}

/** Rectangle où la vue reste: la carte, le dehors d'un lieu, ou la pièce où est le joueur. */
export interface MapBounds {
  /** Coin nord-ouest (m); absent: l'origine de la carte. */
  readonly x?: number;
  readonly y?: number;
  readonly width: number;
  readonly height: number;
}

/** Où poser la caméra: point visé au sol, lacet, inclinaison, largeur de vue. */
export interface CameraPose {
  readonly x: number;
  readonly y: number;
  /** Lacet affiché (radians), dans [0, 2 PI[. */
  readonly yaw: number;
  /** Inclinaison au-dessus de l'horizon (radians). */
  readonly pitch: number;
  /** Largeur de vue au sol (m). */
  readonly width: number;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** Part du chemin faite en `dt` secondes pour un demi-rattrapage en `halfLife` secondes. */
export function approach(dt: number, halfLife: number): number {
  if (halfLife <= 0) return 1;
  return 1 - Math.pow(0.5, dt / halfLife);
}

/**
 * Borne douce: identité loin des bords, puis freinage progressif sur `softness` au lieu d'un arrêt
 * net. La sortie ne dépasse jamais [min, max] et reste continue et monotone.
 */
export function softClamp(value: number, min: number, max: number, softness: number): number {
  if (max <= min) return (min + max) / 2;
  const soft = Math.min(softness, (max - min) / 2);
  if (soft <= 0) return Math.min(max, Math.max(min, value));
  const low = min + soft;
  const high = max - soft;
  if (value < low) return min + soft * Math.exp((value - low) / soft);
  if (value > high) return max - soft * Math.exp((high - value) / soft);
  return value;
}

/** Ramène un angle dans [0, 2 PI[. */
export function wrapAngle(angle: number): number {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

/**
 * Direction du monde d'une commande de déplacement relative à l'écran: `right` et `up` de -1 à 1
 * (droite et haut de l'écran). Rend le vecteur dans le repère de la carte (x est, y sud), de même
 * longueur: c'est ce que `StepInput.moveX` et `moveY` attendent.
 */
export function screenToWorld(yaw: number, right: number, up: number): { x: number; y: number } {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return { x: right * cos + up * sin, y: right * sin - up * cos };
}

export class CameraRig {
  private yaw: number;
  private yawRate = 0;
  /** Largeur visée (commandes) et largeur affichée (qui la rattrape). */
  private wantedWidth: number;
  private width: number;
  private x = 0;
  private y = 0;
  private placed = false;

  constructor(private readonly settings: CameraSettings = RENDER_SETTINGS.camera) {
    this.yaw = wrapAngle(settings.defaultYawDeg * DEG);
    this.wantedWidth = settings.defaultWidth;
    this.width = settings.defaultWidth;
  }

  /** Pose la vue d'un coup sur la cible (arrivée dans un lieu): aucun glissement depuis l'ancien lieu. */
  snapTo(target: CameraTarget, bounds: MapBounds): void {
    const goal = this.goal(target, bounds);
    this.x = goal.x;
    this.y = goal.y;
    this.placed = true;
  }

  /** Départ d'un lieu: la prochaine image pose la vue d'un coup sur la cible. */
  detach(): void {
    this.placed = false;
  }

  /** Impose le lacet (degrés) et la largeur (m): démonstration, captures, cadrages imposés. */
  set(yawDeg: number, width: number): void {
    this.yaw = wrapAngle(yawDeg * DEG);
    this.yawRate = 0;
    this.wantedWidth = Math.min(this.settings.maxWidth, Math.max(this.settings.minWidth, width));
    this.width = this.wantedWidth;
  }

  update(dt: number, input: CameraInput, target: CameraTarget, bounds: MapBounds): void {
    const s = this.settings;
    if (!this.placed) this.snapTo(target, bounds);

    // Rotation: la vitesse monte et retombe en douceur (inertie courte), le glissé est direct.
    const wantedRate = Math.max(-1, Math.min(1, input.turn ?? 0)) * s.yawSpeedDeg * DEG;
    this.yawRate += (wantedRate - this.yawRate) * approach(dt, s.yawEaseSeconds / 2);
    this.yaw = wrapAngle(
      this.yaw + this.yawRate * dt + (input.dragPixels ?? 0) * s.dragDegPerPixel * DEG,
    );

    // Zoom: en facteur, pour que chaque cran pèse autant de près que de loin. La commande peut
    // dépasser un peu les bornes, la largeur visée y revient d'elle-même (limite douce).
    const wheel = input.wheel ?? 0;
    const hold = Math.max(-1, Math.min(1, input.zoom ?? 0));
    let wanted =
      this.wantedWidth *
      Math.pow(s.wheelFactor, wheel) *
      Math.pow(s.holdFactorPerSecond, -hold * dt);
    const over = 1 + s.zoomOvershoot;
    wanted = Math.min(s.maxWidth * over, Math.max(s.minWidth / over, wanted));
    if (wheel === 0 && hold === 0) {
      const inside = Math.min(s.maxWidth, Math.max(s.minWidth, wanted));
      wanted += (inside - wanted) * approach(dt, s.zoomHalfLife * 2);
    }
    this.wantedWidth = wanted;
    this.width += (wanted - this.width) * approach(dt, s.zoomHalfLife);

    // Suivi: léger retard, anticipation dans le sens de la marche.
    const goal = this.goal(target, bounds);
    const k = approach(dt, s.followHalfLife);
    this.x += (goal.x - this.x) * k;
    this.y += (goal.y - this.y) * k;
  }

  private goal(target: CameraTarget, bounds: MapBounds): { x: number; y: number } {
    const s = this.settings;
    const ahead = Math.min(s.lookAheadMax, target.speed * s.lookAheadSeconds);
    const x0 = bounds.x ?? 0;
    const y0 = bounds.y ?? 0;
    return {
      x: softClamp(
        target.x + Math.cos(target.facing) * ahead,
        x0 + s.edgeMargin,
        x0 + bounds.width - s.edgeMargin,
        s.edgeSoftness,
      ),
      y: softClamp(
        target.y + Math.sin(target.facing) * ahead,
        y0 + s.edgeMargin,
        y0 + bounds.height - s.edgeMargin,
        s.edgeSoftness,
      ),
    };
  }

  /** Lacet affiché (radians): le déplacement, l'audio et les panneaux le lisent. */
  yawAngle(): number {
    return this.yaw;
  }

  pose(): CameraPose {
    const s = this.settings;
    const full = s.pitchFullWidth ?? s.maxWidth;
    const t = Math.min(1, Math.max(0, (this.width - s.minWidth) / (full - s.minWidth)));
    // Adouci surtout tout près: l'inclinaison retrouve vite sa plongée entière en s'éloignant.
    const eased = 1 - (1 - t) * (1 - t);
    return {
      x: this.x,
      y: this.y,
      yaw: this.yaw,
      pitch: (s.pitchNearDeg + (s.pitchFarDeg - s.pitchNearDeg) * eased) * DEG,
      width: this.width,
    };
  }
}

/**
 * Direction du sol vers la caméra pour une pose, dans le repère Three.js (X est, Y haut, Z sud),
 * normalisée. En orthographique, elle est la même pour tous les points de la scène.
 */
export function towardCamera(pose: Pick<CameraPose, 'yaw' | 'pitch'>): {
  x: number;
  y: number;
  z: number;
} {
  const flat = Math.cos(pose.pitch);
  return {
    x: -Math.sin(pose.yaw) * flat,
    y: Math.sin(pose.pitch),
    z: Math.cos(pose.yaw) * flat,
  };
}

/** Rayon du cercle de sol vu (m), pour le cadre d'ombre: il ne change pas quand on tourne. */
export function viewRadius(pose: CameraPose, aspect: number): number {
  const depth = pose.width / Math.max(0.1, aspect) / Math.sin(pose.pitch);
  return Math.hypot(pose.width, depth) / 2;
}
