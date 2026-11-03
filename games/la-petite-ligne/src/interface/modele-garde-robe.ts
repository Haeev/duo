/**
 * Garde-robe et boutique de vêtements de la 0.12 (contrat `docs/jeux/jeu-1/garde-robe-0-12.md`)
 * vus par l'interface: rayons par emplacement, vignettes (nom, couleurs, prix, « Déjà à toi »,
 * nouveautés de la semaine), essayage dans l'aperçu, garde-robe, tenue de départ de la création.
 * Fonctions pures, testées dans Node. Les données (`vetements.json`), l'état (`appearance.wear`,
 * `wardrobe`, stock du lundi) et les intentions (`wear`, `clothes_buy`) sont ceux de la simulation:
 * ces modèles ne lisent que ce qu'on leur passe (`ClothesView`).
 */
import type { Season } from '../donnees/types';
import type { UiContext } from './contexte';

/** Emplacements, dans l'ordre des onglets: Hauts, Vestes, Bas, Chaussures, Chapeaux. */
export const CLOTHING_SLOTS = ['top', 'outer', 'bottom', 'shoes', 'hat'] as const;
export type ClothingSlot = (typeof CLOTHING_SLOTS)[number];

/** Emplacements qu'on ne peut pas laisser vides (contrat, section 1). */
export const REQUIRED_SLOTS: readonly ClothingSlot[] = ['top', 'bottom', 'shoes'];

export function isClothingSlot(value: unknown): value is ClothingSlot {
  return typeof value === 'string' && (CLOTHING_SLOTS as readonly string[]).includes(value);
}

export function isOptionalSlot(slot: ClothingSlot): slot is 'outer' | 'hat' {
  return !REQUIRED_SLOTS.includes(slot);
}

export interface ClothingColors {
  principale: string;
  secondaire: string;
  motif?: string;
}

/** Un vêtement de `vetements.json` (contrat, section 2). */
export interface ClothingDef {
  id: string;
  slot: ClothingSlot;
  style: string;
  nom: string;
  modele: string;
  couleurs: ClothingColors;
  prix: number;
  saison?: Season;
  couvre?: readonly ClothingSlot[];
  /** Pièce de départ, proposée à la création (sinon: les moins chères de chaque emplacement). */
  depart?: boolean;
}

/** Tenue portée (`Character.appearance.wear`, contrat, section 3). */
export interface Wear {
  top: string;
  bottom: string;
  shoes: string;
  outer: string | null;
  hat: string | null;
}

export type ClothingCatalogue = ReadonlyMap<string, ClothingDef>;

/** Ce que la boutique et la garde-robe lisent de l'état et des données. */
export interface ClothesView {
  catalogue: ClothingCatalogue;
  /** Vêtements possédés par ce joueur (`Character.wardrobe`). */
  wardrobe: readonly string[];
  wear: Wear;
  /** Bourse disponible. */
  purse: number;
  /** En vente cette semaine: le fonds permanent puis la sélection du lundi. */
  stock: readonly string[];
  /** Les nouveautés du lundi (marquées « Nouveau »). */
  fresh: readonly string[];
  season: Season;
}

// ---------------------------------------------------------------------------
// Tenue: essayer, porter, retirer

export function wornIn(wear: Wear, slot: ClothingSlot): string | null {
  return wear[slot];
}

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
    seasonal: def.saison !== undefined,
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
    if (def.saison !== undefined && def.saison !== view.season) continue;
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
// Création: tenue de départ

/** Nombre de pièces proposées par emplacement à la création, faute de pièces marquées `depart`. */
const STARTER_PER_SLOT = 4;

export interface StarterOutfit {
  top: ClothingDef[];
  bottom: ClothingDef[];
  shoes: ClothingDef[];
}

/**
 * Pièces de départ de la création (haut, bas, chaussures). Celles que les données marquent
 * `depart`, sinon les moins chères de chaque emplacement hors saison, sans les pièces qui en
 * couvrent une autre (une salopette ne se choisit pas à la création: elle cacherait le haut).
 */
export function starterOutfit(catalogue: ClothingCatalogue): StarterOutfit {
  const all = [...catalogue.values()];
  const marked = all.some((d) => d.depart === true);
  const pick = (slot: 'top' | 'bottom' | 'shoes'): ClothingDef[] => {
    const list = all.filter(
      (d) =>
        d.slot === slot &&
        (marked
          ? d.depart === true
          : d.saison === undefined && (d.couvre === undefined || d.couvre.length === 0)),
    );
    // Pièces marquées: dans l'ordre des données (celui du game designer); sinon les moins chères.
    if (marked) return list;
    return [...list]
      .sort((a, b) => a.prix - b.prix || a.id.localeCompare(b.id))
      .slice(0, STARTER_PER_SLOT);
  };
  return { top: pick('top'), bottom: pick('bottom'), shoes: pick('shoes') };
}

/** Tenue de départ par défaut: une pièce différente pour chaque joueur (p1 la première, p2 la deuxième). */
export function defaultStarterWear(
  starter: StarterOutfit,
  player: 'p1' | 'p2',
  current: Wear | null,
): Wear | null {
  const n = player === 'p1' ? 0 : 1;
  const at = (list: ClothingDef[]): string | null => list[n % Math.max(1, list.length)]?.id ?? null;
  const known = (list: ClothingDef[], id: string | undefined): string | null =>
    id !== undefined && list.some((d) => d.id === id) ? id : null;
  const top = known(starter.top, current?.top) ?? at(starter.top);
  const bottom = known(starter.bottom, current?.bottom) ?? at(starter.bottom);
  const shoes = known(starter.shoes, current?.shoes) ?? at(starter.shoes);
  if (top === null || bottom === null || shoes === null) return null;
  return { top, bottom, shoes, outer: null, hat: null };
}

// ---------------------------------------------------------------------------
// Portrait 2D: couleurs du haut porté

export interface WornColors {
  /** Le haut visible (la salopette, si elle couvre le haut). */
  top: ClothingColors;
  /** La veste par-dessus, ou rien. */
  outer: ClothingColors | null;
}

/** Couleurs du haut porté pour le portrait (le haut couvert laisse voir ce qui le couvre). */
export function wornColors(wear: Wear, catalogue: ClothingCatalogue): WornColors | null {
  const covering = CLOTHING_SLOTS.map((s) => wear[s])
    .map((id) => (id === null ? undefined : catalogue.get(id)))
    .find((d) => d !== undefined && d.slot !== 'top' && (d.couvre ?? []).includes('top'));
  const top = covering ?? catalogue.get(wear.top);
  if (top === undefined) return null;
  const outer = wear.outer === null ? undefined : catalogue.get(wear.outer);
  return { top: top.couleurs, outer: outer?.couleurs ?? null };
}

// ---------------------------------------------------------------------------
// Lecture des données et de l'état (contrat, sections 2 et 3)

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

function isSeason(value: unknown): value is Season {
  return typeof value === 'string' && (SEASONS as readonly string[]).includes(value);
}

function colorsOf(value: unknown): ClothingColors | null {
  if (!isRecord(value)) return null;
  const { principale, secondaire, motif } = value;
  if (typeof principale !== 'string' || typeof secondaire !== 'string') return null;
  return typeof motif === 'string' ? { principale, secondaire, motif } : { principale, secondaire };
}

/** Un vêtement des données, contrôlé (les données viennent du disque). */
export function clothingDefOf(value: unknown): ClothingDef | null {
  if (!isRecord(value)) return null;
  const { id, slot, style, nom, modele, couleurs, prix, saison, couvre, depart } = value;
  const colors = colorsOf(couleurs);
  if (typeof id !== 'string' || !isClothingSlot(slot) || typeof nom !== 'string') return null;
  if (typeof prix !== 'number' || !Number.isFinite(prix) || colors === null) return null;
  const def: ClothingDef = {
    id,
    slot,
    style: typeof style === 'string' ? style : id,
    nom,
    modele: typeof modele === 'string' ? modele : '',
    couleurs: colors,
    prix,
  };
  if (isSeason(saison)) def.saison = saison;
  const covers = stringList(couvre).filter(isClothingSlot);
  if (covers.length > 0) def.couvre = covers;
  if (depart === true) def.depart = true;
  return def;
}

/** Le catalogue des vêtements, quelle que soit sa forme (tableau, table ou `Map`). */
export function catalogueOf(source: unknown): ClothingCatalogue {
  let values: unknown[] = [];
  if (source instanceof Map) values = [...(source as Map<unknown, unknown>).values()];
  else if (Array.isArray(source)) values = source;
  else if (isRecord(source)) values = Object.values(source);
  const out = new Map<string, ClothingDef>();
  for (const v of values) {
    const def = clothingDefOf(v);
    if (def !== null) out.set(def.id, def);
  }
  return out;
}

/** La tenue portée d'une apparence (`appearance.wear`), ou `null` si elle manque. */
export function wearOf(appearance: unknown): Wear | null {
  if (!isRecord(appearance)) return null;
  const w = appearance.wear;
  if (!isRecord(w)) return null;
  const { top, bottom, shoes, outer, hat } = w;
  if (typeof top !== 'string' || typeof bottom !== 'string' || typeof shoes !== 'string') {
    return null;
  }
  return {
    top,
    bottom,
    shoes,
    outer: typeof outer === 'string' ? outer : null,
    hat: typeof hat === 'string' ? hat : null,
  };
}

const catalogues = new WeakMap<object, ClothingCatalogue>();

/** Le catalogue du contenu chargé (`vetements.json`), lu une fois par contenu. */
export function clothesCatalogue(ctx: UiContext): ClothingCatalogue {
  const content: object = ctx.content;
  let out = catalogues.get(content);
  if (out === undefined) {
    out = catalogueOf((content as { clothes?: unknown }).clothes);
    catalogues.set(content, out);
  }
  return out;
}

/** Couleurs du haut porté pour le portrait d'une apparence (`null`: tenue d'avant la 0.12). */
export function portraitClothes(ctx: UiContext, appearance: unknown): WornColors | null {
  const wear = wearOf(appearance);
  return wear === null ? null : wornColors(wear, clothesCatalogue(ctx));
}

/** Les vêtements possédés d'un personnage (`Character.wardrobe`). */
export function wardrobeOf(character: unknown): string[] {
  return isRecord(character) ? stringList(character.wardrobe) : [];
}

/**
 * Le stock de la mercerie (contrat, section 4): `clothesStock` de l'état, le fonds permanent
 * (`permanent`) et la sélection du lundi (`weekly`, les nouveautés). Sans stock dans l'état: tout
 * le catalogue de la saison, sans nouveauté.
 */
export function clothesStockOf(
  world: unknown,
  catalogue: ClothingCatalogue,
): { stock: string[]; fresh: string[] } {
  const raw = isRecord(world) ? world.clothesStock : undefined;
  if (isRecord(raw)) {
    const weekly = stringList(raw.weekly);
    return { stock: [...stringList(raw.permanent), ...weekly], fresh: weekly };
  }
  return { stock: [...catalogue.keys()], fresh: [] };
}

/** Ce que la mercerie et la garde-robe lisent pour un joueur, ou `null` sans tenue dans l'état. */
export function clothesViewOf(
  ctx: UiContext,
  world: { readonly purse: number; readonly clock: { readonly day: number } },
  character: { readonly appearance: unknown } | null,
  season: Season,
): ClothesView | null {
  if (character === null) return null;
  const wear = wearOf(character.appearance);
  if (wear === null) return null;
  const catalogue = clothesCatalogue(ctx);
  const { stock, fresh } = clothesStockOf(world, catalogue);
  return {
    catalogue,
    wardrobe: wardrobeOf(character),
    wear,
    purse: world.purse,
    stock,
    fresh,
    season,
  };
}
