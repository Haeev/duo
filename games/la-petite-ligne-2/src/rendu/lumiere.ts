/**
 * Lumière du jour et de la nuit, en cycle continu: une lumière principale chaude (le soleil, puis
 * la lune bleue), un ciel doux qui débouche les ombres (bible 1.3). Les ombres portées suivent la
 * vue: cadre calé sur le cercle vu et sur la grille des texels, donc stable pendant la rotation
 * et le suivi (technique 3.5).
 */
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  type Object3D,
  type Scene,
  Vector3,
} from 'three';
import { type LightKey, RENDER_SETTINGS } from './reglages';

const MINUTES_PER_DAY = 1440;
const DEG = Math.PI / 180;

/** Les deux repères qui encadrent une heure, et la part du chemin de l'un à l'autre. */
export function keySpan(
  minutes: number,
  keys: readonly LightKey[],
): { from: LightKey; to: LightKey; t: number } {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) throw new Error('aucun repère de lumière');
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const from = keys[i];
    const to = keys[i + 1];
    if (from === undefined || to === undefined) break;
    if (m >= from.minute && m < to.minute)
      return { from, to, t: (m - from.minute) / (to.minute - from.minute) };
  }
  // Après le dernier repère ou avant le premier: on boucle par minuit.
  const span = first.minute + MINUTES_PER_DAY - last.minute;
  const since = m >= last.minute ? m - last.minute : m + MINUTES_PER_DAY - last.minute;
  return { from: last, to: first, t: span > 0 ? since / span : 0 };
}

/** Direction vers la lumière (repère Three.js: X est, Y haut, Z sud), normalisée. */
export function lightDirection(azimuthDeg: number, elevationDeg: number, out: Vector3): Vector3 {
  const flat = Math.cos(elevationDeg * DEG);
  return out.set(
    Math.sin(azimuthDeg * DEG) * flat,
    Math.sin(elevationDeg * DEG),
    -Math.cos(azimuthDeg * DEG) * flat,
  );
}

/** Part de nuit de 0 (plein jour) à 1 (nuit), d'après la force de la lumière principale. */
export function nightShare(minutes: number, keys: readonly LightKey[]): number {
  const { from, to, t } = keySpan(minutes, keys);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const key of keys) {
    min = Math.min(min, key.sunIntensity);
    max = Math.max(max, key.sunIntensity);
  }
  const intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
  return max > min ? 1 - (intensity - min) / (max - min) : 0;
}

export class Daylight {
  readonly sun = new DirectionalLight();
  readonly hemi = new HemisphereLight();
  /** Couleur de la table et du fond pour l'heure courante. */
  readonly tableColor = new Color();
  private readonly a = new Color();
  private readonly b = new Color();
  private readonly toLight = new Vector3();
  private readonly dirA = new Vector3();
  private readonly dirB = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly center = new Vector3();
  private mapSize = 0;

  constructor(
    scene: Scene,
    private readonly keys: readonly LightKey[] = RENDER_SETTINGS.lightKeys,
    private readonly shadows: typeof RENDER_SETTINGS.shadows = RENDER_SETTINGS.shadows,
  ) {
    this.sun.castShadow = true;
    this.sun.shadow.bias = shadows.bias;
    this.sun.shadow.radius = shadows.radius;
    scene.add(this.sun, this.sun.target, this.hemi);
  }

  /** Taille de la carte d'ombre (texels) et ombres actives ou non (options graphiques). */
  setShadows(enabled: boolean, mapSize: number): void {
    this.sun.castShadow = enabled;
    if (mapSize !== this.mapSize) {
      this.mapSize = mapSize;
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      // La carte est refaite à la bonne taille à la prochaine image.
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  private lerpColor(target: Color, from: string, to: string, t: number): void {
    target.copy(this.a.set(from)).lerp(this.b.set(to), t);
  }

  /** Une image: l'heure (minutes depuis minuit), le point de sol visé et le rayon du cercle vu. */
  update(minutes: number, focusX: number, focusZ: number, radius: number): void {
    const { from, to, t } = keySpan(minutes, this.keys);
    this.lerpColor(this.sun.color, from.sunColor, to.sunColor, t);
    this.sun.intensity = from.sunIntensity + (to.sunIntensity - from.sunIntensity) * t;
    this.lerpColor(this.hemi.color, from.skyColor, to.skyColor, t);
    this.lerpColor(this.hemi.groundColor, from.groundColor, to.groundColor, t);
    this.hemi.intensity = from.hemiIntensity + (to.hemiIntensity - from.hemiIntensity) * t;
    this.lerpColor(this.tableColor, from.tableColor, to.tableColor, t);
    this.sun.shadow.intensity =
      from.shadowIntensity + (to.shadowIntensity - from.shadowIntensity) * t;
    lightDirection(from.azimuthDeg, from.elevationDeg, this.dirA);
    lightDirection(to.azimuthDeg, to.elevationDeg, this.dirB);
    this.toLight.copy(this.dirA).lerp(this.dirB, t).normalize();
    this.frame(focusX, focusZ, radius);
  }

  /**
   * Cadre d'ombre: un carré autour du cercle vu, dont le centre est calé sur la grille des texels
   * dans le repère de la lumière. Tourner la caméra ne change ni sa taille ni son calage: l'ombre
   * ne scintille pas.
   */
  private frame(focusX: number, focusZ: number, radius: number): void {
    const s = this.shadows;
    // Demi-côté arrondi au demi-mètre: le zoom ne fait pas frémir les bords d'ombre à chaque image.
    const half = Math.ceil((radius + s.margin) * 2) / 2;
    const size = Math.max(1, this.mapSize);
    const texel = (half * 2) / size;
    this.right.set(0, 1, 0).cross(this.toLight).normalize();
    this.up.copy(this.toLight).cross(this.right).normalize();
    this.center.set(focusX, 0, focusZ);
    const u = Math.round(this.center.dot(this.right) / texel) * texel;
    const v = Math.round(this.center.dot(this.up) / texel) * texel;
    const w = this.center.dot(this.toLight);
    this.center
      .set(0, 0, 0)
      .addScaledVector(this.right, u)
      .addScaledVector(this.up, v)
      .addScaledVector(this.toLight, w);
    const target: Object3D = this.sun.target;
    target.position.copy(this.center);
    this.sun.position.copy(this.center).addScaledVector(this.toLight, s.distance);
    const camera = this.sun.shadow.camera;
    // Lumière rasante: l'ombre d'un volume haut s'allonge, le cadre aussi (vers la lumière).
    const reach = s.casterHeight / Math.max(0.2, Math.tan(Math.asin(this.toLight.y)));
    if (camera.right !== half || camera.far !== s.distance + half + reach) {
      camera.left = -half;
      camera.right = half;
      camera.top = half;
      camera.bottom = -half;
      camera.near = 1;
      camera.far = s.distance + half + reach;
      camera.updateProjectionMatrix();
    }
    this.sun.shadow.normalBias = texel * s.normalBiasTexels;
  }

  dispose(): void {
    this.sun.removeFromParent();
    this.sun.target.removeFromParent();
    this.hemi.removeFromParent();
    this.sun.shadow.map?.dispose();
    this.sun.dispose();
    this.hemi.dispose();
  }
}
