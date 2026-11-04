/**
 * Gabarits des personnages (qualité visuelle, étape A, chantier 4): un personnage refait est modelé
 * autour des os de son gabarit (rond, trapu, moyen), puis ramené au squelette commun de
 * `personnages.glb`. Son nœud porte deux extras de l'artiste:
 * - `bone_rest`: `{ os: [x, y, z] }`, translations de repos glTF à poser sur la copie de son
 *   squelette (sinon le corps est tiré vers les os du gabarit commun);
 * - `idle_clip`: sa pose de repos propre, jouée à la place de `idle`.
 *
 * Les clips n'animent la translation que de `root` et `hips`: les autres os gardent la translation
 * posée ici pendant toute animation.
 */
import { Bone, type Object3D } from 'three';

/** Clip d'attente commun, demandé par le rendu; un personnage refait le remplace par le sien. */
export const IDLE_CLIP = 'idle';

/** Translations de repos par os, lues dans les extras d'un nœud. */
export type BoneRest = ReadonlyMap<string, readonly [number, number, number]>;

const NO_REST: BoneRest = new Map();

function isTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** `bone_rest` des extras du nœud, validé (donnée du fichier de l'artiste): les entrées mal formées sont ignorées. */
export function boneRestOf(extras: Readonly<Record<string, unknown>>): BoneRest {
  const raw = extras.bone_rest;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return NO_REST;
  const rest = new Map<string, readonly [number, number, number]>();
  for (const [bone, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isTriple(value)) rest.set(bone, value);
  }
  return rest;
}

/**
 * Pose les translations de repos du gabarit sur les os de `model` (une copie de `cloneRig`: ses
 * os lui sont propres). Rend le nombre d'os posés.
 */
export function applyBoneRest(model: Object3D, rest: BoneRest): number {
  if (rest.size === 0) return 0;
  let applied = 0;
  model.traverse((object) => {
    const value = object instanceof Bone ? rest.get(object.name) : undefined;
    if (value !== undefined) {
      object.position.fromArray(value);
      applied += 1;
    }
  });
  return applied;
}

/** Pose de repos du personnage: l'extra `idle_clip` s'il nomme un clip présent, sinon `idle`. */
export function idleClipOf(
  extras: Readonly<Record<string, unknown>>,
  clips: { has(name: string): boolean },
): string {
  const name = extras.idle_clip;
  return typeof name === 'string' && clips.has(name) ? name : IDLE_CLIP;
}
