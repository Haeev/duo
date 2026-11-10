/**
 * Contrat commun des onglets du carnet. Un onglet rend le contenu de ses pages, lit les touches qui
 * le concernent (jamais A, E, Espace, Retour: elles restent au carnet) et dit si son dessin doit
 * être refait (`signature`).
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';

export type TabId = 'quests' | 'villagers' | 'collections' | 'map' | 'outfits' | 'settings';

export interface TabPages {
  /** Page de gauche (sous le jeton et les besoins), ou page unique si `full`. */
  readonly left: readonly (HTMLElement | null)[];
  /** Page de droite; `null` avec `full`. */
  readonly right: readonly (HTMLElement | null)[] | null;
  /** Une seule page pour les deux (carte). */
  readonly full: boolean;
}

export interface TabHint {
  readonly codes: readonly string[];
  readonly label: string;
}

export interface Tab {
  render(world: ReadonlyWorld, local: PlayerIndex): TabPages;
  /** Tout ce qui change le dessin; comparé à l'image précédente. */
  signature(world: ReadonlyWorld, local: PlayerIndex): string;
  /** `true` si la touche est prise par l'onglet. */
  key(code: string, shift: boolean, world: ReadonlyWorld, local: PlayerIndex): boolean;
  /** Touches utiles en pied de page. */
  hints(): readonly TabHint[];
  /** Le carnet se ferme (mémorise ce qui a été vu). */
  closed(world: ReadonlyWorld, local: PlayerIndex): void;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Directions lues par position: Z Q S D (codes W A S D) et flèches. */
export const DIRECTION_KEYS: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
};

/** Touches qui ferment le carnet: C (celle qui l'ouvre) et Retour arrière. */
export const CLOSE_KEYS: readonly string[] = ['KeyC', 'Backspace'];

/**
 * Garde d'ouverture (interface.md, 5.3): seul un second appui immédiat est avalé. Le carnet s'ouvre
 * par C: si la première touche reçue pendant la garde est C ou Retour arrière, elle est avalée, car
 * elle le refermerait aussitôt. A, E, les flèches et les actions passent toujours, et après elles C
 * ferme (geste voulu); sinon C puis E tapés vite menaient au Sac ou aux Quêtes selon le minutage.
 * Le rangement s'ouvre par Espace sur un meuble: toute touche y est avalée pendant la garde, car
 * Espace et Entrée y prennent ou rangent.
 */
export function swallowedAtOpening(
  opened: 'notebook' | 'store',
  code: string,
  sinceOpenMs: number,
  guardMs: number,
  firstKey: boolean,
): boolean {
  if (sinceOpenMs >= guardMs) return false;
  return opened === 'store' || (firstKey && CLOSE_KEYS.includes(code));
}

/** Dépendances que le carnet donne à ses onglets. */
export interface TabDeps {
  /** Redessine l'onglet courant (après un clic ou un changement local). */
  readonly invalidate: () => void;
  /** Passe à un autre onglet. */
  readonly goto: (tab: TabId) => void;
  readonly keyLabel: (code: string) => string;
}
