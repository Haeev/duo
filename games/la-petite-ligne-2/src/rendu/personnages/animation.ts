/**
 * Animation pilotée par l'état (logique pure, testée dans Node): poids des clips selon la posture
 * et la vitesse, cadence calée sur la vitesse réelle, visage (expression, clignement, bouche).
 */
import { approach } from '../camera';
import { CHARACTER_SETTINGS, type CharacterSettings } from './reglages';

/** Ce que fait le personnage: debout (vitesse au sol), assis, ou un clip de geste. */
export type Posture =
  | { readonly kind: 'stand'; readonly speed: number }
  | { readonly kind: 'sit' }
  | { readonly kind: 'clip'; readonly clip: string };

export type ClipWeights = Map<string, number>;

/** Poids visés de chaque clip pour cette posture (somme 1). */
export function targetWeights(
  posture: Posture,
  available: ReadonlySet<string>,
  out: ClipWeights,
  settings: CharacterSettings = CHARACTER_SETTINGS,
): ClipWeights {
  out.clear();
  const c = settings.clips;
  const has = (name: string): string => (available.has(name) ? name : c.idle);
  if (posture.kind === 'sit') {
    out.set(has(c.sit), 1);
    return out;
  }
  if (posture.kind === 'clip') {
    out.set(available.has(posture.clip) ? posture.clip : has(c.gesture), 1);
    return out;
  }
  const l = settings.locomotion;
  const speed = Math.abs(posture.speed);
  if (speed < l.moving) {
    out.set(c.idle, 1);
    return out;
  }
  const run = Math.min(1, Math.max(0, (speed - l.runFrom) / (l.runTo - l.runFrom)));
  if (run < 1) out.set(has(c.walk), 1 - run);
  if (run > 0) out.set(has(c.run), (out.get(has(c.run)) ?? 0) + run);
  return out;
}

/**
 * Cycles de foulée par seconde: la vitesse divisée par la distance d'un cycle (mêlée entre marche
 * et course selon leur poids), bornée autour de la cadence propre du clip.
 */
export function strideRate(
  speed: number,
  walkStride: number,
  runStride: number,
  runWeight: number,
  walkDuration: number,
  runDuration: number,
  settings: CharacterSettings = CHARACTER_SETTINGS,
): number {
  const stride = walkStride + (runStride - walkStride) * runWeight;
  const duration = walkDuration + (runDuration - walkDuration) * runWeight;
  const natural = 1 / Math.max(1e-3, duration);
  const wanted = Math.abs(speed) / Math.max(1e-3, stride);
  const l = settings.locomotion;
  return Math.min(natural * l.maxRate, Math.max(natural * l.minRate, wanted));
}

/** Rapproche les poids affichés des poids visés (fondu), sans allocation. */
export function blendWeights(
  current: ClipWeights,
  target: ClipWeights,
  dt: number,
  halfLife: number,
): void {
  const k = approach(dt, halfLife);
  for (const [name, value] of current) {
    const next = value + ((target.get(name) ?? 0) - value) * k;
    if (next < 1e-3 && !target.has(name)) current.delete(name);
    else current.set(name, next);
  }
  for (const [name, value] of target) if (!current.has(name)) current.set(name, value * k);
}

/** Générateur mulberry32 du visage: clignements différents d'un personnage à l'autre, rejouables. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Le visage: une expression à la fois (neutre par défaut), le clignement, la bouche du babil.
 * Les cibles livrées ne se cumulent pas (README des pièces): la bouche passe devant l'expression,
 * le clignement ne joue que sur un visage neutre.
 */
export class Face {
  private readonly random: () => number;
  private held: string | null = null;
  private event: string | null = null;
  private eventLeft = 0;
  private talkLeft = 0;
  private talkTime = 0;
  private blinkIn: number;
  private blinkAt = -1;
  private shown: string | null = null;
  private weight = 0;
  /** Poids de chaque cible pour cette image. */
  readonly influences = new Map<string, number>();

  constructor(
    seed: number,
    private readonly settings: CharacterSettings = CHARACTER_SETTINGS,
  ) {
    this.random = random(seed);
    this.blinkIn = this.gap();
  }

  private gap(): number {
    const b = this.settings.blink;
    return b.minGap + (b.maxGap - b.minGap) * this.random();
  }

  /** Expression tenue par l'état (`null`: neutre). */
  hold(expression: string | null): void {
    this.held = expression;
  }

  /** Expression d'un événement, pour `seconds`. */
  show(expression: string, seconds: number): void {
    this.event = expression;
    this.eventLeft = seconds;
  }

  /** Une page de babil: la bouche bouge pendant `seconds`. */
  talk(seconds: number = this.settings.talk.seconds): void {
    this.talkLeft = seconds;
  }

  /** Expression affichée (hors bouche et clignement). */
  expression(): string | null {
    return this.eventLeft > 0 ? this.event : this.held;
  }

  update(dt: number): ReadonlyMap<string, number> {
    this.influences.clear();
    this.eventLeft = Math.max(0, this.eventLeft - dt);
    const wanted = this.expression();
    const k = approach(dt, this.settings.expressionHalfLife);
    if (wanted !== this.shown) {
      // On referme l'ancienne avant d'ouvrir la nouvelle: jamais deux cibles pleines ensemble.
      this.weight -= this.weight * k + dt * 4;
      if (this.weight <= 0.02) {
        this.weight = 0;
        this.shown = wanted;
      }
    } else if (wanted !== null) this.weight += (1 - this.weight) * k;
    if (this.talkLeft > 0) {
      this.talkLeft = Math.max(0, this.talkLeft - dt);
      this.talkTime += dt;
      const open = 0.5 - 0.5 * Math.cos(this.talkTime * this.settings.talk.hertz * Math.PI * 2);
      this.influences.set('talk', open * Math.min(1, this.talkLeft * 6));
      return this.influences;
    }
    this.talkTime = 0;
    if (this.shown !== null && this.weight > 0) this.influences.set(this.shown, this.weight);
    if (this.shown === null) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0 && this.blinkAt < 0) this.blinkAt = 0;
      if (this.blinkAt >= 0) {
        this.blinkAt += dt;
        const t = this.blinkAt / this.settings.blink.seconds;
        if (t >= 1) {
          this.blinkAt = -1;
          this.blinkIn = this.gap();
        } else this.influences.set('blink', Math.sin(Math.PI * t));
      }
    }
    return this.influences;
  }
}
