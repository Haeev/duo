/**
 * Système « outils » (lot outils et cultures): intentions de la forge. Les gestes eux-mêmes sont
 * des briques (`harvest` ici, `field` dans `cultures/`), lancées par la touche d'action du noyau
 * et inscrites au registre par `briques.ts`.
 */
import type { GameSystem } from '../noyau/systemes';
import { forgeTool } from './forge';

export const toolSystem: GameSystem = {
  id: 'outils',
  intent(sim, player, intent) {
    if (intent.type !== 'tool_upgrade' && intent.type !== 'tool_repair_paid') return;
    const job = intent.type === 'tool_upgrade' ? 'upgrade' : 'repair';
    const refusal = forgeTool(sim, player, intent.target, intent.slot, job);
    if (refusal !== null)
      sim.emit({ type: 'refused', player, reason: refusal, target: intent.target });
  },
};
