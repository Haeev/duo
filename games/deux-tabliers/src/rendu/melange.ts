/**
 * Mélange des clips d'un personnage: un clip joue toujours (jamais la pose de liaison, bras
 * écartés). Les poids sont tenus ici et leur somme reste à 1 pendant les fondus, même quand on
 * change de clip à chaque image (marche et attente qui alternent): les fondus de Three.js
 * (`fadeIn` après `reset`) repartent de 0 et laissaient alors tous les poids près de zéro.
 *
 * Mains: les personnages à doigts ont trois poses de 0,1 s sur les 12 os des doigts seulement
 * (`relaxed`, `grip_handle`, `grip_glass`). Elles jouent à part des clips du corps, toujours
 * ensemble à poids complémentaires (somme à 1): main détendue au repos, fondu enchaîné vers une
 * prise quand la main tient une tasse ou un verre.
 */
import type { AnimationAction, AnimationClip, AnimationMixer } from 'three';

/** Poses des doigts livrées par l'artiste (clips sur les seuls os des doigts). */
export const HAND_RELAXED = 'relaxed';
export type HandGrip = 'grip_handle' | 'grip_glass';
const HAND_POSES: ReadonlySet<string> = new Set([HAND_RELAXED, 'grip_handle', 'grip_glass']);

export interface ClipBlend {
  /** Clip voulu (`walk`, `idle`...); un nom absent retombe sur `idle`, puis sur le premier clip. */
  set(name: string): void;
  /** Avance les fondus et le mélangeur de `dt` secondes. */
  update(dt: number): void;
  /** Clip vers lequel on va. */
  target(): string;
  /** Poids du clip dans le mélange (0 s'il ne joue pas). */
  weight(name: string): number;
  /** Cale le temps du clip (s), avant `update`: un geste suivi par une horloge à soi. */
  seek(name: string, time: number): void;
  /**
   * Doigts de la main droite: part `weight` (0 à 1) de la prise `grip`, le reste en main
   * détendue. Sans effet sur un personnage sans doigts. Appliqué au prochain `update`.
   */
  grip(grip: HandGrip | null, weight: number): void;
  /** Vrai si le personnage a les poses des doigts (`relaxed` et au moins une prise). */
  hasFingers(): boolean;
  stop(): void;
}

export function createClipBlend(
  mixer: AnimationMixer,
  clips: readonly AnimationClip[],
  fadeSeconds: number,
  start = 'idle',
): ClipBlend {
  const actions = new Map<string, AnimationAction>();
  const hands = new Map<string, AnimationAction>();
  for (const clip of clips) {
    if (HAND_POSES.has(clip.name)) hands.set(clip.name, mixer.clipAction(clip));
    else actions.set(clip.name, mixer.clipAction(clip));
  }
  const body = clips.filter((c) => !HAND_POSES.has(c.name));
  const weights = new Map<string, number>();
  const resolve = (name: string): string => {
    if (actions.has(name)) return name;
    if (actions.has('idle')) return 'idle';
    return body[0]?.name ?? '';
  };
  // Pose tenue (premier instant), les trois toujours jouées: la somme des poids reste à 1.
  const relaxed = hands.get(HAND_RELAXED);
  const fingers = relaxed !== undefined && hands.size > 1;
  if (fingers) {
    for (const [name, a] of hands) {
      a.play();
      a.paused = true;
      a.setEffectiveWeight(name === HAND_RELAXED ? 1 : 0);
    }
  }
  let target = resolve(start);
  const first = actions.get(target);
  if (first !== undefined) {
    first.play();
    first.setEffectiveWeight(1);
    weights.set(target, 1);
  }

  return {
    set(name) {
      const next = resolve(name);
      if (next === target) return;
      target = next;
      const action = actions.get(next);
      if (action !== undefined && !weights.has(next)) {
        action.reset().play();
        action.setEffectiveWeight(0);
        weights.set(next, 0);
      }
    },
    update(dt) {
      const t = weights.get(target);
      if (t !== undefined) {
        const now = fadeSeconds <= 0 ? 1 : Math.min(1, t + dt / fadeSeconds);
        // Les autres clips se partagent ce qui reste, dans leurs proportions: somme toujours à 1.
        const scale = t >= 1 ? 0 : (1 - now) / (1 - t);
        let others = 0;
        for (const [name, w] of weights) {
          if (name === target) continue;
          const action = actions.get(name);
          const nw = w * scale;
          if (action === undefined || nw < 1e-3) {
            action?.stop();
            weights.delete(name);
            continue;
          }
          weights.set(name, nw);
          action.setEffectiveWeight(nw);
          others += nw;
        }
        weights.set(target, 1 - others);
        actions.get(target)?.setEffectiveWeight(1 - others);
      }
      mixer.update(dt);
    },
    target: () => target,
    weight: (name) => weights.get(name) ?? 0,
    seek(name, time) {
      const action = actions.get(name);
      if (action !== undefined) action.time = time;
    },
    grip(grip, weight) {
      if (!fingers) return;
      const held = grip === null || !hands.has(grip) ? 0 : Math.max(0, Math.min(1, weight));
      for (const [name, a] of hands)
        a.setEffectiveWeight(name === HAND_RELAXED ? 1 - held : name === grip ? held : 0);
    },
    hasFingers: () => fingers,
    stop() {
      mixer.stopAllAction();
      weights.clear();
    },
  };
}
