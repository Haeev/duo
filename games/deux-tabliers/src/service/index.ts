/**
 * Chantier « service »: postes et gestes, commandes, tickets, service, plonge (cahier 4.5 à 4.8).
 * Point d'entrée branché dans `simulation/chantiers.ts`; voir README.md du jeu.
 *
 * Ce qui se joue avec les touches du cœur (« Agir » sur un poste, Agir tenu pour les maintiens):
 * - Moulin: maintenir pour moudre une dose (le moulin à dose en tire deux d'un clic).
 * - Groupe de la machine: une tasse dessous et une dose, Agir lance l'extraction; Agir l'arrête
 *   (prête à 12 s; 12 à 14 s « Parfait », jusqu'à 18 s « Bien », coupure à 20 s « Correct »).
 * - Buse vapeur: une tasse dessous (café crème, cappuccino, noisette, chocolat), maintenir Agir;
 *   relâcher entre 58 et 65 °C « Parfait »; la buse coupe seule à 72 °C.
 * - Bouilloire: Agir la met à chauffer, Agir verse (vert à 80 °C, noir et infusion à 95 °C).
 * - Cloche à viennoiseries, réfrigérateur et plan, presse-agrumes, crêpière: une assiette ou un
 *   verre posé, maintenir Agir.
 * - Caisse: maintenir pour prendre la commande du client qui attend; rail: prendre un ticket.
 * - Passe: un article fini posé dessus (ou sur un plateau posé dessus) rejoint son ticket.
 * - Vaisselle propre: Agir donne la pièce qu'attend le prochain article; la pile peut se vider.
 * - Plonge: maintenir pour laver, pièce après pièce; lave-vaisselle: charger, lancer, vider.
 * - Rangement: poser le carton au pied de son étagère ou de l'armoire froide, Agir.
 *
 * Pour les autres chantiers:
 * - Clientèle et économie (b), chez l'hôte: `presentOrder`, `orderStatus`, `abandonOrder`,
 *   `collectTicket`, `finishConsumption`, `drainReceipts`, `leaveTip`, `deliverCarton`,
 *   `stockOf`, `takeUnsoldFresh`, `unlockRecipe`, `orderableRecipes`, `setGroupOut` (api.ts);
 *   événements `service-order-taken`, `service-paid`, `service-ticket-ready`,
 *   `service-ticket-collected` (evenements.ts).
 * - Aménagement et tablette (c, d), chez l'hôte: `applyPurchase(sim, id)` pour un achat de
 *   `service/equipements.json` (le meuble se pose seul à sa place prévue), `installEquipment`.
 * - Interface (d), sur les deux machines: `serviceGauge`, `serviceStationPrompt`, `kettleReading`,
 *   `articleLabel`, `QUALITY_LABEL`, `judgeLatteArt` (jauge.ts); l'état à lire est
 *   `view.world().service` (tickets et `taker`, vaisselle `clean`, stock, cartons); intentions
 *   `service-assist`, `service-latte-art`, `service-take-ticket`, `service-release-ticket`
 *   (intentions.ts).
 */
import type { PlayerIndex } from '../etat/monde';
import { objectById } from '../simulation/monde';
import type { Chantier, SimContext, StationHandler } from '../simulation/systemes';
import { judgeSteam, planStation, SERVICE_STATIONS, stepService } from './regles';
import type { Quality } from './etat';

export * from './api';
export {
  articleLabel,
  judgeLatteArt,
  kettleReading,
  QUALITY_LABEL,
  serviceGauge,
  serviceStationPrompt,
  type ServiceGauge,
  type TracePoint,
} from './jauge';
export { judgeExtraction, judgeTea, orderableRecipes, recipeKnown, ticketReady } from './regles';

function handler(station: string): StationHandler {
  return {
    refuse(sim, player, furniture) {
      const plan = planStation(sim, player, furniture, station);
      return plan.kind === 'refuse' ? plan.reason : null;
    },
    complete(sim, player, furniture) {
      const plan = planStation(sim, player, furniture, station);
      if (plan.kind === 'go') plan.run(sim);
      else sim.emit({ type: 'refused', player, reason: plan.reason });
    },
  };
}

function latteArt(
  sim: SimContext,
  player: PlayerIndex,
  object: number,
  shape: string,
  score: number,
): void {
  const item = sim.world.service.items.find((i) => i.object === object);
  if (item === undefined || !item.steamed || item.art !== null) return;
  if (objectById(sim.world, object) === undefined) return;
  const quality: Quality = sim.world.service.assist[player]
    ? 'bien'
    : score >= 0.8
      ? 'parfait'
      : score >= 0.5
        ? 'bien'
        : 'correct';
  item.art = { shape, quality };
  sim.emit({ type: 'service-latte-art', player, object, shape });
}

export const serviceChantier: Chantier = {
  id: 'service',
  system: {
    id: 'service',
    step: stepService,
    intent(sim, player, intent) {
      const s = sim.world.service;
      if (intent.type === 'service-assist') s.assist[player] = intent.on;
      else if (intent.type === 'service-latte-art')
        latteArt(sim, player, intent.object, intent.shape, intent.score);
      else if (intent.type === 'service-take-ticket') {
        const t = s.tickets.find((u) => u.id === intent.ticket);
        if (t?.taker === null) {
          t.taker = player;
          sim.emit({ type: 'service-ticket-taken', player, ticket: t.id });
        }
      } else if (intent.type === 'service-release-ticket') {
        const t = s.tickets.find((u) => u.id === intent.ticket);
        if (t?.taker === player) t.taker = null;
      }
    },
  },
  stations: Object.fromEntries(SERVICE_STATIONS.map((s) => [s, handler(s)])),
};

/** Jugement de la buse, exposé pour les tests et l'interface. */
export { judgeSteam };
