/**
 * Mélange des clips d'un personnage: un clip joue toujours (jamais la pose de liaison, bras
 * écartés). Les poids sont tenus ici et leur somme reste à 1 pendant les fondus, même quand on
 * change de clip à chaque image (marche et attente qui alternent): les fondus de Three.js
 * (`fadeIn` après `reset`) repartent de 0 et laissaient alors tous les poids près de zéro.
 */
import type { AnimationAction, AnimationClip, AnimationMixer } from 'three';

export interface ClipBlend {
  /** Clip voulu (`walk`, `idle`...); un nom absent retombe sur `idle`, puis sur le premier clip. */
  set(name: string): void;
  /** Avance les fondus et le mélangeur de `dt` secondes. */
  update(dt: number): void;
  /** Clip vers lequel on va. */
  target(): string;
  stop(): void;
}

export function createClipBlend(
  mixer: AnimationMixer,
  clips: readonly AnimationClip[],
  fadeSeconds: number,
  start = 'idle',
): ClipBlend {
  const actions = new Map<string, AnimationAction>();
  for (const clip of clips) actions.set(clip.name, mixer.clipAction(clip));
  const weights = new Map<string, number>();
  const resolve = (name: string): string => {
    if (actions.has(name)) return name;
    if (actions.has('idle')) return 'idle';
    return clips[0]?.name ?? '';
  };
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
    stop() {
      mixer.stopAllAction();
      weights.clear();
    },
  };
}
