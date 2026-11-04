/**
 * Gestes des personnages: le clip de `personnages.glb` joué pour chaque action de la simulation
 * (module sans Three.js, vérifié contre le fichier de l'artiste par `gestes.test.ts`).
 */
import type { ActionKind } from '../etat/types';

/** Animation jouée pour chaque action de la simulation. */
export const CLIP_FOR_ACTION: Readonly<Record<ActionKind, string>> = {
  idle: 'idle',
  walk: 'walk',
  carry: 'carry_two',
  till: 'hoe',
  sow: 'sow',
  water: 'water',
  harvest: 'harvest',
  chop: 'chop',
  saw: 'saw',
  hammer: 'hammer',
  talk: 'talk',
  sit: 'sit',
  eat: 'eat',
  sleep: 'sleep',
  // Clips de la 0.12: la droite remue, la gauche tient la casserole.
  cook: 'cook',
  // Grain jeté bas depuis un sac à la hanche; ramasser au sol et remonter l'objet à la poitrine.
  feed: 'feed',
  pickup: 'pickup',
  // Remplir l'arrosoir: le bras tendu tient l'arrosoir sous le bec et y reste (`water` le vidait).
  refill: 'give',
  // Tour 9 (les lanternes): la perche levée vers la lanterne, puis rabaissée.
  light: 'pole_raise',
  // 0.13 (lot H7): gestes avec le décor, un clip existant par famille.
  decor_lean: 'pickup',
  decor_tap: 'hammer_tap',
  decor_crank: 'crank_turn',
  decor_offer: 'give',
  decor_look: 'look_up',
  decor_reach: 'reach_up',
  decor_pet: 'pet',
  decor_wave: 'wave',
  decor_drink: 'drink',
  decor_sit: 'sit_ground',
};
