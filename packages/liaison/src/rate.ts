/**
 * Seau à jetons: un débit moyen et une rafale permise. Sert aux plafonds des
 * messages de jeu (reseau.md, section 7.4).
 */
export class TokenBucket {
  private tokens: number;
  private lastAt: number;
  private readonly ratePerSecond: number;
  private readonly burst: number;

  constructor(ratePerSecond: number, burst: number, now: number) {
    this.ratePerSecond = ratePerSecond;
    this.burst = burst;
    this.tokens = burst;
    this.lastAt = now;
  }

  /** Prend `cost` jetons s'il y en a assez; sinon ne prend rien et rend `false`. */
  take(cost: number, now: number): boolean {
    const elapsed = Math.max(0, now - this.lastAt);
    this.lastAt = now;
    this.tokens = Math.min(this.burst, this.tokens + (elapsed / 1000) * this.ratePerSecond);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}
