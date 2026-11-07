/**
 * Chantier « amenagement »: aménagement: catalogue, achat, placement libre, contraintes, port à deux.
 * Point d'entrée branché dans `simulation/chantiers.ts`; voir README.md du jeu.
 */
import type { Chantier } from '../simulation/systemes';

export const amenagementChantier: Chantier = {
  id: 'amenagement',
  system: { id: 'amenagement' },
};
