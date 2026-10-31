// Surveillance d'un jeu (ADR 0004, point 6, amendé le 2026-10-31): battement de
// cœur du SDK chaque seconde; 30 s sans battement au chargement, 8 s en partie
// (F05: retour au salon en 10 s au plus): jeu figé. 90 s sans `ready`: échec du chargement. Seuils larges, car une
// compilation de shaders sur un graphique intégré peut bloquer plusieurs secondes.

export const WATCHDOG_LIMITS = {
  loadingSilenceMs: 30_000,
  runningSilenceMs: 8_000,
  readyMs: 90_000,
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
