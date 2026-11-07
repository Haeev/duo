// Domaine « amenagement » de l'état partagé (aménagement: catalogue, achat, placement libre, contraintes, port à deux).
// Sérialisé dans les sauvegardes et envoyé à l'invité quand il change (canal du domaine).
// Toute évolution du format: monter WORLD_FORMAT (etat/monde.ts) et écrire la migration.
import { v } from '@duo/sdk';

export const ArrangementStateSchema = v.strictObject({
  /** Prochain numéro de meuble acheté (chantier aménagement). */
  nextFurnitureId: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ArrangementState = v.InferOutput<typeof ArrangementStateSchema>;

export function createArrangementState(): ArrangementState {
  return { nextFurnitureId: 0 };
}
