// Cœur de la boucle à pas fixe, sans DOM ni horloge: le temps lui est donné, ce qui le rend testable dans Node.

export interface FixedStepper {
  /** Durée d'un pas, en millisecondes. */
  readonly stepMs: number;
  /** Ajoute le temps écoulé et renvoie le nombre de pas à exécuter maintenant. */
  advance(elapsedMs: number): number;
  /** Avancement vers le pas suivant, de 0 à 1 (interpolation du rendu). */
  alpha(): number;
  /** Oublie le temps accumulé (reprise après une pause). */
  reset(): void;
}

/**
 * `maxCatchUpSteps` borne le rattrapage après un long gel (onglet en arrière-plan, débogueur):
 * au-delà, le temps est perdu plutôt que de figer la page sous une rafale de pas.
 */
export function createFixedStepper(hz: number, maxCatchUpSteps = Math.ceil(hz / 4)): FixedStepper {
  if (!Number.isFinite(hz) || hz <= 0 || hz > 1000) {
    throw new RangeError(`boucle: fréquence invalide (${hz})`);
  }
  const stepMs = 1000 / hz;
  let accumulator = 0;
  return {
    stepMs,
    advance(elapsedMs) {
      if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
        return 0;
      }
      accumulator += elapsedMs;
      // La petite marge absorbe l'erreur d'arrondi des additions répétées (1000 x 1 ms = 60 pas, pas 59).
      let steps = Math.floor(accumulator / stepMs + 1e-6);
      if (steps > maxCatchUpSteps) {
        steps = maxCatchUpSteps;
        accumulator = 0;
        return steps;
      }
      accumulator = Math.max(0, accumulator - steps * stepMs);
      return steps;
    },
    alpha() {
      return Math.min(1, accumulator / stepMs);
    },
    reset() {
      accumulator = 0;
    },
  };
}
