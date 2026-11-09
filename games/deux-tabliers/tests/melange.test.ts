// Mélange des clips (correctif du 2026-11-08): un clip joue toujours, même quand la marche et
// l'attente alternent à chaque image; jamais la pose de liaison.
import { AnimationClip, AnimationMixer, NumberKeyframeTrack, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { createClipBlend } from '../src/rendu/melange';

function clip(name: string): AnimationClip {
  return new AnimationClip(name, 1, [new NumberKeyframeTrack('.position[x]', [0, 1], [0, 1])]);
}

describe('Deux Tabliers, mélange des clips', () => {
  it('la somme des poids reste à 1, quel que soit le rythme des changements', () => {
    const node = new Object3D();
    const mixer = new AnimationMixer(node);
    const clips = ['walk', 'idle', 'sit'].map(clip);
    const blend = createClipBlend(mixer, clips, 0.2);
    const total = (): number =>
      clips.reduce((sum, c) => {
        const a = mixer.existingAction(c);
        return sum + (a?.isRunning() === true ? a.getEffectiveWeight() : 0);
      }, 0);
    blend.update(0);
    expect(total()).toBeCloseTo(1, 5);
    for (let i = 0; i < 120; i++) {
      blend.set(i % 2 === 0 ? 'walk' : 'idle');
      blend.update(1 / 60);
      expect(total()).toBeCloseTo(1, 5);
    }
    blend.set('nage');
    expect(blend.target()).toBe('idle');
    for (let i = 0; i < 30; i++) blend.update(1 / 60);
    expect(mixer.existingAction(clips[1] ?? clip('x'))?.getEffectiveWeight()).toBeCloseTo(1, 5);
  });
});
