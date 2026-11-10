/**
 * Essai « encre »: les ambiances. Une ambiance ne touche à aucune géométrie ni texture: ce sont
 * les trois tons de la lumière (clair, demi-teinte, ombre), la couleur de l'encre, les flaques
 * des lampes, la vignette et la teinte dominante. Les couleurs de matière viennent du nuancier
 * 0.2 de la bible (`planches/source/nuancier-v02.json`): la pièce porte le ton clair, la texture
 * pose le ton de base en taches, la lumière donne l'ombre.
 */
import { hex, type Rgb } from './formes';

export type AmbianceId = 'jour' | 'crepuscule' | 'nuit' | 'aube';
export type SceneId = 'exterieur' | 'interieur';

export interface Ambiance {
  /** D'où vient le soleil (ou la lune): azimut depuis le nord, sens horaire, et hauteur, en degrés. */
  readonly sunAzimuth: number;
  readonly sunElevation: number;
  /** Les trois tons de la lumière, multipliés à la couleur de la pièce. */
  readonly lit: Rgb;
  readonly half: Rgb;
  readonly shade: Rgb;
  readonly ink: Rgb;
  /** Hachures: dans l'ombre propre et, plus lâches, dans l'ombre portée (0 à 1). */
  readonly hatchOwn: number;
  readonly hatchCast: number;
  /** Aplat d'encre pleine au coeur des ombres propres (0 à 1): les « noirs » de la planche. */
  readonly blackFill: number;
  /** Force du relief des textures sur les tons, et de l'encre au pied des objets (0 à 1). */
  readonly relief: number;
  readonly grime: number;
  /** Personnages: part de l'ombre relevée vers la demi-teinte, et force du liseré clair. */
  readonly characterLift: number;
  readonly characterRim: number;
  /** Force des lampes (0: éteintes) et couleur ajoutée dans leur flaque. */
  readonly lamps: number;
  readonly lampColor: Rgb;
  /** Vitres: couleur et force de leur lueur. */
  readonly windowGlow: Rgb;
  readonly windowAmount: number;
  /** Rectangle de lumière que les fenêtres éclairées posent sur le sol dehors (0: aucun). */
  readonly spill: number;
  /** Reflet du ciel dessiné sur les vitres (de jour): couleur et force. */
  readonly glint: Rgb;
  readonly glintAmount: number;
  /** Brume au sol: force (0: aucune), épaisseur en mètres, couleur. */
  readonly mist: number;
  readonly mistTop: number;
  readonly mistColor: Rgb;
  /** Vent: force (1: brise) et direction vers laquelle il souffle, en degrés depuis le nord. */
  readonly wind: number;
  readonly windAzimuth: number;
  /** Particules de l'air: poussière dans le soleil, lucioles, ou rien. */
  readonly particles: 'poussiere' | 'lucioles' | 'aucune';
  /** Vignette: couleur, force au bord, rayon où elle commence (0,5 = bord court de l'image). */
  readonly vignetteColor: Rgb;
  readonly vignette: number;
  readonly vignetteStart: number;
  /** Teinte dominante, multipliée à toute l'image; puis saturation et contraste (1: inchangés). */
  readonly tint: Rgb;
  readonly saturation: number;
  readonly contrast: number;
  /** Tons du sol: herbe (clair, base, sombre), terre et ballast (clair, base). */
  readonly grass: readonly [Rgb, Rgb, Rgb];
  readonly dirt: readonly [Rgb, Rgb];
  readonly ballast: readonly [Rgb, Rgb];
  /** Fond hors du monde (intérieur: l'encre autour de la pièce). */
  readonly background: Rgb;
}

const GRASS: Ambiance['grass'] = [hex('#B9C76A'), hex('#A3B659'), hex('#8FA44E')];
const DIRT: Ambiance['dirt'] = [hex('#E6CF9C'), hex('#D3B886')];
const BALLAST: Ambiance['ballast'] = [hex('#CFC6B4'), hex('#B6A890')];

const DAY: Ambiance = {
  sunAzimuth: 232,
  sunElevation: 50,
  lit: [1.03, 1.0, 0.94],
  half: [0.86, 0.82, 0.8],
  shade: [0.6, 0.57, 0.66],
  ink: hex('#231A17'),
  hatchOwn: 0.85,
  hatchCast: 0.3,
  blackFill: 0.0,
  relief: 1.3,
  grime: 0.85,
  characterLift: 0.8,
  characterRim: 0.9,
  lamps: 0,
  lampColor: [0, 0, 0],
  windowGlow: hex('#3F5A59'),
  windowAmount: 0,
  spill: 0,
  glint: hex('#CFE0DC'),
  glintAmount: 0.8,
  mist: 0,
  mistTop: 1.2,
  mistColor: hex('#C9D2D6'),
  wind: 1,
  windAzimuth: 80,
  particles: 'poussiere',
  vignetteColor: hex('#4A3A2E'),
  vignette: 0.3,
  vignetteStart: 0.5,
  tint: [1.0, 0.985, 0.95],
  saturation: 1,
  contrast: 1,
  grass: GRASS,
  dirt: DIRT,
  ballast: BALLAST,
  background: hex('#231A17'),
};

const DUSK: Ambiance = {
  ...DAY,
  sunAzimuth: 262,
  sunElevation: 20,
  lit: [1.06, 0.84, 0.6],
  half: [0.82, 0.6, 0.56],
  shade: [0.5, 0.38, 0.52],
  ink: hex('#1F1620'),
  hatchOwn: 1,
  hatchCast: 0.28,
  blackFill: 0.35,
  lamps: 0.7,
  lampColor: [0.5, 0.36, 0.1],
  windowGlow: hex('#FFC46B'),
  windowAmount: 1,
  spill: 0.8,
  glintAmount: 0,
  mist: 0.45,
  mistTop: 0.9,
  mistColor: hex('#8E6F86'),
  wind: 0.7,
  particles: 'lucioles',
  vignetteColor: hex('#1E1426'),
  vignette: 0.72,
  vignetteStart: 0.34,
  tint: [1.0, 0.95, 0.93],
};

const NIGHT: Ambiance = {
  ...DAY,
  sunAzimuth: 140,
  sunElevation: 48,
  lit: [0.4, 0.49, 0.72],
  half: [0.3, 0.37, 0.6],
  shade: [0.17, 0.21, 0.4],
  ink: hex('#0E1220'),
  hatchOwn: 1,
  hatchCast: 0.6,
  blackFill: 0.6,
  lamps: 1,
  lampColor: [0.72, 0.5, 0.16],
  windowGlow: hex('#FFC46B'),
  windowAmount: 1,
  spill: 1,
  glintAmount: 0,
  mist: 0.8,
  mistTop: 1.1,
  mistColor: hex('#3B4A78'),
  wind: 0.5,
  particles: 'lucioles',
  vignetteColor: hex('#070A14'),
  vignette: 0.9,
  vignetteStart: 0.28,
  tint: [0.96, 0.98, 1.04],
};

/** L'aube: soleil bas à l'est, rosé et froid, brume épaisse dans les creux, lampes encore allumées. */
const DAWN: Ambiance = {
  ...DAY,
  sunAzimuth: 96,
  sunElevation: 16,
  lit: [1.0, 0.88, 0.8],
  half: [0.74, 0.7, 0.76],
  shade: [0.46, 0.46, 0.62],
  ink: hex('#1A1A26'),
  hatchOwn: 1,
  hatchCast: 0.5,
  blackFill: 0.3,
  lamps: 0.45,
  lampColor: [0.42, 0.3, 0.1],
  windowGlow: hex('#FFC46B'),
  windowAmount: 1,
  spill: 0.5,
  glintAmount: 0,
  mist: 0.7,
  mistTop: 1.5,
  mistColor: hex('#C4C2CE'),
  wind: 0.4,
  particles: 'aucune',
  vignetteColor: hex('#1B1B2A'),
  vignette: 0.7,
  vignetteStart: 0.34,
  tint: [0.98, 0.96, 1.0],
  saturation: 0.9,
};

/** Intérieur: la pièce est à l'ombre du plafond; le soleil n'y entre que par les fenêtres. */
const INSIDE_DAY: Ambiance = {
  ...DAY,
  sunAzimuth: 205,
  sunElevation: 31,
  lit: [1.14, 1.08, 0.94],
  half: [0.99, 0.93, 0.85],
  shade: [0.9, 0.83, 0.78],
  hatchOwn: 0.8,
  hatchCast: 0,
  blackFill: 0.2,
  lamps: 0.3,
  lampColor: [0.3, 0.22, 0.08],
  windowGlow: hex('#E4F0EC'),
  windowAmount: 1,
  glintAmount: 0,
  wind: 0.6,
  vignetteColor: hex('#231A17'),
  vignette: 0.78,
  vignetteStart: 0.36,
  tint: [1.0, 0.97, 0.92],
};

const INSIDE_NIGHT: Ambiance = {
  ...NIGHT,
  sunAzimuth: 205,
  sunElevation: 38,
  lit: [0.42, 0.5, 0.74],
  half: [0.34, 0.36, 0.56],
  shade: [0.27, 0.25, 0.42],
  hatchCast: 0,
  blackFill: 0.7,
  lampColor: [0.78, 0.56, 0.2],
  windowGlow: hex('#2E3A5C'),
  // Dedans, la vitre montre la nuit: un bleu sourd, et le reflet de la lampe en deux bandes.
  windowAmount: 0,
  glint: hex('#8E7A52'),
  glintAmount: 0.55,
  spill: 0,
  mist: 0,
  particles: 'aucune',
  vignette: 0.92,
  vignetteStart: 0.3,
  tint: [1.0, 0.97, 0.94],
};

function scaled(color: Rgb, r: number, g: number, b: number): Rgb {
  return [color[0] * r, color[1] * g, color[2] * b];
}

/**
 * Variante « dense » d'une ambiance de jour (à comparer, le client tranche): même heure, valeurs
 * plus basses et plus contrastées, ombres prune profondes avec des noirs pleins, vignette
 * marquée, décor plus sourd. Les personnages gardent leurs teintes: ce sont eux les accents.
 */
function dense(ambiance: Ambiance, inside: boolean): Ambiance {
  return {
    ...ambiance,
    lit: scaled(ambiance.lit, 0.94, 0.9, 0.82),
    half: scaled(ambiance.half, 0.76, 0.7, 0.7),
    shade: inside ? [0.52, 0.44, 0.5] : [0.45, 0.35, 0.56],
    hatchOwn: 1,
    hatchCast: inside ? 0 : 0.45,
    blackFill: 0.62,
    grime: 1,
    lamps: inside ? 0.6 : ambiance.lamps,
    lampColor: inside ? [0.42, 0.3, 0.1] : ambiance.lampColor,
    vignetteColor: hex('#16110F'),
    vignette: 0.86,
    vignetteStart: 0.3,
    tint: [1.0, 0.95, 0.86],
    saturation: 0.86,
    contrast: 1.1,
    grass: [hex('#A2AD5C'), hex('#8A9A4C'), hex('#74863F')],
    dirt: [hex('#D2B987'), hex('#B99C6C')],
    ballast: [hex('#B8AE9C'), hex('#9C907C')],
  };
}

export function ambianceOf(scene: SceneId, id: AmbianceId, denser = false): Ambiance {
  if (scene === 'interieur') {
    if (id !== 'jour' && id !== 'aube') return INSIDE_NIGHT;
    return denser ? dense(INSIDE_DAY, true) : INSIDE_DAY;
  }
  if (id === 'jour') return denser ? dense(DAY, false) : DAY;
  if (id === 'aube') return DAWN;
  return id === 'crepuscule' ? DUSK : NIGHT;
}

/** Direction vers le soleil, dans le repère de la scène (x à l'est, y en haut, z au sud). */
export function sunDirection(ambiance: Ambiance): [number, number, number] {
  const azimuth = (ambiance.sunAzimuth * Math.PI) / 180;
  const elevation = (ambiance.sunElevation * Math.PI) / 180;
  return [
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  ];
}
