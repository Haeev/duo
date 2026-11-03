/**
 * Garde-robe et boutique de vêtements de la 0.12 (contrat `docs/jeux/jeu-1/garde-robe-0-12.md`)
 * vus par l'interface: rayons par emplacement, vignettes (nom, couleurs, prix, « Déjà à toi »,
 * nouveautés de la semaine), essayage dans l'aperçu, garde-robe. Fonctions pures, testées dans
 * Node. Les données (`content.clothes`), l'état (`appearance.wear`, `wardrobe`), le stock du jour
 * (`clothesStock`) et les intentions (`wear`, `clothes_buy`) sont ceux de la simulation.
 */
import { seasonOfDay } from '../donnees/calendrier';
import type { Season, Settings } from '../donnees/types';
import {
  CLOTHING_SLOTS,
  type ClothesContent,
  type ClothingColors,
  type ClothingDef,
  REQUIRED_SLOTS,
} from '../donnees/vetements';
import { clothesStock } from '../etat/garde-robe';
import type { ClothingSlot, Wear } from '../etat/types';
import type { UiContext } from './contexte';

export { CLOTHING_SLOTS };

export function isOptionalSlot(slot: ClothingSlot): slot is 'outer' | 'hat' {
  return !(REQUIRED_SLOTS as readonly ClothingSlot[]).includes(slot);
}

export type ClothingCatalogue = ReadonlyMap<string, ClothingDef>;

const catalogues = new WeakMap<ClothesContent, ClothingCatalogue>();

/** Les vêtements du contenu, par identifiant, dans l'ordre du fichier (lu une fois par contenu). */
export function catalogueOf(clothes: ClothesContent): ClothingCatalogue {
  let out = catalogues.get(clothes);
  if (out === undefined) {
    out = new Map(clothes.list.map((d) => [d.id, d]));
    catalogues.set(clothes, out);
  }
  return out;
}

/** Ce que la boutique et la garde-robe lisent de l'état et des données. */
export interface ClothesView {
  catalogue: ClothingCatalogue;
  /** Vêtements possédés par ce joueur (`Character.wardrobe`). */
  wardrobe: readonly string[];
  wear: Wear;
  /** Bourse disponible. */
  purse: number;
  /** En vente aujourd'hui (`clothesStock`). */
  stock: readonly string[];
  /** Les nouveautés de la semaine: en vente cette semaine, pas la semaine d'avant. */
  fresh: readonly string[];
  season: Season;
}

// ---------------------------------------------------------------------------
// Tenue: essayer, porter, retirer

/**
 * La tenue avec `item` à son emplacement (essayage ou « Porter »). Retirer (`null`) ne vaut que
 * pour les emplacements facultatifs: un haut, un bas et des chaussures restent toujours portés.
 */
export function withWear(wear: Wear, slot: ClothingSlot, item: string | null): Wear {
  if (item === null && !isOptionalSlot(slot)) return wear;
  if (slot === 'outer' || slot === 'hat') return { ...wear, [slot]: item };
  return item === null ? wear : { ...wear, [slot]: item };
}

/** Emplacements masqués par ce qui est porté (la salopette couvre le haut). */
export function coveredSlots(wear: Wear, catalogue: ClothingCatalogue): Set<ClothingSlot> {
  const out = new Set<ClothingSlot>();
  for (const slot of CLOTHING_SLOTS) {
    const id = wear[slot];
    if (id === null) continue;
    for (const c of catalogue.get(id)?.couvre ?? []) if (c !== slot) out.add(c);
  }
  return out;
}

/** Intentions qui font passer de `from` à `to` (une par emplacement changé). */
export function wearIntents(
  from: Wear,
  to: Wear,
): { type: 'wear'; slot: ClothingSlot; item: string | null }[] {
  return CLOTHING_SLOTS.filter((s) => from[s] !== to[s]).map((slot) => ({
    type: 'wear' as const,
    slot,
    item: to[slot],
  }));
}

// ---------------------------------------------------------------------------
// Vignettes

/** État d'une vignette: portée, à toi, à acheter, trop chère, hors saison (garde-robe). */
export type ClothingState = 'worn' | 'owned' | 'buy' | 'too_expensive';

export interface ClothingCard {
  id: string;
  slot: ClothingSlot;
  name: string;
  /** Nom des couleurs pour le lecteur d'écran et l'infobulle: « moutarde et crème ». */
  colors: ClothingColors;
  price: number;
  state: ClothingState;
  /** Ce qu'il manque dans la bourse (trop chère), sinon 0. */
  missing: number;
  /** Nouveauté de la semaine. */
  fresh: boolean;
  /** Pièce de saison (en vente cette saison seulement). */
  seasonal: boolean;
  /** Dans l'aperçu en ce moment. */
  trying: boolean;
}

export interface ClothesTab {
  slot: ClothingSlot;
  label: string;
  count: number;
  /** Au moins une nouveauté dans ce rayon. */
  fresh: boolean;
}

function tabLabel(ctx: UiContext, slot: ClothingSlot): string {
  return ctx.texts.extra.clothes.slots[slot];
}

function card(
  def: ClothingDef,
  view: ClothesView,
  preview: Wear,
  owned: ReadonlySet<string>,
  fresh: ReadonlySet<string>,
): ClothingCard {
  const worn = view.wear[def.slot] === def.id;
  const mine = owned.has(def.id);
  const missing = mine ? 0 : Math.max(0, def.prix - view.purse);
  return {
    id: def.id,
    slot: def.slot,
    name: def.nom,
    colors: def.couleurs,
    price: def.prix,
    state: worn ? 'worn' : mine ? 'owned' : missing > 0 ? 'too_expensive' : 'buy',
    missing,
    fresh: fresh.has(def.id),
    seasonal: def.saison !== null,
    trying: preview[def.slot] === def.id && !worn,
  };
}

export interface ClothesShopModel {
  tabs: ClothesTab[];
  slot: ClothingSlot;
  cards: ClothingCard[];
  /** Ce que porte l'aperçu (la tenue, plus la pièce essayée). */
  preview: Wear;
  /** L'aperçu diffère de la tenue portée. */
  trying: boolean;
}

/** Les pièces en vente d'un rayon: nouveautés d'abord, puis par prix et par nom. */
function stockOf(view: ClothesView): ClothingDef[] {
  const seen = new Set<string>();
  const out: ClothingDef[] = [];
  for (const id of view.stock) {
    const def = view.catalogue.get(id);
    if (def === undefined || seen.has(id)) continue;
    // Une pièce de saison ne se vend qu'en sa saison (contrat, section 2).
    if (def.saison !== null && def.saison !== view.season) continue;
    seen.add(id);
    out.push(def);
  }
  return out;
}

function sorted(defs: ClothingDef[], fresh: ReadonlySet<string>): ClothingDef[] {
  return [...defs].sort(
    (a, b) =>
      Number(fresh.has(b.id)) - Number(fresh.has(a.id)) ||
      a.prix - b.prix ||
      a.nom.localeCompare(b.nom, 'fr'),
  );
}

/**
 * Le panneau « Mercerie et confection »: un onglet par emplacement (tous, même vides, pour que
 * la place des onglets ne bouge pas), les vignettes du rayon choisi, l'aperçu.
 */
export function clothesShopModel(
  ctx: UiContext,
  view: ClothesView,
  slot: ClothingSlot,
  preview: Wear,
): ClothesShopModel {
  const owned = new Set(view.wardrobe);
  const fresh = new Set(view.fresh);
  const all = stockOf(view);
  const tabs = CLOTHING_SLOTS.map((s) => {
    const list = all.filter((d) => d.slot === s);
    return {
      slot: s,
      label: tabLabel(ctx, s),
      count: list.length,
      fresh: list.some((d) => fresh.has(d.id)),
    };
  });
  const cards = sorted(
    all.filter((d) => d.slot === slot),
    fresh,
  ).map((d) => card(d, view, preview, owned, fresh));
  return {
    tabs,
    slot,
    cards,
    preview,
    trying: CLOTHING_SLOTS.some((s) => preview[s] !== view.wear[s]),
  };
}

export interface WardrobeModel {
  tabs: ClothesTab[];
  slot: ClothingSlot;
  cards: ClothingCard[];
  /** « Retirer » possible (veste, chapeau portés). */
  canRemove: boolean;
  preview: Wear;
}

/** La garde-robe: ce que l'on possède, rayon par rayon; la pièce portée en tête. */
export function wardrobeModel(
  ctx: UiContext,
  view: ClothesView,
  slot: ClothingSlot,
  preview: Wear,
): WardrobeModel {
  const owned = new Set(view.wardrobe);
  const mine = [...owned]
    .map((id) => view.catalogue.get(id))
    .filter((d): d is ClothingDef => d !== undefined);
  const tabs = CLOTHING_SLOTS.map((s) => ({
    slot: s,
    label: tabLabel(ctx, s),
    count: mine.filter((d) => d.slot === s).length,
    fresh: false,
  }));
  const cards = mine
    .filter((d) => d.slot === slot)
    .sort(
      (a, b) =>
        Number(view.wear[b.slot] === b.id) - Number(view.wear[a.slot] === a.id) ||
        a.nom.localeCompare(b.nom, 'fr'),
    )
    .map((d) => card(d, view, preview, owned, new Set()));
  return {
    tabs,
    slot,
    cards,
    canRemove: isOptionalSlot(slot) && view.wear[slot] !== null,
    preview,
  };
}

// ---------------------------------------------------------------------------
// Lecture de l'état

/** Les vêtements en vente et les nouveautés de la semaine (même tirage chez les deux joueurs). */
export function stockOfDay(
  clothes: ClothesContent,
  settings: Pick<Settings, 'calendar'>,
  seed: number,
  day: number,
): { stock: string[]; fresh: string[] } {
  const stock = clothesStock(clothes, settings, seed, day);
  const before = new Set(clothesStock(clothes, settings, seed, day - 7));
  return { stock, fresh: stock.filter((id) => !before.has(id)) };
}

/** Ce que la mercerie et la garde-robe lisent pour un joueur. */
export function clothesViewOf(
  ctx: UiContext,
  world: {
    readonly purse: number;
    readonly seed: number;
    readonly clock: { readonly day: number };
  },
  character: {
    readonly appearance: { readonly wear: Readonly<Wear> };
    readonly wardrobe: readonly string[];
  } | null,
): ClothesView | null {
  if (character === null) return null;
  const clothes = ctx.content.clothes;
  const { stock, fresh } = stockOfDay(clothes, ctx.content.settings, world.seed, world.clock.day);
  return {
    catalogue: catalogueOf(clothes),
    wardrobe: character.wardrobe,
    wear: { ...character.appearance.wear },
    purse: world.purse,
    stock,
    fresh,
    season: seasonOfDay(ctx.content.settings, world.clock.day),
  };
}
