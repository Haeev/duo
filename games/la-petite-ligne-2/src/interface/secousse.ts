/**
 * Vibration d'écran des gros coups (cahier 5, CA-14 à 16): quels événements la déclenchent, et
 * si ce joueur la veut. Le rendu ne fait que l'appliquer (`requestCameraShake` de
 * `rendu/camera.ts`); `main.ts` relie les deux.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { GameEvent } from '../simulation/noyau/evenements';

export interface ShakeTriggers {
  /** Récoltes qui font tomber quelque chose de gros (genre de ressource: `chop`, l'arbre abattu). */
  readonly harvestKinds: readonly string[];
  /** Un poisson marqué `big` par la pêche (grande taille ou prise unique). */
  readonly bigFish: boolean;
  /** Durée (s). */
  readonly seconds: number;
}

export const SHAKE_TRIGGERS: ShakeTriggers = {
  harvestKinds: ['chop'],
  bigFish: true,
  seconds: 0.15,
};

/**
 * Durée de vibration que mérite `event` sur la machine du joueur `me`, ou 0. On vibre pour ses
 * propres coups; un gros poisson sorti ensemble (`together`) fait vibrer les deux.
 */
export function shakeSecondsFor(
  content: Content,
  event: GameEvent,
  me: PlayerIndex | null,
  triggers: ShakeTriggers = SHAKE_TRIGGERS,
): number {
  if (me === null) return 0;
  if (event.type === 'harvested' && event.player === me) {
    const kind = content.resources[event.resource]?.kind;
    return kind !== undefined && triggers.harvestKinds.includes(kind) ? triggers.seconds : 0;
  }
  if (event.type === 'fish_caught' && triggers.bigFish && event.big)
    return event.player === me || event.together ? triggers.seconds : 0;
  return 0;
}

/** Le joueur veut-il la vibration ? Réglage allumé, et aucun mouvement réduit (jeu ou système). */
export function shakeWanted(
  settings: { shake: boolean; reducedMotion: boolean },
  systemReduced: boolean,
): boolean {
  return settings.shake && !settings.reducedMotion && !systemReduced;
}
