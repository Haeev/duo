/**
 * Points d'extension de la simulation. Chaque lot expose un `GameSystem` depuis l'`index.ts` de
 * son dossier; la liste `SYSTEMS` est déjà branchée: un lot n'édite que son dossier.
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Slice, WorldState } from '../../etat/monde';
import { needsSystem } from '../besoins/index';
import { fishingSystem } from '../peche/index';
import { brickSystem } from '../briques/index';
import { shopSystem } from '../commerces/index';
import { cookingSystem } from '../cuisine/index';
import { dialogueSystem } from '../dialogues/index';
import { cropSystem } from '../cultures/index';
import { toolSystem } from '../outils/index';
import { villagerSystem } from '../habitants/index';
import { questSystem } from '../quetes/index';
import { collectionSystem } from '../collections/index';
import { worldTimeSystem } from '../monde/index';
import { housingSystem } from '../logement/index';
import { placeSystem } from '../lieux/index';
import { bagSystem } from '../sac/index';
import { sceneSystem } from '../scenes/index';
import { travelSystem } from '../voyage/index';
import { farmSystem } from '../elevage/index';
import type { Intent, StepInput } from './entrees';
import type { GameEvent } from './evenements';

/** Ce que reçoit un système à chaque pas, chez l'hôte seulement. */
export interface SimContext {
  readonly world: WorldState;
  readonly content: Content;
  /** Durée d'un pas, en secondes. */
  readonly dt: number;
  /** Aléa à graine (jamais `Math.random`). */
  readonly random: RandomSource;
  /** Commandes du pas de chaque joueur. */
  readonly inputs: readonly [StepInput, StepInput];
  emit(event: GameEvent): void;
  /** Événements déjà émis pendant ce pas (un système placé après les autres peut y réagir). */
  readonly events?: readonly GameEvent[];
  /**
   * À appeler après toute écriture dans une tranche lente: elle repart alors vers l'invité.
   * Les champs du canal rapide (`body`, `needs`, `minutes`) n'en ont pas besoin.
   */
  touch(slice: Slice): void;
}

export interface GameSystem {
  readonly id: string;
  /** Un pas de simulation, après les intentions du pas. */
  step?(sim: SimContext): void;
  /** Intention reçue: le système traite les siennes et ignore les autres. */
  intent?(sim: SimContext, player: PlayerIndex, intent: Intent): void;
}

/** Ordre d'exécution à chaque pas. */
export const SYSTEMS: readonly GameSystem[] = [
  travelSystem,
  placeSystem,
  brickSystem,
  bagSystem,
  shopSystem,
  needsSystem,
  dialogueSystem,
  toolSystem,
  cropSystem,
  villagerSystem,
  questSystem,
  sceneSystem,
  cookingSystem,
  worldTimeSystem,
  collectionSystem,
  housingSystem,
  fishingSystem,
  farmSystem,
];
