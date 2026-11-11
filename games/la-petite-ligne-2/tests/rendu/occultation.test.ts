// Occultation (lot L4): ce qui est entre la caméra et le joueur s'efface en fondu, à tout angle.
import { describe, expect, it } from 'vitest';
import { towardCamera } from '../../src/rendu/camera';
import { targetPulse } from '../../src/rendu/cible';
import { keySpan, nightShare } from '../../src/rendu/lumiere';
import {
  cutInterior,
  cutZone,
  Occlusion,
  rayHitsBox,
  type OccluderBox,
} from '../../src/rendu/occultation';
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

describe('occultation encrée: découpe autour des joueurs', () => {
  const C = S.cut;
  // Pente de la caméra du jeu (50 degrés), lacet 0: la caméra est au sud (+z).
  const GAME_PITCH = (50 * Math.PI) / 180;
  /** Maison de 11 x 8 m, 10 m au faîtage; le joueur se tient à 0,8 m au nord, derrière elle. */
  const HOUSE: OccluderBox = {
    id: 'maison',
    min: { x: 0, y: 0, z: 0 },
    max: { x: 11, y: 10, z: 8 },
  };
  const FOOTPRINT = { x0: 0, z0: 0, x1: 11, z1: 8, floor: 0 };
  const BEHIND = { x: 5.5, y: 0, z: -0.8 };

  it('ouvre la maison pour toute caméra qui la met entre elle et le joueur, de plus en plus', () => {
    for (let deg = 0; deg < 360; deg += 30) {
      const yaw = (deg * Math.PI) / 180;
      const toCamera = towardCamera({ yaw, pitch: GAME_PITCH });
      const flat = Math.hypot(toCamera.x, toCamera.z);
      // Le joueur à 5 m du milieu, à l'opposé de la caméra: la maison est devant lui.
      const hidden = { x: 5.5 - (toCamera.x / flat) * 5, y: 0, z: 4 - (toCamera.z / flat) * 5 };
      const shown = { x: 5.5 + (toCamera.x / flat) * 10, y: 0, z: 4 + (toCamera.z / flat) * 10 };
      const occlusion = new Occlusion();
      occlusion.add(HOUSE);
      const half = Math.round(S.fadeOutSeconds / 2 / DT);
      for (let i = 0; i < half; i++) occlusion.update(DT, [hidden], toCamera);
      const midway = occlusion.openness('maison');
      expect(midway, `à moitié à ${String(deg)} degrés`).toBeGreaterThan(0.3);
      expect(midway).toBeLessThan(0.75);
      for (let i = 0; i < 30; i++) occlusion.update(DT, [hidden], toCamera);
      expect(occlusion.openness('maison'), `ouverte à ${String(deg)} degrés`).toBe(1);
      for (let i = 0; i < 90; i++) occlusion.update(DT, [shown], toCamera);
      expect(occlusion.openness('maison'), `refermée à ${String(deg)} degrés`).toBe(0);
    }
  });

  it('n’ouvre que ce qui cache le joueur: devant lui, dans l’ellipse, au-dessus de la coupe', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: GAME_PITCH });
    const chest = { x: BEHIND.x, y: BEHIND.y + C.center, z: BEHIND.z };
    const along = (t: number, dx = 0) => ({
      x: chest.x + toCamera.x * t + dx,
      y: chest.y + toCamera.y * t,
      z: chest.z + toCamera.z * t,
    });
    // Le toit sur le rayon du joueur vers la caméra s'ouvre; à 3 m de côté, il reste plein.
    expect(cutZone(along(3), BEHIND, toCamera, 1)).toBe('open');
    expect(cutZone(along(3, 3), BEHIND, toCamera, 1)).toBe('keep');
    // Juste au-delà du bord de l'ellipse: la trame d'encre; une maison pleine ne s'ouvre pas.
    expect(cutZone(along(3, C.radius[0] + C.band / 4), BEHIND, toCamera, 1)).toBe('band');
    expect(cutZone(along(3), BEHIND, toCamera, 0)).toBe('keep');
    // À moitié ouverte, l'ellipse est deux fois plus petite.
    expect(cutZone(along(3, C.radius[0] * 0.8), BEHIND, toCamera, 1)).toBe('open');
    expect(cutZone(along(3, C.radius[0] * 0.8), BEHIND, toCamera, 0.5)).not.toBe('open');
    // Sous la coupe (soubassement) et derrière le joueur: jamais.
    expect(cutZone({ x: 5.5, y: C.keep - 0.1, z: 0.2 }, BEHIND, toCamera, 1)).toBe('keep');
    expect(cutZone({ x: 5.5, y: 3, z: -3 }, BEHIND, toCamera, 1)).toBe('keep');
  });

  it('montre le dedans coupé: le dehors au-delà, la tranche des murs, le mur du fond, le sol', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: GAME_PITCH });
    // Le regard part du point ouvert et descend jusqu'au plan de coupe, puis jusqu'au sol.
    expect(cutInterior({ x: 5.5, y: 2, z: 1.1 }, toCamera, BEHIND, FOOTPRINT)).toBe('air');
    expect(cutInterior({ x: 5.5, y: 2, z: 1.45 }, toCamera, BEHIND, FOOTPRINT)).toBe('poche');
    expect(cutInterior({ x: 5.5, y: 2, z: 1.6 }, toCamera, BEHIND, FOOTPRINT)).toBe('wall');
    expect(cutInterior({ x: 5.5, y: 2, z: 5 }, toCamera, BEHIND, FOOTPRINT)).toBe('floor');
    // Jamais l'herbe sous l'emprise: tout regard qui y tombe rencontre la tranche, un mur ou le sol.
    for (let z = 0.3; z < 8; z += 0.25)
      for (let x = 0.5; x < 11; x += 0.5) {
        const sight = cutInterior({ x, y: 4, z: z + 4.6 }, toCamera, BEHIND, FOOTPRINT);
        const t = (4 - BEHIND.y - C.keep) / toCamera.y;
        const lands = z + 4.6 - toCamera.z * t;
        const landsInside = lands >= 0 && lands <= 8;
        if (landsInside) expect(sight).not.toBe('air');
      }
    // Un joueur sous le débord (dans l'emprise): rien du dedans ne le recouvre.
    expect(cutInterior({ x: 5.5, y: 2, z: 5 }, toCamera, { x: 5.5, y: 0, z: 0.4 }, FOOTPRINT)).toBe(
      'air',
    );
  });

  it('reste ouvert un moment après le dernier rayon: pas de battement le long d’un mur', () => {
    const toCamera = towardCamera({ yaw: 0, pitch: PITCH });
    const occlusion = new Occlusion();
    occlusion.add(WALL);
    for (let i = 0; i < 30; i++) occlusion.update(DT, [feet(10, 9)], toCamera);
    // Le rayon frôle le bord du mur une image sur deux: l'ouverture ne bouge pas.
    for (let i = 0; i < 60; i++) {
      const x = i % 2 === 0 ? 10 : WALL.max.x + S.margin + S.hysteresis + 0.2;
      occlusion.update(DT, [feet(x, 9)], toCamera);
      expect(occlusion.openness('mur')).toBe(1);
    }
    // Parti pour de bon: il se referme une fois le délai passé, en douceur.
    const away = feet(30, 30);
    const holdFrames = Math.floor(S.holdSeconds / DT) - 2;
    for (let i = 0; i < holdFrames; i++) occlusion.update(DT, [away], toCamera);
    expect(occlusion.openness('mur')).toBe(1);
    for (let i = 0; i < 60; i++) occlusion.update(DT, [away], toCamera);
    expect(occlusion.openness('mur')).toBe(0);
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
