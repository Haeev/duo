/**
 * Système « basse-cour »: chaque matin, les abris du lieu vivent leur journée (rattrapage des
 * jours passés ailleurs compris); les gestes de l'écran de l'abri arrivent en intentions.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { buy, collect, fill, pet, rename } from './abri';
import { liveShelters } from './journee';

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  let refusal: string | null;
  if (intent.type === 'shelter_fill') refusal = fill(sim, player, intent.target);
  else if (intent.type === 'shelter_collect') refusal = collect(sim, player, intent.target);
  else if (intent.type === 'animal_pet') refusal = pet(sim, player, intent.target, intent.animal);
  else if (intent.type === 'animal_buy') refusal = buy(sim, player, intent.target);
  else if (intent.type === 'animal_rename')
    refusal = rename(sim, intent.target, intent.animal, intent.name);
  else return;
  if (refusal !== null)
    sim.emit({ type: 'refused', player, reason: refusal, target: intent.target });
}

export const farmSystem: GameSystem = { id: 'elevage', step: liveShelters, intent: onIntent };
