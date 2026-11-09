/**
 * Crochets de l'aménagement pour un autre chantier (l'installation de la démo v0.3), branchés au
 * chargement du module qui les fournit: l'aménagement n'importe pas ce chantier (pas de cycle).
 * Sans crochet, l'aménagement se comporte exactement comme avant.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import type { SimContext } from '../simulation/systemes';
import type { Piece } from './etat';

/** Place unique d'un appareil (DE-04): l'aperçu s'y aimante, la pose ailleurs est refusée. */
export interface SpotRule {
  /** Identifiant du meuble posé à cette place (`station-4`...). */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotDeg: number;
  /** Distance au plus, au sol, entre la pose visée et la place pour s'y aimanter. */
  readonly snap: number;
  /** Phrase du refus ailleurs. */
  readonly reason: string;
  /** Un second exemplaire se range avec le premier (vaisselle): rien ne se pose en plus. */
  readonly merge: boolean;
  /** Meubles posés que la pose remplace (la vieille machine qu'on rend à sa propriétaire). */
  readonly replaces: readonly string[];
}

export interface ArrangementHooks {
  spot?(content: Content, world: World, type: string): SpotRule | null;
  /** Pourquoi ce meuble posé ne se prend pas (il n'est pas encore à nous), ou `null`. */
  locked?(content: Content, world: World, furniture: string): string | null;
  /** Un carton s'ouvre (petit: on le prend; gros: on le pose). */
  unpacked?(sim: SimContext, player: PlayerIndex, carton: string, piece: Piece): void;
  /**
   * Une pièce (identifiant d'avant la pose) vient d'être posée à sa place (`merged`: rangée avec
   * la précédente, rien de posé en plus).
   */
  placed?(sim: SimContext, player: PlayerIndex, piece: Piece, merged: boolean): void;
}

let hooks: ArrangementHooks = {};

export function connectArrangementHooks(next: ArrangementHooks): void {
  hooks = next;
}

export function arrangementHooks(): ArrangementHooks {
  return hooks;
}
