import { performance } from 'node:perf_hooks';

/** Annule un minuteur. Sans effet s'il a déjà sonné. */
export type CancelTimer = () => void;

/**
 * Horloge monotone et minuteurs, injectés partout: le cœur du réseau ne lit jamais
 * l'heure ni `setTimeout` directement, pour que les tests tournent en temps simulé.
 */
export interface Clock {
  /** Millisecondes monotones (origine arbitraire). */
  now(): number;
  setTimeout(callback: () => void, delayMs: number): CancelTimer;
}

/** Horloge du système: `performance.now()` et les minuteurs de Node. */
export function createSystemClock(): Clock {
  return {
    now: () => performance.now(),
    setTimeout: (callback, delayMs) => {
      const timer = setTimeout(callback, Math.max(0, delayMs));
      return () => {
        clearTimeout(timer);
      };
    },
  };
}

/** Répète `callback` toutes les `periodMs()` millisecondes (période relue à chaque tour). */
export function every(clock: Clock, periodMs: () => number, callback: () => void): CancelTimer {
  // Le tour suivant est armé avant le rappel: si le rappel annule, c'est lui qui est annulé.
  const state = { cancelled: false, cancelCurrent: (() => undefined) as CancelTimer };
  const arm = (): void => {
    state.cancelCurrent = clock.setTimeout(() => {
      if (state.cancelled) return;
      arm();
      callback();
    }, periodMs());
  };
  arm();
  return () => {
    state.cancelled = true;
    state.cancelCurrent();
  };
}

interface ManualTimer {
  readonly id: number;
  readonly at: number;
  readonly callback: () => void;
}

/**
 * Horloge des tests: le temps n'avance que par `advance`. Les minuteurs sonnent
 * dans l'ordre de leur heure, puis de leur création, ce qui rend chaque scénario
 * reproductible.
 */
export class ManualClock implements Clock {
  private current: number;
  private nextId = 1;
  private timers: ManualTimer[] = [];

  constructor(start = 1000) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  setTimeout(callback: () => void, delayMs: number): CancelTimer {
    const timer: ManualTimer = {
      id: this.nextId++,
      at: this.current + Math.max(0, delayMs),
      callback,
    };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((candidate) => candidate.id !== timer.id);
    };
  }

  /** Avance le temps de `ms` en faisant sonner chaque minuteur échu, à son heure. */
  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      const next = this.earliest();
      if (next === undefined || next.at > target) break;
      this.timers = this.timers.filter((candidate) => candidate.id !== next.id);
      this.current = Math.max(this.current, next.at);
      next.callback();
    }
    this.current = target;
  }

  /** Nombre de minuteurs en attente (contrôle des fuites dans les tests). */
  pending(): number {
    return this.timers.length;
  }

  private earliest(): ManualTimer | undefined {
    let best: ManualTimer | undefined;
    for (const timer of this.timers) {
      if (
        best === undefined ||
        timer.at < best.at ||
        (timer.at === best.at && timer.id < best.id)
      ) {
        best = timer;
      }
    }
    return best;
  }
}
