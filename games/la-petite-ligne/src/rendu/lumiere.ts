/**
 * Lumière du jour: une lumière directionnelle (soleil, puis lune) avec des
 * ombres légères, une lumière hémisphérique, la couleur du ciel et la brume,
 * selon l'heure et la météo. Brouillon de lumière: le technical artist règle
 * les moments clés dans `reglages.ts`.
 *
 * L'ombre ne couvre que ce que la caméra voit (caméra d'ombre serrée), calée
 * sur la grille des texels pour ne pas scintiller quand la caméra glisse, et
 * son biais suit la taille d'un texel (pas d'acné d'ombre à aucun zoom).
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Vector3,
  type Scene,
} from 'three';
import type { Weather } from '../etat/types';
import { RENDER_SETTINGS, type DaylightKey, type WeatherLook } from './reglages';

const DEG = Math.PI / 180;
const MINUTES_PER_DAY = 1440;
/** Coefficients de luminance (Rec. 709) pour la désaturation. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
const SHADOW_NEAR = 0.5;

interface PreparedKey {
  minutes: number;
  azimuth: number;
  elevation: number;
  sunColor: Color;
  sunIntensity: number;
  skyColor: Color;
  groundColor: Color;
  hemiIntensity: number;
  background: Color;
  night: number;
}

function prepare(key: DaylightKey): PreparedKey {
  return {
    minutes: key.minutes,
    azimuth: key.azimuthDeg * DEG,
    elevation: key.elevationDeg * DEG,
    sunColor: new Color(key.sunColor),
    sunIntensity: key.sunIntensity,
    skyColor: new Color(key.skyColor),
    groundColor: new Color(key.groundColor),
    hemiIntensity: key.hemiIntensity,
    background: new Color(key.background),
    night: key.night,
  };
}

/** Plus court chemin entre deux angles. */
function lerpAngle(from: number, to: number, t: number): number {
  const delta = MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI;
  return from + delta * t;
}

function grade(color: Color, look: WeatherLook): void {
  const luma = color.r * LUMA_R + color.g * LUMA_G + color.b * LUMA_B;
  color.r = MathUtils.lerp(color.r, luma, look.desaturate) * (1 - look.darken);
  color.g = MathUtils.lerp(color.g, luma, look.desaturate) * (1 - look.darken);
  color.b = MathUtils.lerp(color.b, luma, look.desaturate) * (1 - look.darken);
}

export class DaylightRig {
  readonly sun = new DirectionalLight();
  readonly hemi = new HemisphereLight();
  readonly fog: Fog;
  readonly background = new Color();
  /** 0 le jour, 1 la nuit (lueur des fenêtres). */
  night = 0;
  /** Direction d'où vient la lumière (unitaire), pour l'énigme et les effets. */
  readonly direction = new Vector3(0, 1, 0);
  private readonly keys: PreparedKey[];
  private readonly lightRight = new Vector3();
  private readonly lightUp = new Vector3();
  private readonly snapped = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);

  constructor(scene: Scene) {
    this.keys = RENDER_SETTINGS.daylight.map(prepare);
    const shadows = RENDER_SETTINGS.shadows;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
    this.sun.shadow.bias = shadows.bias;
    this.sun.shadow.radius = shadows.radius;
    this.sun.shadow.camera.near = SHADOW_NEAR;
    this.fog = new Fog(this.background, 1, 2);
    scene.add(this.sun, this.sun.target, this.hemi);
    scene.background = this.background;
    scene.fog = this.fog;
  }

  /**
   * Met la lumière à l'heure (`minutes` depuis minuit) et à la météo, et cale
   * l'ombre autour de `focus` sur un rayon `viewRadius`.
   */
  update(
    minutes: number,
    weather: Weather,
    focus: Vector3,
    viewRadius: number,
    cameraDistance: number,
  ): void {
    const m = MathUtils.euclideanModulo(minutes, MINUTES_PER_DAY);
    let index = 0;
    while (
      index < this.keys.length - 2 &&
      (this.keys[index + 1]?.minutes ?? MINUTES_PER_DAY) <= m
    ) {
      index += 1;
    }
    const a = this.keys[index];
    const b = this.keys[index + 1];
    if (a === undefined || b === undefined) {
      return;
    }
    const span = b.minutes - a.minutes;
    const t = span > 0 ? MathUtils.clamp((m - a.minutes) / span, 0, 1) : 0;
    const look = RENDER_SETTINGS.weather[weather];

    this.sun.color.lerpColors(a.sunColor, b.sunColor, t);
    grade(this.sun.color, look);
    this.sun.intensity = MathUtils.lerp(a.sunIntensity, b.sunIntensity, t) * look.sunFactor;
    this.hemi.color.lerpColors(a.skyColor, b.skyColor, t);
    this.hemi.groundColor.lerpColors(a.groundColor, b.groundColor, t);
    grade(this.hemi.color, look);
    grade(this.hemi.groundColor, look);
    this.hemi.intensity = MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t) * look.hemiFactor;
    this.background.lerpColors(a.background, b.background, t);
    grade(this.background, look);
    this.night = MathUtils.lerp(a.night, b.night, t);

    const azimuth = lerpAngle(a.azimuth, b.azimuth, t);
    const elevation = MathUtils.lerp(a.elevation, b.elevation, t);
    this.direction.set(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    );

    const fog = RENDER_SETTINGS.fog;
    this.fog.color.copy(this.background);
    this.fog.near = cameraDistance + fog.nearBeyondCamera;
    this.fog.far = cameraDistance + fog.farBeyondCamera;

    this.fitShadow(focus, viewRadius, look);
  }

  private fitShadow(focus: Vector3, viewRadius: number, look: WeatherLook): void {
    const shadows = RENDER_SETTINGS.shadows;
    const radius = viewRadius + shadows.margin;
    const texel = (2 * radius) / shadows.mapSize;
    // Cale le centre de l'ombre sur la grille des texels, dans le repère de la lumière.
    this.lightRight.crossVectors(this.worldUp, this.direction).normalize();
    this.lightUp.crossVectors(this.direction, this.lightRight).normalize();
    const along = focus.dot(this.direction);
    const u = Math.round(focus.dot(this.lightRight) / texel) * texel;
    const v = Math.round(focus.dot(this.lightUp) / texel) * texel;
    this.snapped
      .copy(this.direction)
      .multiplyScalar(along)
      .addScaledVector(this.lightRight, u)
      .addScaledVector(this.lightUp, v);

    this.sun.target.position.copy(this.snapped);
    this.sun.position.copy(this.snapped).addScaledVector(this.direction, shadows.lightDistance);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();

    const camera = this.sun.shadow.camera;
    if (camera.right !== radius) {
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
    }
    camera.far = shadows.lightDistance + radius + shadows.casterHeight;
    camera.updateProjectionMatrix();
    this.sun.shadow.normalBias = texel * shadows.normalBiasTexels;
    this.sun.shadow.intensity = shadows.intensity * look.shadowFactor;
  }
}
