/**
 * Pose assise juste sur une assise (clients et avatars): les clips `sit` et `sit_drink` livrés
 * sont faits pour une assise basse (fesses vers 0,30 m pour `sit_drink`, à 0,16 m pour Simone),
 * et `sit` décale le bassin de 0,4 m en arrière. Mesuré une fois par modèle et par clip, au
 * premier exemplaire (os `Hips`, sommets sous le bassin): le personnage est posé pour que ses
 * fesses touchent la surface de l'assise et que son bassin soit au-dessus du point d'assise;
 * les cuisses se baissent pour que les pieds retrouvent le sol (une chaise de 0,45 m), dans une
 * limite (tabouret de comptoir: les pieds pendent, comme sur un vrai tabouret).
 */
import {
  AnimationClip,
  AnimationMixer,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';

export interface SitCalibration {
  /** Hauteur des fesses au-dessus de l'origine du personnage, dans la pose. */
  readonly bottom: number;
  /** Bassin dans le repère du personnage (x à sa gauche, z devant lui). */
  readonly hipX: number;
  readonly hipY: number;
  readonly hipZ: number;
  /** Point le plus bas (pieds), à l'origine du personnage. */
  readonly lowest: number;
  /** Pointe du pied depuis l'articulation de la hanche (repère du personnage), moyenne des deux. */
  readonly toeY: number;
  readonly toeZ: number;
}

/** Les fesses s'enfoncent un peu dans le coussin (paille, moleskine): pas d'air dessous. */
const SINK = 0.015;
/** Cuisses: de quoi poser les pieds d'une chaise haute de 0,1 m de plus que la pose, pas plus. */
const MAX_THIGH_DOWN = 0.6;
const MAX_THIGH_UP = 0.25;

const cache = new Map<string, SitCalibration | null>();
const v = new Vector3();
const hip = new Vector3();

/**
 * Mesure (mise en cache par `key`) de la pose du clip sur un personnage pas encore placé
 * (origine, sans rotation). Laisse le personnage dans la pose: le mélangeur la réécrit ensuite.
 */
export function sitCalibration(
  key: string,
  node: Object3D,
  clip: AnimationClip | undefined,
): SitCalibration | null {
  const known = cache.get(key);
  if (known !== undefined) return known;
  if (clip === undefined) {
    cache.set(key, null);
    return null;
  }
  const mixer = new AnimationMixer(node);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.setTime(clip.duration * 0.5);
  node.updateMatrixWorld(true);
  const hips = node.getObjectByName('Hips');
  const legs = ['LeftUpLeg', 'RightUpLeg'].map((n) => node.getObjectByName(n));
  const toes = ['LeftToeBase', 'RightToeBase'].map((n) => node.getObjectByName(n));
  let result: SitCalibration | null = null;
  if (hips !== undefined) {
    hip.setFromMatrixPosition(hips.matrixWorld);
    let bottom = Infinity;
    let lowest = Infinity;
    node.traverse((o) => {
      if (!(o instanceof SkinnedMesh)) return;
      const geometry = o.geometry as BufferGeometry;
      const count = geometry.getAttribute('position').count;
      for (let i = 0; i < count; i++) {
        o.getVertexPosition(i, v);
        v.applyMatrix4(o.matrixWorld);
        lowest = Math.min(lowest, v.y);
        if (Math.abs(v.z - hip.z) < 0.06 && Math.abs(v.x - hip.x) < 0.12)
          bottom = Math.min(bottom, v.y);
      }
    });
    let ty = 0;
    let tz = 0;
    let n = 0;
    for (let k = 0; k < 2; k++) {
      const leg = legs[k];
      const toe = toes[k];
      if (leg === undefined || toe === undefined) continue;
      const a = new Vector3().setFromMatrixPosition(leg.matrixWorld);
      const b = new Vector3().setFromMatrixPosition(toe.matrixWorld);
      ty += b.y - a.y;
      tz += b.z - a.z;
      n++;
    }
    if (Number.isFinite(bottom))
      result = {
        bottom,
        hipX: hip.x,
        hipY: hip.y,
        hipZ: hip.z,
        lowest: Number.isFinite(lowest) ? lowest : 0,
        toeY: n > 0 ? ty / n : 0,
        toeZ: n > 0 ? tz / n : 0,
      };
  }
  action.stop();
  mixer.uncacheRoot(node);
  cache.set(key, result);
  return result;
}

export interface SeatPlacement {
  x: number;
  y: number;
  z: number;
  /** Rotation des cuisses vers le bas (radians, autour de l'axe gauche-droite du personnage). */
  thigh: number;
}

/**
 * Origine du personnage pour que ses fesses soient au point d'assise (`sx`, `sy`, `sz`), tourné
 * de `rotY` (`rotation.y` de Three.js, avant +Z du modèle), et rotation des cuisses.
 */
export function seatPlacement(
  c: SitCalibration,
  sx: number,
  sy: number,
  sz: number,
  rotY: number,
  out: SeatPlacement,
): SeatPlacement {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  out.x = sx - (c.hipX * cos + c.hipZ * sin);
  out.z = sz - (-c.hipX * sin + c.hipZ * cos);
  out.y = sy - SINK - c.bottom;
  // Pieds au-dessus du sol après la montée: on baisse les cuisses (rotation autour de +X, qui
  // descend ce qui est devant) jusqu'à ce que la pointe du pied touche le sol.
  const drop = out.y + c.lowest;
  const r = Math.hypot(c.toeY, c.toeZ);
  if (r < 1e-3) {
    out.thigh = 0;
    return out;
  }
  const beta = Math.atan2(c.toeZ, c.toeY);
  const want = Math.max(-1, Math.min(1, (c.toeY - drop) / r));
  const theta = Math.acos(want) - beta;
  out.thigh = Math.max(-MAX_THIGH_UP, Math.min(MAX_THIGH_DOWN, Number.isFinite(theta) ? theta : 0));
  return out;
}

const qAxis = new Quaternion();
const qParent = new Quaternion();
const qNode = new Quaternion();
const axis = new Vector3();

/**
 * Retouches d'os après le mélangeur. Le mélangeur de Three.js ne réécrit une propriété que si
 * sa valeur change (`PropertyMixer.apply`): sur une pose tenue (`sit_rest`), la retouche de
 * l'image précédente resterait et s'ajouterait (jambes qui montent, tête qui tourne sans fin).
 * On garde la valeur d'avant retouche et on la remet si le mélangeur n'y a pas touché.
 */
const touched = new WeakMap<Object3D, { base: Quaternion; out: Quaternion }>();

function rotateInWorld(bone: Object3D, rotation: Quaternion): void {
  let rec = touched.get(bone);
  if (rec !== undefined && bone.quaternion.equals(rec.out)) bone.quaternion.copy(rec.base);
  if (rec === undefined) {
    rec = { base: new Quaternion(), out: new Quaternion() };
    touched.set(bone, rec);
  }
  rec.base.copy(bone.quaternion);
  const parent = bone.parent;
  if (parent !== null) {
    parent.getWorldQuaternion(qParent);
    // Rotation du monde exprimée dans le repère du parent: q' = P⁻¹ · R · P · q.
    bone.quaternion.premultiply(qParent).premultiply(rotation).premultiply(qParent.invert());
  }
  rec.out.copy(bone.quaternion);
}

/** Tourne les cuisses de `angle` (après la mise à jour du mélangeur, chaque image). */
export function bendThighs(node: Object3D, thighs: readonly Object3D[], angle: number): void {
  node.getWorldQuaternion(qNode);
  axis.set(1, 0, 0).applyQuaternion(qNode);
  qAxis.setFromAxisAngle(axis, angle);
  for (const t of thighs) rotateInWorld(t, qAxis);
}

/** Les deux cuisses d'un personnage riggé sur le squelette commun. */
export function thighsOf(node: Object3D): Object3D[] {
  const out: Object3D[] = [];
  for (const n of ['LeftUpLeg', 'RightUpLeg']) {
    const b = node.getObjectByName(n);
    if (b !== undefined) out.push(b);
  }
  return out;
}

/** Pose assise de repos, tirée de `sit` (voir `restClip`). */
export const SIT_REST = 'sit_rest';

/**
 * Pose assise calme: la première image du clip `sit` (buste droit, mains sur les cuisses), tenue.
 * Le clip `sit` livré s'assoit, se penche de 50° vers l'avant (tête vers la table, avant-bras
 * dans le plateau) puis se relève: on n'en garde que l'assise droite du début.
 */
export function restClip(clips: readonly AnimationClip[]): AnimationClip | null {
  const sit = clips.find((c) => c.name === 'sit');
  if (sit === undefined) return null;
  const tracks = sit.tracks.map((track) => {
    const size = track.getValueSize();
    const first = Array.from(track.values.slice(0, size));
    const t = track.clone();
    t.times = new Float32Array([0, 1]);
    t.values = new Float32Array([...first, ...first]);
    return t;
  });
  return new AnimationClip(SIT_REST, 1, tracks);
}

const up = new Vector3(0, 1, 0);

/** Tourne la tête (os du cou) de `angle` autour de la verticale, après le mélangeur. */
export function turnHead(neck: Object3D | undefined, angle: number): void {
  if (neck === undefined) return;
  qAxis.setFromAxisAngle(up, angle);
  rotateInWorld(neck, qAxis);
}

const pinWant = new Vector3();
const pinHave = new Vector3();

/**
 * Garde le bassin (os `Hips`) là où la mesure l'a posé, pendant tout le clip (RV-05): `sit_drink`
 * soulève le bassin quand le buste se penche vers la tasse; on redescend le personnage d'autant,
 * et les fesses restent sur l'assise. `hipX`, `hipY`, `hipZ`: bassin attendu dans le repère du
 * personnage (mêlé selon le fondu des clips). Après le mélangeur, chaque image.
 */
export function pinHips(
  node: Object3D,
  hips: Object3D | undefined,
  hipX: number,
  hipY: number,
  hipZ: number,
): void {
  if (hips === undefined) return;
  node.updateWorldMatrix(true, false);
  pinWant.set(hipX, hipY, hipZ).applyMatrix4(node.matrixWorld);
  hips.getWorldPosition(pinHave);
  pinWant.sub(pinHave);
  const parent = node.parent;
  if (parent !== null) {
    // Écart du monde exprimé dans le repère du parent (translation seule).
    pinHave.copy(node.position);
    parent.localToWorld(pinHave);
    pinHave.add(pinWant);
    parent.worldToLocal(pinHave);
    node.position.copy(pinHave);
  } else node.position.add(pinWant);
  node.updateMatrixWorld(true);
}

const reachFrom = new Vector3();
const reachElbow = new Vector3();
const reachHand = new Vector3();
const reachGoal = new Vector3();
const reachU = new Vector3();
const reachV = new Vector3();
const reachQ = new Quaternion();
const identity = new Quaternion();

/**
 * Porte la main (os `RightHand`) vers `target` (monde), d'une part `weight` (0 rien, 1 tout):
 * le coude se plie pour que l'épaule soit à la bonne distance de la cible (loi des cosinus), puis
 * le bras vise la cible (RV-05: la tasse à la bouche, pas au front). Après le mélangeur; avec un
 * poids nul, efface la retouche de l'image d'avant (pose tenue que le mélangeur ne réécrit pas).
 */
export function reachTo(
  arm: Object3D | undefined,
  forearm: Object3D | undefined,
  hand: Object3D | undefined,
  target: Vector3,
  weight: number,
): void {
  if (arm === undefined || forearm === undefined) return;
  if (hand === undefined || weight <= 0) {
    rotateInWorld(forearm, identity);
    rotateInWorld(arm, identity);
    return;
  }
  const w = Math.min(1, weight);
  // 1. Le coude: distance épaule-main égale à la distance épaule-cible (dans les limites du bras).
  rotateInWorld(forearm, identity);
  arm.getWorldPosition(reachFrom);
  forearm.getWorldPosition(reachElbow);
  hand.getWorldPosition(reachHand);
  const a = reachFrom.distanceTo(reachElbow);
  const b = reachElbow.distanceTo(reachHand);
  if (a < 1e-4 || b < 1e-4) return;
  const d = Math.max(Math.abs(a - b) + 0.01, Math.min(a + b - 0.01, reachFrom.distanceTo(target)));
  reachU.copy(reachElbow).sub(reachFrom).normalize();
  reachV.copy(reachHand).sub(reachElbow).normalize();
  const current = Math.PI - Math.acos(Math.max(-1, Math.min(1, reachU.dot(reachV))));
  const wanted = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - d * d) / (2 * a * b))));
  reachU.cross(reachV);
  if (reachU.lengthSq() > 1e-10) {
    reachU.normalize();
    reachQ.setFromAxisAngle(reachU, (current - wanted) * w);
    rotateInWorld(forearm, reachQ);
  } else rotateInWorld(forearm, identity);
  // 2. Le bras vise la cible.
  rotateInWorld(arm, identity);
  hand.getWorldPosition(reachHand);
  reachHand.sub(reachFrom);
  reachGoal.copy(target).sub(reachFrom);
  if (reachHand.lengthSq() < 1e-8 || reachGoal.lengthSq() < 1e-8) return;
  reachQ.setFromUnitVectors(reachHand.normalize(), reachGoal.normalize());
  reachQ.slerpQuaternions(identity, reachQ, w);
  rotateInWorld(arm, reachQ);
}
