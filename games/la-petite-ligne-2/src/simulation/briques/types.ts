/**
 * Contrat d'une action de la touche d'action. Une cible est toujours un objet visible: un meuble
 * (ses briques), un objet posé au sol, un habitant. Chaque action tient dans un fichier de ce
 * dossier et s'inscrit dans `registre.ts`.
 */
import type { Content } from '../../donnees/charger';
import type { Brick, BrickId } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { BrickStates } from '../../etat/briques';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';

/**
 * Ce que lit un contrôle (`refuse`) ou la visée: l'état transmis et le contenu, rien d'autre.
 * L'invité peut donc évaluer la même cible que l'hôte pour prédire son geste (ADR 0020).
 * Un `SimContext` convient aussi.
 */
export interface Look {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** Geste court joué avant l'effet (1,5 s au plus, validé par les données). */
export interface GestureSpec {
  readonly clip: string;
  readonly seconds: number;
}

/** Le meuble visé: son instance, la brique déclarée dans ses données et l'état de ses briques. */
export interface BrickTarget<B extends Brick = Brick, S = BrickStates> {
  readonly id: string;
  /** Type du meuble (`donnees/commun/meubles/<type>.json`). */
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: 0 | 1 | 2 | 3;
  readonly params: B;
  readonly states: S;
}
export type BrickView<B extends Brick = Brick> = BrickTarget<B, DeepReadonly<BrickStates>>;

export interface BrickBehaviour<B extends Brick = Brick> {
  /** Verbe de la bulle d'action quand la brique n'en porte pas dans ses données. */
  readonly verb: string;
  /** Geste joué avant l'effet; absent ou `null`: l'effet est immédiat. */
  gesture?(look: Look, player: PlayerIndex, target: BrickView<B>): GestureSpec | null;
  /** Clé de texte du refus, ou `null` si la brique peut servir à ce joueur maintenant. Pur. */
  refuse(look: Look, player: PlayerIndex, target: BrickView<B>): string | null;
  /** La brique sert: effet sur l'état (à la fin du geste s'il y en a un). */
  use(sim: SimContext, player: PlayerIndex, target: BrickTarget<B>): void;
}

export type BrickRegistry = {
  readonly [K in BrickId]?: BrickBehaviour<Extract<Brick, { brick: K }>>;
};

/** Actions sur ce qui n'est pas un meuble: objet au sol, habitant. */
export interface EntityBehaviour {
  readonly verb: string;
  gesture?(look: Look, player: PlayerIndex, id: string): GestureSpec | null;
  refuse(look: Look, player: PlayerIndex, id: string): string | null;
  use(sim: SimContext, player: PlayerIndex, id: string): void;
}

export type AimKind = 'prop' | 'ground' | 'villager';
export type ActionId = BrickId | 'pickup' | 'talk';

/** La cible de la touche d'action d'un joueur et ce que fera l'appui. */
export interface Aim {
  readonly kind: AimKind;
  /** Identifiant dans l'état: instance de meuble, habitant, ou `sol-<n>` pour un objet au sol. */
  readonly id: string;
  readonly action: ActionId;
  /** Un seul verbe, à montrer avant l'appui. */
  readonly verb: string;
  /** Clé de texte de ce qui manque; `null`: l'appui agit. */
  readonly refusal: string | null;
  /** Point visé (m), pour la bulle et le cap du personnage. */
  readonly x: number;
  readonly y: number;
}
