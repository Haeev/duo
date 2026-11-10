/** Personnages assemblés (lot L6): ce que le moteur et les pages d'essai importent. */
import type { GameView } from '../../session';
import type { CharacterLayerFactory } from '../bonshommes';
import { loadCharacterLibrary } from './chargement';
import { assembledCharacters } from './couche';

export { AssembledCharacters, assembledCharacters } from './couche';
export { CharacterLibrary, assemble, createRig } from './assemblage';
export { composeLook, defaultPlayerLook, resolveLook } from './apparence';
export { loadCharacterLibrary } from './chargement';
export { CHARACTER_SETTINGS } from './reglages';

/** La couche du jeu: GLB du catalogue chargés au lancement, bonshommes provisoires en attendant. */
export function gameCharacters(view: Pick<GameView, 'content' | 'onEvent'>): CharacterLayerFactory {
  return assembledCharacters({
    view,
    library: () => loadCharacterLibrary(view.content.catalogue, view.content.morphologies),
  });
}
