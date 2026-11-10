/**
 * Pose assise juste pour chaque corps: le clip `sit` donne l'allure (dos, bras, cuisses), puis
 * une cinématique inverse à deux os ramène chaque cheville à sa place au sol, quelles que soient
 * la hauteur de l'assise (fiche du meuble) et la longueur des jambes du gabarit. Le bassin se
 * pose donc à la vraie hauteur de l'assise, sans enfoncer les pieds dans le sol ni les laisser
 * flotter; une jambe trop courte pour toucher le sol (enfant, tabouret haut) garde la pose du
 * clip: les pieds pendent.
 */
import { type Object3D, Quaternion, Vector3 } from 'three';

export interface Leg {
  readonly upper: Object3D;
  readonly lower: Object3D;
  readonly foot: Object3D;
}

const hip = new Vector3();
const knee = new Vector3();
const ankle = new Vector3();
const a = new Vector3();
const b = new Vector3();
const axis = new Vector3();
const turn = new Quaternion();
const world = new Quaternion();
const parent = new Quaternion();
const footWorld = new Quaternion();

/** Tourne un os de `q` dans le repère du monde (autour de sa propre articulation). */
function rotateWorld(bone: Object3D, q: Quaternion): void {
  bone.getWorldQuaternion(world);
  if (bone.parent === null) parent.identity();
  else bone.parent.getWorldQuaternion(parent);
  bone.quaternion.copy(parent.invert()).multiply(q).multiply(world);
  bone.updateMatrixWorld(true);
}

/**
 * Amène la cheville en `target` (monde) en pliant le genou dans son plan actuel, puis en
 * balançant la cuisse. Rend `false` sans rien toucher si la jambe est trop courte (à `slack`
 * près, pour ne jamais la tendre tout à fait). Le pied garde son orientation d'avant.
 */
export function solveLeg(leg: Leg, target: Vector3, slack = 0.01): boolean {
  leg.upper.getWorldPosition(hip);
  leg.lower.getWorldPosition(knee);
  leg.foot.getWorldPosition(ankle);
  const thigh = hip.distanceTo(knee);
  const shin = knee.distanceTo(ankle);
  const reach = hip.distanceTo(target);
  if (reach > thigh + shin - slack || thigh < 1e-5 || shin < 1e-5) return false;
  const wanted = Math.max(reach, Math.abs(thigh - shin) + 1e-4);
  leg.foot.getWorldQuaternion(footWorld);

  // 1. Le genou: l'angle entre cuisse et tibia qui donne la bonne distance de la hanche à la cheville.
  a.copy(hip).sub(knee);
  b.copy(ankle).sub(knee);
  axis.copy(b).cross(a);
  if (axis.lengthSq() < 1e-10) axis.set(1, 0, 0);
  axis.normalize();
  const now = a.angleTo(b);
  const cos = (thigh * thigh + shin * shin - wanted * wanted) / (2 * thigh * shin);
  const then = Math.acos(Math.min(1, Math.max(-1, cos)));
  rotateWorld(leg.lower, turn.setFromAxisAngle(axis, now - then));

  // 2. La cuisse: la jambe pliée vise la cible.
  leg.foot.getWorldPosition(ankle);
  a.copy(ankle).sub(hip).normalize();
  b.copy(target).sub(hip).normalize();
  rotateWorld(leg.upper, turn.setFromUnitVectors(a, b));

  // 3. Le pied reste à plat, comme dans le clip.
  if (leg.foot.parent === null) parent.identity();
  else leg.foot.parent.getWorldQuaternion(parent);
  leg.foot.quaternion.copy(parent.invert()).multiply(footWorld);
  leg.foot.updateMatrixWorld(true);
  return true;
}

/** Pose d'un clip gardée de côté: un os que le clip ne réécrit pas revient à elle avant chaque image. */
export class LegPose {
  private readonly bones: Object3D[] = [];
  private readonly saved: Quaternion[] = [];
  private held = false;

  constructor(legs: readonly Leg[]) {
    for (const leg of legs) {
      this.bones.push(leg.upper, leg.lower, leg.foot);
      this.saved.push(new Quaternion(), new Quaternion(), new Quaternion());
    }
  }

  /** À appeler avant le mélangeur d'animation: rend aux os la pose du clip de l'image passée. */
  restore(): void {
    if (!this.held) return;
    this.bones.forEach((bone, i) => {
      const q = this.saved[i];
      if (q !== undefined) bone.quaternion.copy(q);
    });
    this.held = false;
  }

  /** À appeler après le mélangeur, avant de poser les jambes: garde la pose du clip. */
  keep(): void {
    this.bones.forEach((bone, i) => this.saved[i]?.copy(bone.quaternion));
    this.held = true;
  }
}

/**
 * Glissement le long de l'assise pour qu'un corps ne traverse pas l'accoudoir: `along` est sa
 * place le long du meuble depuis son milieu (m), `halfWidth` la demi-largeur du meuble, `clear`
 * ce qu'il faut entre le milieu du corps et le bout du meuble. Rend la place corrigée.
 */
export function clampAlongSeat(along: number, halfWidth: number, clear: number): number {
  const limit = Math.max(0, halfWidth - clear);
  return Math.min(limit, Math.max(-limit, along));
}
