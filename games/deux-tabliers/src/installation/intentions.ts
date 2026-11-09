// Intentions du chantier « installation » (démo v0.3). L'hôte revérifie tout (point visé encore
// valable, portée, outil en main, propriété): une intention n'est qu'une demande.
import { v } from '@duo/sdk';

export const INSTALLATION_INTENTS = [
  /**
   * Agir sur un point de l'installation (`installSpots`): rideau, drap, courrier, outil, tache,
   * vitre, achat à Simone, chaises, raccord, carton à rendre. Un geste à maintien lit ensuite
   * « Agir tenu » dans les entrées du joueur.
   */
  v.strictObject({
    type: v.literal('installation-act'),
    spot: v.pipe(v.string(), v.maxLength(60)),
  }),
] as const;
