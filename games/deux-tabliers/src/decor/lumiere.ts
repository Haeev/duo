/**
 * Lumière du jour (retour de séance du 2026-11-09: « la luminosité n'évolue pas de la journée »).
 * Fonction pure de l'heure de jeu et du temps qu'il fait, réglée par `reglages.ts` (`DAYLIGHT`):
 * soleil (couleur, force, direction), ciel et ambiance des lumières de la scène, teintes de la place
 * cuite et de son ciel, force de la lumière cuite de la salle, allumage des lampes et des réverbères.
 *
 * La coque est cuite sous le soleil de l'après-midi (azimut 205°, `assets-src/modeles/coque.py`): les
 * facteurs de la place et de la salle sont relatifs à cette cuisson (1 à 15 h). Aucune ombre calculée.
 */
import { DAYLIGHT, type DaylightKey, type WeatherLight } from './reglages';

export type Rgb = [number, number, number];

export interface Daylight {
  /** Couleur du soleil (linéaire, 0 à 1) et force relative à la lumière d'origine de la scène. */
  sun: Rgb;
  sunIntensity: number;
  /** Direction vers le soleil, repère du monde (x est, y haut, z sud), unitaire. */
  sunDir: Rgb;
  sky: Rgb;
  skyIntensity: number;
  ambientIntensity: number;
  /** Multiplicateurs de couleur de la place cuite et de son ciel. */
  outdoor: Rgb;
  skyDome: Rgb;
  /** Force de la lumière cuite de la salle (1: la cuisson). */
  interior: number;
  /** Allumage des lampes du café et des réverbères, 0 à 1. */
  lamps: number;
}

export function createDaylight(): Daylight {
  return {
    sun: [1, 1, 1],
    sunIntensity: 1,
    sunDir: [0, 1, 0],
    sky: [1, 1, 1],
    skyIntensity: 1,
    ambientIntensity: 1,
    outdoor: [1, 1, 1],
    skyDome: [1, 1, 1],
    interior: 1,
    lamps: 0,
  };
}

/** Couleur `#rrggbb` (sRGB) vers le linéaire, comme `Color.set` de Three.js. */
export function hexToLinear(hex: string, out: Rgb): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  const c = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  out[0] = c((n >> 16) & 255);
  out[1] = c((n >> 8) & 255);
  out[2] = c(n & 255);
  return out;
}

const ca: Rgb = [0, 0, 0];
const cb: Rgb = [0, 0, 0];

function mixRgb(a: readonly number[], b: readonly number[], t: number, out: Rgb): void {
  for (let i = 0; i < 3; i++) out[i] = (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * t;
}

function mixHex(a: string, b: string, t: number, out: Rgb): void {
  hexToLinear(a, ca);
  hexToLinear(b, cb);
  mixRgb(ca, cb, t, out);
}

/** Lissage (départ et arrivée doux) entre deux réglages. */
const ease = (t: number): number => t * t * (3 - 2 * t);

/** Lumière à la minute de jeu `minute` (480: 8 h) par le temps `weather`; écrit dans `out`. */
export function daylightAt(minute: number, weather: string, out: Daylight): Daylight {
  const keys = DAYLIGHT.keys;
  let a: DaylightKey = keys[0];
  let b: DaylightKey = a;
  for (const k of keys) {
    if (k.minute <= minute) a = k;
    if (k.minute >= minute) {
      b = k;
      break;
    }
    b = k;
  }
  const span = b.minute - a.minute;
  const t = span <= 0 ? 0 : ease(Math.max(0, Math.min(1, (minute - a.minute) / span)));
  mixHex(a.sun, b.sun, t, out.sun);
  mixHex(a.sky, b.sky, t, out.sky);
  const lerp = (x: number, y: number): number => x + (y - x) * t;
  out.sunIntensity = lerp(a.sunIntensity, b.sunIntensity);
  out.skyIntensity = lerp(a.skyIntensity, b.skyIntensity);
  out.ambientIntensity = lerp(a.ambientIntensity, b.ambientIntensity);
  mixRgb(a.outdoor, b.outdoor, t, out.outdoor);
  mixRgb(a.skyDome, b.skyDome, t, out.skyDome);
  out.interior = lerp(a.interior, b.interior);
  out.lamps = lerp(a.lamps, b.lamps);
  // Direction: azimut compté du nord (-z) vers l'est (+x); hauteur gardée au-dessus de l'horizon.
  const az = (lerp(a.azimuthDeg, b.azimuthDeg) * Math.PI) / 180;
  const el =
    (Math.max(DAYLIGHT.minElevationDeg, lerp(a.elevationDeg, b.elevationDeg)) * Math.PI) / 180;
  out.sunDir[0] = Math.sin(az) * Math.cos(el);
  out.sunDir[1] = Math.sin(el);
  out.sunDir[2] = -Math.cos(az) * Math.cos(el);
  // Temps couvert, pluie: soleil voilé, place plus grise, lampes allumées plus tôt.
  const w: WeatherLight = DAYLIGHT.weather[weather] ?? DAYLIGHT.weather.soleil ?? DAYLIGHT.clear;
  out.sunIntensity *= w.sun;
  for (const rgb of [out.outdoor, out.skyDome]) {
    const grey = (rgb[0] + rgb[1] + rgb[2]) / 3;
    for (let i = 0; i < 3; i++) rgb[i] = ((rgb[i] ?? 0) + (grey - (rgb[i] ?? 0)) * w.grey) * w.dim;
  }
  out.lamps = Math.min(
    1,
    out.lamps + w.lamps * Math.max(0, Math.min(1, (minute - DAYLIGHT.greyLampsFromMinute) / 60)),
  );
  return out;
}
