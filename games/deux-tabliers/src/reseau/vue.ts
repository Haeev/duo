// Ce que l'interface, le rendu, le son et les robots lisent, chez l'hôte comme chez l'invité.
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { GameEvent } from '../simulation/evenements';

export interface Pose {
  x: number;
  z: number;
  yawDeg: number;
  pitchDeg: number;
}

export interface GameView {
  readonly content: Content;
  /** Index du joueur de cette machine (0 chez l'hôte, 1 chez l'invité). */
  readonly local: PlayerIndex;
  /** Monde à afficher (chez l'invité: dernier état reçu, son avatar prédit). */
  world(): World;
  /** Pose affichée d'un joueur pour l'image en cours (interpolée, prédite et lissée). */
  pose(player: PlayerIndex): Pose;
  /** Événements de la simulation, sur les deux machines. */
  onEvent(listener: (event: GameEvent) => void): () => void;
}

export interface EventHub {
  emit(event: GameEvent): void;
  on(listener: (event: GameEvent) => void): () => void;
}

export function createEventHub(): EventHub {
  const listeners = new Set<(event: GameEvent) => void>();
  return {
    emit(event) {
      for (const l of listeners) l(event);
    },
    on(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
