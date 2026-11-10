/** Intentions des habitants. */
import * as v from 'valibot';
import { IdSchema } from '../../donnees/schemas/communs';

export const VILLAGER_INTENTS = [
  /** Offrir l'objet en main (case choisie de la barre) à cet habitant. */
  v.strictObject({ type: v.literal('give_gift'), villager: IdSchema }),
] as const;
