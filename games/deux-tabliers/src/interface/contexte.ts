// Ce que les panneaux et les écrans reçoivent de l'interface: modèle, envoi d'actions, joueurs.
import type { PlayerColorId } from '@duo/sdk';
import type { UiAction } from './actions';
import type { Layers } from './calques';
import type { InterfaceModel } from './modele';
import type { SettingsStore } from './reglages';

export interface Person {
  readonly name: string;
  readonly color: PlayerColorId;
}

export interface UiContext {
  model(): InterfaceModel;
  send(action: UiAction): void;
  readonly me: Person;
  readonly partner: Person;
  /** Prénom de l'hôte (« Seulement chez Camille » pour la radio). */
  readonly hostName: string;
  readonly settings: SettingsStore;
  readonly layers: Layers;
  /** Largeur sur hauteur de la vue (champ de vision horizontal). */
  aspect(): number;
  openTablet(section?: TabletSection): void;
  openSlate(): void;
  openProposal(id: string): void;
  /** Rouvre le bilan du soir (tablette, section Bilans). */
  openEvening(): void;
}

export type TabletSection =
  | 'home'
  | 'orders'
  | 'catalogue'
  | 'menu'
  | 'discounts'
  | 'marketing'
  | 'reports'
  | 'projects'
  | 'settings';
