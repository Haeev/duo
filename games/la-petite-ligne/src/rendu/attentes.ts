/**
 * Vie au repos des personnages, côté rendu seulement: attentes variées
 * (poses procédurales posées par-dessus le clip `idle`), tête tournée vers un
 * joueur proche. Rien n'entre dans l'état partagé; le tirage dépend de
 * l'identifiant du personnage, donc il est le même sur les deux écrans.
 *
 * Une pose est une somme de rotations d'os autour des axes du personnage
 * (haut, droite, avant), ajoutées après le mélangeur d'animations: le clip
 * `idle` continue de respirer dessous.
 */
import { Quaternion, Vector3, type Object3D } from 'three';
import { textHash } from './modeles';

export type RigBone =
  | 'chest'
  | 'neck'
  | 'head'
  | 'upper_arm_l'
  | 'upper_arm_r'
  | 'forearm_l'
  | 'forearm_r';

const RIG_BONES: readonly RigBone[] = [
  'chest',
  'neck',
  'head',
  'upper_arm_l',
  'upper_arm_r',
  'forearm_l',
  'forearm_r',
];

/** Axes du repère du personnage: haut (Y), sa droite (X), devant lui (Z). */
export type PoseAxis = 'up' | 'side' | 'forward';

export interface PoseTerm {
  readonly bone: RigBone;
  readonly axis: PoseAxis;
  readonly degrees: number;
  /** Aller-retour sinusoïdal, en nombre de cycles sur la durée (0 ou absent: tenu). */
  readonly sweeps?: number;
}

export interface IdlePose {
  readonly seconds: number;
  readonly terms: readonly PoseTerm[];
}

const AXES: Readonly<Record<PoseAxis, Vector3>> = {
  up: new Vector3(0, 1, 0),
  side: new Vector3(1, 0, 0),
  forward: new Vector3(0, 0, 1),
};
const DEGREES = Math.PI / 180;
const HASH_SPAN = 1000;

/** Nombre pseudo-aléatoire stable dans [0, 1) pour un personnage et un rang. */
export function stableUnit(id: string, rank: number, salt: string): number {
  return (textHash(`${id}|${salt}|${rank}`) % HASH_SPAN) / HASH_SPAN;
}

/** Montée et descente douces d'une pose de `seconds` (fondu `fade` à chaque bout). */
export function poseEnvelope(time: number, seconds: number, fade: number): number {
  if (time <= 0 || time >= seconds) {
    return 0;
  }
  const edge = Math.min(time, seconds - time);
  const u = Math.min(1, edge / Math.max(fade, 1e-3));
  return u * u * (3 - 2 * u);
}

/** Angle (rad) d'un terme de pose à l'instant `time`, enveloppe comprise. */
export function termAngle(term: PoseTerm, time: number, seconds: number, envelope: number): number {
  const sweeps = term.sweeps ?? 0;
  const shape = sweeps > 0 ? Math.sin((time / seconds) * sweeps * 2 * Math.PI) : 1;
  return term.degrees * DEGREES * shape * envelope;
}

const tmpAxis = new Vector3();
const tmpRoot = new Quaternion();
const tmpParent = new Quaternion();
const tmpDelta = new Quaternion();

/**
 * Os du squelette qu'on retouche, et rotations à leur ajouter à cette image.
 * `begin()` remet à zéro, `add()` cumule, `apply()` pose le tout sur les os.
 */
export class BoneOffsets {
  private readonly bones: (Object3D | null)[];
  private readonly angles: number[];
  private any = false;

  constructor(model: Object3D) {
    this.bones = RIG_BONES.map((name) => model.getObjectByName(name) ?? null);
    this.angles = new Array<number>(RIG_BONES.length * 3).fill(0);
  }

  begin(): void {
    if (this.any) {
      this.angles.fill(0);
      this.any = false;
    }
  }

  add(bone: RigBone, axis: PoseAxis, radians: number): void {
    if (radians === 0) {
      return;
    }
    const index = RIG_BONES.indexOf(bone) * 3 + (axis === 'up' ? 0 : axis === 'side' ? 1 : 2);
    this.angles[index] = (this.angles[index] ?? 0) + radians;
    this.any = true;
  }

  /** Ajoute les rotations cumulées, exprimées dans le repère de `root` (le personnage). */
  apply(root: Object3D): void {
    if (!this.any) {
      return;
    }
    root.getWorldQuaternion(tmpRoot);
    for (let b = 0; b < this.bones.length; b += 1) {
      const bone = this.bones[b];
      const parent = bone?.parent ?? null;
      if (bone === null || bone === undefined || parent === null) {
        continue;
      }
      // Les matrices du parent datent de l'image précédente: écart invisible pour une pose lente.
      parent.getWorldQuaternion(tmpParent).invert();
      for (let a = 0; a < 3; a += 1) {
        const angle = this.angles[b * 3 + a] ?? 0;
        if (angle === 0) {
          continue;
        }
        const axis = a === 0 ? AXES.up : a === 1 ? AXES.side : AXES.forward;
        tmpAxis.copy(axis).applyQuaternion(tmpRoot).applyQuaternion(tmpParent);
        tmpDelta.setFromAxisAngle(tmpAxis, angle);
        bone.quaternion.premultiply(tmpDelta);
      }
    }
  }
}
