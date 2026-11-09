// Ce que les panneaux et les écrans reçoivent de l'interface: modèle, envoi d'actions, joueurs.
import type { PlayerColorId } from '@duo/sdk';
import type { UiAction } from './actions';
import type { Layers } from './calques';
import type { InterfaceModel } from './modele';
import type { SettingsStore } from './reglages';
import type { PhoneState } from './telephone-etat';

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
  /** Pile de navigation, messages et prix préparés du téléphone, gardés entre deux sorties. */
  readonly phone: PhoneState;
  /** Largeur sur hauteur de la vue (champ de vision horizontal). */
  aspect(): number;
  /** Sort le téléphone (ou le garde sorti) sur une appli; sans appli, sur l'écran laissé. */
  openPhone(app?: PhoneApp, thread?: ThreadId): void;
  openSlate(): void;
  /** Message bref au centre de l'écran (« C'est lancé : ... »). */
  flash(text: string): void;
  openProposal(id: string): void;
  /** Rouvre le bilan du soir (téléphone, appli Bilans). */
  openEvening(): void;
}

/** Applis du téléphone, dans l'ordre de l'accueil (ux-telephone 6). */
export type PhoneApp =
  | 'home'
  | 'orders'
  | 'stock'
  | 'catalogue'
  | 'menu'
  | 'discounts'
  | 'marketing'
  | 'reports'
  | 'projects'
  | 'messages'
  | 'settings';

/** Conversations de l'appli Messages (ux-telephone 6.10). */
export type ThreadId = 'partner' | 'simone' | 'suppliers' | 'regulars';
