/**
 * Foulée d'un clip de marche (retour du 2026-11-03: « les pieds glissent »). Les clips de l'artiste
 * marchent sur place: pour qu'un pied posé reste immobile au sol, le clip doit jouer à
 * `vitesse du corps / vitesse du pied posé`. On mesure cette vitesse sur le clip lui-même (la
 * cheville au plus bas, à `contactTolerance` près), plutôt que de la recopier de la fiche: l'artiste
 * peut retoucher ses clips sans que le jeu se remette à patiner.
 */
import { AnimationMixer, Vector3, type AnimationClip, type Object3D } from 'three';

/** Une cheville est au sol quand elle est à moins de tant (m) de son point le plus bas du clip. */
const CONTACT_TOLERANCE = 0.02;
const SAMPLES = 64;

const point = new Vector3();

/**
 * Vitesse (m/s, au rythme d'origine du clip) à laquelle les chevilles `feet` reculent quand elles
 * sont posées, mesurée sur `rig` (squelette nu, qui n'est plus utilisable ensuite pour un autre
 * clip sans être remis en pose). `null` si le clip ne pose aucun pied (ou si les os manquent).
 */
export function plantedFootSpeed(
  rig: Object3D,
  clip: AnimationClip,
  feet: readonly string[],
  samples = SAMPLES,
): number | null {
  const bones = feet.map((name) => rig.getObjectByName(name)).filter((bone) => bone !== undefined);
  if (bones.length === 0 || clip.duration <= 0) return null;
  const mixer = new AnimationMixer(rig);
  mixer.clipAction(clip).play();
  const heights: number[][] = bones.map(() => []);
  const depths: number[][] = bones.map(() => []);
  for (let i = 0; i <= samples; i += 1) {
    mixer.setTime((clip.duration * i) / samples);
    rig.updateMatrixWorld(true);
    bones.forEach((bone, b) => {
      bone.getWorldPosition(point);
      heights[b]?.push(point.y);
      depths[b]?.push(point.z);
    });
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(rig);
  const step = clip.duration / samples;
  let travelled = 0;
  let time = 0;
  bones.forEach((_bone, b) => {
    const y = heights[b] ?? [];
    const z = depths[b] ?? [];
    const floor = Math.min(...y) + CONTACT_TOLERANCE;
    for (let i = 0; i < samples; i += 1) {
      const a = y[i];
      const c = y[i + 1];
      if (a === undefined || c === undefined || a > floor || c > floor) continue;
      travelled += Math.abs((z[i + 1] ?? 0) - (z[i] ?? 0));
      time += step;
    }
  });
  return time > 0 && travelled > 0 ? travelled / time : null;
}
