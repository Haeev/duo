/**
 * Chantier « clientele »: clients, attrait de l'ardoise, journée et semaine, économie, bilan, livre d'or, événements.
 * Point d'entrée branché dans `simulation/chantiers.ts`; voir README.md du jeu.
 */
import type { Chantier } from '../simulation/systemes';

export const clienteleChantier: Chantier = {
  id: 'clientele',
  system: { id: 'clientele' },
};
