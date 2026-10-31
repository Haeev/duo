/**
 * Courbes périodiques pour la lumière du jour: elles passent par chaque moment
 * clé, sans dépasser ses voisins (pas de couleur qui part trop loin entre deux
 * clés) et avec une pente continue (pas de cassure visible quand l'heure
 * passe une clé). Interpolation cubique monotone de Fritsch et Butland (PCHIP),
 * refermée sur elle-même: minuit raccorde la fin de la journée à son début.
 */

const HALF_TURN_DEG = 180;
const FULL_TURN_DEG = 360;
/** Poids de la moyenne harmonique de PCHIP (Fritsch et Butland). */
const PCHIP_WEIGHT = 2;
/** Coefficients de la base d'Hermite cubique. */
const HERMITE_TWO = 2;
const HERMITE_THREE = 3;

/** Écart angulaire ramené dans [-180, 180[ (degrés). */
export function wrapDegrees(delta: number): number {
  return (
    ((((delta + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG
  );
}

export interface CurveOptions {
  /** Période (1440 minutes pour une journée). */
  period: number;
  /** Valeurs en degrés: on suit le plus court chemin entre deux clés. */
  angular?: boolean;
}

export class CyclicCurve {
  private readonly times: number[];
  private readonly values: number[];
  private readonly slopes: number[];
  private readonly period: number;
  /** Décalage d'un tour complet (angles: multiple de 360 si la courbe fait le tour). */
  private readonly turn: number;

  /**
   * `times` croissants dans [0, période[, une valeur par moment. Un moment égal
   * à la période (copie du premier) est ignoré.
   */
  constructor(times: readonly number[], values: readonly number[], options: CurveOptions) {
    if (times.length !== values.length || times.length === 0) {
      throw new Error('Courbe: autant de moments que de valeurs, au moins un.');
    }
    this.period = options.period;
    const keptTimes: number[] = [];
    const keptValues: number[] = [];
    for (let i = 0; i < times.length; i += 1) {
      const time = times[i] ?? 0;
      if (time >= this.period) {
        continue;
      }
      const previousTime = keptTimes[keptTimes.length - 1];
      if (previousTime !== undefined && time <= previousTime) {
        throw new Error('Courbe: moments strictement croissants attendus.');
      }
      let value = values[i] ?? 0;
      const previousValue = keptValues[keptValues.length - 1];
      if (options.angular === true && previousValue !== undefined) {
        value = previousValue + wrapDegrees(value - previousValue);
      }
      keptTimes.push(time);
      keptValues.push(value);
    }
    this.times = keptTimes;
    this.values = keptValues;
    // Raccord de minuit: la clé qui suit la dernière est la première, un tour plus loin.
    const first = keptValues[0] ?? 0;
    const last = keptValues[keptValues.length - 1] ?? 0;
    const closing = options.angular === true ? last + wrapDegrees(first - last) : first;
    this.turn = closing - first;
    this.slopes = this.computeSlopes();
  }

  /** Clé `index` (peut sortir du tableau: on boucle d'une période, avec le décalage d'angle du tour). */
  private key(index: number, turn: number): { time: number; value: number } {
    const count = this.times.length;
    const wrapped = ((index % count) + count) % count;
    const laps = Math.floor(index / count);
    return {
      time: (this.times[wrapped] ?? 0) + laps * this.period,
      value: (this.values[wrapped] ?? 0) + laps * turn,
    };
  }

  private computeSlopes(): number[] {
    const turn = this.turn;
    const count = this.times.length;
    const slopes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      const previous = this.key(i - 1, turn);
      const current = this.key(i, turn);
      const next = this.key(i + 1, turn);
      const h0 = current.time - previous.time;
      const h1 = next.time - current.time;
      const d0 = h0 > 0 ? (current.value - previous.value) / h0 : 0;
      const d1 = h1 > 0 ? (next.value - current.value) / h1 : 0;
      if (count < 2 || d0 * d1 <= 0) {
        // Sommet ou creux: pente nulle, la courbe ne dépasse pas la clé.
        slopes.push(0);
        continue;
      }
      const w0 = PCHIP_WEIGHT * h1 + h0;
      const w1 = h1 + PCHIP_WEIGHT * h0;
      slopes.push((w0 + w1) / (w0 / d0 + w1 / d1));
    }
    return slopes;
  }

  /** Valeur au moment `time` (n'importe quel réel: ramené dans la période). */
  at(time: number): number {
    const count = this.times.length;
    const firstTime = this.times[0] ?? 0;
    if (count === 1) {
      return this.values[0] ?? 0;
    }
    const t = ((((time - firstTime) % this.period) + this.period) % this.period) + firstTime;
    let index = count - 1;
    for (let i = 0; i < count - 1; i += 1) {
      if (t < (this.times[i + 1] ?? Number.POSITIVE_INFINITY)) {
        index = i;
        break;
      }
    }
    const a = this.key(index, this.turn);
    const b = this.key(index + 1, this.turn);
    const m0 = this.slopes[index] ?? 0;
    const m1 = this.slopes[(index + 1) % count] ?? 0;
    if (a.value === b.value && m0 === 0 && m1 === 0) {
      // Palier (nuit, plein jour): la valeur exacte, sans erreur d'arrondi.
      return a.value;
    }
    const h = b.time - a.time;
    const s = h > 0 ? (t - a.time) / h : 0;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = HERMITE_TWO * s3 - HERMITE_THREE * s2 + 1;
    const h10 = s3 - HERMITE_TWO * s2 + s;
    const h01 = -HERMITE_TWO * s3 + HERMITE_THREE * s2;
    const h11 = s3 - s2;
    return h00 * a.value + h10 * h * m0 + h01 * b.value + h11 * h * m1;
  }
}
