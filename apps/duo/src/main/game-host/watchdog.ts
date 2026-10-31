// Surveillance d'un jeu (ADR 0004, point 6): battement de cœur du SDK chaque
// seconde; 10 s sans battement au chargement, 5 s en partie: jeu figé.
// 30 s sans `ready`: échec du chargement.

export const WATCHDOG_LIMITS = {
  loadingSilenceMs: 10_000,
  runningSilenceMs: 5_000,
  readyMs: 30_000,
} as const;

export type WatchdogExpiry = 'hung' | 'load-timeout';

export class Watchdog {
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = true;

  constructor(
    private readonly onExpire: (reason: WatchdogExpiry) => void,
    private readonly limits: typeof WATCHDOG_LIMITS = WATCHDOG_LIMITS,
  ) {}

  /** Début du chargement. */
  start(): void {
    this.stop();
    this.stopped = false;
    this.running = false;
    this.armSilence();
    this.readyTimer = setTimeout(() => {
      this.expire('load-timeout');
    }, this.limits.readyMs);
  }

  heartbeat(): void {
    if (!this.stopped) this.armSilence();
  }

  /** Le jeu a signalé `ready`: seuil de partie. */
  ready(): void {
    if (this.stopped) return;
    if (this.readyTimer !== null) clearTimeout(this.readyTimer);
    this.readyTimer = null;
    this.running = true;
    this.armSilence();
  }

  stop(): void {
    this.stopped = true;
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    if (this.readyTimer !== null) clearTimeout(this.readyTimer);
    this.silenceTimer = null;
    this.readyTimer = null;
  }

  private armSilence(): void {
    if (this.silenceTimer !== null) clearTimeout(this.silenceTimer);
    const limit = this.running ? this.limits.runningSilenceMs : this.limits.loadingSilenceMs;
    this.silenceTimer = setTimeout(() => {
      this.expire('hung');
    }, limit);
  }

  private expire(reason: WatchdogExpiry): void {
    if (this.stopped) return;
    this.stop();
    this.onExpire(reason);
  }
}
