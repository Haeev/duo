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
  AnimationMixer,
  Quaternion,
  SkinnedMesh,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type Object3D,
} from 'three';

export interface SitCalibration {
  /** Hauteur des fesses au-dessus de l'origine du personnage, dans la pose. */
  readonly bottom: number;
  /** Bassin dans le repère du personnage (x à sa gauche, z devant lui). */
  readonly hipX: number;
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

/** Tourne les cuisses de `angle` (après la mise à jour du mélangeur, chaque image). */
export function bendThighs(node: Object3D, thighs: readonly Object3D[], angle: number): void {
  if (Math.abs(angle) < 1e-4) return;
  node.getWorldQuaternion(qNode);
  axis.set(1, 0, 0).applyQuaternion(qNode);
  qAxis.setFromAxisAngle(axis, angle);
  for (const t of thighs) {
    const parent = t.parent;
    if (parent === null) continue;
    parent.getWorldQuaternion(qParent);
    // Rotation du monde exprimée dans le repère du parent: q' = P⁻¹ · R · P · q.
    t.quaternion.premultiply(qParent).premultiply(qAxis).premultiply(qParent.invert());
  }
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
