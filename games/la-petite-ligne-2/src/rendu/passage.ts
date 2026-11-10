/**
 * Fondu d'un passage (porte, replacement): quand le joueur local est déplacé d'un coup, l'image
 * garde un instant ce qu'elle montrait et s'éteint, la vue est reposée au noir, puis elle revient.
 * Aucun glissement n'est donc visible, chez l'hôte comme chez l'invité: le fondu ne lit que la
 * position affichée, pas le réseau. Logique pure, testée sans WebGL.
 */
import { RENDER_SETTINGS } from './reglages';

export type PassageSettings = typeof RENDER_SETTINGS.passage;

/** Ce que le moteur fait de l'image en cours. */
export interface PassageStep {
  /** Exposition de 0 (noir) à 1. */
  readonly exposure: number;
  /** Vrai: redessiner la vue d'avant le saut sans rien mettre à jour (le noir tombe dessus). */
  readonly hold: boolean;
  /** Vrai: au noir, c'est l'image où la caméra et les personnages se posent d'un coup. */
  readonly cut: boolean;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Le corps a-t-il été déplacé d'un coup entre deux images ? (une marche ne fait jamais autant) */
export function jumped(
  from: { readonly x: number; readonly y: number } | null,
  to: { readonly x: number; readonly y: number },
  settings: PassageSettings = RENDER_SETTINGS.passage,
): boolean {
  return from !== null && Math.hypot(to.x - from.x, to.y - from.y) > settings.jumpMeters;
}

export class PassageFade {
  private phase: 'idle' | 'closing' | 'opening' = 'idle';
  private exposure = 1;
  private readonly step: Mutable<PassageStep> = { exposure: 1, hold: false, cut: false };

  constructor(private readonly settings: PassageSettings = RENDER_SETTINGS.passage) {}

  /** Le lieu change, la scène du train commence: plus rien à fondre. */
  reset(): void {
    this.phase = 'idle';
    this.exposure = 1;
  }

  /** Une image: `jump`, le joueur local vient d'être déplacé d'un coup. */
  update(dt: number, jump: boolean): PassageStep {
    const s = this.settings;
    const out = this.step;
    out.cut = false;
    // Un second saut pendant le retour de l'image: on repart au noir depuis là où l'on en est.
    if (jump && this.phase !== 'closing') this.phase = 'closing';
    else if (this.phase === 'closing') {
      this.exposure -= dt / Math.max(1e-3, s.outSeconds);
      if (this.exposure <= 0) {
        this.exposure = 0;
        this.phase = 'opening';
        out.cut = true;
      }
    } else if (this.phase === 'opening') {
      this.exposure += dt / Math.max(1e-3, s.inSeconds);
      if (this.exposure >= 1) {
        this.exposure = 1;
        this.phase = 'idle';
      }
    }
    out.exposure = this.exposure;
    out.hold = this.phase === 'closing';
    return out;
  }
}
