/**
 * Prise des outils (retour R08 du 2026-11-01: « les outils sont toujours tenus en bout de
 * manche, la houe fait canne d'aveugle »). Les outils de l'artiste ont leur origine au point
 * de prise de ses clips de geste (houe à 25 cm du bout du manche, hache à 8 cm) et pendent de
 * la main au repos: la houe tombait jusqu'au sol devant le pied.
 *
 * Chaque outil a ici:
 * - `gestureGrip`: point de l'outil tenu dans la main pendant ses gestes (clips de l'artiste);
 * - `grip` et `carry`: hors geste (attente, marche), le point tenu et le port. Pour la houe,
 *   le port sur l'épaule: main droite au milieu du manche devant l'épaule (bras plié par la
 *   main posée de `portee.ts`), manche couché sur l'épaule, lame derrière, tournée vers le bas.
 *
 * On passe d'une prise à l'autre en douceur (`blendHalfLife`), le temps du fondu des clips.
 */
import { Matrix4, Quaternion, Vector3, type Object3D } from 'three';
import { RENDER_SETTINGS } from './reglages';

type Vec3 = readonly [number, number, number];

export interface ToolCarry {
  /** Main droite, repère du personnage (avant +Z, gauche +X, m avant l'échelle du personnage). */
  readonly hand: Vec3;
  /** Direction de l'axe +Y de l'outil (vers le haut du manche), repère du personnage. */
  readonly axis: Vec3;
  /** Direction approchée de l'axe +Z de l'outil (dos de la lame: -Z), repère du personnage. */
  readonly front: Vec3;
}

export interface ToolHoldSpec {
  /** Point de l'outil dans la main hors geste (repère de l'outil). */
  readonly grip: Vec3;
  /** Point de l'outil dans la main pendant ses gestes. */
  readonly gestureGrip: Vec3;
  /** Clips de geste de cet outil (la prise de l'artiste). */
  readonly gestures: readonly string[];
  /** Port hors geste, ou `null`: l'outil pend de la main du clip, tenu à `grip`. */
  readonly carry: ToolCarry | null;
}

/** Prise d'un outil d'après son type (`tool_kind` de l'artiste, sinon son nom), ou `null`. */
export function holdSpecFor(
  model: string,
  extras: Readonly<Record<string, unknown>>,
): ToolHoldSpec | null {
  const kind = typeof extras.tool_kind === 'string' ? extras.tool_kind : model;
  const holds: Readonly<Record<string, ToolHoldSpec>> = RENDER_SETTINGS.toolHolds;
  return holds[kind] ?? null;
}

const toolPoint = new Vector3();
const basis = new Matrix4();
const axisY = new Vector3();
const axisZ = new Vector3();
const axisX = new Vector3();
const rootQuat = new Quaternion();
const handQuat = new Quaternion();
const wanted = new Quaternion();
const IDENTITY = new Quaternion();

/** Orientation de l'outil (repère du personnage) d'après un port. */
export function carryQuaternion(carry: ToolCarry, out: Quaternion): Quaternion {
  axisY.set(carry.axis[0], carry.axis[1], carry.axis[2]).normalize();
  axisZ.set(carry.front[0], carry.front[1], carry.front[2]);
  axisZ.addScaledVector(axisY, -axisZ.dot(axisY)).normalize();
  axisX.crossVectors(axisY, axisZ);
  basis.makeBasis(axisX, axisY, axisZ);
  return out.setFromRotationMatrix(basis);
}

/** Tient l'outil d'un personnage: cible de la main droite, place et orientation de l'outil. */
export class ToolHolder {
  private spec: ToolHoldSpec | null = null;
  private readonly carryQuat = new Quaternion();
  /** Part du port (0: prise de geste, 1: port), lissée. */
  private weight = 0;

  set(spec: ToolHoldSpec | null): void {
    this.spec = spec;
    if (spec !== null && spec.carry !== null) {
      carryQuaternion(spec.carry, this.carryQuat);
    }
  }

  /**
   * Avance le mélange vers le port ou la prise de geste selon le clip joué. Écrit la cible de
   * la main droite (monde) dans `out` et rend son poids (0 sans port).
   */
  handTarget(root: Object3D, clip: string, dt: number, out: Vector3): number {
    const spec = this.spec;
    const carrying = spec !== null && !spec.gestures.includes(clip);
    const goal = carrying ? 1 : 0;
    const k = 1 - Math.pow(2, -Math.max(0, dt) / RENDER_SETTINGS.toolHoldBlendHalfLife);
    this.weight += (goal - this.weight) * k;
    if (Math.abs(goal - this.weight) < 1e-3) this.weight = goal;
    const carry = spec?.carry ?? null;
    if (carry === null || this.weight <= 0) return 0;
    out.set(carry.hand[0], carry.hand[1], carry.hand[2]);
    root.localToWorld(out);
    return this.weight;
  }

  /** Après le mélangeur et la main posée: place l'outil dans la main (enfant de la prise). */
  place(root: Object3D, hand: Object3D, tool: Object3D): void {
    const spec = this.spec;
    if (spec === null) {
      tool.position.set(0, 0, 0);
      tool.quaternion.identity();
      return;
    }
    const w = this.weight;
    if (spec.carry !== null && w > 0) {
      // Orientation voulue dans le monde, ramenée dans le repère de la main.
      root.getWorldQuaternion(rootQuat);
      hand.getWorldQuaternion(handQuat);
      wanted.copy(handQuat).invert().multiply(rootQuat).multiply(this.carryQuat);
      tool.quaternion.copy(IDENTITY).slerp(wanted, w);
    } else {
      tool.quaternion.identity();
    }
    const g = spec.gestureGrip;
    const c = spec.grip;
    toolPoint.set(g[0] + (c[0] - g[0]) * w, g[1] + (c[1] - g[1]) * w, g[2] + (c[2] - g[2]) * w);
    // Le point tenu de l'outil tombe sur l'origine de la prise: position = -(rotation x point).
    tool.position.copy(toolPoint.applyQuaternion(tool.quaternion).negate());
  }
}
