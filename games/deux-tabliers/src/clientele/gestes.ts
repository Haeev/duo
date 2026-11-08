/**
 * Gestes d'un client assis, décidés sans Three.js (même résultat chez l'hôte et l'invité, testé
 * dans Node): il ne boit que si sa boisson est servie (sa tasse ou son verre est alors devant lui
 * sur la table, et dans sa main pendant la gorgée); sinon il attend, calme, et regarde de temps
 * en temps le comptoir ou son voisin. Gorgées et regards suivent une horloge propre à chaque
 * client (graine: groupe et rang), sans état: rien à transmettre ni à sauvegarder.
 */
import type { Settings } from '../donnees/schemas';
import type { ClienteleContent } from './donnees';
import type { Group } from './etat';

/** Familles de la carte servies dans une tasse ou un verre (le reste se mange). */
export const DRINK_FAMILIES: ReadonlySet<string> = new Set([
  'black_coffee',
  'milk_coffee',
  'tea',
  'chocolate',
  'cold_drink',
]);

/** Boisson servie du membre `k` (recette de `carte.json`), `null` s'il n'en a pas encore. */
export function memberDrink(cc: ClienteleContent, g: Group, k: number): string | null {
  if (g.stage !== 'seated' || g.servedAt === null) return null;
  let n = 0;
  for (const id of g.items) {
    const family = cc.recipes.get(id)?.family;
    if (family === undefined || !DRINK_FAMILIES.has(family)) continue;
    if (n === k) return id;
    n++;
  }
  return null;
}

/** Nombre pseudo-aléatoire stable dans [0, 1[ (hachage entier, pas de `Math.random`). */
function hash01(a: number, b: number, c: number): number {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) ^ c;
  h = Math.imul(h ^ (h >>> 16), 0x165667b1);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

type Seating = Settings['seating'];

/**
 * Temps écoulé dans la gorgée en cours (s, de 0 à `sipSec`), ou `null` entre deux gorgées.
 * Chaque client a sa pause (`sipGapSeconds`) et son décalage: les voisins ne boivent pas ensemble.
 */
export function sipTime(
  seating: Seating,
  group: number,
  k: number,
  nowSec: number,
  sipSec: number,
): number | null {
  const [lo, hi] = seating.sipGapSeconds;
  const period = sipSec + lo + (hi - lo) * hash01(group, k, 1);
  const phase = (((nowSec + period * hash01(group, k, 2)) % period) + period) % period;
  return phase < sipSec ? phase : null;
}

const RAMP = 0.6;

/**
 * Part du regard tourné vers le comptoir ou le voisin (0 droit devant, 1 tourné), avec des
 * transitions douces: un regard de `glanceSeconds`, puis autant droit devant.
 */
export function glanceWeight(seating: Seating, group: number, k: number, nowSec: number): number {
  const [lo, hi] = seating.glanceSeconds;
  const span = lo + (hi - lo) * hash01(group, k, 3);
  const period = span * 2;
  const phase = (((nowSec + period * hash01(group, k, 4)) % period) + period) % period;
  if (phase >= span) return 0;
  const edge = Math.min(phase, span - phase) / RAMP;
  const t = Math.min(1, edge);
  return t * t * (3 - 2 * t);
}
