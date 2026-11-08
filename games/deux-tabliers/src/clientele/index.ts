/**
 * Chantier « clientele » (b): journée et semaine, ardoise et attrait, clients, économie, habitués,
 * livre d'or, événements de la démo, bilan du soir. Point d'entrée branché dans
 * `simulation/chantiers.ts`; règles: `docs/jeux/cosy-cafe/demo/demo-v0-1.md` et la simulation
 * `demo_v0_1.py`; données: `donnees/clientele/` (section « Clientèle » de `donnees/SCHEMA.md`).
 *
 * ## Pour le service (chantier a)
 *
 * Le service lit et appelle, dans son `system.step` (il passe avant ce chantier dans `CHANTIERS`):
 * - `takeServiceOutbox(world)`: vide et rend la boîte de dépôt `world.clientele.outbox`:
 *   - `orders`: commandes payées à mettre en tickets (`group`, `items` de `carte.json`, `reorder`,
 *     `player` qui l'a prise). Servie, la commande se rend par `deliverOrder(sim, group, résultat)`
 *     avec `qualities` (`perfect`, `good`, `fine`), `latteArt`, `homemade`: ils comptent dans la
 *     satisfaction, le carnet vert et le concours du cœur de lait;
 *   - `dishes`: vaisselle sale laissée à une table (`table`, `seats`, `pieces`): poser les objets
 *     sales sur les emplacements de la table. Une table est propre dès que ses emplacements sont
 *     vides (ou par `tableCleared`); l'inspection compte les tables sales de plus de 30 s;
 *   - `cartons`: cartons livrés le matin (`[ingrédient, nombre, lourd]`) à poser à la porte de
 *     service; `cartonStowed(world, ingrédient)` quand un carton est rangé (le stock est déjà
 *     compté à la livraison).
 * - `takeOrderAt(sim, player)`: la commande du groupe en tête de file, quand un joueur agit sur la
 *   caisse (le même geste existe en intention `clientele-take-order` pour l'interface).
 * - `serveAsUsual(sim, group)`: « Comme d'habitude ? », la fétiche servie à un habitué avant sa
 *   commande.
 * - `world.clientele.conditions`: `machine-degraded` (panne du jour 6: un groupe de la machine sur
 *   deux), `averse` (terrasse fermée), `fete`; `world.clientele.stock`, `known`, `stations`.
 * - `reportInspection(world, critère)` pendant l'inspection: `cups` (pile vide), `floor`, `fridge`.
 * - Sans service branché, `regles.json` `fallbackPrepSeconds` (nombre de secondes) sert les
 *   commandes seul; `null` en production.
 *
 * ## Pour l'aménagement (chantier c)
 *
 * - Achats: intention `clientele-buy` (`item`: équipement, extension, meuble du catalogue de la
 *   démo, pièce de la brocante du lundi). Les achats faits sont dans `world.clientele.purchases`
 *   (`[id, jour, jour où c'est prêt]`): l'aménagement y prend les meubles à mettre dans la remise.
 *   Pièces uniques offertes: `world.clientele.gifts` (`[id, jour d'arrivée]`).
 * - Les assises posées comptent comme places des clients (type par préfixe du type de meuble,
 *   `regles.json` `seatKinds`, terrasse par la zone E1 du plan); une assise occupée est celle d'un
 *   groupe de `world.clientele.groups[].seats`: ne pas la déplacer pendant le service.
 * - L'ambiance (démo 6.3) se calcule ici (`economie.ts`, `ambiance`) depuis les achats et les
 *   assises; `world.clientele.ambiance` = `[valeur, style dominant, cohérence]`.
 *
 * ## Pour l'interface (chantier d)
 *
 * Lire `view.world().clientele`: `phase` (`monday`, `prep`, `service`, `closing`, `evening`, `end`),
 * `day`, horloge par `clockMinutes(content.clientele, état)`, `weather` et `tomorrowWeather`,
 * `cash`, `debt`, `cups`, `renown`, `slate`, `votes` (« On ouvre ? »: `votes.open`), `proposals`,
 * `report` (bilan du soir, sommes en centimes), `guestbook`, `event` (événement en cours),
 * `brocante`, `letterDay`, `demoEnded`, `houseName`, `namePending`. Offres de la tablette:
 * `offerOf(content.clientele, état, id)`; commande habituelle: `suggestedOrder`; ardoise proposée:
 * `proposeSlate`. Événements: `CLIENTELE_EVENTS` (`clientele-ask`: « On ouvre ? » chez l'autre;
 * `clientele-clue` et `clientele-say` avec `player`: à n'afficher que chez ce joueur).
 * Intentions: `CLIENTELE_INTENTS` (`clientele-vote`, `clientele-name`, `clientele-slate`,
 * `clientele-take-order`, `clientele-talk`, `clientele-buy`, `clientele-answer`,
 * `clientele-supply`, `clientele-emergency`, `clientele-scene`, `clientele-pace`).
 *
 * ## Réseau et rendu
 *
 * Les positions des clients debout partent sur le canal 7 (`reseau.ts`, 20 par seconde, entiers);
 * un client assis n'a pas de position: sa place la donne. Rendu: `rendu3d.ts` (modèles par nom
 * `assets/modeles/client-<profil>.glb` ou `habitue-<id>.glb`, clips `walk`, `idle`, `sit`, `drink`,
 * `sit_drink`; substitut sinon).
 */
import type { PlayerIndex, World } from '../etat/monde';
import type { Intent } from '../simulation/entrees';
import type { Chantier, SimContext } from '../simulation/systemes';
import {
  clockMinutes,
  deliverOrder,
  prepareOrder,
  groupById,
  hostWalkers,
  placePoint,
  serveAsUsual as asUsual,
  takeOrder,
  type ServeResult,
} from './clients';
import {
  answerProposal,
  coverShortfall,
  emergencyCents,
  reconcileLots,
  requestPurchase,
  type Ctx,
} from './economie';
import type { ClienteleState } from './etat';
import { talk } from './habitues';
import { applyDiscountSettings, launchCampaign, startCampaign } from './remises';
import { dawn, startHouse, stepDay, vote } from './journee';
import { onTalk, sceneAct } from './scenes';

export { clockMinutes, deliverOrder, prepareOrder, type ServeResult };
export { ctxOf };
export {
  offerOf,
  suggestedOrder,
  availableCents,
  reserveCents,
  bigPurchaseCents,
  chargesCents,
  orderCost,
  orderReservedCents,
  nextOpenDay,
  nextPassage,
  supplierPasses,
  weekdayId,
  cartonCents,
  lastGoodDay,
  emergencyCents,
  reconcileLots,
} from './economie';
export { proposeSlate } from './attrait';
export { hostWalkers };
export { animOf } from './clients';

function ctxOf(sim: SimContext): Ctx {
  return { sim, cc: sim.content.clientele, s: sim.world.clientele };
}

function refuse(sim: SimContext, player: PlayerIndex, reason: string | null): void {
  if (reason !== null) sim.emit({ type: 'refused', player, reason: reason.slice(0, 80) });
}

/** Distance du joueur à un meuble posé d'un type donné (la caisse), ou l'infini. */
function distanceToType(sim: SimContext, player: PlayerIndex, type: string): number {
  const p = sim.world.players[player];
  let best = Infinity;
  for (const f of sim.world.furniture)
    if (f.type === type) best = Math.min(best, Math.hypot(f.x - p.x, f.z - p.z));
  return best;
}

export function takeOrderAt(
  sim: SimContext,
  player: PlayerIndex | null,
  groupId: number | null = null,
): string | null {
  const r = takeOrder(ctxOf(sim), player, groupId);
  return typeof r === 'string' ? r : null;
}

export function serveAsUsual(sim: SimContext, group: number): string | null {
  return asUsual(ctxOf(sim), group);
}

export function deliver(sim: SimContext, group: number, result: ServeResult = {}): string | null {
  return deliverOrder(ctxOf(sim), group, result);
}

export function takeServiceOutbox(world: World): ClienteleState['outbox'] {
  const box = world.clientele.outbox;
  world.clientele.outbox = { orders: [], dishes: [], cartons: [] };
  return box;
}

export function tableCleared(world: World, table: string): void {
  world.clientele.dirty = world.clientele.dirty.filter(([t]) => t !== table);
}

export function cartonStowed(world: World, ingredient: string): void {
  const c = world.clientele.cartons.find(([id]) => id === ingredient);
  if (c === undefined) return;
  c[1]--;
  if (c[1] <= 0) world.clientele.cartons.splice(world.clientele.cartons.indexOf(c), 1);
}

export function reportInspection(world: World, criterion: 'cups' | 'floor' | 'fridge'): void {
  const e = world.clientele.event;
  if (e?.id === 'l_inspection' && !e.flags.includes(`fail:${criterion}`))
    e.flags.push(`fail:${criterion}`);
}

function onIntent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  const ctx = ctxOf(sim);
  const { s, cc } = ctx;
  if (intent.type === 'clientele-ui-place') {
    s.uiPlaces[player] = intent.place;
    return;
  }
  if (s.day === 0) return;
  if (intent.type === 'clientele-evening-page') {
    s.eveningPages[player] = [s.report?.day ?? s.day, intent.page];
    return;
  }
  if (intent.type === 'clientele-vote') {
    refuse(sim, player, vote(ctx, player, intent.topic, intent.yes));
    return;
  }
  if (intent.type === 'clientele-name') {
    s.namePending = { by: player, name: intent.name.trim() };
    sim.emit({ type: 'clientele-ask', topic: 'name', by: player, yes: true });
    return;
  }
  if (intent.type === 'clientele-slate') {
    const seen = new Set<string>();
    const lines: [string, number][] = [];
    const st = cc.economy.priceSteps;
    for (const [id, step] of intent.lines) {
      if (seen.has(id) || !s.known.includes(id) || !cc.recipes.has(id)) continue;
      const ok = cc.recipes.get(id)?.stations.every((x) => (s.stations[x] ?? 0) > 0) ?? false;
      if (!ok) continue;
      seen.add(id);
      lines.push([id, Math.max(st.min, Math.min(st.max, step))]);
    }
    if (lines.length > cc.rules.slateLines) {
      refuse(sim, player, `L’ardoise n’a que ${String(cc.rules.slateLines)} lignes`);
      return;
    }
    s.slate = lines;
    return;
  }
  if (intent.type === 'clientele-take-order') {
    if (distanceToType(sim, player, 'caisse') > sim.content.settings.player.reach + 1) {
      refuse(sim, player, 'Va à la caisse');
      return;
    }
    refuse(sim, player, takeOrderAt(sim, player));
    return;
  }
  if (intent.type === 'clientele-talk') {
    const g = groupById(sim.world, intent.group);
    if (g === undefined) return;
    const p = sim.world.players[player];
    const pos = placePoint(ctx, g) ?? hostPosition(sim.world, g.id);
    if (pos === null || Math.hypot(pos.x - p.x, pos.z - p.z) > cc.rules.talkReach + 0.4) {
      refuse(sim, player, 'Trop loin pour parler');
      return;
    }
    talk(ctx, player, g);
    onTalk(ctx, player, g);
    return;
  }
  if (intent.type === 'clientele-buy') {
    refuse(sim, player, requestPurchase(ctx, player, intent.item));
    return;
  }
  if (intent.type === 'clientele-answer') {
    // Une action de marketing au-delà du seuil (marketing v0.2) se répond comme un achat.
    const i = s.proposals.findIndex((p) => p.by === intent.by);
    const item = s.proposals[i]?.item;
    if (item !== undefined && cc.actions.has(item) && intent.by !== player) {
      s.proposals.splice(i, 1);
      if (intent.accept) refuse(sim, player, startCampaign(ctx, item, intent.by));
      return;
    }
    refuse(sim, player, answerProposal(ctx, player, intent.by, intent.accept));
    return;
  }
  if (intent.type === 'clientele-supply') {
    if (s.phase === 'service') {
      refuse(sim, player, 'La commande se passe le soir ou avant d’ouvrir');
      return;
    }
    const order: Record<string, number> = {};
    for (const [id, n] of intent.cartons) if (cc.ingredients.has(id) && n > 0) order[id] = n;
    s.order = order;
    return;
  }
  if (intent.type === 'clientele-emergency') {
    const ing = cc.ingredients.get(intent.ingredient);
    const supplier = cc.supplies.suppliers.find((x) => x.id === ing?.supplier);
    if (ing === undefined || supplier?.emergency !== true || s.phase !== 'service') {
      refuse(sim, player, 'Pas de dépannage pour ça');
      return;
    }
    const o = cc.supplies.ordering;
    // Dépannage par Mireille (P0-2): le carton entier, payé 30 % plus cher, sans port.
    const price = emergencyCents(cc, ing);
    s.cash -= price;
    coverShortfall(s);
    s.today.emergency += price;
    const k =
      s.pace === 'peaceful' ? cc.days.peacefulSecondsPerGameMinute : cc.days.secondsPerGameMinute;
    s.emergencies.push([ing.id, 1, s.serviceSec + o.emergencyGameMinutes * k]);
    return;
  }
  if (intent.type === 'clientele-scene') {
    refuse(sim, player, sceneAct(ctx, player, intent.action, intent.choice));
    return;
  }
  if (intent.type === 'clientele-discounts') {
    refuse(sim, player, applyDiscountSettings(ctx, intent.settings));
    return;
  }
  if (intent.type === 'clientele-campaign') {
    refuse(sim, player, launchCampaign(ctx, player, intent.action));
    return;
  }
  if (intent.type === 'clientele-pace') {
    if (s.phase === 'service' || s.phase === 'closing') {
      refuse(sim, player, 'Le rythme se règle hors du service');
      return;
    }
    s.pace = intent.peaceful ? 'peaceful' : 'normal';
    return;
  }
}

function hostPosition(world: World, id: number): { x: number; z: number } | null {
  const w = hostWalkers(world).get(id);
  return w === undefined ? null : { x: w.x, z: w.z };
}

export const clienteleChantier: Chantier = {
  id: 'clientele',
  system: {
    id: 'clientele',
    step(sim) {
      const ctx = ctxOf(sim);
      if (ctx.s.day === 0) startHouse(ctx);
      reconcileLots(ctx.cc, ctx.s);
      stepDay(ctx);
    },
    intent: onIntent,
  },
};

/** Pour les tests et les outils: passer directement au jour `day` (aube). */
export function jumpToDay(sim: SimContext, day: number): void {
  const ctx = ctxOf(sim);
  if (ctx.s.day === 0) startHouse(ctx);
  dawn(ctx, day);
}
