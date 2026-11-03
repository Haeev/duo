/**
 * Tableau du quai et établi de Basile (tour 9, sections 1.6, 2.3 et 2.6): modèles purs des
 * onglets « Catalogue », « Annonces » et « Chantiers », et de la commande des chantiers de la
 * maisonnette. Testés dans Node; `panneaux.ts` les affiche.
 *
 * L'interface n'importe pas `simulation/`: le chantier ouvert d'une file et le reste à payer y
 * sont recalculés comme dans `simulation/chantiers.ts` (`openImprovement`,
 * `improvementRemaining`), avec un test d'égalité.
 */
import { onSale } from '../donnees/commandes';
import { rawText } from '../donnees/contenu';
import type { ImprovementDef, ImprovementQueue } from '../donnees/types';
import { type ShelfKind, catalogueOffers, copiesOf } from '../etat/catalogue';
import type { BoardAnnonce, ReadonlyWorld } from '../etat/types';
import { type UiContext, characterOf, nameOf } from './contexte';
import { capitalize, countIn, hourLabel, itemName, itemTitle, weekdayOf } from './format';
import { itemIcon } from './modele';
import {
  type ProductModel,
  type ProductState,
  catalogueDelivered,
  catalogueOpen,
} from './modele-panneaux';

export type BoardTab = 'catalogue' | 'annonces' | 'chantiers';
export const BOARD_TABS: readonly BoardTab[] = ['catalogue', 'annonces', 'chantiers'];

/** Le tableau a ses onglets (lettre `firmin_board`, jour 16); avant, il ne montre que le catalogue. */
export function boardOpen(world: ReadonlyWorld, ctx: UiContext): boolean {
  const board = ctx.content.settings.board;
  return board !== null && world.clock.day >= board.fromDay;
}

// ---------------------------------------------------------------------------
// Catalogue de la semaine, par rayons

const SHELF_ORDER: readonly ShelfKind[] = ['tools', 'hens', 'house', 'gifts'];

export interface ShelfModel {
  shelf: ShelfKind;
  title: string;
  products: ProductModel[];
}

function listedItems(ctx: UiContext): Set<string> {
  const cat = ctx.content.catalogue;
  const out = new Set<string>();
  if (cat === null) return out;
  for (const page of cat.pages) for (const item of page.items) out.add(item);
  for (const g of cat.gifts) out.add(g.item);
  return out;
}

function legacyShelf(ctx: UiContext, item: string): ShelfKind {
  const category = ctx.content.items[item]?.category;
  if (category === 'tool') return 'tools';
  if (category === 'animal_order') return 'hens';
  if (category === 'gift') return 'gifts';
  return 'house';
}

/**
 * Ce que montre le catalogue: les articles d'avant le tour 9 encore en vente, puis seulement les
 * articles parus du catalogue de la semaine (page de la saison, souhait entendu), et ceux qu'on a
 * commandés ou proposés même s'il n'en reste plus. Rien de ce qui n'est pas paru ne se voit: la
 * simulation le refuserait.
 */
export function catalogueProducts(world: ReadonlyWorld, ctx: UiContext): ProductModel[] {
  const open = catalogueOpen(world, ctx);
  const delivered = catalogueDelivered(world, ctx);
  const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
  const cat = ctx.content.catalogue;
  const listed = listedItems(ctx);
  const offers = new Map(
    catalogueOffers(ctx.content.settings, ctx.content, world).map((o) => [o.item, o]),
  );
  const out: ProductModel[] = [];
  const add = (
    item: string,
    shelf: ShelfKind,
    villager: string | null,
    left: number | null,
  ): void => {
    const def = ctx.content.items[item];
    if (def?.buyPrice === null || def === undefined) return;
    const price = def.buyPrice;
    const ordered = world.catalogueOrders.filter((x) => x === item).length;
    const proposal = world.proposals.find(
      (p) => p.purchase.source === 'catalogue' && p.purchase.item === item,
    );
    const inChest = delivered && countIn(world.cellar, item) > 0;
    const soldOut = left !== null && left <= 0;
    let state: ProductState;
    if (proposal !== undefined) state = proposal.by === ctx.me ? 'waiting' : 'partner_waiting';
    else if (ordered > 0 && (soldOut || left === null)) state = 'ordered';
    else if (inChest && (soldOut || left === null)) state = 'delivered';
    else if (!open) state = 'closed';
    else if (price > world.purse) state = 'too_expensive';
    else state = 'orderable';
    const name = itemTitle(def, 1, item);
    const villagerName =
      villager === null
        ? null
        : (ctx.content.villagers.find((v) => v.id === villager)?.label ?? villager);
    const copies = cat === null ? 1 : copiesOf(cat, item);
    out.push({
      item,
      icon: itemIcon(ctx, item),
      name:
        villagerName === null
          ? name
          : ctx.t(ctx.texts.extra.catalogue.forVillager, {
              villager: villagerName,
              item: itemName(def, 1, item),
            }),
      effect: ctx.t(ctx.texts.extra.catalogue.effects[item] ?? ''),
      price,
      state,
      big: price >= threshold,
      missing: Math.max(0, price - world.purse),
      available: state === 'orderable',
      shelf,
      copies,
      left: left ?? 1,
      ordered,
    });
  };
  for (const def of Object.values(ctx.content.items)) {
    if (
      def.shop !== 'catalogue' ||
      def.buyPrice === null ||
      listed.has(def.id) ||
      !onSale(def, world.clock.day)
    )
      continue;
    add(def.id, legacyShelf(ctx, def.id), null, null);
  }
  if (cat !== null) {
    const seen = new Set<string>();
    const weekly = [
      ...cat.pages.flatMap((p) =>
        p.items.map((item) => ({ item, villager: null as string | null })),
      ),
      ...cat.gifts.map((g) => ({ item: g.item, villager: g.villager })),
    ];
    for (const { item, villager } of weekly) {
      if (seen.has(item)) continue;
      seen.add(item);
      const offer = offers.get(item);
      const ordered = world.catalogueOrders.includes(item);
      const proposed = world.proposals.some(
        (p) => p.purchase.source === 'catalogue' && p.purchase.item === item,
      );
      const inChest =
        catalogueDelivered(world, ctx) &&
        countIn(world.cellar, item) > 0 &&
        (world.catalogueBought[item] ?? 0) > 0;
      if (offer === undefined && !ordered && !proposed && !inChest) continue;
      add(
        item,
        offer?.shelf ?? legacyShelf(ctx, item),
        offer?.villager ?? villager,
        offer?.left ?? 0,
      );
    }
  }
  return out;
}

/** Les rayons non vides, dans l'ordre Outillage, Basse-cour, Maison, Pour offrir. */
export function catalogueShelves(world: ReadonlyWorld, ctx: UiContext): ShelfModel[] {
  const products = catalogueProducts(world, ctx);
  return SHELF_ORDER.map((shelf) => ({
    shelf,
    title: ctx.t(ctx.texts.extra.catalogue.shelves[shelf]),
    products: products.filter((p) => p.shelf === shelf),
  })).filter((s) => s.products.length > 0);
}

// ---------------------------------------------------------------------------
// Annonces

export interface AnnonceLineModel {
  item: string;
  icon: string;
  /** « 6 radis » */
  text: string;
  have: number;
  need: number;
  /** Dans le sac de ce joueur. */
  inBag: number;
  done: boolean;
}

export interface AnnonceModel {
  gabarit: string;
  title: string;
  /** Le texte de l'habitant, variables remplies (« Il me faudrait 6 radis »). */
  text: string;
  giver: string;
  kind: 'help' | 'together';
  kindLabel: string;
  lines: AnnonceLineModel[];
  /** Une scène à deux finit l'annonce (après les dons, s'il y en a). */
  scene: string | null;
  /** « jusqu'à mardi, 20 h » */
  deadline: string;
  /** « Merci : 110 sous » */
  reward: string;
  state: BoardAnnonce['state'];
  /** Le tampon « Fait » à la couleur de qui l'a remise (`null`: scène à deux). */
  by: 'self' | 'other' | null;
  /** Tampon (« Fait », « Retirée ») et son nom accessible (« Fait par Camille »), ou `null` pour une annonce ouverte. */
  stamp: string | null;
  stampLabel: string | null;
  /** Ce qu'il reste à faire (« Parle à Odette... »), ou la ligne de l'annonce retirée. */
  help: string;
}

function annonceLinesOf(
  ctx: UiContext,
  a: Pick<BoardAnnonce, 'gabarit' | 'variant'>,
): readonly { item: string; count: number }[] {
  return ctx.content.annonces.find((x) => x.id === a.gabarit)?.variants[a.variant] ?? [];
}

/** Texte de l'annonce, `{count}` et `{item}` remplis par la première ligne (comme `annonceText` de la simulation). */
export function annonceTextOf(
  ctx: UiContext,
  a: Pick<BoardAnnonce, 'gabarit' | 'variant'>,
): string {
  const text = rawText(ctx.content.texts, 'annonces', a.gabarit, 'text') ?? '';
  const first = annonceLinesOf(ctx, a)[0];
  if (first === undefined) return ctx.t(text);
  return ctx.t(text, {
    count: first.count,
    item: itemName(ctx.content.items[first.item], first.count, first.item),
  });
}

export function annonceModel(
  world: ReadonlyWorld,
  ctx: UiContext,
  a: Readonly<BoardAnnonce>,
): AnnonceModel {
  const b = ctx.texts.extra.board;
  const g = ctx.texts.game.ui.board;
  const def = ctx.content.annonces.find((x) => x.id === a.gabarit);
  const giver = ctx.content.villagers.find((v) => v.id === def?.giver)?.label ?? def?.giver ?? '';
  const quest = world.quests.find((q) => q.id === a.quest);
  const me = characterOf(world, ctx.me);
  // Les dons se comptent depuis le début de l'étape (`given:<habitant>:<objet>`, comme le choix « Donner »).
  const giveDone =
    a.state === 'done' || (quest !== undefined && (quest.status === 'done' || quest.step > 0));
  const lines = annonceLinesOf(ctx, a).map((l) => {
    const key = `given:${def?.giver ?? ''}:${l.item}`;
    const given =
      quest === undefined
        ? 0
        : (world.counters.duo[key] ?? 0) - (quest.baselines[`duo:${key}`] ?? 0);
    const have = giveDone ? l.count : Math.max(0, Math.min(l.count, given));
    return {
      item: l.item,
      icon: itemIcon(ctx, l.item),
      text: ctx.t(b.line, {
        count: l.count,
        item: itemName(ctx.content.items[l.item], l.count, l.item),
      }),
      have,
      need: l.count,
      inBag: me === null ? 0 : countIn(me.bag, l.item),
      done: have >= l.count,
    };
  });
  const by = a.by === null ? null : a.by === ctx.me ? 'self' : 'other';
  let stamp: string | null = null;
  let stampLabel: string | null = null;
  if (a.state === 'done') {
    stamp = ctx.t(g.done);
    stampLabel =
      a.by === null ? ctx.t(b.doneTogether) : ctx.t(b.doneBy, { name: nameOf(world, a.by) });
  } else if (a.state === 'expired') {
    stamp = ctx.t(g.expired);
    stampLabel = stamp;
  }
  const kind = def?.kind ?? 'help';
  return {
    gabarit: a.gabarit,
    title: ctx.t(rawText(ctx.content.texts, 'annonces', a.gabarit, 'title') ?? a.gabarit),
    text: annonceTextOf(ctx, a),
    giver,
    kind,
    kindLabel: ctx.t(b.kinds[kind]),
    lines,
    scene: def?.scene ?? null,
    deadline: ctx.t(g.until, {
      weekday: weekdayOf(a.deadline.day, ctx.texts.weekdays),
      time: hourLabel(a.deadline.time, ctx.texts.game.ui.hud.time),
    }),
    reward: ctx.t(g.reward, { amount: a.reward }),
    state: a.state,
    by,
    stamp,
    stampLabel,
    help:
      a.state === 'expired'
        ? ctx.t(b.expiredText, { giver })
        : a.state === 'open' && lines.some((l) => !l.done)
          ? ctx.t(b.howTo, { giver })
          : '',
  };
}

export interface BoardAnnoncesModel {
  current: AnnonceModel | null;
  previous: AnnonceModel | null;
}

export function boardAnnonces(world: ReadonlyWorld, ctx: UiContext): BoardAnnoncesModel {
  const { current, previous } = world.board;
  return {
    current: current === null ? null : annonceModel(world, ctx, current),
    previous: previous === null ? null : annonceModel(world, ctx, previous),
  };
}

// ---------------------------------------------------------------------------
// Chantiers

/** Le chantier ouvert de cette file (règle de `openImprovement`, simulation). */
export function openChantier(
  world: ReadonlyWorld,
  ctx: UiContext,
  queue: ImprovementQueue,
): ImprovementDef | null {
  const s = ctx.content.settings.improvements;
  if (s === null || world.clock.day < s.queues[queue].opensFromDay) return null;
  const list = ctx.content.improvements
    .filter((x) => x.queue === queue)
    .sort((a, b) => a.order - b.order);
  for (const def of list) {
    const state = world.improvements[def.id];
    if (state?.builtDay === null || state === undefined) return def;
    if (state.builtDay >= world.clock.day) return null;
  }
  return null;
}

/** Reste à payer (règle de `improvementRemaining`, simulation). */
export function chantierRemaining(
  world: ReadonlyWorld,
  ctx: UiContext,
  def: ImprovementDef,
): number {
  const discount = ctx.content.settings.improvements?.plankDiscount ?? 0;
  const state = world.improvements[def.id];
  return Math.max(0, def.price - (state?.paid ?? 0) - (state?.planks ?? 0) * discount);
}

export function chantierName(ctx: UiContext, id: string): string {
  return rawText(ctx.content.texts, 'chantiers', id, 'name') ?? id;
}

export interface PayOption {
  /** Sous versés, ou `null` pour « le reste ». */
  amount: number | null;
  /** Somme réelle du versement. */
  sum: number;
  label: string;
  /** Passe par l'accord de l'autre (`bigPurchaseThreshold`). */
  big: boolean;
  missing: number;
  key: string;
}

export interface ChantierModel {
  id: string;
  queue: ImprovementQueue;
  /** « Un banc au gué » */
  name: string;
  price: number;
  paid: number;
  planks: number;
  remaining: number;
  /** « Un banc au gué : 450 sur 950 sous » (planches comptées à leur valeur). */
  progress: string;
  /** Part payée (0 à 100). */
  percent: number;
  /** « dont 4 planches apportées », ou vide. */
  planksNote: string;
  funded: boolean;
  /** Versement en attente de l'accord: le mien, celui de l'autre, ou aucun. */
  pending: 'mine' | 'partner' | null;
  pendingAmount: number;
  options: PayOption[];
}

function chantierModel(world: ReadonlyWorld, ctx: UiContext, def: ImprovementDef): ChantierModel {
  const g = ctx.texts.game.ui.board;
  const b = ctx.texts.extra.board;
  const settings = ctx.content.settings;
  const discount = settings.improvements?.plankDiscount ?? 0;
  const state = world.improvements[def.id];
  const paid = state?.paid ?? 0;
  const planks = state?.planks ?? 0;
  const remaining = chantierRemaining(world, ctx, def);
  const counted = def.price - remaining;
  const name = capitalize(chantierName(ctx, def.id));
  const proposal = world.proposals.find(
    (p) => p.purchase.source === 'improvement' && p.purchase.item === def.id,
  );
  const funded = state?.funded === true;
  const threshold = settings.economy.bigPurchaseThreshold;
  const options: PayOption[] = [];
  const option = (amount: number | null, sum: number, label: string): PayOption => ({
    amount,
    sum,
    label,
    big: sum >= threshold,
    missing: Math.max(0, sum - world.purse),
    key: `pay:${def.id}:${amount === null ? 'rest' : String(amount)}`,
  });
  if (!funded && proposal === undefined && remaining > 0) {
    if (def.payAt === 'board') {
      // Un versement fixe n'est proposé que s'il reste plus: sinon « le reste » suffit.
      for (const step of settings.improvements?.steps ?? []) {
        if (step >= remaining) continue;
        const label = step === 50 ? g.pay50 : step === 100 ? g.pay100 : b.payAmount;
        options.push(option(step, step, ctx.t(label, { amount: step })));
      }
      options.push(option(null, remaining, ctx.t(g.payRest, { amount: remaining })));
    } else {
      options.push(
        option(null, remaining, ctx.t(ctx.texts.extra.basile.orderButton, { price: remaining })),
      );
    }
  }
  return {
    id: def.id,
    queue: def.queue,
    name,
    price: def.price,
    paid,
    planks,
    remaining,
    progress: ctx.t(g.progress, { name, paid: counted, price: def.price }),
    percent: def.price <= 0 ? 100 : Math.round((counted / def.price) * 100),
    planksNote:
      planks > 0 && discount > 0
        ? ctx.t(planks === 1 ? b.planksPaidOne : b.planksPaid, { planks })
        : '',
    funded,
    pending: proposal === undefined ? null : proposal.by === ctx.me ? 'mine' : 'partner',
    pendingAmount: proposal?.price ?? 0,
    options,
  };
}

export interface BuiltChantier {
  id: string;
  name: string;
  /** « Le banc du gué attend ses premiers pêcheurs. » */
  text: string;
  /** « Bâti dans la nuit du lundi 17 » */
  when: string;
}

export interface ChantiersPageModel {
  /** Le chantier du bourg ouvert, ou `null` (file pas encore ouverte, tous bâtis, ou suivant demain). */
  open: ChantierModel | null;
  allBuilt: boolean;
  built: BuiltChantier[];
  /** Ligne sur la file de la maisonnette (à l'établi de Basile), ou vide. */
  home: string;
}

function builtList(world: ReadonlyWorld, ctx: UiContext): BuiltChantier[] {
  const b = ctx.texts.extra.board;
  return ctx.content.improvements
    .map((def) => ({ def, day: world.improvements[def.id]?.builtDay ?? null }))
    .filter((x): x is { def: ImprovementDef; day: number } => x.day !== null)
    .sort((a, z) => z.day - a.day)
    .map(({ def, day }) => ({
      id: def.id,
      name: ctx.t(capitalize(chantierName(ctx, def.id))),
      text: ctx.t(rawText(ctx.content.texts, 'chantiers', def.id, 'done') ?? ''),
      // Bâti dans la nuit qui précède le matin `day`.
      when: ctx.t(b.builtOn, { weekday: weekdayOf(day - 1, ctx.texts.weekdays), day: day - 1 }),
    }));
}

export function chantiersPage(world: ReadonlyWorld, ctx: UiContext): ChantiersPageModel {
  const b = ctx.texts.extra.board;
  const open = openChantier(world, ctx, 'bourg');
  const bourg = ctx.content.improvements.filter((x) => x.queue === 'bourg');
  const allBuilt =
    bourg.length > 0 && bourg.every((x) => (world.improvements[x.id]?.builtDay ?? null) !== null);
  const home = openChantier(world, ctx, 'maisonnette');
  const homeFrom = ctx.content.settings.improvements?.queues.maisonnette.opensFromDay ?? null;
  let homeLine = '';
  if (home !== null && world.improvements[home.id]?.funded !== true)
    homeLine = ctx.t(b.home, { name: chantierName(ctx, home.id) });
  else if (homeFrom !== null && world.clock.day < homeFrom)
    homeLine = ctx.t(b.homeFrom, {
      weekday: weekdayOf(homeFrom, ctx.texts.weekdays),
      day: homeFrom,
    });
  return {
    open: open === null ? null : chantierModel(world, ctx, open),
    allBuilt,
    built: builtList(world, ctx).filter((x) => bourg.some((d) => d.id === x.id)),
    home: homeLine,
  };
}

// ---------------------------------------------------------------------------
// Établi de Basile: chantiers de la maisonnette

export interface BasileModel {
  /** Le chantier à commander, ou `null` (tous bâtis, ou le suivant ouvre demain). */
  chantier: ChantierModel | null;
  /** « Un banc au pignon : 690 sous » */
  priceLine: string;
  /** « Apporter des planches : 3 sur 20 (30 sous de moins) » */
  planksLine: string;
  /** Planches que ce joueur peut apporter maintenant (sac et place restante). */
  bring: number;
  /** Plus aucune planche acceptée (plafond ou prix atteint). */
  planksFull: boolean;
  allBuilt: boolean;
  built: BuiltChantier[];
}

/**
 * La commande à Basile, ou `null` tant que la file n'est pas ouverte (lettre `basile_works` pour la
 * maisonnette; 0.12: file `elevage`, chevrerie et poulailler agrandi, présentée à part).
 */
export function basileModel(
  world: ReadonlyWorld,
  ctx: UiContext,
  queue: 'maisonnette' | 'elevage' = 'maisonnette',
): BasileModel | null {
  const s = ctx.content.settings.improvements;
  if (s === null || world.clock.day < s.queues[queue].opensFromDay) return null;
  const def = openChantier(world, ctx, queue);
  const list = ctx.content.improvements.filter((x) => x.queue === queue);
  const allBuilt =
    list.length > 0 && list.every((x) => (world.improvements[x.id]?.builtDay ?? null) !== null);
  const built = builtList(world, ctx).filter((x) => list.some((d) => d.id === x.id));
  if (def === null)
    return {
      chantier: null,
      priceLine: '',
      planksLine: '',
      bring: 0,
      planksFull: true,
      allBuilt,
      built,
    };
  const chantier = chantierModel(world, ctx, def);
  const state = world.improvements[def.id];
  const planks = state?.planks ?? 0;
  const paid = state?.paid ?? 0;
  // Même plafond que `bringPlanks`: jamais plus de `plankDiscountMax`, jamais sous un prix nul.
  const room = Math.max(
    0,
    Math.min(
      s.plankDiscountMax - planks,
      Math.floor((def.price - paid) / Math.max(1, s.plankDiscount)) - planks,
    ),
  );
  const me = characterOf(world, ctx.me);
  const inBag = me === null ? 0 : countIn(me.bag, 'plank');
  const g = ctx.texts.game.ui.basile;
  return {
    chantier,
    priceLine: ctx.t(g.price, { name: chantier.name, price: chantier.remaining }),
    planksLine: ctx.t(g.planks, { n: planks, discount: planks * s.plankDiscount }),
    bring: chantier.funded || chantier.pending !== null ? 0 : Math.min(room, inBag),
    planksFull: room <= 0,
    allBuilt,
    built,
  };
}
