/**
 * Main posée sur un point (correction cinématique à deux os, côté rendu seulement): le clip
 * `reach_up` de Basile lève le bras droit à hauteur d'épaule, sous le nichoir qu'il redresse
 * (contrôle du DA après le tour 6). Après le mélangeur, le bras et l'avant-bras tournent pour
 * amener la prise de la main sur la cible, en gardant le plan du coude du clip. Si la cible est
 * hors de portée, le buste se tourne d'abord un peu vers elle (au plus `maxChestRadians`), comme
 * quelqu'un qui s'étire sur son échelle.
 *
 * Comme `BoneOffsets`: les rotations du clip sont rendues avant la mise à jour suivante du
 * mélangeur, qui n'écrit un os que si sa valeur change.
 */
import { Quaternion, Vector3, type Object3D } from 'three';

/** Le coude ne se tend jamais tout à fait (une solution nette, sans retournement du plan). */
const STRAIGHT_MARGIN = 1e-3;
/** Le buste tourne au plus de tant vers une cible hors de portée (rad). */
const DEFAULT_MAX_CHEST = (14 * Math.PI) / 180;
const DEGENERATE = 1e-6;

const chestPoint = new Vector3();
const shoulder = new Vector3();
const elbow = new Vector3();
const tip = new Vector3();
const aim = new Vector3();
const side = new Vector3();
const wanted = new Vector3();
const from = new Vector3();
const to = new Vector3();
const turn = new Quaternion();
const world = new Quaternion();
const parentWorld = new Quaternion();
const fullUpper = new Quaternion();
const fullFore = new Quaternion();
const fullChest = new Quaternion();
const axis = new Vector3();

/** Tourne `bone` de `rotation` (repère du monde), réécrit dans son repère local. */
function rotateInWorld(bone: Object3D, rotation: Quaternion, out: Quaternion): void {
  bone.getWorldQuaternion(world);
  const parent = bone.parent;
  if (parent === null) {
    out.copy(rotation).multiply(world);
    return;
  }
  parent.getWorldQuaternion(parentWorld).invert();
  out.copy(parentWorld).multiply(rotation).multiply(world);
}

export class ArmReach {
  private readonly chest: Object3D | null;
  private readonly upper: Object3D | null;
  private readonly fore: Object3D | null;
  private readonly tip: Object3D | null;
  private readonly baseChest = new Quaternion();
  private readonly baseUpper = new Quaternion();
  private readonly baseFore = new Quaternion();
  private applied = false;

  constructor(
    model: Object3D,
    chest: string,
    upper: string,
    fore: string,
    tipName: string,
    private readonly maxChestRadians = DEFAULT_MAX_CHEST,
  ) {
    this.chest = model.getObjectByName(chest) ?? null;
    this.upper = model.getObjectByName(upper) ?? null;
    this.fore = model.getObjectByName(fore) ?? null;
    this.tip = model.getObjectByName(tipName) ?? null;
  }

  /** À appeler avant le mélangeur (et avant `BoneOffsets.restore`, posé avant nous). */
  restore(): void {
    if (!this.applied || this.upper === null || this.fore === null) {
      return;
    }
    this.chest?.quaternion.copy(this.baseChest);
    this.upper.quaternion.copy(this.baseUpper);
    this.fore.quaternion.copy(this.baseFore);
    this.applied = false;
  }

  /**
   * Amène la prise de la main vers `target` (repère du monde) avec le poids `weight` (0: le clip
   * seul, 1: la main sur la cible, ou bras tendu vers elle si elle est trop loin). `root` est le
   * personnage, dont les matrices sont recalculées ici (placé et animé à cette image).
   */
  apply(root: Object3D, target: Vector3, weight: number): void {
    const upper = this.upper;
    const fore = this.fore;
    const hand = this.tip;
    if (upper === null || fore === null || hand === null || weight <= 0) {
      return;
    }
    const w = Math.min(1, weight);
    const chest = this.chest;
    if (chest !== null) this.baseChest.copy(chest.quaternion);
    this.baseUpper.copy(upper.quaternion);
    this.baseFore.copy(fore.quaternion);
    this.applied = true;
    root.updateMatrixWorld(true);
    upper.getWorldPosition(shoulder);
    fore.getWorldPosition(elbow);
    hand.getWorldPosition(tip);
    const a = shoulder.distanceTo(elbow);
    const b = elbow.distanceTo(tip);
    let chestTurned = false;
    if (chest !== null && shoulder.distanceTo(target) > a + b) {
      // Hors de portée: le buste tourne l'épaule vers la cible, juste de quoi rattraper l'écart.
      chest.getWorldPosition(chestPoint);
      from.subVectors(shoulder, chestPoint);
      to.subVectors(target, chestPoint);
      const lever = from.length();
      axis.crossVectors(from, to);
      if (lever > DEGENERATE && axis.lengthSq() > DEGENERATE) {
        const angle = Math.min(this.maxChestRadians, from.angleTo(to), (shoulder.distanceTo(target) - (a + b)) / lever);
        turn.setFromAxisAngle(axis.normalize(), angle);
        rotateInWorld(chest, turn, fullChest);
        chest.quaternion.copy(fullChest);
        chest.updateMatrixWorld(true);
        chestTurned = true;
        upper.getWorldPosition(shoulder);
        fore.getWorldPosition(elbow);
        hand.getWorldPosition(tip);
      }
    }
    aim.subVectors(target, shoulder);
    const reach = aim.length();
    if (a < DEGENERATE || b < DEGENERATE || reach < DEGENERATE) {
      return;
    }
    aim.divideScalar(reach);
    const d = Math.min(a + b - STRAIGHT_MARGIN, Math.max(Math.abs(a - b) + STRAIGHT_MARGIN, reach));
    // Plan du coude: celui du clip (le coude reste du même côté).
    side.subVectors(elbow, shoulder);
    side.addScaledVector(aim, -side.dot(aim));
    if (side.lengthSq() < DEGENERATE) {
      side.set(0, -1, 0).addScaledVector(aim, aim.y);
    }
    side.normalize();
    const cos = Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d)));
    const sin = Math.sqrt(1 - cos * cos);
    wanted.copy(shoulder).addScaledVector(aim, a * cos).addScaledVector(side, a * sin);
    // Bras: l'épaule-coude du clip vers le coude voulu.
    from.subVectors(elbow, shoulder).normalize();
    to.subVectors(wanted, shoulder).normalize();
    turn.setFromUnitVectors(from, to);
    rotateInWorld(upper, turn, fullUpper);
    upper.quaternion.copy(fullUpper);
    upper.updateMatrixWorld(true);
    // Avant-bras: du coude vers la cible ramenée à portée.
    fore.getWorldPosition(elbow);
    hand.getWorldPosition(tip);
    wanted.copy(shoulder).addScaledVector(aim, d);
    from.subVectors(tip, elbow).normalize();
    to.subVectors(wanted, elbow).normalize();
    turn.setFromUnitVectors(from, to);
    rotateInWorld(fore, turn, fullFore);
    if (chest !== null && chestTurned) chest.quaternion.copy(this.baseChest).slerp(fullChest, w);
    upper.quaternion.copy(this.baseUpper).slerp(fullUpper, w);
    fore.quaternion.copy(this.baseFore).slerp(fullFore, w);
    (chest ?? upper).updateMatrixWorld(true);
  }
}
