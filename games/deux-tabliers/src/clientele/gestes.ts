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

type Sip = Seating['sip'];

/** Durée d'une gorgée entière (s), de la main qui part vers la tasse à la main qui la lâche. */
export function sipDuration(sip: Sip): number {
  return (
    sip.reachSec +
    sip.liftSec +
    sip.tiltSec +
    sip.holdSec +
    sip.untiltSec +
    sip.lowerSec +
    sip.releaseSec
  );
}

/**
 * Nombre de gorgées commencées entre `sinceSec` et `nowSec` (même horloge que `sipTime`): la
 * tasse se vide de gorgée en gorgée sans rien garder dans le monde.
 */
export function sipCount(
  seating: Seating,
  group: number,
  k: number,
  sinceSec: number,
  nowSec: number,
  sipSec: number,
): number {
  const [lo, hi] = seating.sipGapSeconds;
  const period = sipSec + lo + (hi - lo) * hash01(group, k, 1);
  const offset = period * hash01(group, k, 2);
  // Une gorgée commence quand la phase de `sipTime` repasse à zéro.
  const n = (t: number): number => Math.floor((t + offset) / period);
  return Math.max(0, n(nowSec) - n(sinceSec));
}

/** Contenu de la tasse (1 pleine) avant la gorgée numéro `n` (0 la première). */
export function fillBefore(sip: Sip, n: number): number {
  return Math.max(sip.emptyFill, 1 - n * sip.sipShare);
}

/** Inclinaison la plus forte d'une gorgée (degrés): plus la tasse est vide, plus on incline. */
export function sipTiltDeg(sip: Sip, fill: number): number {
  const span = 1 - sip.emptyFill;
  const drunk = span <= 0 ? 1 : Math.max(0, Math.min(1, (1 - fill) / span));
  return sip.tiltFullDeg + (sip.tiltEmptyDeg - sip.tiltFullDeg) * drunk;
}

export interface SipPose {
  /** Main sur la tasse (0 au repos, 1 qui la tient). */
  hand: number;
  /** Tasse levée (0 posée ou au repos, 1 aux lèvres). */
  lift: number;
  /** Inclinaison vers la bouche (degrés) et tête penchée en arrière (degrés). */
  tiltDeg: number;
  headDeg: number;
  /** Contenu montré (1 pleine): il baisse au milieu de la tenue, quand on boit. */
  fill: number;
}

function ease(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/**
 * Pose de la gorgée à l'instant `t` (s depuis son début), pour une tasse pleine à `fill`:
 * la main va à la tasse, la monte (bord aux lèvres, à plat), l'incline vers la bouche en
 * penchant un peu la tête, la tient, la redresse, la repose à plat et la lâche.
 */
export function sipPose(sip: Sip, t: number, fill: number, out: SipPose): SipPose {
  const tilt = sipTiltDeg(sip, fill);
  const after = Math.max(sip.emptyFill, fill - sip.sipShare);
  let s = t;
  out.hand = 1;
  out.lift = 1;
  out.tiltDeg = 0;
  out.headDeg = 0;
  out.fill = fill;
  if (s < sip.reachSec) {
    out.hand = ease(s / sip.reachSec);
    out.lift = 0;
    return out;
  }
  s -= sip.reachSec;
  if (s < sip.liftSec) {
    out.lift = ease(s / sip.liftSec);
    return out;
  }
  s -= sip.liftSec;
  const lean = (k: number): void => {
    out.tiltDeg = tilt * k;
    out.headDeg = sip.headBackDeg * k;
  };
  if (s < sip.tiltSec) {
    lean(ease(s / sip.tiltSec));
    return out;
  }
  s -= sip.tiltSec;
  if (s < sip.holdSec) {
    lean(1);
    if (s >= sip.holdSec / 2) out.fill = after;
    return out;
  }
  s -= sip.holdSec;
  out.fill = after;
  if (s < sip.untiltSec) {
    lean(1 - ease(s / sip.untiltSec));
    return out;
  }
  s -= sip.untiltSec;
  if (s < sip.lowerSec) {
    out.lift = 1 - ease(s / sip.lowerSec);
    return out;
  }
  s -= sip.lowerSec;
  out.lift = 0;
  out.hand = 1 - ease(s / sip.releaseSec);
  return out;
}
