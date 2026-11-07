/**
 * Ce que l'interface demande quand un joueur agit dans un panneau ou un écran. L'interface ne
 * modifie jamais le monde: chaque action part vers `send`, que `main.ts` traduit en intention
 * (`Intent`) pour l'hôte par `toIntent` (adaptateur.ts). Les actions `local-*` ne quittent pas
 * cette machine (réglages par joueur, compteur d'images).
 */
import type { NightChoice } from './modele';

export type UiAction =
  // Première fois (CC02 à CC04)
  | { readonly type: 'house-name'; readonly name: string }
  | { readonly type: 'house-editing'; readonly editing: boolean }
  | { readonly type: 'house-ready'; readonly ready: boolean }
  | { readonly type: 'avatar'; readonly firstName: string; readonly look: number }
  // Matin, ouverture, fermeture
  | { readonly type: 'morning-start' }
  | { readonly type: 'proposal-answer'; readonly id: string; readonly accept: boolean }
  | { readonly type: 'proposal-withdraw'; readonly id: string }
  // Ardoise (CC08)
  | { readonly type: 'slate-write'; readonly recipe: string }
  | { readonly type: 'slate-erase'; readonly recipe: string }
  | { readonly type: 'slate-price'; readonly recipe: string; readonly priceCents: number }
  | { readonly type: 'slate-star'; readonly recipe: string; readonly star: boolean }
  | { readonly type: 'slate-word'; readonly text: string }
  | { readonly type: 'slate-hold'; readonly recipe: string | null }
  // Tablette
  | {
      readonly type: 'order-quantity';
      readonly supplier: string;
      readonly product: string;
      readonly quantity: number;
    }
  | { readonly type: 'order-usual' }
  | { readonly type: 'order-send' }
  | { readonly type: 'buy'; readonly item: string }
  | { readonly type: 'propose-buy'; readonly item: string }
  | { readonly type: 'project-pin'; readonly project: string; readonly pinned: boolean }
  | {
      readonly type: 'duo-setting';
      readonly key: 'pace' | 'crowd' | 'radio';
      readonly value: string;
    }
  /** Où est ce joueur dans l'interface, pour la carte de l'autre (« Sur la tablette : catalogue »). */
  | { readonly type: 'ui-place'; readonly place: string | null }
  // Bilan, nuit, fin
  | { readonly type: 'evening-page'; readonly page: number }
  | { readonly type: 'evening-choice'; readonly goodNight: boolean }
  | { readonly type: 'night-choice'; readonly choice: NightChoice }
  | { readonly type: 'demo-end'; readonly stay: boolean }
  // Dialogues et scènes
  | { readonly type: 'dialogue-next'; readonly id: string }
  | { readonly type: 'dialogue-answer'; readonly id: string; readonly answer: number }
  | { readonly type: 'scene-dismiss'; readonly id: string };

export type UiActionType = UiAction['type'];
