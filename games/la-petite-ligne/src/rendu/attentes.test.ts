import { Bone, Group, Quaternion } from 'three';
import { describe, expect, it } from 'vitest';
import { BoneOffsets, poseEnvelope, stableUnit, termAngle } from './attentes';
import { IDLE_POSES, RENDER_SETTINGS } from './reglages';

describe('attentes variées', () => {
  it('monte et descend en douceur, nulle hors de la pose', () => {
    expect(poseEnvelope(-0.1, 2, 0.3)).toBe(0);
    expect(poseEnvelope(2.1, 2, 0.3)).toBe(0);
    expect(poseEnvelope(1, 2, 0.3)).toBe(1);
    expect(poseEnvelope(0.15, 2, 0.3)).toBeCloseTo(0.5, 6);
  });

  it('tire le même nombre pour le même personnage (identique sur les deux écrans)', () => {
    const a = stableUnit('firmin', 3, 'idle');
    expect(stableUnit('firmin', 3, 'idle')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });

  it('balaie aller et retour: nul au milieu et à la fin', () => {
    const term = { bone: 'head', axis: 'up', degrees: 40, sweeps: 1 } as const;
    expect(termAngle(term, 1, 2, 1)).toBeCloseTo(0, 6);
    expect(termAngle(term, 0.5, 2, 1)).toBeCloseTo((40 * Math.PI) / 180, 6);
  });

  it('n’a que des attentes connues (pose ou clip livré)', () => {
    const clips = new Set(['pet', 'wave', 'give', 'high_five', 'sit_eat']);
    for (const list of Object.values(RENDER_SETTINGS.characters.idleVariants)) {
      for (const name of list) {
        expect(name in IDLE_POSES || clips.has(name), name).toBe(true);
      }
    }
  });

  it('rend aux os leur rotation du clip avant le mélangeur (pas de pose collée)', () => {
    const root = new Group();
    const chest = new Bone();
    chest.name = 'chest';
    const head = new Bone();
    head.name = 'head';
    root.add(chest);
    chest.add(head);
    const offsets = new BoneOffsets(root);
    const start = head.quaternion.clone();
    for (let frame = 0; frame < 3; frame += 1) {
      offsets.restore();
      offsets.begin();
      offsets.add('head', 'up', 0.5);
      offsets.apply(root);
    }
    // Trois images de suite: une seule rotation de 0,5 rad, pas trois cumulées.
    expect(head.quaternion.angleTo(start)).toBeCloseTo(0.5, 5);
    offsets.restore();
    expect(head.quaternion.equals(start)).toBe(true);
    expect(new Quaternion().angleTo(chest.quaternion)).toBe(0);
  });
});
