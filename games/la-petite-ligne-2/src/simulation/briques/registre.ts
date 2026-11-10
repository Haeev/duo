/**
 * Registre des briques: pour chaque brique des données, le comportement qui la fait vivre. Le
 * moteur ne connaît aucun meuble: il lit les briques du meuble visé et appelle leur comportement.
 * Un contenu nouveau (une chaise) ne touche donc jamais ce dossier; seule une brique nouvelle le fait.
 */
import type { Brick, BrickId } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { BrickStates } from '../../etat/briques';
import type { SimContext } from '../noyau/systemes';

/** Le meuble visé: son instance, la brique déclarée dans ses données et l'état de ses briques. */
export interface BrickTarget<B extends Brick = Brick> {
  readonly id: string;
  readonly params: B;
  readonly states: BrickStates;
}

export interface BrickBehaviour<B extends Brick = Brick> {
  /** Verbe de la bulle d'action quand la brique n'en porte pas dans ses données. */
  readonly verb: string;
  /** Clé de texte du refus, ou `null` si la brique peut servir à ce joueur maintenant. */
  refuse(sim: SimContext, player: PlayerIndex, target: BrickTarget<B>): string | null;
  /** La brique sert: effet sur l'état (à la fin du geste pour un geste court). */
  use(sim: SimContext, player: PlayerIndex, target: BrickTarget<B>): void;
}

export type BrickRegistry = {
  readonly [K in BrickId]?: BrickBehaviour<Extract<Brick, { brick: K }>>;
};

/**
 * Comportements livrés. Vide au socle: les lots L2 (gather, open, sit, sleep) et L3 (relieve,
 * store) y inscrivent les leurs, chacun dans son fichier de ce dossier; shop, cook et repair
 * arrivent au jalon 2. Une brique déclarée sans comportement est simplement inerte.
 */
export const BRICK_BEHAVIOURS: BrickRegistry = {};
