/**
 * Lumière du jour (technical artist): une lumière directionnelle (soleil, puis
 * lune) avec ombre, une lumière hémisphérique, la brume et le fond, selon
 * l'heure et la météo. Chaque valeur suit une courbe continue entre les moments
 * clés de `reglages-ambiance.ts` (`courbes.ts`): rien ne saute quand l'heure
 * passe une clé.
 *
 * L'ombre ne couvre que ce que la caméra voit: l'empreinte au sol de la vue
 * (et des objets jusqu'à `receiverHeight`), projetée dans le repère de la
 * lumière, donne un cadre serré (`attachCamera`). Le cadre est calé sur la
 * grille des texels (pas de scintillement quand la caméra glisse) et son biais
 * suit la taille d'un texel (pas d'acné d'ombre, à aucun zoom).
 *
 * Elle publie aussi ce que l'ambiance lit à chaque image (`ambiance.ts`):
 * couleur du ciel reflété, lueur de nuit, sol mouillé, pluie, nuages, brume.
 */
import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  Vector3,
  type OrthographicCamera,
  type Scene,
} from 'three';
import type { Weather } from '../etat/types';
import { CyclicCurve } from './courbes';
import { AMBIANCE_SETTINGS, type LightKey, type WeatherLook } from './reglages-ambiance';
import { SEASON_RENDER_SETTINGS, type SeasonLook } from './reglages-saisons';
import { morningMistLevel, seasonalElevation, seasonalMinutes } from './saisons';

const DEG = Math.PI / 180;
const MINUTES_PER_DAY = 1440;
/** Coefficients de luminance (Rec. 709) pour la désaturation. */
const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;
const SHADOW_NEAR = 0.5;
/** Plus bas que le sol le plus bas (lit de la rivière): l'empreinte de la vue part de là. */
const LOWEST_GROUND = -0.5;
/** Coins de l'écran en coordonnées normalisées. */
const SCREEN_CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
const NEAR_PLANE_NDC = -1;
const HALF = 0.5;

/** Une couleur qui suit la journée: trois courbes, une par canal (en linéaire). */
class ColorCurve {
  private readonly r: CyclicCurve;
  private readonly g: CyclicCurve;
  private readonly b: CyclicCurve;

  constructor(times: readonly number[], hexes: readonly string[]) {
    const colors = hexes.map((hex) => new Color(hex));
    const period = { period: MINUTES_PER_DAY };
    this.r = new CyclicCurve(
      times,
      colors.map((color) => color.r),
      period,
    );
    this.g = new CyclicCurve(
      times,
      colors.map((color) => color.g),
      period,
    );
    this.b = new CyclicCurve(
      times,
      colors.map((color) => color.b),
      period,
    );
  }

  at(minutes: number, out: Color): Color {
    return out.setRGB(
      Math.max(0, this.r.at(minutes)),
      Math.max(0, this.g.at(minutes)),
      Math.max(0, this.b.at(minutes)),
    );
  }
}

/** Toutes les courbes de la journée, tirées des moments clés. */
class DayCurves {
  readonly azimuth: CyclicCurve;
  readonly elevation: CyclicCurve;
  readonly sunIntensity: CyclicCurve;
  readonly hemiIntensity: CyclicCurve;
  readonly shadow: CyclicCurve;
  readonly shadowRadius: CyclicCurve;
  readonly glow: CyclicCurve;
  readonly mist: CyclicCurve;
  readonly clouds: CyclicCurve;
  readonly sunColor: ColorCurve;
  readonly skyColor: ColorCurve;
  readonly groundColor: ColorCurve;
  readonly fogColor: ColorCurve;
  readonly reflectionColor: ColorCurve;

  constructor(keys: readonly LightKey[]) {
    const times = keys.map((key) => key.minutes);
    const scalar = (pick: (key: LightKey) => number, angular = false): CyclicCurve =>
      new CyclicCurve(times, keys.map(pick), { period: MINUTES_PER_DAY, angular });
    this.azimuth = scalar((key) => key.azimuthDeg, true);
    this.elevation = scalar((key) => key.elevationDeg);
    this.sunIntensity = scalar((key) => key.sunIntensity);
    this.hemiIntensity = scalar((key) => key.hemiIntensity);
    this.shadow = scalar((key) => key.shadow);
    this.shadowRadius = scalar((key) => key.shadowRadius ?? AMBIANCE_SETTINGS.shadows.radius);
    this.glow = scalar((key) => key.glow);
    this.mist = scalar((key) => key.mist);
    this.clouds = scalar((key) => key.clouds);
    this.sunColor = new ColorCurve(
      times,
      keys.map((key) => key.sunColor),
    );
    this.skyColor = new ColorCurve(
      times,
      keys.map((key) => key.skyColor),
    );
    this.groundColor = new ColorCurve(
      times,
      keys.map((key) => key.groundColor),
    );
    this.fogColor = new ColorCurve(
      times,
      keys.map((key) => key.fogColor),
    );
    this.reflectionColor = new ColorCurve(
      times,
      keys.map((key) => key.reflectionColor),
    );
  }
}

/** Météo appliquée à une couleur: teinte grise, désaturation, assombrissement. */
function grade(color: Color, look: WeatherLook, tint: Color | null): void {
  if (tint !== null && look.tintAmount > 0) {
    color.lerp(tint, look.tintAmount);
  }
  const luma = color.r * LUMA_R + color.g * LUMA_G + color.b * LUMA_B;
  const keep = 1 - look.darken;
  color.r = MathUtils.lerp(color.r, luma, look.desaturate) * keep;
  color.g = MathUtils.lerp(color.g, luma, look.desaturate) * keep;
  color.b = MathUtils.lerp(color.b, luma, look.desaturate) * keep;
}

const clamp01 = (value: number): number => MathUtils.clamp(value, 0, 1);

export class DaylightRig {
  readonly sun = new DirectionalLight();
  readonly hemi = new HemisphereLight();
  readonly fog: Fog;
  readonly background = new Color();
  /** Lueur des fenêtres, lanternes et lampes: 0 le jour, 1 la nuit (montée au crépuscule). */
  night = 0;
  /** Direction d'où vient la lumière (unitaire), pour l'énigme et les effets. */
  readonly direction = new Vector3(0, 1, 0);
  /** Ciel reflété par l'eau et les flaques (linéaire). */
  readonly reflection = new Color();
  /** Force du soleil, de 0 (nuit, pluie) à 1 (plein midi): reflets et étincelles de l'eau. */
  sunLevel = 0;
  /** Sol mouillé (0 à 1), densité de la pluie (0 à 1), ombres de nuages (0 à 1), brume au sol (0 à 1). */
  wet = 0;
  rain = 0;
  cloudCover = 0;
  mist = 0;
  /** Point suivi par la caméra et rayon de la vue au sol, à cette image. */
  readonly focus = new Vector3();
  viewRadius = 1;
  private readonly curves: DayCurves;
  private readonly tints: Record<Weather, Color>;
  private readonly noonSun: number;
  private camera: OrthographicCamera | null = null;
  private readonly lightRight = new Vector3();
  private readonly lightUp = new Vector3();
  private readonly snapped = new Vector3();
  private readonly worldUp = new Vector3(0, 1, 0);
  private readonly corner = new Vector3();
  private readonly forward = new Vector3();
  private readonly ground = new Vector3();
  /** Saison de la lumière (déformation de l'heure, hauteur du soleil): le printemps par défaut. */
  private season: SeasonLook = SEASON_RENDER_SETTINGS.seasons.spring;
  /** Brume du matin du jour (`mistAmount`, 0 à 1): la nappe sur l'eau et le pré (`ciel.ts`). */
  morningMist = 0;

  constructor(scene: Scene) {
    this.curves = new DayCurves(AMBIANCE_SETTINGS.daylight);
    const looks = AMBIANCE_SETTINGS.weather;
    this.tints = {
      sunny: new Color(looks.sunny.tint),
      cloudy: new Color(looks.cloudy.tint),
      rain: new Color(looks.rain.tint),
    };
    this.noonSun = Math.max(...AMBIANCE_SETTINGS.daylight.map((key) => key.sunIntensity));
    const shadows = AMBIANCE_SETTINGS.shadows;
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
   * Caméra de la vue: l'ombre se cale alors sur ce qu'elle voit (cadre serré),
   * au lieu d'un cercle autour du point suivi.
   */
  attachCamera(camera: OrthographicCamera): void {
    this.camera = camera;
  }

  /** Saison de la lumière, lue à la prochaine mise à jour (section 2.5). */
  setSeason(look: SeasonLook): void {
    this.season = look;
  }

  /** Brume du matin (`mistAmount` de `etat/meteo.ts`: 1 jusqu'à 9 h, 0 à 10 h 30). */
  setMorningMist(amount: number): void {
    this.morningMist = clamp01(amount);
  }

  /**
   * Met la lumière à l'heure (`minutes` depuis minuit) et à la météo, et cale
   * l'ombre sur la vue (autour de `focus`, rayon `viewRadius` sans caméra).
   */
  update(
    minutes: number,
    weather: Weather,
    focus: Vector3,
    viewRadius: number,
    cameraDistance: number,
  ): void {
    const m = seasonalMinutes(MathUtils.euclideanModulo(minutes, MINUTES_PER_DAY), this.season);
    const curves = this.curves;
    const look: WeatherLook = AMBIANCE_SETTINGS.weather[weather];
    const tint = this.tints[weather];
    this.focus.copy(focus);
    this.viewRadius = viewRadius;

    curves.sunColor.at(m, this.sun.color);
    grade(this.sun.color, look, null);
    const sunIntensity = curves.sunIntensity.at(m);
    this.sun.intensity = sunIntensity * look.sunFactor;
    curves.skyColor.at(m, this.hemi.color);
    curves.groundColor.at(m, this.hemi.groundColor);
    grade(this.hemi.color, look, tint);
    grade(this.hemi.groundColor, look, null);
    this.hemi.intensity = curves.hemiIntensity.at(m) * look.hemiFactor;
    curves.fogColor.at(m, this.background);
    grade(this.background, look, tint);
    curves.reflectionColor.at(m, this.reflection);
    grade(this.reflection, look, tint);

    this.night = clamp01(curves.glow.at(m));
    // La lueur de nuit éteint aussi les reflets de soleil: la lune ne fait pas scintiller l'eau.
    this.sunLevel = clamp01((sunIntensity / this.noonSun) * look.sunFactor * (1 - this.night));
    this.wet = look.wet;
    this.rain = look.rain;
    this.cloudCover = clamp01(look.cloudCover * curves.clouds.at(m));
    this.mist = clamp01(morningMistLevel(curves.mist.at(m), this.morningMist) + look.mist);

    const shadows = AMBIANCE_SETTINGS.shadows;
    const azimuth = curves.azimuth.at(m) * DEG;
    const sunHeight = seasonalElevation(
      curves.elevation.at(m),
      this.season.sunElevationScale,
      this.night,
    );
    const elevation = Math.max(shadows.minElevationDeg, sunHeight) * DEG;
    this.direction.set(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation),
    );

    const fog = AMBIANCE_SETTINGS.fog;
    const pull = 1 - this.mist * fog.mistPull;
    this.fog.color.copy(this.background);
    this.fog.near = cameraDistance + fog.nearBeyondCamera * look.fogFactor * pull;
    this.fog.far = cameraDistance + fog.farBeyondCamera * look.fogFactor * pull;

    this.sun.shadow.intensity =
      Math.min(1, shadows.intensity * Math.max(0, curves.shadow.at(m))) * look.shadowFactor;
    this.sun.shadow.radius = curves.shadowRadius.at(m);
    this.setShadowMapSize(
      m >= shadows.detailFrom && m <= shadows.detailTo ? shadows.detailMapSize : shadows.mapSize,
    );
    this.fitShadow(focus, viewRadius);
  }

  /**
   * Teinte passagère (un moment rare: la lumière qui dore sur la brume), après `update`: le soleil
   * va vers `color` de `amount` (0 à 1), le ciel de moitié.
   */
  tint(color: Color, amount: number): void {
    const a = clamp01(amount);
    this.sun.color.lerp(color, a);
    this.hemi.color.lerp(color, a * 0.5);
  }

  /** Change la taille de la carte d'ombre (le moteur la recrée à la prochaine image). */
  private setShadowMapSize(size: number): void {
    const shadow = this.sun.shadow;
    if (shadow.mapSize.x === size) {
      return;
    }
    shadow.mapSize.set(size, size);
    shadow.map?.dispose();
    shadow.map = null;
  }

  /** Repère de la lumière: deux axes perpendiculaires à sa direction (ceux de sa caméra d'ombre). */
  private lightFrame(): void {
    this.lightRight.crossVectors(this.worldUp, this.direction).normalize();
    this.lightUp.crossVectors(this.direction, this.lightRight).normalize();
  }

  /** Cadre de l'ombre: demi-largeurs et centre dans le repère de la lumière, plus l'étendue en profondeur. */
  private viewBounds(
    focus: Vector3,
    viewRadius: number,
  ): { u: number; v: number; halfU: number; halfV: number; along: number; depth: number } {
    const shadows = AMBIANCE_SETTINGS.shadows;
    const camera = this.camera;
    if (camera === null) {
      const radius = viewRadius + shadows.fallbackMargin;
      return {
        u: focus.dot(this.lightRight),
        v: focus.dot(this.lightUp),
        halfU: radius,
        halfV: radius,
        along: focus.dot(this.direction),
        depth: radius,
      };
    }
    camera.updateMatrixWorld();
    camera.getWorldDirection(this.forward);
    let minU = Number.POSITIVE_INFINITY;
    let maxU = Number.NEGATIVE_INFINITY;
    let minV = Number.POSITIVE_INFINITY;
    let maxV = Number.NEGATIVE_INFINITY;
    let minD = Number.POSITIVE_INFINITY;
    let maxD = Number.NEGATIVE_INFINITY;
    const forwardY = Math.min(-Number.EPSILON, this.forward.y);
    for (const [x, y] of SCREEN_CORNERS) {
      this.corner.set(x, y, NEAR_PLANE_NDC).unproject(camera);
      for (const height of [LOWEST_GROUND, shadows.receiverHeight]) {
        const t = (height - this.corner.y) / forwardY;
        this.ground.copy(this.corner).addScaledVector(this.forward, t);
        const u = this.ground.dot(this.lightRight);
        const v = this.ground.dot(this.lightUp);
        const d = this.ground.dot(this.direction);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, v);
        maxV = Math.max(maxV, v);
        minD = Math.min(minD, d);
        maxD = Math.max(maxD, d);
      }
    }
    const step = shadows.extentStep;
    const quantize = (half: number): number => Math.ceil((half + shadows.margin) / step) * step;
    return {
      u: (minU + maxU) * HALF,
      v: (minV + maxV) * HALF,
      halfU: quantize((maxU - minU) * HALF),
      halfV: quantize((maxV - minV) * HALF),
      along: (minD + maxD) * HALF,
      depth: (maxD - minD) * HALF + shadows.margin,
    };
  }

  private fitShadow(focus: Vector3, viewRadius: number): void {
    const shadows = AMBIANCE_SETTINGS.shadows;
    this.lightFrame();
    const bounds = this.viewBounds(focus, viewRadius);
    const mapSize = this.sun.shadow.mapSize.x;
    const texelU = (2 * bounds.halfU) / mapSize;
    const texelV = (2 * bounds.halfV) / mapSize;
    // Centre calé sur la grille des texels, dans le repère de la lumière.
    const u = Math.round(bounds.u / texelU) * texelU;
    const v = Math.round(bounds.v / texelV) * texelV;
    this.snapped
      .copy(this.direction)
      .multiplyScalar(bounds.along)
      .addScaledVector(this.lightRight, u)
      .addScaledVector(this.lightUp, v);

    this.sun.target.position.copy(this.snapped);
    this.sun.position.copy(this.snapped).addScaledVector(this.direction, shadows.lightDistance);
    this.sun.target.updateMatrixWorld();
    this.sun.updateMatrixWorld();

    const camera = this.sun.shadow.camera;
    camera.left = -bounds.halfU;
    camera.right = bounds.halfU;
    camera.top = bounds.halfV;
    camera.bottom = -bounds.halfV;
    // Profondeur serrée: devant les receveurs, seulement la distance (le long du rayon) d'où un
    // objet de `casterHeight` peut encore porter son ombre dans la vue, plafonnée à `casterReach`
    // (soleil bas: les grands arbres lointains ne portent plus que des pointes d'ombre pâles);
    // derrière, rien (un objet plus loin que les receveurs n'ombre rien de visible).
    const elevation = Math.max(Math.asin(this.direction.y), shadows.minElevationDeg * DEG);
    const reach = Math.min(shadows.casterHeight / Math.sin(elevation), shadows.casterReach);
    camera.near = Math.max(SHADOW_NEAR, shadows.lightDistance - bounds.depth - reach);
    camera.far = shadows.lightDistance + bounds.depth;
    camera.updateProjectionMatrix();
    this.sun.shadow.normalBias = Math.max(texelU, texelV) * shadows.normalBiasTexels;
  }

  /** Taille d'un texel de la carte d'ombre au sol (m), pour les tests et le diagnostic. */
  shadowTexel(): number {
    const camera = this.sun.shadow.camera;
    return (
      Math.max(camera.right - camera.left, camera.top - camera.bottom) / this.sun.shadow.mapSize.x
    );
  }

  /** Libère la carte d'ombre. */
  dispose(): void {
    this.sun.dispose();
    this.hemi.dispose();
  }
}
