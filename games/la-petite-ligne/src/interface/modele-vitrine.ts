/**
 * Modèles de l'interface imagée (patch 0.12.2): ce que disent les pastilles d'un objet, les
 * ingrédients d'une recette en « possédés / requis », et les fiches des poissons en icônes.
 * Fonctions pures sur l'état, testées dans Node.
 */
import { FISH_RARITIES, type FishRarity, rarityScales } from '../etat/peche';
import type { ReadonlyWorld } from '../etat/types';
import { dialogueDone } from '../etat/dialogues-faits';
import { type UiContext, characterOf, nameOf } from './contexte';
import { capitalize, itemName, itemTitle } from './format';
import { fishIcon } from './icones';
import { itemIcon } from './modele';
import { available, recipeEntries } from './modele-panneaux';

/** Une pastille: une icône, un nombre ou un mot très court, et son nom accessible. */
export interface Fact {
  icon: string;
  text: string;
  label: string;
  tone: 'info' | 'ok' | 'missing' | 'price' | 'count' | 'wait';
}

/** Les pastilles d'un objet (usage, beauté, confort, pousse, « à fabriquer », repas). */
export function itemFacts(ctx: UiContext, item: string): Fact[] {
  const def = ctx.content.items[item];
  if (def === undefined) return [];
  const v = ctx.texts.extra.vitrine;
  const facts: Fact[] = [];
  const crop = def.plants === null ? undefined : ctx.content.crops[def.plants];
  if (crop !== undefined) {
    facts.push({ icon: 'ui-hourglass', text: ctx.t(v.daysShort, { days: crop.growthDays }), label: ctx.t(v.grow, { days: crop.growthDays }), tone: 'info' });
    facts.push({ icon: itemIcon(ctx, crop.harvest), text: `×${String(crop.yieldPerCell)}`, label: ctx.t(v.yield, { count: crop.yieldPerCell }), tone: 'info' });
  }
  if (def.beauty > 0) facts.push({ icon: 'ui-star', text: `+${String(def.beauty)}`, label: ctx.t(v.beauty, { count: def.beauty }), tone: 'info' });
  if (def.comfort > 0) facts.push({ icon: 'chair', text: `+${String(def.comfort)}`, label: ctx.t(v.comfort, { count: def.comfort }), tone: 'info' });
  if (def.dish !== null) {
    const snack = ctx.content.settings.snacks[def.dish] ?? 0;
    facts.push({ icon: 'ui-stamina', text: `+${String(snack)}`, label: ctx.t(v.eat, { count: snack }), tone: 'ok' });
  }
  const outputs = [...new Set(Object.values(ctx.content.recipes).filter((r) => r.inputs.some((i) => i.item === item)).map((r) => r.output.item))];
  if (outputs.length > 0) {
    const names = outputs.map((o) => itemName(ctx.content.items[o], 1, o));
    // L'icône de ce qu'on fabrique: un seul dessin (le premier), le nom accessible les dit tous.
    facts.push({ icon: itemIcon(ctx, outputs[0] ?? item), text: '', label: ctx.t(v.crafts, { list: names.join(', ') }), tone: 'info' });
  }
  return facts;
}

// ---------------------------------------------------------------------------
// Recettes

export interface IngredientModel {
  item: string;
  icon: string;
  name: string;
  have: number;
  need: number;
}

export interface RecipeCardModel {
  id: string;
  name: string;
  icon: string;
  output: { item: string; count: number };
  inputs: IngredientModel[];
  /** Ingrédients complets (sac, puis coffre de la maison). */
  ready: boolean;
  /** Cuisinable ou fabricable maintenant (rien d'autre en cours). */
  available: boolean;
  /** Ingrédients qui manquent (nombre de sortes). */
  missingKinds: number;
  /** Fabrication en cours (0 à 1), ou `null`. */
  progress: number | null;
  /** Une partie sera prise au coffre (« dont 2 au coffre »), ou `null`. */
  fromChest: string | null;
}

export function recipeCards(world: ReadonlyWorld, ctx: UiContext, station: 'workbench' | 'stove'): { cards: RecipeCardModel[]; locked: number } {
  const me = characterOf(world, ctx.me);
  const { entries, locked } = recipeEntries(world, ctx, station);
  const cards = entries.map((e): RecipeCardModel => {
    const def = ctx.content.recipes[e.id];
    const inputs = (def?.inputs ?? []).map((i) => ({
      item: i.item,
      icon: itemIcon(ctx, i.item),
      name: itemName(ctx.content.items[i.item], i.count, i.item),
      have: me === null ? 0 : available(world, me, i.item),
      need: i.count,
    }));
    return {
      id: e.id,
      name: e.name,
      icon: e.icon,
      output: def === undefined ? { item: '', count: 0 } : { ...def.output },
      inputs,
      ready: e.missing.length === 0,
      available: e.available,
      missingKinds: e.missing.length,
      progress: e.progress,
      fromChest: e.fromChest,
    };
  });
  return { cards, locked };
}

/** « 3 radis » pour le nom accessible d'un ingrédient (« Radis : 2 sur 3 »). */
export function ingredientLabel(ctx: UiContext, i: IngredientModel): string {
  return ctx.t(ctx.texts.extra.common.itemCountOf, { item: capitalize(itemName(ctx.content.items[i.item], i.need, i.item)), have: Math.min(i.have, i.need), need: i.need });
}

// ---------------------------------------------------------------------------
// Poissons

/** Moments de la journée (heures de début, en minutes): matin, midi, soir, nuit. */
export const FISH_MOMENTS = [
  { id: 'morning', from: 5 * 60, to: 11 * 60 },
  { id: 'noon', from: 11 * 60, to: 17 * 60 },
  { id: 'evening', from: 17 * 60, to: 22 * 60 },
  { id: 'night', from: 22 * 60, to: 29 * 60 },
] as const;

export type FishMoment = (typeof FISH_MOMENTS)[number]['id'];

const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;

export interface FishZoneModel {
  id: string;
  name: string;
  on: boolean;
  rects: readonly { x: number; y: number; w: number; h: number }[];
}

export interface FishCardModel {
  id: string;
  /** Nom avec majuscule (« Goujon »), ou « Pas encore pris ». */
  name: string;
  caught: boolean;
  rarity: FishRarity;
  scales: number;
  icon: string;
  /** Taille relative de la silhouette (m). */
  shadowLength: number;
  /** Une phrase courte: la première de la description après la prise, sinon l'indice. */
  line: string;
  seasons: { id: (typeof SEASON_IDS)[number]; on: boolean }[];
  moments: { id: FishMoment; on: boolean }[];
  zones: FishZoneModel[];
  /** Prix chez Odette, `null` s'il est remis à l'eau. */
  price: number | null;
  count: number;
  record: { cm: number; by: 'self' | 'other'; name: string } | null;
}

export interface FishBoardModel {
  caught: number;
  total: number;
  /** Le coin où l'on est, s'il y en a un (« le gué »). */
  here: string | null;
  cards: FishCardModel[];
}

/** La première phrase (jusqu'au premier point ou deux-points), point final compris. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const cut = trimmed.search(/(\s*:\s)|(\.\s)|(\s;\s)/);
  const head = cut < 0 ? trimmed : trimmed.slice(0, cut);
  return /[.!?…]$/.test(head) ? head : `${head}.`;
}

function overlaps(ranges: readonly [number, number][], from: number, to: number): boolean {
  return ranges.some(([a, b]) => {
    // La nuit passe minuit: on teste aussi la plage décalée d'un jour.
    const day = 24 * 60;
    return (a < to && b > from) || (a + day < to && b + day > from);
  });
}

export function fishBoard(world: ReadonlyWorld, ctx: UiContext): FishBoardModel {
  const t = ctx.texts.extra.fish;
  const zones = ctx.map.fishingZones ?? [];
  const sizes = ctx.content.settings.fishing?.rules.shadows.sizes ?? { small: 0.3, medium: 0.5, large: 0.8, huge: 1.2 };
  const log = world.fishing.log;
  const fishes = Object.values(ctx.content.items).filter((d) => d.fish !== null);
  const me = characterOf(world, ctx.me);
  let here: string | null = null;
  if (me !== null && me.inside === null) {
    const zone = zones.find((z) => z.rects.some((r) => me.pos.x >= r.x - 3 && me.pos.y >= r.y - 3 && me.pos.x < r.x + r.w + 3 && me.pos.y < r.y + r.h + 3));
    if (zone !== undefined) here = zone.name;
  }
  const rank = (r: FishRarity): number => FISH_RARITIES.indexOf(r);
  const cards = fishes
    .map((d): FishCardModel | null => {
      const fish = d.fish;
      if (fish === null) return null;
      const entry = log[d.id];
      const caught = entry !== undefined;
      let line: string;
      if (caught) line = ctx.t(firstSentence(fish.description));
      else {
        const rumor = fish.grand?.rumorDialogue ?? null;
        const locked = fish.grand !== null && (rumor === null || !dialogueDone(world.dialoguesDone, rumor));
        line = locked ? ctx.t(t.hintLocked) : ctx.t(fish.hint);
      }
      return {
        id: d.id,
        name: caught ? capitalize(d.name) : ctx.t(t.unknown),
        caught,
        rarity: fish.rarity,
        scales: rarityScales(fish.rarity),
        icon: fishIcon(d.id),
        shadowLength: sizes[fish.shadow],
        line,
        seasons: SEASON_IDS.map((id) => ({ id, on: fish.seasons.includes(id) })),
        moments: FISH_MOMENTS.map((m) => ({ id: m.id, on: fish.rainAnyHour || overlaps(fish.hours, m.from, m.to) })),
        zones: zones.map((z) => ({ id: z.id, name: z.name, on: fish.zones.includes(z.id), rects: z.rects })),
        price: fish.released ? null : d.sellPrice,
        count: entry?.count ?? 0,
        record: entry === undefined ? null : { cm: entry.record.cm, by: entry.record.by === ctx.me ? 'self' : 'other', name: nameOf(world, entry.record.by) },
      };
    })
    .filter((c): c is FishCardModel => c !== null)
    .sort((a, b) => rank(a.rarity) - rank(b.rarity));
  return { caught: cards.filter((c) => c.caught).length, total: cards.length, here, cards };
}

/** Nom d'un objet pour une vignette (« Sachet de graines de radis »). */
export function tileName(ctx: UiContext, item: string, count = 1): string {
  return itemTitle(ctx.content.items[item], count, item);
}
