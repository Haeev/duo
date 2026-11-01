/**
 * Onglet Souvenirs du carnet (tour 7, conception section 2.3): la page du duo, racontée du point
 * de vue de qui la lit. Fonctions pures (aucun DOM), testées dans Node. Rien de ce qui manque ne
 * se voit: pas de compteur, pas de case vide, seulement ce qui a été vécu, et une rumeur du bourg
 * différente chez les deux joueurs.
 */
import type { Content, MomentDef } from '../donnees/types';
import { finishedSecretLine } from '../etat/secrets';
import { lastDayOfSeason, seasonIndex, seasonOf, yearOf } from '../etat/souvenirs';
import { unitDraw } from '../etat/tirage';
import type {
  CharacterId,
  DeepReadonly,
  MomentMemoryEntry,
  ReadonlyWorld,
  SecretMemoryEntry,
} from '../etat/types';
import { type UiContext, nameOf } from './contexte';

/** Vignette quand les données n'en déclarent pas (ou que le sprite ne l'a pas encore). */
export const GENERIC_VIGNETTE = 'memory-generic';

export interface MemoryEntryModel {
  /** Identité stable (focus, filet des nouveautés): `moment:<id>` ou `secret:<quête>`. */
  key: string;
  /** Change à chaque passage de plus: une entrée revue redevient nouvelle. */
  stamp: string;
  vignette: string;
  /** Texte de remplacement de la vignette. */
  alt: string;
  title: string;
  date: string;
  /** Ligne à soi, selon qui lit; `null` si rien à dire (habitant inconnu, ancienne sauvegarde). */
  self: string | null;
  /** « Vu deux fois ensemble; la dernière, un jeudi d'été. », ou `null` (une seule fois). */
  returns: string | null;
}

export interface MemorySeasonModel {
  key: string;
  /** Intercalaire: « Le printemps, première année ». */
  title: string;
  entries: MemoryEntryModel[];
}

export interface MemoriesPageModel {
  /** Du plus récent au plus ancien. */
  seasons: MemorySeasonModel[];
  /** Page vide (début de partie), ou `null`. */
  empty: string | null;
  /** Rumeur du bourg, ou `null` (plus aucun moment à découvrir). */
  rumor: { lead: string; text: string } | null;
}

type Souvenirs = UiContext['texts']['game']['souvenirs'];

function yearLabel(t: Souvenirs, year: number): string {
  return t.years[year - 1] ?? t.yearN.replace('{count}', String(year));
}

function weekdayOf(ctx: UiContext, day: number): string {
  const list = ctx.texts.weekdays;
  return list[(Math.max(1, day) - 1) % Math.max(1, list.length)] ?? '';
}

function villagerName(content: Content, id: string | null): string | null {
  if (id === null) return null;
  return content.villagers.find((v) => v.id === id)?.firstName ?? null;
}

/** « Jour 13 · printemps, première année ». */
export function memoryDate(ctx: UiContext, day: number): string {
  const t = ctx.texts.game.souvenirs;
  const s = ctx.content.settings.memories;
  return ctx.t(t.date, {
    day,
    season: t.seasons[seasonOf(s, day)] ?? '',
    year: yearLabel(t, yearOf(s, day)),
  });
}

/** Intercalaire de la saison d'un jour: « L'été, première année ». */
export function seasonTitle(ctx: UiContext, day: number): string {
  const t = ctx.texts.game.souvenirs;
  const s = ctx.content.settings.memories;
  return ctx.t(t.divider, {
    season: t.seasonTitles[seasonOf(s, day)] ?? '',
    year: yearLabel(t, yearOf(s, day)),
  });
}

function returnsLine(ctx: UiContext, m: DeepReadonly<MomentMemoryEntry>): string | null {
  if (m.count < 2) return null;
  const t = ctx.texts.game.souvenirs;
  const s = ctx.content.settings.memories;
  const times = t.times[m.count] ?? '';
  const vars = {
    times: times === '' ? t.often : times,
    weekday: weekdayOf(ctx, m.last),
    seasonOf: t.seasonsOf[seasonOf(s, m.last)] ?? '',
    year: yearLabel(t, yearOf(s, m.last)),
  };
  return ctx.t(yearOf(s, m.last) === yearOf(s, m.first) ? t.last : t.lastOtherYear, vars);
}

/** Qui avait la confidence, ou qui en avait parlé: du point de vue de ce joueur. */
function momentSelf(
  world: ReadonlyWorld,
  ctx: UiContext,
  m: DeepReadonly<MomentMemoryEntry>,
): string | null {
  const t = ctx.texts.game.souvenirs.self;
  const villager = villagerName(ctx.content, m.hintFrom);
  const partner = nameOf(world, ctx.partner);
  if (m.hintTo === null) return villager === null ? null : ctx.t(t.quest, { villager });
  const mine = m.hintTo === ctx.me;
  if (villager !== null)
    return ctx.t(mine ? t.hintVillager : t.hintVillagerPartner, { villager, partner });
  return ctx.t(mine ? t.hintEve : t.hintEvePartner, { partner });
}

function momentEntry(
  world: ReadonlyWorld,
  ctx: UiContext,
  m: DeepReadonly<MomentMemoryEntry>,
): MemoryEntryModel | null {
  const def = ctx.content.moments.find((d) => d.id === m.id);
  const title = def === undefined ? undefined : ctx.texts.messages[def.texts.memory];
  if (def === undefined || title === undefined) return null;
  const t = ctx.texts.game.souvenirs;
  const alt = def.texts.vignette === null ? undefined : ctx.texts.messages[def.texts.vignette];
  return {
    key: `moment:${m.id}`,
    stamp: `moment:${m.id}:${String(m.count)}`,
    vignette: def.vignette ?? GENERIC_VIGNETTE,
    alt: ctx.t(alt ?? t.vignetteGeneric),
    title: ctx.t(title, { weekday: weekdayOf(ctx, m.first) }),
    date: memoryDate(ctx, m.first),
    self: momentSelf(world, ctx, m),
    returns: returnsLine(ctx, m),
  };
}

function secretEntry(
  world: ReadonlyWorld,
  ctx: UiContext,
  s: DeepReadonly<SecretMemoryEntry>,
): MemoryEntryModel | null {
  const def = ctx.content.quests.find((q) => q.id === s.quest);
  const lines = ctx.texts.game.souvenirs.secrets[s.quest];
  if (def === undefined || lines === undefined) return null;
  const t = ctx.texts.game.souvenirs;
  const vars = {
    partner: nameOf(world, ctx.partner),
    secret: finishedSecretLine(world, ctx.content, s.quest, s.variant),
  };
  const self = ctx.t(s.informed === ctx.me ? lines.informed : lines.doer, vars);
  return {
    key: `secret:${s.quest}`,
    stamp: `secret:${s.quest}`,
    vignette: def.secret?.vignette ?? GENERIC_VIGNETTE,
    alt: ctx.t(lines.vignette),
    title: ctx.t(def.title),
    date: memoryDate(ctx, s.day),
    self: s.firstTry ? `${self} ${ctx.t(t.firstTry)}` : self,
    returns: null,
  };
}

/**
 * Le moment peut-il venir d'ici la fin de la saison suivante (et de la partie) ? Les conditions
 * de jour se lisent d'avance, un drapeau doit déjà être posé (les mésanges attendent le nichoir
 * redressé); la météo et l'heure changent d'un jour à l'autre et ne comptent pas.
 */
function possibleBefore(world: ReadonlyWorld, def: MomentDef, lastDay: number): boolean {
  return def.availableWhen.every((c) =>
    c.type === 'day_at_least'
      ? c.day <= lastDay
      : c.type === 'flag'
        ? world.flags.includes(c.flag)
        : true,
  );
}

/**
 * Le moment de la rumeur de ce joueur aujourd'hui, ou `null`: jamais vu ensemble, avec une
 * rumeur, possible dans la saison en cours ou la suivante. Le premier joueur de la liste tire
 * parmi les moments d'index pair, l'autre d'index impair (les deux ont la même s'il n'en reste
 * qu'un); empreinte de la graine, du joueur et du jour, sans le générateur de la partie.
 */
export function rumorMoment(
  world: ReadonlyWorld,
  content: Content,
  viewer: CharacterId,
): MomentDef | null {
  const s = content.settings.memories;
  const day = world.clock.day;
  const horizon = Math.min(
    lastDayOfSeason(s, seasonIndex(s, day) + 1),
    content.settings.clock.lastDay.day,
  );
  const seen = new Set(world.memories.moments.map((m) => m.id));
  const pool = content.moments.filter(
    (def) =>
      def.mode !== 'quest' &&
      def.texts.rumor !== null &&
      content.settings.moments.tiers.includes(def.tier) &&
      !seen.has(def.id) &&
      possibleBefore(world, def, horizon),
  );
  if (pool.length === 0) return null;
  const parity = viewer === (world.characters[0]?.id ?? 'p1') ? 0 : 1;
  const mine = pool.filter((_, i) => i % 2 === parity);
  const list = mine.length > 0 ? mine : pool;
  return list[Math.floor(unitDraw(world.seed, `rumor:${viewer}`, day) * list.length)] ?? null;
}

/** La page Souvenirs de ce joueur. */
export function memoriesPageModel(world: ReadonlyWorld, ctx: UiContext): MemoriesPageModel {
  const t = ctx.texts.game.souvenirs;
  const s = ctx.content.settings.memories;
  // Plus récent d'abord. À jour égal, le moment avant la quête (les moments viennent surtout
  // l'après-midi et le soir), puis la dernière inscrite.
  const dated: { day: number; order: number; entry: MemoryEntryModel }[] = [];
  world.memories.moments.forEach((m, i) => {
    const entry = momentEntry(world, ctx, m);
    if (entry !== null) dated.push({ day: m.first, order: 1000 + i, entry });
  });
  world.memories.secrets.forEach((m, i) => {
    const entry = secretEntry(world, ctx, m);
    if (entry !== null) dated.push({ day: m.day, order: i, entry });
  });
  dated.sort((a, b) => b.day - a.day || b.order - a.order);
  const seasons: MemorySeasonModel[] = [];
  for (const d of dated) {
    const key = `season:${String(seasonIndex(s, d.day))}`;
    let group = seasons.at(-1);
    if (group?.key !== key) {
      group = { key, title: seasonTitle(ctx, d.day), entries: [] };
      seasons.push(group);
    }
    group.entries.push(d.entry);
  }
  const def = rumorMoment(world, ctx.content, ctx.me);
  const text =
    def?.texts.rumor === null || def === null ? undefined : ctx.texts.messages[def.texts.rumor];
  return {
    seasons,
    empty: seasons.length === 0 ? ctx.t(t.empty) : null,
    rumor: text === undefined ? null : { lead: ctx.t(t.rumorLead), text: ctx.t(text) },
  };
}
