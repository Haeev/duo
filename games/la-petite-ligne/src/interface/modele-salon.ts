/**
 * Le bourg du tour 10 vu par l'interface: le fauteuil du salon de Solange (15 coupes, 8 couleurs,
 * barbe et moustache, prix, proposition depuis le banc), le guichet du fournil d'Achille et le
 * chocolat chaud d'Odette. Fonctions pures, testées dans Node. Les règles et les intentions sont
 * celles du lot L3 (simulation du monde); ces modèles ne lisent que les réglages et l'état reçus.
 */
import { weekdayOf as weekdayIndex } from '../donnees/calendrier';
import type { Appearance, ReadonlyWorld } from '../etat/types';
import { PLAYER_BEARDS, PLAYER_HAIR_COLORS, PLAYER_HAIRS } from './config';
import type { UiContext } from './contexte';
import { hourLabel, itemTitle } from './format';
import { itemIcon } from './modele';

/** Jours de la semaine des réglages, dans l'ordre de `weekdayOf` (le jour 1 est un samedi). */
const WEEKDAY_IDS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

export function weekdayId(day: number): (typeof WEEKDAY_IDS)[number] {
  return WEEKDAY_IDS[weekdayIndex(day)] ?? 'saturday';
}

// ---------------------------------------------------------------------------
// Salon de Solange (section 2.3)

export type SalonLook = Pick<Appearance, 'hair' | 'hairColor' | 'beard'>;

export interface SalonOption {
  index: number;
  name: string;
  /** Coupe du salon seulement (pas à la création). */
  salonOnly: boolean;
  /** Couleur du nuancier (couleurs seulement). */
  color: string | null;
}

export interface SalonOptions {
  cuts: SalonOption[];
  colors: SalonOption[];
  beards: SalonOption[];
}

/** Les choix du fauteuil: 15 coupes (les 3 dernières du salon seulement), 8 couleurs, 4 barbes. */
export function salonOptions(ctx: UiContext): SalonOptions {
  const x = ctx.texts.extra.creation;
  const a = ctx.content.settings.appearance;
  const cutCount = Math.min(PLAYER_HAIRS.length, a?.hairStyles ?? PLAYER_HAIRS.length);
  const creationCuts = a?.creationHairStyles ?? cutCount;
  const colorCount = Math.min(
    PLAYER_HAIR_COLORS.length,
    a?.hairColors ?? PLAYER_HAIR_COLORS.length,
  );
  const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
  return {
    cuts: range(cutCount).map((i) => ({
      index: i,
      name: x.hairs[i] ?? '',
      salonOnly: i >= creationCuts,
      color: null,
    })),
    colors: range(colorCount).map((i) => ({
      index: i,
      name: x.hairColors[i] ?? '',
      salonOnly: false,
      color: PLAYER_HAIR_COLORS[i] ?? null,
    })),
    beards: range(PLAYER_BEARDS.length).map((i) => ({
      index: i,
      name: x.beards[i] ?? '',
      salonOnly: false,
      color: null,
    })),
  };
}

export interface SalonPriceModel {
  /** Ce qui change: la coupe (barbe comprise: c'est le travail des ciseaux) et la couleur. */
  cut: boolean;
  color: boolean;
  price: number;
  free: boolean;
  /** Libellé du bouton « Valider »: « Valider: 15 sous », « Valider: offert », ou rien n'a changé. */
  confirm: string;
  /** Ligne des prix: « Coupe: 15 sous », « Les deux: 20 sous ». */
  line: string;
  missing: number;
}

/**
 * Prix d'un passage au fauteuil (`reglages.salon`): coupe 15, couleur 10, les deux 20; la première
 * visite est offerte (`firstFree`, quête `solange_first_cut`); « Garder ma coiffure » ne coûte rien.
 */
export function salonPrice(
  world: ReadonlyWorld,
  ctx: UiContext,
  current: SalonLook,
  choice: SalonLook,
  firstFree: boolean,
): SalonPriceModel {
  const s = ctx.texts.extra.salon;
  const prices = ctx.content.settings.salon ?? { cutPrice: 0, colorPrice: 0, bothPrice: 0 };
  const cut = choice.hair !== current.hair || choice.beard !== current.beard;
  const color = choice.hairColor !== current.hairColor;
  const full =
    cut && color ? prices.bothPrice : cut ? prices.cutPrice : color ? prices.colorPrice : 0;
  const free = firstFree && (cut || color);
  const price = free ? 0 : full;
  const line =
    cut && color
      ? ctx.t(s.bothPrice, { price: prices.bothPrice })
      : cut
        ? ctx.t(s.cutPrice, { price: prices.cutPrice })
        : color
          ? ctx.t(s.colorPrice, { price: prices.colorPrice })
          : ctx.t(s.unchanged);
  const confirm =
    !cut && !color ? ctx.t(s.keep) : free ? ctx.t(s.confirmFree) : ctx.t(s.confirm, { price });
  return {
    cut,
    color,
    price,
    free,
    confirm,
    line: free ? `${line} · ${ctx.t(s.free)}` : line,
    missing: Math.max(0, price - world.purse),
  };
}

/** « Sacha te propose: Tresse couronne, roux » (proposition reçue depuis le banc). */
export function salonProposalText(ctx: UiContext, partner: string, look: SalonLook): string {
  const x = ctx.texts.extra.creation;
  const cut = [x.hairs[look.hair], x.hairColors[look.hairColor]?.toLowerCase()]
    .filter((v): v is string => v !== undefined && v !== '')
    .join(', ');
  return ctx.t(ctx.texts.extra.salon.proposal, { partner, cut });
}

// ---------------------------------------------------------------------------
// Guichet du fournil (section 1.5)

export type BakeryOfferState = 'buy' | 'cap' | 'closed' | 'too_expensive';

export interface BakeryOffer {
  item: string;
  name: string;
  icon: string;
  price: number;
  state: BakeryOfferState;
  /** « Encore 3 aujourd'hui », « Seulement de 6 h à 9 h »... */
  note: string;
  /** Texte du bouton. */
  action: string;
}

/**
 * Ce que vend le guichet à cette heure (`reglages.bakery`): le pain chaud de 6 h à 9 h, le pain
 * jusqu'à midi, la brioche le dimanche; plafonds par joueur et par jour (`dailyCapPerPlayer`, le
 * pain chaud compte dans les pains). `bought`: ce que ce joueur a déjà acheté aujourd'hui, par objet.
 * `null` sans fournil dans les réglages.
 */
export function bakeryOffers(
  world: ReadonlyWorld,
  ctx: UiContext,
  bought: Readonly<Record<string, number>>,
): BakeryOffer[] | null {
  const b = ctx.content.settings.bakery;
  if (b === null) return null;
  const k = ctx.texts.extra.bakery;
  const time = ctx.texts.game.ui.hud.time;
  const minutes = world.clock.minutes;
  const weekday = weekdayId(world.clock.day);
  const open = !b.closedWeekdays.includes(weekday);
  const breads = (bought.bread ?? 0) + (bought.warm_bread ?? 0);
  const offer = (
    item: string,
    price: number,
    available: boolean,
    unavailable: string,
    cap: number | undefined,
    used: number,
  ): BakeryOffer => {
    const def = ctx.content.items[item];
    const left = cap === undefined ? null : Math.max(0, cap - used);
    let state: BakeryOfferState = 'buy';
    let note = left === null ? '' : ctx.t(k.left, { count: left });
    if (!open || !available) {
      state = 'closed';
      note = open ? unavailable : ctx.t(k.closed);
    } else if (left === 0) {
      state = 'cap';
      note = ctx.t(k.cap, { max: cap ?? 0 });
    } else if (price > world.purse) {
      state = 'too_expensive';
    }
    const action =
      state === 'too_expensive'
        ? ctx.t(k.missing, { missing: price - world.purse })
        : ctx.t(k.buy, { price });
    return {
      item,
      name: ctx.t(itemTitle(def, 1, item)),
      icon: itemIcon(ctx, item),
      price,
      state,
      note,
      action,
    };
  };
  const warmOnly = ctx.t(k.warmOnly, {
    from: hourLabel(b.warmFrom, time),
    to: hourLabel(b.warmTo, time),
  });
  return [
    offer(
      'warm_bread',
      b.breadPrice,
      minutes >= b.warmFrom && minutes < b.warmTo,
      warmOnly,
      b.dailyCapPerPlayer.bread,
      breads,
    ),
    offer(
      'bread',
      b.breadPrice,
      minutes < b.breadUntil,
      ctx.t(k.closed),
      b.dailyCapPerPlayer.bread,
      breads,
    ),
    offer(
      'brioche',
      b.briochePrice,
      b.briocheWeekdays.includes(weekday) && minutes < b.breadUntil,
      ctx.t(k.sundayOnly),
      b.dailyCapPerPlayer.brioche,
      bought.brioche ?? 0,
    ),
  ];
}

/** Sous-titre du guichet: « Achille vend le pain chaud de 6 h à 9 h, du pain jusqu'à 12 h. » */
export function bakerySubtitle(ctx: UiContext): string {
  const b = ctx.content.settings.bakery;
  if (b === null) return '';
  const time = ctx.texts.game.ui.hud.time;
  return ctx.t(ctx.texts.extra.bakery.subtitle, {
    from: hourLabel(b.warmFrom, time),
    to: hourLabel(b.warmTo, time),
    until: hourLabel(b.breadUntil, time),
  });
}

// ---------------------------------------------------------------------------
// Chocolat chaud d'Odette (section 1.6)

export interface ChocolateModel {
  available: boolean;
  done: boolean;
  price: number;
  text: string;
  note: string;
  action: string;
  missing: number;
}

/**
 * Le chocolat chaud du comptoir: les jours de pluie, et l'automne et l'hiver, jusqu'à 18 h, une
 * tasse par joueur et par jour. `drunk`: tasses de ce joueur aujourd'hui. `null` sans réglage.
 */
export function chocolateModel(
  world: ReadonlyWorld,
  ctx: UiContext,
  season: string,
  drunk: number,
): ChocolateModel | null {
  const g = ctx.content.settings.grocer;
  if (g === null) return null;
  const c = g.chocolate;
  const k = ctx.texts.extra.grocer;
  const time = ctx.texts.game.ui.hud.time;
  const seasonOk =
    c.seasons.some((s) => s === season) || (c.rainAnySeason && world.weather === 'rain');
  const available = seasonOk && world.clock.minutes >= g.hours[0] && world.clock.minutes < c.until;
  const done = drunk >= c.perPlayerPerDay;
  const missing = Math.max(0, c.price - world.purse);
  return {
    available,
    done,
    price: c.price,
    text: ctx.t(k.chocolateText, { belly: c.belly }),
    note: ctx.t(k.chocolateSeason, { until: hourLabel(c.until, time) }),
    action: done
      ? ctx.t(k.chocolateDone)
      : missing > 0
        ? ctx.t(ctx.texts.extra.common.missingMoney, { missing })
        : ctx.t(k.chocolateBuy, { price: c.price }),
    missing,
  };
}
