/**
 * Pêche à deux (prise unique `crew: "pair"`): l'un à la canne, l'autre à l'épuisette.
 *
 * - Avant la fatigue, le poisson alterne élans (d'un côté) et souffles. À la canne, on sent le côté
 *   et l'on tient la touche pendant les élans (tenir pendant un souffle la brusque).
 * - Fatiguée, elle plonge d'un côté (la canne le sent), fait des bulles puis remonte de ce côté
 *   (l'épuisette la voit). L'épuisette plonge dans le bon couloir pendant la remontée, la canne
 *   tenue: elle est sortie. Sinon elle replonge, un peu reposée; on recommence.
 *
 * Les phases sont une fonction pure de la graine de la ligne et du temps: l'hôte et l'invité les
 * lisent sans réseau. Seuls les gestes partent (`fish_hold`, `fish_net`); l'hôte juge.
 */
import { createRandom, deriveSeed } from '@duo/sdk/sim';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DeepReadonly } from '../../etat/monde';
import type { FishingLine, PairFight } from '../../etat/peche';
import { SIM_DT } from '../noyau/constantes';
import { FISHING } from './reglages';

/** Couloir vu de la berge: gauche, milieu, droite. */
export type Lane = -1 | 0 | 1;

export interface PairPhase {
  /** `pull`, `rest`: avant la fatigue; `dive`, `rise`: fatiguée. */
  kind: 'pull' | 'rest' | 'dive' | 'rise';
  side: Lane;
  /** Secondes écoulées dans la phase, et sa durée. */
  into: number;
  length: number;
}

const P = FISHING.pair;

function lane(value: number): Lane {
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

/**
 * Phase du poisson `t` s après la touche (`tiredTick` nul) ou après sa fatigue. `out` évite une
 * allocation à chaque image.
 */
export function pairPhaseAt(
  seed: number,
  tiredTick: number | null,
  t: number,
  out: PairPhase = { kind: 'pull', side: 0, into: 0, length: 1 },
): PairPhase {
  const tired = tiredTick !== null;
  const random = createRandom(deriveSeed(seed, tired ? `remontee-${String(tiredTick)}` : 'a-deux'));
  let start = 0;
  // Borne: au plus la durée du combat, en phases de la plus courte durée permise.
  for (let i = 0; i < 400; i++) {
    const side = lane(random.int(-1, 2));
    const first = tired
      ? random.float(P.dive.min, P.dive.max)
      : random.float(P.pull.min, P.pull.max);
    const second = tired ? P.rise : random.float(P.rest.min, P.rest.max);
    if (t < start + first) {
      out.kind = tired ? 'dive' : 'pull';
      out.side = side;
      out.into = t - start;
      out.length = first;
      return out;
    }
    start += first;
    if (t < start + second) {
      out.kind = tired ? 'rise' : 'rest';
      out.side = side;
      out.into = t - start;
      out.length = second;
      return out;
    }
    start += second;
  }
  out.kind = tired ? 'dive' : 'rest';
  out.side = 0;
  out.into = 0;
  out.length = 1;
  return out;
}

/** Phase d'un combat à deux à `seconds` (horloge des pas, `tick * SIM_DT`, interpolée ou non). */
export function pairPhase(
  line: DeepReadonly<FishingLine>,
  pair: DeepReadonly<PairFight>,
  seconds: number,
  out?: PairPhase,
): PairPhase {
  const from = (pair.tired ?? pair.since) * SIM_DT;
  return pairPhaseAt(line.seed, pair.tired, Math.max(0, seconds - from), out);
}

/** Part des forces perdues (0: fraîche, 1: fatiguée). */
export function pairFatigue(pair: DeepReadonly<PairFight>): number {
  return pair.tired !== null ? 1 : Math.min(1, pair.held / P.holdSeconds);
}

/** Les bulles: la remontée arrive dans moins de `warn` s. */
export function pairWarning(phase: Readonly<PairPhase>): boolean {
  return phase.kind === 'dive' && phase.length - phase.into <= P.warn;
}

export type NetVerdict = 'landed' | 'deep' | 'side' | 'slack';

/** Jugement d'un plongeon d'épuisette dans `at`, au pas `tick`. */
export function judgeNet(
  line: DeepReadonly<FishingLine>,
  pair: DeepReadonly<PairFight>,
  tick: number,
  at: Lane,
): NetVerdict {
  const phase = pairPhase(line, pair, tick * SIM_DT);
  if (phase.kind !== 'rise') return 'deep';
  if (phase.side !== at) return 'side';
  return pair.down ? 'landed' : 'slack';
}

/**
 * Un pas de l'hôte: forces perdues à tenir la canne, fatigue. Rend `escaped` si le combat a trop
 * duré. `changed`: l'état a bougé (à transmettre).
 */
export function stepPair(
  line: DeepReadonly<FishingLine>,
  pair: PairFight,
  tick: number,
): { changed: boolean; escaped: boolean } {
  let changed = false;
  if (pair.tired === null && pair.down) {
    const phase = pairPhase(line, pair, tick * SIM_DT);
    const before = pair.held;
    if (phase.kind === 'pull') pair.held = Math.min(120, pair.held + SIM_DT);
    else pair.held = Math.max(0, pair.held - P.restPenalty * SIM_DT);
    changed = pair.held !== before;
    if (pair.held >= P.holdSeconds) {
      pair.tired = tick;
      changed = true;
    }
  }
  return { changed, escaped: (tick - pair.since) * SIM_DT > P.maxSeconds };
}

/** Après un plongeon raté: elle replonge, un peu reposée. */
export function missNet(pair: PairFight): void {
  pair.misses = Math.min(99, pair.misses + 1);
  pair.held = Math.min(pair.held, P.holdSeconds) * P.missKeep;
  pair.tired = null;
}

/** Le combat à deux de la ligne de `player`, ou celui où `player` tient l'épuisette. */
export function pairRole(
  lines: DeepReadonly<[FishingLine | null, FishingLine | null]>,
  player: PlayerIndex,
): { role: 'rod' | 'net'; angler: PlayerIndex } | null {
  const mine = lines[player];
  if (mine?.pair !== undefined) return { role: 'rod', angler: player };
  const otherIndex: PlayerIndex = player === 0 ? 1 : 0;
  const other = lines[otherIndex];
  if (other?.pair?.netter === player) return { role: 'net', angler: otherIndex };
  return null;
}
