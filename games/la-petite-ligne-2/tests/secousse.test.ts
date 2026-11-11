// Vibration d'écran de 0,15 s (cahier 5, A.13): l'arbre qui tombe et le gros poisson, réglable,
// coupée par le mouvement réduit; la caméra l'applique puis revient exactement à sa place.
import { describe, expect, it } from 'vitest';
import { CameraRig, requestCameraShake } from '../src/rendu/camera';
import { shakeSecondsFor, shakeWanted, SHAKE_TRIGGERS } from '../src/interface/secousse';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { gameContent } from './aides';

const content = gameContent();
const fish = (player: 0 | 1, big: boolean, together = false): GameEvent => ({
  type: 'fish_caught',
  player,
  catch: 'perche',
  sizeMm: 300,
  quality: 1,
  count: 1,
  isNew: false,
  record: false,
  together,
  big,
});
const harvest = (resource: string): GameEvent => ({
  type: 'harvested',
  player: 0,
  target: 'arbre-1',
  resource,
  item: 'buche',
  count: 1,
  rare: false,
});

describe('vibration d’écran', () => {
  it('vient de l’arbre abattu et du gros poisson, pour qui les a faits', () => {
    expect(SHAKE_TRIGGERS.seconds).toBe(0.15);
    expect(shakeSecondsFor(content, harvest('chene'), 0)).toBe(0.15);
    expect(shakeSecondsFor(content, harvest('chene'), 1)).toBe(0);
    expect(shakeSecondsFor(content, harvest('caillou'), 0)).toBe(0);
    expect(shakeSecondsFor(content, fish(0, true), 0)).toBe(0.15);
    expect(shakeSecondsFor(content, fish(0, false), 0)).toBe(0);
    expect(shakeSecondsFor(content, fish(0, true), 1)).toBe(0);
    expect(shakeSecondsFor(content, fish(0, true, true), 1)).toBe(0.15);
  });

  it('se règle et se coupe par le mouvement réduit', () => {
    expect(shakeWanted({ shake: true, reducedMotion: false }, false)).toBe(true);
    expect(shakeWanted({ shake: false, reducedMotion: false }, false)).toBe(false);
    expect(shakeWanted({ shake: true, reducedMotion: true }, false)).toBe(false);
    expect(shakeWanted({ shake: true, reducedMotion: false }, true)).toBe(false);
  });

  it('secoue la vue 0,15 s puis la rend à sa place', () => {
    const rig = new CameraRig();
    const target = { x: 20, y: 20, speed: 0, facing: 0 };
    const bounds = { width: 60, height: 60 };
    rig.update(1 / 60, {}, target, bounds);
    const still = rig.pose();
    requestCameraShake(0.15);
    let moved = 0;
    for (let i = 0; i < 6; i++) {
      rig.update(1 / 60, {}, target, bounds);
      const p = rig.pose();
      moved = Math.max(moved, Math.hypot(p.x - still.x, p.y - still.y));
    }
    expect(moved).toBeGreaterThan(0.01);
    for (let i = 0; i < 12; i++) rig.update(1 / 60, {}, target, bounds);
    const after = rig.pose();
    expect(after.x).toBeCloseTo(still.x, 6);
    expect(after.y).toBeCloseTo(still.y, 6);
  });
});
