// Domaine « service » de l'état partagé (postes et gestes, commandes, tickets, service, plonge).
// Sérialisé dans les sauvegardes et envoyé à l'invité quand il change (canal du domaine).
// Toute évolution du format: monter WORLD_FORMAT (etat/monde.ts) et écrire la migration.
import { v } from '@duo/sdk';

export const ServiceStateSchema = v.strictObject({
  /** Prochain numéro de ticket (chantier service). */
  nextTicketId: v.pipe(v.number(), v.integer(), v.minValue(0)),
});
export type ServiceState = v.InferOutput<typeof ServiceStateSchema>;

export function createServiceState(): ServiceState {
  return { nextTicketId: 0 };
}
