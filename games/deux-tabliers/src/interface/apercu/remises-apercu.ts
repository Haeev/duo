/**
 * Aperçu des remises et du marketing (démo v0.2) avec les vrais lecteurs (`branchement/remises.ts`)
 * sur une vraie maison au mardi 2 (graine fixe): onglets « Remises » et « Faire connaître »,
 * ardoise à 15 h 30 pendant l'heure douce, ticket remisé, bilan avec la publicité. Non livré.
 */
import { createRandom } from '@duo/sdk';
import {
  discountsView,
  eveningExtras,
  marketingView,
  receiptLines,
  slateDiscounts,
} from '../../branchement/remises';
import { spawnGroup, takeOrder } from '../../clientele/clients';
import { addLot, requestPurchase, type Ctx } from '../../clientele/economie';
import { dawn, startHouse } from '../../clientele/journee';
import {
  applyDiscountSettings,
  defaultDiscounts,
  launchCampaign,
  listPrice,
  openDiscounts,
} from '../../clientele/remises';
import { loadContent } from '../../donnees/charger';
import { DATA_FILES } from '../../donnees/fichiers';
import { IDLE_INPUT } from '../../simulation/entrees';
import { createWorld } from '../../simulation/monde';
import type { InterfaceModel } from '../modele';

/** Champs du modèle propres aux remises, à fondre dans un modèle d'exemple. */
export function remisesPreview(): {
  discounts: NonNullable<InterfaceModel['discounts']>;
  marketing: NonNullable<InterfaceModel['marketing']>;
  slateLines: readonly string[];
  happyHourNow: string | null;
  discounted: (recipe: string) => number | null;
  listed: (recipe: string) => number;
  receipt: readonly string[];
  figures: ReturnType<typeof eveningExtras>;
} {
  const content = loadContent(DATA_FILES);
  const cc = content.clientele;
  const world = createWorld(content, ['a', 'b']);
  const ctx: Ctx = {
    sim: {
      world,
      content,
      dt: 1 / 60,
      random: createRandom(3),
      inputs: [IDLE_INPUT, IDLE_INPUT],
      emit: () => undefined,
    },
    cc,
    s: world.clientele,
  };
  const s = ctx.s;
  startHouse(ctx);
  dawn(ctx, 2);
  s.slate = ['creme', 'espresso', 'chocolat', 'croissant', 'tarte_fruits', 'jus_orange'].map(
    (id): [string, number] => [id, 0],
  );
  for (const ing of ['croissant_boulanger', 'oranges']) addLot(s, ing, 20, 5);
  addLot(s, 'tarte_boulanger', 6, 3);
  s.soldHistory = [{ tarte_fruits: 3 }, { tarte_fruits: 2 }, { tarte_fruits: 4 }];
  s.cash += 20_000;
  requestPurchase(ctx, 0, 'cartes_fidelite');
  const d = defaultDiscounts(cc);
  d.happyHour.on = true;
  d.loyalty = true;
  d.dailyOffer = ['tarte_fruits', 0.3];
  applyDiscountSettings(ctx, d);
  // Onglets lus le soir, avant l'ouverture: une affiche déjà lancée, l'encart pas encore.
  s.phase = 'evening';
  launchCampaign(ctx, 0, 'affiche_boulangerie');
  const discounts = discountsView(cc, s);
  const marketing = marketingView(cc, s, 0);
  // Le lendemain du lancement, en plein service à 15 h 30: ardoise et ticket.
  openDiscounts(ctx);
  s.phase = 'service';
  s.serviceSec = (15 * 60 + 30 - cc.days.open) * cc.days.secondsPerGameMinute;
  const g = spawnGroup(ctx, { profile: 'voisins', size: 2, items: ['creme', 'tarte_fruits'] });
  g.stage = 'register';
  g.arrivedAt = s.serviceSec;
  takeOrder(ctx, null, g.id);
  const slate = slateDiscounts(cc, s);
  const report = {
    ...(s.report ?? ({} as never)),
    discounts: s.today.discounts,
    discountBy: s.today.discountBy,
    discountOrders: s.today.discountOrders,
    marketing: 800,
    fromCampaigns: { affiche_boulangerie: 3.4, encart_echo: 6.6 },
    fromWord: 7.8,
  };
  return {
    discounts,
    marketing,
    slateLines: slate.lines,
    happyHourNow: slate.now,
    discounted: slate.discounted,
    listed: (recipe) => listPrice(cc, s, recipe),
    receipt: receiptLines(cc, g),
    figures: eveningExtras(cc, report),
  };
}
