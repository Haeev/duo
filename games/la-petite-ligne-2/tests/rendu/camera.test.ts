// Caméra libre (lot L4): lacet continu, zoom borné en douceur, suivi en retard, repère du déplacement.
import { describe, expect, it } from 'vitest';
import {
  CameraRig,
  screenToWorld,
  softClamp,
  towardCamera,
  viewRadius,
} from '../../src/rendu/camera';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';

const S = RENDER_SETTINGS.camera;
const DT = 1 / 60;
const BOUNDS = { width: 40, height: 40 };
const still = (x: number, y: number) => ({ x, y, speed: 0, facing: 0 });

function run(
  rig: CameraRig,
  seconds: number,
  input: Parameters<CameraRig['update']>[1],
  target = still(20, 20),
): void {
  for (let t = 0; t < seconds; t += DT) rig.update(DT, input, target, BOUNDS);
}

describe('caméra libre', () => {
  it('tourne en continu sur 360 degrés et revient à son point de départ', () => {
    const rig = new CameraRig();
    const start = rig.yawAngle();
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 8; i += 1) {
      rig.update(DT, { turn: 1 }, still(20, 20), BOUNDS);
      seen.add(Math.floor((rig.yawAngle() * 8) / (Math.PI * 2)));
      expect(rig.yawAngle()).toBeGreaterThanOrEqual(0);
      expect(rig.yawAngle()).toBeLessThan(Math.PI * 2);
    }
    // Les huit octants ont été vus: aucun angle n'est interdit.
    expect(seen.size).toBe(8);
    // 360 degrés à 110 degrés par seconde: un tour en 3,3 s environ.
    const lap = new CameraRig();
    run(lap, 360 / S.yawSpeedDeg + S.yawEaseSeconds, { turn: 1 });
    const off = Math.abs(lap.yawAngle() - start);
    expect(Math.min(off, Math.PI * 2 - off)).toBeLessThan(0.25);
  });

  it('prend sa vitesse de rotation et s’arrête en douceur', () => {
    const rig = new CameraRig();
    const before = rig.yawAngle();
    rig.update(DT, { turn: 1 }, still(20, 20), BOUNDS);
    const first = rig.yawAngle() - before;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(((S.yawSpeedDeg * Math.PI) / 180) * DT);
    run(rig, 0.5, { turn: 1 });
    const moving = rig.yawAngle();
    rig.update(DT, {}, still(20, 20), BOUNDS);
    // Inertie courte: elle tourne encore un peu après le relâchement, puis s'arrête.
    expect(rig.yawAngle()).toBeGreaterThan(moving);
    run(rig, 1, {});
    const stopped = rig.yawAngle();
    rig.update(DT, {}, still(20, 20), BOUNDS);
    expect(rig.yawAngle()).toBeCloseTo(stopped, 4);
  });

  it('tourne aussi au glissé du bouton droit', () => {
    const rig = new CameraRig();
    const before = rig.yawAngle();
    rig.update(DT, { dragPixels: 100 }, still(20, 20), BOUNDS);
    expect(rig.yawAngle() - before).toBeCloseTo((100 * S.dragDegPerPixel * Math.PI) / 180, 5);
  });

  it('zoome à la molette et aux flèches, entre ses bornes, proche par défaut', () => {
    const rig = new CameraRig();
    rig.update(DT, {}, still(20, 20), BOUNDS);
    expect(rig.pose().width).toBeCloseTo(S.defaultWidth, 5);
    for (let i = 0; i < 40; i += 1) rig.update(DT, { wheel: 1 }, still(20, 20), BOUNDS);
    run(rig, 1.5, {});
    expect(rig.pose().width).toBeCloseTo(S.maxWidth, 1);
    run(rig, 6, { zoom: 1 });
    // Tenue en butée: un léger dépassement permis, jamais plus.
    expect(rig.pose().width).toBeGreaterThanOrEqual(S.minWidth / (1 + S.zoomOvershoot) - 1e-6);
    run(rig, 1.5, {});
    expect(rig.pose().width).toBeCloseTo(S.minWidth, 1);
    expect((rig.pose().pitch * 180) / Math.PI).toBeCloseTo(S.pitchNearDeg, 0);
  });

  it('suit le personnage avec un léger retard, sans à-coup', () => {
    const rig = new CameraRig();
    rig.snapTo(still(20, 20), BOUNDS);
    let x = 20;
    let lag = 0;
    let previous = rig.pose().x;
    for (let i = 0; i < 120; i += 1) {
      x += 3 * DT;
      rig.update(DT, {}, { x, y: 20, speed: 0, facing: 0 }, BOUNDS);
      const pose = rig.pose();
      expect(pose.x).toBeGreaterThanOrEqual(previous);
      // Jamais plus vite que le personnage et demi: pas de saut.
      expect(pose.x - previous).toBeLessThan(3 * DT * 1.5);
      previous = pose.x;
      lag = x - pose.x;
    }
    expect(lag).toBeGreaterThan(0.2);
    expect(lag).toBeLessThan(1.2);
    run(rig, 2, {}, { x, y: 20, speed: 0, facing: 0 });
    expect(rig.pose().x).toBeCloseTo(x, 2);
  });

  it('freine le point suivi près du bord de la carte au lieu de buter', () => {
    expect(softClamp(20, 2, 38, 3)).toBe(20);
    let previous = softClamp(30, 2, 38, 3);
    for (let v = 30.1; v < 60; v += 0.1) {
      const out = softClamp(v, 2, 38, 3);
      expect(out).toBeGreaterThanOrEqual(previous);
      expect(out).toBeLessThanOrEqual(38);
      previous = out;
    }
    const rig = new CameraRig();
    rig.snapTo(still(39.5, 0.2), BOUNDS);
    expect(rig.pose().x).toBeLessThan(BOUNDS.width - S.edgeMargin);
    expect(rig.pose().y).toBeGreaterThan(S.edgeMargin);
  });

  it('donne un déplacement relatif à l’écran, quel que soit l’angle', () => {
    // Lacet 0: le haut de l'écran est au nord (y négatif), la droite à l'est.
    expect(screenToWorld(0, 0, 1).y).toBeCloseTo(-1);
    expect(screenToWorld(0, 1, 0).x).toBeCloseTo(1);
    // Lacet de 90 degrés: le haut de l'écran est à l'est.
    expect(screenToWorld(Math.PI / 2, 0, 1).x).toBeCloseTo(1);
    for (let deg = 0; deg < 360; deg += 17) {
      const yaw = (deg * Math.PI) / 180;
      const up = screenToWorld(yaw, 0, 1);
      const right = screenToWorld(yaw, 1, 0);
      const cam = towardCamera({ yaw, pitch: 0.6 });
      // « Haut » s'éloigne de la caméra; « droite » lui est perpendiculaire; les longueurs tiennent.
      expect(up.x * cam.x + up.y * cam.z).toBeLessThan(0);
      expect(right.x * cam.x + right.y * cam.z).toBeCloseTo(0);
      expect(Math.hypot(up.x, up.y)).toBeCloseTo(1);
      // Droite de l'écran: produit vectoriel (haut du monde) x (vers la caméra), composante horizontale.
      expect(right.x * cam.z - right.y * cam.x).toBeGreaterThan(0);
    }
  });

  it('garde un cercle vu qui ne dépend pas de l’angle (cadre d’ombre stable)', () => {
    const rig = new CameraRig();
    rig.update(DT, {}, still(20, 20), BOUNDS);
    const before = viewRadius(rig.pose(), 16 / 9);
    run(rig, 1.3, { turn: 1 });
    expect(viewRadius(rig.pose(), 16 / 9)).toBeCloseTo(before, 6);
  });
});
