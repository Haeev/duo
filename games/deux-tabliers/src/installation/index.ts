/**
 * Chantier « installation » (démo v0.3, `docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`):
 * une maison qui part d'une cellule vide s'installe le lundi, à deux, puis ouvre le mardi.
 * Inerte pour une maison déjà ouverte (`world.installation` à `null`: départ équipé, v0.2).
 *
 * Branché ici, au chargement du module (sur les deux machines):
 * - crochets de l'aménagement: place unique des appareils, objets de Simone pas encore à nous,
 *   cartons ouverts, appareils posés;
 * - garde des achats de la clientèle: « Pour ouvrir » seulement pour une maison qui s'installe,
 *   une seule machine, crédit de Simone et de Gaby quand la caisse ne suffit plus (EC-06).
 */
import { connectArrangementHooks } from '../amenagement/crochets';
import {
  availableCents,
  cents,
  completePurchase,
  connectPurchaseGuard,
  offerOf,
} from '../clientele/economie';
import type { Chantier } from '../simulation/systemes';
import { prompt } from './donnees';
import { installationOf, owns, purchasesOf } from './regles';
import { installationIntent, installationStep } from './systeme';

export const installationChantier: Chantier = {
  id: 'installation',
  system: { id: 'installation', step: installationStep, intent: installationIntent },
};

connectArrangementHooks({
  spot(content, world, type) {
    const ic = content.installation;
    const i = installationOf(world);
    if (ic === null || i === null) return null;
    const a = ic.cell.appliances.find((x) => x.type === type);
    if (a === undefined) return null;
    // La vieille dame de Simone, pas achetée, remonte chez elle quand la révisée prend sa place.
    const oldOwned = i.machine.model !== null && i.machine.model !== 'machine-revisee';
    const replaces =
      a.reason === 'machine' && type !== 'machine-espresso' && !oldOwned
        ? [ic.cell.oldMachine]
        : [];
    return {
      id: a.id,
      x: a.x,
      y: a.y,
      z: a.z,
      rotDeg: a.rotDeg,
      snap: ic.rules.snapRadius,
      reason: ic.texts.spots[a.reason] ?? '',
      merge: type === 'pile-tasses',
      replaces,
    };
  },
  locked(content, world, furniture) {
    const ic = content.installation;
    const i = installationOf(world);
    if (ic === null || i === null) return null;
    const lot = ic.cell.lots.find((l) => l.table === furniture);
    if (lot === undefined) return null;
    const state = i.lots[lot.id] ?? 'simone';
    if (state === 'simone') return prompt(ic, 'simoneOwns');
    if (state === 'ours') return prompt(ic, 'chairsFirst');
    return null;
  },
  unpacked(sim, player, carton, piece) {
    const i = installationOf(sim.world);
    if (i === null) return;
    i.cartons = i.cartons.filter(([c]) => c !== carton);
    sim.emit({ type: 'installation-unpack', player, furniture: carton, item: piece.type });
  },
  placed(sim, _player, piece) {
    const { world, content } = sim;
    const ic = content.installation;
    const i = installationOf(world);
    if (ic === null || i === null) return;
    const purchase = ic.purchaseList.find((p) => piece.id.startsWith(`piece-${p.id}-`));
    if (purchase !== undefined && purchase.dishes > 0) {
      // Un service de vaisselle: moitié tasses, un quart de verres, un quart d'assiettes.
      const n = purchase.dishes;
      const quarter = Math.floor(n / 4);
      const c = world.service.clean;
      c.verre += quarter;
      c.assiette += quarter;
      c.tasse += n - 2 * quarter;
      world.clientele.dishes += n;
    }

    // La révisée posée: la vieille dame (pas achetée) et son drap remontent chez Simone.
    const machine = ic.cell.appliances.find((a) => a.reason === 'machine');
    if (piece.type === 'machine-espresso-revisee' && machine !== undefined) {
      world.furniture = world.furniture.filter(
        (f) => !(f.id === ic.cell.oldMachine && f.type === 'machine-espresso'),
      );
      i.machine.connected = false;
      i.machine.heatEnd = null;
    }
  },
});

connectPurchaseGuard((ctx, player, item) => {
  const { sim, cc, s } = ctx;
  const ic = sim.content.installation;
  const p = ic?.purchases.get(item);
  if (ic === null || p === undefined) return undefined;
  const i = installationOf(sim.world);
  if (i === null) return 'Le café est déjà équipé.';
  if (owns(sim.world, item)) return prompt(ic, 'alreadyBought');
  if (p.lot !== null && (i.lots[p.lot] ?? 'simone') !== 'simone')
    return prompt(ic, 'alreadyBought');
  if (p.exclusive !== null) {
    const other = ic.purchaseList.find(
      (q) => q.exclusive === p.exclusive && q.id !== p.id && owns(sim.world, q.id),
    );
    if (other !== undefined)
      return other.delivery === 'en-place'
        ? prompt(ic, 'oneMachine')
        : prompt(ic, 'machineOnTheWay');
  }
  const offer = offerOf(cc, s, item);
  if (typeof offer === 'string') return offer;
  const available = availableCents(cc, s);
  const lender = ic.credit[item];
  const required = ic.required.includes(p.need);
  if (offer.price <= available) {
    // Une dette en cours n'arrête pas l'installation: le nécessaire s'achète quand même.
    if (s.debt > 0 && required) {
      completePurchase(ctx, offer, player);
      return null;
    }
    return undefined;
  }
  // Jamais bloqué par l'argent (7.2): si rien de ce besoin n'est à portée, crédit sans intérêt.
  const cheaper = purchasesOf(ic, p.need).some(
    (q) => q.id !== p.id && cents(q.price) <= available && !owns(sim.world, q.id),
  );
  if (!required || lender === undefined || cheaper) return undefined;
  completePurchase(ctx, offer, player);
  if (s.cash < 0) {
    s.debt += -s.cash;
    s.cash = 0;
  }
  sim.emit({
    type: 'installation-message',
    from: lender,
    text: (ic.texts.catalog.credit ?? '')
      .replace('{name}', lender)
      .replace(
        '{amount}',
        `${((offer.price - Math.max(0, available)) / 100).toFixed(2).replace('.', ',')} €`,
      ),
  });
  return null;
});
