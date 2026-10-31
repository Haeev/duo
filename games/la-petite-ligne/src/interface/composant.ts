/**
 * Ce que l'orchestrateur de l'interface (`interface.ts`) offre aux
 * composants, et ce qu'il attend d'une couche (écran, dialogue, panneau).
 */
import type { Intent } from '../etat/actions';
import type { MenuKind, ReadonlyWorld } from '../etat/types';
import type { UiContext } from './contexte';

export type CameraCommand = 'rotate_left' | 'rotate_right' | 'zoom_in' | 'zoom_out';

/** Onglet ou partie d'un panneau à montrer à l'ouverture. */
export type PanelTab = 'quests' | 'mail' | 'bag' | 'buy' | 'sell';

export interface UiHost {
  readonly ctx: UiContext;
  /** Intention du joueur local (la seule façon de changer le monde). */
  send(intent: Intent): void;
  /** Ouvre ou ferme un menu du jeu: affiché aussitôt, confirmé par l'état. */
  setMenu(menu: MenuKind | null, tab?: PanelTab): void;
  /** Redessine au prochain `frame`. */
  invalidate(): void;
  camera(command: CameraCommand): void;
  /** Lecture d'un objet à lire (la carte d'Émile), sans passer par la simulation. */
  read(item: string): void;
  /** Horloge réelle (ms). */
  now(): number;
  /** Symboles des profils Duo des deux joueurs (`orb`, `crescent`...). */
  symbol(player: 'self' | 'other'): string;
}

/** Infos d'une touche reçue. */
export interface KeyInfo {
  shift: boolean;
  repeat: boolean;
  /** Le focus est dans la couche. */
  inside: boolean;
}

/** Une couche qui capte le clavier: écran plein cadre, dialogue ou panneau. */
export interface Layer {
  readonly root: HTMLElement;
  update(world: ReadonlyWorld): void;
  /** Élément à focaliser à l'ouverture (maquettes, section 6). */
  defaultFocus(): HTMLElement | null;
  /** Touche propre à la couche (avant la navigation commune). Vrai si consommée. */
  key?(code: string, info: KeyInfo): boolean;
  /** Retour arrière ferme-t-il la couche ? */
  readonly closable: boolean;
  /** Touche de fermeture propre (Tab pour le carnet), en plus de Retour arrière. */
  readonly closeKey?: string;
  /** Les lettres Z Q S D naviguent-elles (panneaux du jeu) ? */
  readonly letterNavigation: boolean;
  close?(): void;
  dispose?(): void;
}
