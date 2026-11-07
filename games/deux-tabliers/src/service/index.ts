/**
 * Chantier « service »: postes et gestes, commandes, tickets, service, plonge.
 * Point d'entrée branché dans `simulation/chantiers.ts`; voir README.md du jeu.
 */
import type { Chantier } from '../simulation/systemes';

export const serviceChantier: Chantier = {
  id: 'service',
  system: { id: 'service' },
};
