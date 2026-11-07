// Domaine « clientele » de l'état partagé (clients, attrait de l'ardoise, journée et semaine, économie, bilan, livre d'or, événements).
// Sérialisé dans les sauvegardes et envoyé à l'invité quand il change (canal du domaine).
// Toute évolution du format: monter WORLD_FORMAT (etat/monde.ts) et écrire la migration.
import { v } from '@duo/sdk';

export const ClienteleStateSchema = v.strictObject({
  /** Jour de la maison, à partir de 1 (chantier clientèle). */
  day: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ClienteleState = v.InferOutput<typeof ClienteleStateSchema>;

export function createClienteleState(): ClienteleState {
  return { day: 1 };
}
