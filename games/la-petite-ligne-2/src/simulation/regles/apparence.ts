/**
 * Apparence révélée ou non. Tant que le fait `joueurs.apparence.j<n>` n'est pas retenu, le
 * personnage d'un joueur n'a pas de visage: le rendu et l'interface le montrent en silhouette
 * sombre, sans traits ni tenue. L'effet `reveal_look` des données (un dialogue, une étape de
 * quête) le retient; rien ici ne nomme un dialogue ni un lieu.
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld, WorldState } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { recall, remember } from './memoire';
import { RULES } from './reglages';

/** Clé du fait « apparence révélée » d'un joueur. */
export function lookRevealedKey(player: PlayerIndex): string {
  return `${RULES.look.revealedPrefix}.j${String(player)}`;
}

/** Vrai quand le personnage de ce joueur se montre tel qu'il est composé. Pur (hôte et invité). */
export function lookRevealed(world: ReadonlyWorld, player: PlayerIndex): boolean {
  return recall(world, lookRevealedKey(player))?.v === true;
}

/**
 * Ce lieu sait révéler une apparence: un de ses dialogues ou une de ses étapes de quête porte
 * l'effet `reveal_look`. Une partie neuve n'y commence sans visage que dans ce cas: ailleurs
 * (lieux d'essai), personne ne ferait jamais la photo.
 */
export function placeReveals(place: PlaceContent): boolean {
  const reveals = (effects: readonly { readonly type: string }[]): boolean =>
    effects.some((effect) => effect.type === 'reveal_look');
  for (const dialogue of place.dialogues)
    for (const node of Object.values(dialogue.nodes)) {
      if (node.kind === 'effects' && reveals(node.effects)) return true;
      if (node.kind === 'choice' && node.options.some((o) => reveals(o.effects))) return true;
    }
  for (const quest of Object.values(place.quests))
    for (const chapter of quest.chapters)
      for (const step of chapter.steps)
        if (reveals(step.onStart) || reveals(step.onDone)) return true;
  return false;
}

/** Écrit le fait hors d'un pas de simulation (création de la partie). */
export function markLookRevealed(world: WorldState, player: PlayerIndex): void {
  world.progress.memory[lookRevealedKey(player)] = { v: true, by: player, day: world.common.day };
}

/** Révèle l'apparence d'un joueur (tranche « progression »: l'autre machine le voit aussi). */
export function revealLook(sim: SimContext, player: PlayerIndex): void {
  if (!lookRevealed(sim.world, player)) remember(sim, lookRevealedKey(player), true, player);
}
