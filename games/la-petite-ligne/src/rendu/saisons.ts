/**
 * Saisons du rendu (pur, sans Three.js): déformation de l'heure (section 2.5) et brume du matin.
 * L'heure de jeu `m` devient `f(m)`, linéaire par morceaux entre les ancres `0 → 0`,
 * `lever → 330`, `780 → 780`, `fin du jour → 1230`, `1440 → 1440`. Au printemps, `f` est
 * l'identité.
 */
import { SEASON_RENDER_SETTINGS, type SeasonLook } from './reglages-saisons';

const MINUTES_PER_DAY = 1440;

/** Interpolation linéaire de `m` de `[a0, a1]` vers `[b0, b1]`. */
function remap(m: number, a0: number, a1: number, b0: number, b1: number): number {
  return b0 + ((m - a0) / Math.max(1, a1 - a0)) * (b1 - b0);
}

/** Heure lue par les courbes de la journée pour l'heure de jeu `minutes` (0 à 1440). */
export function seasonalMinutes(
  minutes: number,
  look: Pick<SeasonLook, 'sunrise' | 'dayEnd'>,
): number {
  const a = SEASON_RENDER_SETTINGS.anchors;
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (m < look.sunrise) return remap(m, 0, look.sunrise, 0, a.sunrise);
  if (m < a.noon) return remap(m, look.sunrise, a.noon, a.sunrise, a.noon);
  if (m < look.dayEnd) return remap(m, a.noon, look.dayEnd, a.noon, a.dayEnd);
  return remap(m, look.dayEnd, MINUTES_PER_DAY, a.dayEnd, MINUTES_PER_DAY);
}

/**
 * Hauteur du soleil pour la saison: le facteur de la saison le jour, rien la nuit (la lune garde
 * sa hauteur), en passant de l'un à l'autre avec la lueur de nuit (`night`, 0 à 1).
 */
export function seasonalElevation(elevationDeg: number, scale: number, night: number): number {
  const n = Math.min(1, Math.max(0, night));
  return elevationDeg * (scale + (1 - scale) * n);
}

/** Brume au ras du sol: celle de l'heure, portée au moins au niveau de la brume du matin. */
export function morningMistLevel(curveMist: number, mistAmount: number): number {
  return Math.max(curveMist, SEASON_RENDER_SETTINGS.morningMist.level * mistAmount);
}
