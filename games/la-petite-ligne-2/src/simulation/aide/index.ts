/**
 * Aide réglable par joueur (cahier 2.4, CA-23). Le cran est un réglage de la machine du joueur
 * (onglet Réglages du carnet, gardé d'une séance à l'autre); elle l'envoie à l'hôte
 * (`set_assist`), qui le range dans l'état du joueur et l'applique. L'autre joueur n'en voit rien
 * à l'écran et n'en est pas affecté: chaque mini-jeu lit le cran du joueur qui joue.
 *
 * Point de branchement unique pour tout mini-jeu: `assistFactor(world, player)` (voir README).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { AssistLevel } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import type { GameSystem } from '../noyau/systemes';
import { ASSIST, type AssistSettings } from './reglages';

export { ASSIST, type AssistSettings } from './reglages';

/** Cran d'aide d'un joueur (« normal » tant que sa machine n'a rien dit). */
export function assistLevelOf(world: ReadonlyWorld, player: PlayerIndex): AssistLevel {
  return world.players[player].assist ?? 'normal';
}

/**
 * Multiplicateur d'aide d'un joueur: 1, 1,25 ou 1,5 (`ASSIST.factor`). Chaque mini-jeu multiplie
 * par lui ses fenêtres de temps et ses tolérances (jamais ses récompenses).
 */
export function assistFactor(
  world: ReadonlyWorld,
  player: PlayerIndex,
  settings: AssistSettings = ASSIST,
): number {
  return settings.factor[assistLevelOf(world, player)];
}

export const assistSystem: GameSystem = {
  id: 'aide',
  intent(sim, player, intent) {
    if (intent.type !== 'set_assist') return;
    const me = sim.world.players[player];
    if ((me.assist ?? 'normal') === intent.level) return;
    me.assist = intent.level;
    sim.touch('players');
  },
};
