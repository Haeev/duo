// Mains à doigts (2026-11-08), tests courts: prises lues dans `modeles.json`, main et récipient
// l'un de l'autre, fondu enchaîné des poses des doigts.
import {
  AnimationClip,
  AnimationMixer,
  Object3D,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
} from 'three';
import { describe, expect, it } from 'vitest';
import { createClipBlend } from '../src/rendu/melange';
import {
  adaptHold,
  fingerHolds,
  handForVessel,
  vesselInHand,
  wristDirection,
  type VesselShape,
} from '../src/rendu/tenue';

const WITH_FINGERS = [
  'char_simone',
  'char_mathis',
  'char_lise',
  'char_client_etudiante',
  'char_client_brunch',
  'char_client_connaisseur',
  'char_client_gourmand',
  'char_client_flaneur',
  'char_client_pressee',
  'char_avatar_1',
  'char_avatar_2',
];

describe('Deux Tabliers, mains à doigts', () => {
  it('prises lues pour les 11 personnages à doigts, aucune pour les 4 autres', () => {
    for (const id of WITH_FINGERS) {
      const h = fingerHolds(id);
      expect(h, id).not.toBeNull();
      expect(h?.handle.model).toBe('ware_cup_cappuccino');
      expect(h?.glass.model).toBe('ware_glass');
    }
    for (const id of [
      'char_farida',
      'char_bastien',
      'char_client_teletravail',
      'char_client_voisine',
    ])
      expect(fingerHolds(id)).toBeNull();
  });

  it('la main tirée du récipient le retrouve exactement (anse dans la main)', () => {
    const hold = fingerHolds('char_simone')?.handle;
    if (hold === undefined) throw new Error('prise absente');
    const at = new Vector3(1, 1.1, 2);
    const q = new Quaternion().setFromAxisAngle(new Vector3(0.3, 1, 0.2).normalize(), 0.8);
    const wrist = new Vector3();
    const hand = new Quaternion();
    handForVessel(hold, at, q, wrist, hand);
    const back = new Vector3();
    const backQ = new Quaternion();
    vesselInHand(hold, wrist, hand, back, backQ);
    expect(back.distanceTo(at)).toBeLessThan(1e-9);
    expect(Math.abs(backQ.dot(q))).toBeCloseTo(1, 9);
    // Le poignet reste à portée de main du récipient (moins de 25 cm).
    expect(wrist.distanceTo(at)).toBeLessThan(0.25);
    const dir = wristDirection(hold, new Vector3());
    expect(dir.y).toBe(0);
    expect(dir.length()).toBeCloseTo(1, 9);
  });

  it("prise adaptée à la tasse à espresso: le point pincé reste à sa place relative dans l'anse", () => {
    const hold = fingerHolds('char_lise')?.handle;
    if (hold === undefined || hold.handlePoint === null) throw new Error('prise absente');
    const capp: VesselShape = {
      rimRadius: 0.06,
      rimY: 0.078,
      handle: { x0: 0.0678, x1: 0.0831, y0: 0.0233, y1: 0.0703 },
      gripX: 0,
      gripY: 0,
      liquidY0: 0,
    };
    expect(adaptHold(hold, capp, capp).position.distanceTo(hold.position)).toBeLessThan(1e-9);
    const esp: VesselShape = {
      ...capp,
      handle: { x0: 0.0451, x1: 0.0602, y0: 0.0167, y1: 0.0553 },
    };
    const a = adaptHold(hold, capp, esp);
    // Le point pincé de la petite anse, porté par la tasse adaptée, tombe au même endroit de la
    // main que celui de la grande anse avec la prise d'origine.
    const p0 = hold.handlePoint.clone().applyQuaternion(hold.quaternion).add(hold.position);
    const p1 = a.handlePoint?.clone().applyQuaternion(a.quaternion).add(a.position);
    expect(p1?.distanceTo(p0)).toBeLessThan(1e-9);
  });

  it('doigts: main détendue au repos, fondu enchaîné vers la prise (somme des poids à 1)', () => {
    const node = new Object3D();
    const bone = new Object3D();
    bone.name = 'RightHandIndex1';
    node.add(bone);
    const pose = (name: string, angle: number): AnimationClip => {
      const qa = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), angle);
      return new AnimationClip(name, 0.1, [
        new QuaternionKeyframeTrack(
          'RightHandIndex1.quaternion',
          [0, 0.1],
          [...qa.toArray(), ...qa.toArray()],
        ),
      ]);
    };
    const idle = new AnimationClip('idle', 1, []);
    const mixer = new AnimationMixer(node);
    const blend = createClipBlend(
      mixer,
      [idle, pose('relaxed', 0.2), pose('grip_handle', 1.4), pose('grip_glass', 0.8)],
      0.2,
    );
    expect(blend.hasFingers()).toBe(true);
    blend.update(0.1);
    const angle = (): number => 2 * Math.acos(Math.min(1, Math.abs(bone.quaternion.w)));
    expect(angle()).toBeCloseTo(0.2, 3);
    blend.grip('grip_handle', 1);
    blend.update(0.1);
    expect(angle()).toBeCloseTo(1.4, 3);
    blend.grip('grip_handle', 0.5);
    blend.update(0.1);
    expect(angle()).toBeCloseTo(0.8, 2);
    blend.grip(null, 1);
    blend.update(0.1);
    expect(angle()).toBeCloseTo(0.2, 3);
    // Les poses des doigts ne sont jamais un clip du corps.
    blend.set('relaxed');
    expect(blend.target()).toBe('idle');
  });
});
