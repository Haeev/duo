// Occultation (lot L4): ce qui est entre la caméra et le joueur s'efface en fondu, à tout angle.
import { describe, expect, it } from 'vitest';
import { towardCamera } from '../../src/rendu/camera';
import { targetPulse } from '../../src/rendu/cible';
import { keySpan, nightShare } from '../../src/rendu/lumiere';
import { Occlusion, rayHitsBox, type OccluderBox } from '../../src/rendu/occultation';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';

const S = RENDER_SETTINGS.occlusion;
const DT = 1 / 60;
const PITCH = (35 * Math.PI) / 180;

/** Mur de 4 m de long (est-ouest), 0,3 m d'épaisseur, 2,6 m de haut, centré en (10, 10). */
const WALL: OccluderBox = {
  id: 'mur',
  min: { x: 8, y: 0, z: 9.85 },
  max: { x: 12, y: 2.6, z: 10.15 },
};
const feet = (x: number, z: number) => ({ x, y: 0, z });

describe('occultation', () => {
  it('trouve le volume traversé par le rayon du personnage vers la caméra', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: PITCH });
    // Lacet 0: la caméra est au sud. Un personnage au nord du mur est caché, au sud non.
    expect(rayHitsBox({ x: 10, y: 0.9, z: 9 }, toCamera, WALL, 0)).toBe(true);
    expect(rayHitsBox({ x: 10, y: 0.9, z: 11.5 }, toCamera, WALL, 0)).toBe(false);
    expect(rayHitsBox({ x: 20, y: 0.9, z: 9 }, toCamera, WALL, 0)).toBe(false);
  });

  it('efface le mur pour n’importe quel angle, dès que le joueur passe derrière', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const yaw = (deg * Math.PI) / 180;
      const toCamera = towardCamera({ yaw, pitch: PITCH });
      // Derrière: à 1 m du centre du mur, à l'opposé de la caméra. Devant: du côté de la caméra.
      const flat = Math.hypot(toCamera.x, toCamera.z);
      const behind = feet(10 - (toCamera.x / flat) * 1, 10 - (toCamera.z / flat) * 1);
      const front = feet(10 + (toCamera.x / flat) * 3, 10 + (toCamera.z / flat) * 3);
      const occlusion = new Occlusion();
      occlusion.add(WALL);
      occlusion.update(DT, [behind], toCamera);
      expect(occlusion.isHidden('mur'), `caché à ${String(deg)} degrés`).toBe(true);
      occlusion.update(DT, [front], toCamera);
      expect(occlusion.isHidden('mur'), `visible à ${String(deg)} degrés`).toBe(false);
    }
  });

  it('fond en douceur, sans saut d’opacité, et revient', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: PITCH });
    const occlusion = new Occlusion();
    occlusion.add(WALL);
    let previous = 1;
    let frames = 0;
    while (occlusion.opacity('mur') > S.fadedOpacity && frames < 600) {
      const changed = occlusion.update(DT, [feet(10, 9)], toCamera);
      expect(changed).toEqual(['mur']);
      const opacity = occlusion.opacity('mur');
      expect(previous - opacity).toBeLessThan(0.12);
      previous = opacity;
      frames += 1;
    }
    expect(frames * DT).toBeCloseTo(S.fadeOutSeconds, 1);
    // Une fois arrivé, plus rien ne change: aucun matériau retouché.
    expect(occlusion.update(DT, [feet(10, 9)], toCamera)).toEqual([]);
    for (let i = 0; i < 60; i += 1) occlusion.update(DT, [feet(10, 14)], toCamera);
    expect(occlusion.opacity('mur')).toBe(1);
  });

  it('ne clignote pas à la limite (hystérésis)', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: PITCH });
    const occlusion = new Occlusion();
    occlusion.add(WALL);
    // Le long du mur, vers l'est: on sort de la zone cachée en x.
    const edge = WALL.max.x + S.margin;
    occlusion.update(DT, [feet(edge - 0.05, 9)], toCamera);
    expect(occlusion.isHidden('mur')).toBe(true);
    // Un petit pas de côté ne le fait pas réapparaître, il faut s'écarter franchement.
    occlusion.update(DT, [feet(edge + 0.1, 9)], toCamera);
    expect(occlusion.isHidden('mur')).toBe(true);
    occlusion.update(DT, [feet(edge + S.hysteresis + 0.1, 9)], toCamera);
    expect(occlusion.isHidden('mur')).toBe(false);
    // Et dans l'autre sens, il ne s'efface qu'une fois la marge franchie.
    occlusion.update(DT, [feet(edge + 0.1, 9)], toCamera);
    expect(occlusion.isHidden('mur')).toBe(false);
  });

  it('efface le toit au-dessus du joueur et laisse les volumes bas pleins', () => {
    const toCamera = towardCamera({ yaw: 1.1, pitch: PITCH });
    const occlusion = new Occlusion();
    const roof: OccluderBox = {
      id: 'toit',
      min: { x: 6, y: 2.6, z: 6 },
      max: { x: 14, y: 2.95, z: 14 },
    };
    const low: OccluderBox = {
      id: 'bas',
      min: { x: 9, y: 0, z: 9 },
      max: { x: 11, y: 0.9, z: 11 },
    };
    expect(occlusion.add(roof)).toBe(true);
    expect(occlusion.add(low)).toBe(false);
    occlusion.update(DT, [feet(10, 10)], toCamera);
    expect(occlusion.isHidden('toit')).toBe(true);
    expect(occlusion.opacity('bas')).toBe(1);
    occlusion.update(DT, [feet(30, 30)], toCamera);
    expect(occlusion.isHidden('toit')).toBe(false);
  });
});

describe('cible qui réagit', () => {
  const T = RENDER_SETTINGS.target;

  it('rebondit une fois puis garde sa lueur, avec une brillance toutes les deux secondes', () => {
    expect(targetPulse(0, false).scale).toBeCloseTo(1);
    expect(targetPulse(T.bounceSeconds / 2, false).scale).toBeCloseTo(T.bounceScale);
    expect(targetPulse(T.bounceSeconds, false).scale).toBe(1);
    expect(targetPulse(1, false)).toEqual({ scale: 1, glow: T.glow });
    expect(targetPulse(T.sheenPeriod + T.sheenSeconds / 2, false).glow).toBeCloseTo(
      T.glow + T.sheenStrength,
    );
    expect(targetPulse(T.sheenPeriod + T.sheenSeconds + 0.1, false).glow).toBe(T.glow);
  });

  it('reste fixe en animations réduites', () => {
    expect(targetPulse(T.bounceSeconds / 2, true)).toEqual({ scale: 1, glow: T.glow });
    expect(targetPulse(T.sheenPeriod + 0.2, true)).toEqual({ scale: 1, glow: T.glow });
  });
});

describe('lumière du jour et de la nuit', () => {
  const keys = RENDER_SETTINGS.lightKeys;

  it('boucle par minuit sans saut', () => {
    const before = keySpan(1439.9, keys);
    const after = keySpan(0, keys);
    expect(before.from.sunColor).toBe(after.from.sunColor);
    for (let m = 0; m < 1440; m += 7) {
      const span = keySpan(m, keys);
      expect(span.t).toBeGreaterThanOrEqual(0);
      expect(span.t).toBeLessThanOrEqual(1);
    }
  });

  it('fait nuit la nuit et jour le jour, de façon continue', () => {
    expect(nightShare(120, keys)).toBe(1);
    expect(nightShare(780, keys)).toBe(0);
    let previous = nightShare(0, keys);
    for (let m = 1; m <= 1440; m += 1) {
      const share = nightShare(m, keys);
      expect(Math.abs(share - previous)).toBeLessThan(0.02);
      previous = share;
    }
  });
});
