/**
 * Intentions des joueurs: la seule façon de faire changer le monde.
 *
 * L'interface, les entrées et le rendu (clic au sol) produisent des `Intent`.
 * Chez l'hôte, elles vont directement à la simulation; chez l'invité, elles
 * partent sur le réseau. Dans les deux cas l'hôte les valide (portée, fonds,
 * état) avant de les appliquer: une intention impossible est ignorée ou donne
 * un message au joueur, jamais une erreur.
 */
import type { Cell, CharacterId, ItemId, MenuKind, Quality, RecipeId, VillagerId } from './types';

/** Commandes continues d'un pas (déplacement et action maintenue), après traduction des touches. */
export interface ControlFrame {
  /** Numéro croissant chez le joueur (réconciliation de la prédiction). */
  seq: number;
  /** Direction voulue dans le repère du sol, déjà tournée selon la caméra (-1 à 1). */
  moveX: number;
  moveY: number;
  /** Espace ou clic gauche maintenu (geste à deux, construction). */
  actHeld: boolean;
}

/** Cible d'un clic: une case ou une entité. */
export type ClickTarget =
  | { kind: 'ground'; x: number; y: number }
  | { kind: 'villager'; villager: VillagerId }
  | { kind: 'character'; character: CharacterId }
  | { kind: 'furniture'; furniture: string }
  | { kind: 'ground_item'; groundItem: string }
  | { kind: 'tree'; tree: string };

export type Intent =
  // Écrans titre et de fin, synchronisés entre les deux joueurs
  | { type: 'title_ready'; ready: boolean }
  | { type: 'end_ready'; ready: boolean }
  // Écran d'étape (tour 8): « Rester à la Halte », « Finir la séance », ou revenir sur son choix (`null`)
  | { type: 'stage_choice'; choice: 'stay' | 'finish' | null }
  // Création (PE-01, version démo)
  | { type: 'create_character'; name: string; hair: number; outfit: number }
  // Déplacement à la souris: aller là (et agir si `act`)
  | { type: 'move_to'; target: ClickTarget; act: boolean }
  // Ce que survole la souris (R11): la cible mise en évidence, ou l'aperçu du meuble en main.
  // Envoyée quand la cible change; `null` rend la visée au clavier (souris sortie, Z Q S D).
  | { type: 'point_at'; target: ClickTarget | null }
  // Agir une fois sur ce qui est visé (Espace pressé): la cible survolée, sinon ce qui est devant soi
  | { type: 'act' }
  // Examiner, ou reprendre un meuble posé (X, clic droit)
  | { type: 'examine' }
  // Barre d'outils
  | { type: 'select_slot'; slot: number }
  | { type: 'cycle_slot'; delta: number }
  | { type: 'swap_slots'; from: number; to: number }
  // Aménagement
  | { type: 'rotate_furniture'; delta: number }
  | { type: 'place_furniture'; cell: Cell; rotation: number }
  | { type: 'take_furniture'; furniture: string }
  | { type: 'hold_furniture'; item: ItemId }
  | { type: 'cancel_placement' }
  // Coin à soi (C): le carré de 2x2 cases le plus proche du point visé; au même endroit, le retire
  | { type: 'corner'; x: number; y: number }
  | { type: 'corner_clear' }
  // Menus du jeu (arrêt de l'horloge quand les deux y sont)
  | { type: 'menu'; menu: MenuKind | null }
  // Dialogues et scènes
  | { type: 'dialogue_next' }
  | { type: 'dialogue_choice'; choice: string }
  | { type: 'dialogue_close' }
  // Économie
  | { type: 'buy'; item: ItemId; count: number }
  | { type: 'sell'; item: ItemId; quality: Quality; count: number }
  | { type: 'catalogue_order'; item: ItemId }
  | { type: 'proposal_answer'; proposal: string; accept: boolean }
  | { type: 'proposal_withdraw' }
  | { type: 'crate_deposit'; item: ItemId; quality: Quality; count: number }
  | { type: 'crate_take'; item: ItemId; quality: Quality; count: number }
  | { type: 'chest_deposit'; item: ItemId; quality: Quality; count: number }
  | { type: 'chest_take'; item: ItemId; quality: Quality; count: number }
  // Fabrication, cuisine, repas
  | { type: 'craft'; recipe: RecipeId }
  | { type: 'eat'; item: ItemId }
  // Donner (à l'autre ou à un habitant)
  // `to`: un habitant ou l'autre personnage (`p1`, `p2`).
  | { type: 'give'; to: string; item: ItemId; quality: Quality; count: number }
  // Courrier lu
  | { type: 'read_letter'; letter: string }
  // Journée
  | { type: 'start_day' }
  | { type: 'get_up' }
  | { type: 'night_choice'; choice: 'continue' | 'finish' }
  // Repère (G ou clic molette): une épingle à sa couleur, visible chez les deux (GE-07)
  | { type: 'pin'; x: number; y: number }
  // Astuce vue (l'interface l'a affichée)
  | { type: 'hint_seen'; hint: string };

export type IntentType = Intent['type'];

/** Une intention et son auteur, telle que la simulation la reçoit. */
export interface AuthoredIntent {
  by: CharacterId;
  intent: Intent;
}
