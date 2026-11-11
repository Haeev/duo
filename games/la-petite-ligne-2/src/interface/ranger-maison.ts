/**
 * « Ranger à la maison » (bouton du Sac): modèle de vue pur. Un objet qui déclare sa fiche de
 * meuble (champ `prop`) quitte le sac pour l'inventaire du logement où l'on se tient (intention
 * `furniture_stow`); ailleurs, le bouton reste montré, éteint, avec sa raison écrite.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import { housingAt } from '../simulation/logement/etat';
import { fill, TEXTS } from './textes';

export type StowModel =
  | { readonly kind: 'none' }
  | { readonly kind: 'ready'; readonly housing: string; readonly prop: string }
  | { readonly kind: 'refused'; readonly text: string };

/** Ce que le bouton fait pour l'objet de la case choisie, selon l'endroit où se tient le joueur. */
export function stowModel(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
  itemId: string,
): StowModel {
  const prop = content.items[itemId]?.prop;
  if (prop === undefined || content.props[prop]?.placeable !== true) return { kind: 'none' };
  const place = content.places[world.common.place];
  const state = world.places[world.common.place];
  const { x, y } = world.players[player].body;
  const home = place === undefined || state === undefined ? null : housingAt(place, state, x, y);
  if (home === null) return { kind: 'refused', text: TEXTS.notebook.stowNotHome };
  return { kind: 'ready', housing: home.id, prop };
}

/** Message de succès après `furniture_stowed`. */
export function stowedText(content: Content, prop: string): string {
  return fill(TEXTS.notebook.stowDone, { meuble: content.props[prop]?.name ?? prop });
}
