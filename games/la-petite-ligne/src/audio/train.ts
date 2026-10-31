/**
 * Le train du samedi (son.md 3.4), logique pure: horloge des séquences
 * d'arrivée et de départ, calée sur la simulation.
 *
 * La simulation fait entrer le train à 10 h (glissement de `trainSlideSeconds`)
 * et le fait repartir à 16 h. Les séquences du sound designer commencent avant:
 * - arrivée: sifflet et approche, puis l'arrêt (jet de vapeur à 18,3 s) tombe
 *   à la fin du glissement; la séquence démarre donc `18,3 - glissement` s
 *   avant 10 h, comptées sur l'horloge du jeu (elle s'arrête avec elle);
 * - départ: cloche, sifflet de Firmin, sifflet du train; le train s'ébranle à
 *   4,6 s, au moment où la simulation le met en marche à 16 h.
 * Pendant le glissement, la séquence suit la progression du train; à l'arrêt,
 * elle avance en temps réel.
 */
import type { Phase, TrainPhase } from '../etat/types';

export interface TrainRules {
  days: readonly number[];
  arrival: number;
  departure: number;
  firstDay: number;
  secondsPerGameMinute: number;
  slideSeconds: number;
  /** Instant de la séquence d'arrivée où le train s'arrête (s). */
  arrivalStopAt: number;
  /** Instant de la séquence de départ où le train se met en marche (s). */
  departureMoveAt: number;
}

export interface TrainWorld {
  phase: Phase;
  day: number;
  minutes: number;
  train: { phase: TrainPhase; progress: number };
}

export interface TrainTimeline {
  /** Temps de la séquence d'arrivée (s), `Infinity` si elle est passée sans nous (reprise d'une sauvegarde), `null` hors séquence. */
  arrival: number | null;
  departure: number | null;
}

/** Avance de la séquence d'arrivée sur l'entrée du train (s). */
export function arrivalLead(rules: TrainRules): number {
  return Math.max(0, rules.arrivalStopAt - rules.slideSeconds);
}

export class TrainTracker {
  private day = -1;
  private sawArriving = false;
  private sawDeparting = false;
  private stoppedAt: number | null = null;
  private awayAt: number | null = null;
  private readonly out: TrainTimeline = { arrival: null, departure: null };

  constructor(private readonly rules: TrainRules) {}

  /** Horloge des deux séquences à cette image; `now`: temps de jeu (s), pauses exclues. */
  update(world: TrainWorld, now: number): TrainTimeline {
    const r = this.rules;
    if (world.day !== this.day) {
      this.day = world.day;
      this.sawArriving = false;
      this.sawDeparting = false;
      this.stoppedAt = null;
      this.awayAt = null;
    }
    const trainDay = r.days.includes(world.day);
    const spm = r.secondsPerGameMinute;
    const { phase, progress } = world.train;
    this.out.arrival = null;
    this.out.departure = null;
    if (!trainDay || spm <= 0) return this.out;

    // Arrivée (pas le premier jour: le train y est déjà à quai).
    if (world.day !== r.firstDay) {
      const lead = arrivalLead(r);
      const startMinutes = r.arrival - lead / spm;
      switch (phase) {
        case 'away':
          if (!this.sawArriving && world.phase === 'day' && world.minutes >= startMinutes && world.minutes <= r.arrival) {
            this.out.arrival = Math.min(lead, (world.minutes - startMinutes) * spm);
          }
          break;
        case 'arriving':
          this.sawArriving = true;
          this.out.arrival = lead + clamp01(progress) * r.slideSeconds;
          break;
        case 'stopped':
          if (this.sawArriving) {
            this.stoppedAt ??= now;
            this.out.arrival = r.arrivalStopAt + (now - this.stoppedAt);
          } else {
            this.out.arrival = Number.POSITIVE_INFINITY;
          }
          break;
        case 'departing':
          this.out.arrival = Number.POSITIVE_INFINITY;
          break;
      }
    }

    // Départ.
    const depLead = r.departureMoveAt;
    const depStart = r.departure - depLead / spm;
    switch (phase) {
      case 'stopped':
        if (world.minutes >= depStart) this.out.departure = Math.min(depLead, (world.minutes - depStart) * spm);
        break;
      case 'departing':
        this.sawDeparting = true;
        this.out.departure = depLead + (1 - clamp01(progress)) * r.slideSeconds;
        break;
      case 'away':
        if (this.sawDeparting) {
          this.awayAt ??= now;
          this.out.departure = depLead + r.slideSeconds + (now - this.awayAt);
        }
        break;
      case 'arriving':
        break;
    }
    return this.out;
  }
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** Position de la locomotive au sol, pour placer ses sons. */
export interface TrainGeometry {
  /** Locomotive à l'arrêt. */
  stop: { x: number; y: number };
  slideDistance: number;
  departureDirection: -1 | 1;
  /** Bords de la carte d'où l'on entend un train encore dehors (x). */
  offMapX: number;
  maxX: number;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

function easeIn(t: number): number {
  return t * t * t;
}

/**
 * Où est la locomotive (mêmes courbes que le rendu pour l'entrée), au bord de
 * la carte quand elle est dehors. Après le départ, passer `departing` et 0.
 */
export function locomotivePosition(g: TrainGeometry, phase: TrainPhase, progress: number, out: { x: number; y: number }): { x: number; y: number } {
  const p = clamp01(progress);
  let offset: number;
  switch (phase) {
    case 'away':
      offset = -g.slideDistance;
      break;
    case 'arriving':
      offset = -g.slideDistance * (1 - easeOut(p));
      break;
    case 'stopped':
      offset = 0;
      break;
    case 'departing':
      offset = g.departureDirection * g.slideDistance * easeIn(1 - p);
      break;
  }
  out.x = Math.min(g.maxX, Math.max(g.offMapX, g.stop.x + offset));
  out.y = g.stop.y;
  return out;
}
