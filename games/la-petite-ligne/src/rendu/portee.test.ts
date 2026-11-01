import { Bone, Group, Object3D, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ArmReach } from './portee';

/** Un bras de 0,27 + 0,27 m, épaule à 1,4 m, tendu vers le bas, buste à 1,2 m. */
function rig(): { root: Group; chest: Bone; upper: Bone; fore: Bone; tip: Object3D } {
  const root = new Group();
  const chest = new Bone();
  chest.name = 'chest';
  chest.position.set(0, 1.2, 0);
  const upper = new Bone();
  upper.name = 'upper_arm_r';
  upper.position.set(-0.18, 0.2, 0);
  const fore = new Bone();
  fore.name = 'forearm_r';
  fore.position.set(0, -0.27, 0);
  const tip = new Object3D();
  tip.name = 'socket_hand_r';
  tip.position.set(0, -0.27, 0.0);
  // Coude un peu plié vers l'avant: le plan du coude du clip.
  fore.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), 0.3);
  root.add(chest);
  chest.add(upper);
  upper.add(fore);
  fore.add(tip);
  root.updateMatrixWorld(true);
  return { root, chest, upper, fore, tip };
}

function tipWorld(r: ReturnType<typeof rig>): Vector3 {
  r.root.updateMatrixWorld(true);
  return r.tip.getWorldPosition(new Vector3());
}

describe('main posée sur un point (portee.ts)', () => {
  it('amène la main sur une cible à portée', () => {
    const r = rig();
    const reach = new ArmReach(r.root, 'chest', 'upper_arm_r', 'forearm_r', 'socket_hand_r');
    const target = new Vector3(-0.3, 1.7, 0.35);
    reach.apply(r.root, target, 1);
    expect(tipWorld(r).distanceTo(target)).toBeLessThan(1e-4);
  });

  it('hors de portée, tourne le buste puis tend le bras vers la cible', () => {
    const r = rig();
    const reach = new ArmReach(r.root, 'chest', 'upper_arm_r', 'forearm_r', 'socket_hand_r');
    const target = new Vector3(-0.3, 1.95, 0.5);
    const before = r.upper.getWorldPosition(new Vector3()).distanceTo(target);
    expect(before).toBeGreaterThan(0.54);
    reach.apply(r.root, target, 1);
    const shoulder = r.upper.getWorldPosition(new Vector3());
    expect(shoulder.distanceTo(target)).toBeLessThan(before);
    // Bras tendu dans l'axe épaule-cible.
    const hand = tipWorld(r);
    const along = hand.clone().sub(shoulder).normalize().dot(target.clone().sub(shoulder).normalize());
    expect(along).toBeGreaterThan(0.9999);
  });

  it('rend au clip ses rotations avant le mélangeur, et ne fait rien à poids nul', () => {
    const r = rig();
    const reach = new ArmReach(r.root, 'chest', 'upper_arm_r', 'forearm_r', 'socket_hand_r');
    const clip = [r.chest.quaternion.clone(), r.upper.quaternion.clone(), r.fore.quaternion.clone()];
    reach.apply(r.root, new Vector3(-0.3, 1.95, 0.5), 1);
    expect(r.upper.quaternion.equals(clip[1] ?? new Quaternion())).toBe(false);
    reach.restore();
    expect(r.chest.quaternion.equals(clip[0] ?? new Quaternion())).toBe(true);
    expect(r.upper.quaternion.equals(clip[1] ?? new Quaternion())).toBe(true);
    expect(r.fore.quaternion.equals(clip[2] ?? new Quaternion())).toBe(true);
    reach.apply(r.root, new Vector3(-0.3, 1.7, 0.35), 0);
    expect(r.upper.quaternion.equals(clip[1] ?? new Quaternion())).toBe(true);
  });

  it('à mi-poids, la main est entre le clip et la cible', () => {
    const r = rig();
    const reach = new ArmReach(r.root, 'chest', 'upper_arm_r', 'forearm_r', 'socket_hand_r');
    const start = tipWorld(r);
    const target = new Vector3(-0.3, 1.7, 0.35);
    reach.apply(r.root, target, 0.5);
    const mid = tipWorld(r);
    expect(mid.distanceTo(target)).toBeLessThan(start.distanceTo(target));
    expect(mid.distanceTo(target)).toBeGreaterThan(0.01);
  });
});
