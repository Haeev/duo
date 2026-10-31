/**
 * Contexte commun des modèles et des composants de l'interface: contenu,
 * carte, textes, joueur local, libellés des touches.
 */
import type { Content } from '../donnees/types';
import type { GameMap } from '../etat/carte';
import type { CharacterId, ReadonlyWorld } from '../etat/types';
import { fill, type TextVars } from './format';
import type { UiTexts } from './textes';
import { typographier } from './typographie';

export interface UiContext {
  readonly content: Content;
  readonly map: GameMap;
  readonly texts: UiTexts;
  /** Personnage de cette machine, et l'autre. */
  readonly me: CharacterId;
  readonly partner: CharacterId;
  /** Libellé réel d'une touche (`KeyW` donne « Z » sur un clavier AZERTY). */
  key(code: string): string;
  /** Gabarit rempli et mis en typographie française, prêt à afficher. */
  t(template: string, vars?: TextVars): string;
}

export function createUiContext(
  content: Content,
  map: GameMap,
  texts: UiTexts,
  me: CharacterId,
  keyLabel: (code: string) => string,
): UiContext {
  return {
    content,
    map,
    texts,
    me,
    partner: me === 'p1' ? 'p2' : 'p1',
    key: keyLabel,
    t: (template, vars) => typographier(fill(template, vars)),
  };
}

export type ReadonlyCharacter = ReadonlyWorld['characters'][number];

/** Le personnage demandé (l'état en contient toujours deux). */
export function characterOf(world: ReadonlyWorld, id: CharacterId): ReadonlyCharacter | null {
  return world.characters.find((c) => c.id === id) ?? null;
}

/** Prénom affichable d'un personnage. */
export function nameOf(world: ReadonlyWorld, id: CharacterId): string {
  return characterOf(world, id)?.name ?? '';
}
