/**
 * Intentions du noyau (lot L2). Une intention est une demande ponctuelle d'un joueur, validée
 * par schéma à l'arrivée chez l'hôte; les commandes tenues (marche, action maintenue) passent par
 * `StepInput`. Chaque lot déclare les siennes dans son dossier (`*_INTENTS`), jamais ici.
 */
import * as v from 'valibot';
import { IntSchema, LabelSchema } from '../../donnees/schemas/communs';
import { LookSchema } from '../../donnees/schemas/personnage';

export const CORE_INTENTS = [
  /** Appui sur la touche d'action: le jeu choisit le geste selon la cible et l'outil en main. */
  v.strictObject({ type: v.literal('act') }),
  /** Case de la barre prise en main, `null`: ranger l'outil. */
  v.strictObject({
    type: v.literal('select_slot'),
    slot: v.nullable(v.pipe(IntSchema, v.minValue(0), v.maxValue(9))),
  }),
  /** Validation de l'éditeur de personnage. */
  v.strictObject({ type: v.literal('set_look'), name: LabelSchema, look: LookSchema }),
  /** « Débloquer mon personnage » (menu): replacé sur la case libre la plus proche reliée au quai. */
  v.strictObject({ type: v.literal('unstick') }),
] as const;
