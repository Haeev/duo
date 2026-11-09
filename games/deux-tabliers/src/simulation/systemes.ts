/**
 * Points d'extension de la simulation. Chaque chantier expose un `Chantier` depuis son
 * `index.ts`; la liste `CHANTIERS` est déjà branchée: un chantier n'édite que son dossier.
 */
import type { RandomSource } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { Intent, StepInput } from './entrees';
import type { GameEvent } from './evenements';

/** Ce que reçoit un système à chaque pas, chez l'hôte seulement. */
export interface SimContext {
  readonly world: World;
  readonly content: Content;
  /** Durée d'un pas, en secondes. */
  readonly dt: number;
  /** Aléa à graine du SDK (jamais `Math.random`). */
  readonly random: RandomSource;
  /** Entrées du pas de chaque joueur (après prédiction des entrées en retard de l'invité). */
  readonly inputs: readonly [StepInput, StepInput];
  emit(event: GameEvent): void;
}

/** Comportement d'un poste au-delà de la transformation décrite dans `postes.json`. */
export interface StationHandler {
  /** Refus éventuel avant usage (« Il manque le café moulu »), `null` si le poste peut servir. */
  refuse?(sim: SimContext, player: PlayerIndex, furniture: string): string | null;
  /** Fin de l'usage (clic, ou maintien mené à son terme), après la transformation des données. */
  complete?(sim: SimContext, player: PlayerIndex, furniture: string): void;
}

export interface GameSystem {
  readonly id: string;
  /** Un pas de simulation, après les déplacements et les intentions du pas. */
  step?(sim: SimContext): void;
  /** Intention propre au chantier (types déclarés dans son `intentions.ts`). */
  intent?(sim: SimContext, player: PlayerIndex, intent: Intent): void;
}

export interface Chantier {
  readonly id: 'service' | 'clientele' | 'branchement' | 'amenagement' | 'installation';
  readonly system: GameSystem;
  /** Postes pris en charge, par identifiant de `postes.json`. */
  readonly stations?: Readonly<Record<string, StationHandler>>;
}
