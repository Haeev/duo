/**
 * Le carnet des collections (cahier 4.8): commun au duo, avec ce que chacun a trouvé. Une prise
 * nouvelle part en `collection_found` (`first`: nouvelle pour le duo, `mine`: pour ce joueur),
 * que l'interface, le rendu et le son fêtent (références de ressenti, section 3). Toute catégorie
 * passe par `recordFind`: un système qui n'existe pas encore (pêche, fouilles) l'appellera, ou
 * donnera l'objet de l'entrée (`item_gained` suffit).
 */
import type { Content } from '../../donnees/charger';
import type { Album, CollectionEntryDef, Find, Rarity } from '../../donnees/schemas/collections';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { SEASONS, WEATHERS, type Season, type Weather } from '../../donnees/schemas/temps';
import type { ReadonlyWorld } from '../../etat/monde';
import type { SimContext } from '../noyau/systemes';
import { calendarOf, inHours } from '../monde/calendrier';

const MAX_COUNT = 9999;

function albumOf(sim: SimContext): Album {
  const progress = sim.world.progress;
  progress.album ??= { f: {}, h: [] };
  return progress.album;
}

export interface FindResult {
  /** Nouvelle pour le duo. */
  readonly first: boolean;
  /** Nouvelle pour ce joueur. */
  readonly mine: boolean;
}

/** Entrées d'une catégorie dans un lieu (`place` absent: tous les lieux). */
export function entriesOf(
  content: Content,
  category: string,
  place?: string,
): CollectionEntryDef[] {
  return Object.values(content.book.entries).filter(
    (e) => e.category === category && (place === undefined || e.place === place),
  );
}

export function isFound(world: ReadonlyWorld, entry: string): boolean {
  return world.progress.album?.f[entry] !== undefined;
}

/**
 * Inscrit une prise au carnet. `record`: mesure de la prise (taille, poids) si la catégorie tient
 * un record. Entrée inconnue: rien (renvoie `null`).
 */
export function recordFind(
  sim: SimContext,
  player: PlayerIndex,
  entryId: string,
  record?: number,
): FindResult | null {
  const entry = sim.content.book.entries[entryId];
  if (entry === undefined) return null;
  const { world } = sim;
  const album = albumOf(sim);
  const before = album.f[entryId];
  const counts: [number, number] = before === undefined ? [0, 0] : [before[5], before[6]];
  const mine = counts[player] === 0;
  counts[player] = Math.min(MAX_COUNT, counts[player] + 1);
  const head: [PlayerIndex, number, number, number, number] =
    before === undefined
      ? [
          player,
          world.common.day,
          Math.min(1440, Math.floor(world.minutes)),
          WEATHERS.indexOf(world.common.weather),
          SEASONS.indexOf(calendarOf(sim.content, world.common.day).season),
        ]
      : [before[0], before[1], before[2], before[3], before[4]];
  let best: [number, PlayerIndex] | null = before?.length === 9 ? [before[7], before[8]] : null;
  const category = sim.content.book.categories.find((c) => c.id === entry.category);
  const beaten =
    record !== undefined &&
    category !== undefined &&
    category.record !== null &&
    (best === null || record > best[0]);
  if (beaten) best = [record, player];
  const next: Find = best === null ? [...head, ...counts] : [...head, ...counts, ...best];
  album.f[entryId] = next;
  sim.touch('progress');
  sim.emit({
    type: 'collection_found',
    player,
    entry: entryId,
    category: entry.category,
    first: before === undefined,
    mine,
  });
  if (beaten) sim.emit({ type: 'collection_record', player, entry: entryId, value: record });
  if (before === undefined) {
    const all = entriesOf(sim.content, entry.category, entry.place);
    if (all.every((e) => album.f[e.id] !== undefined))
      sim.emit({ type: 'collection_completed', category: entry.category, place: entry.place });
  }
  return { first: before === undefined, mine };
}

/** Un habitant a parlé de cette entrée: le carnet montre ses conditions avant la première prise. */
export function revealHint(sim: SimContext, entryId: string): void {
  if (!(entryId in sim.content.book.entries)) return;
  const album = albumOf(sim);
  if (album.h.includes(entryId) || album.f[entryId] !== undefined) return;
  album.h.push(entryId);
  sim.touch('progress');
}

/** Poids d'apparition d'une entrée (R58): multiplié par le coup de pouce tant que le duo ne l'a pas. */
export function boostedWeight(
  look: { content: Content; world: ReadonlyWorld },
  entry: string,
  weight: number,
): number {
  return isFound(look.world, entry)
    ? weight
    : weight * look.content.time.file.collections.newEntryBoost;
}

/** Les conditions d'une rareté sont réunies (heure, météo, saison): CA-07. */
export function rarityMet(
  rarity: Rarity | null,
  minutes: number,
  weather: Weather,
  season: Season,
): boolean {
  if (rarity === null) return true;
  return (
    inHours(rarity.hours, minutes) &&
    (rarity.weathers.length === 0 || rarity.weathers.includes(weather)) &&
    (rarity.seasons.length === 0 || rarity.seasons.includes(season))
  );
}

// Lecture pour l'interface (onglet Collections du carnet).

export interface BookEntryView {
  readonly id: string;
  readonly name: string;
  readonly place: string;
  /** Trouvée par chaque joueur. */
  readonly by: readonly [boolean, boolean];
  /** Premier à l'avoir trouvée (son prénom s'affiche), `null`: pas encore. */
  readonly firstBy: PlayerIndex | null;
  /** Moment de la première prise. */
  readonly foundOn: {
    readonly day: number;
    readonly minute: number;
    readonly weather: Weather;
    readonly season: Season;
  } | null;
  /** Conditions à montrer (après la première prise ou un indice), sinon `null`. */
  readonly rarity: Rarity | null;
  readonly record: { readonly value: number; readonly by: PlayerIndex } | null;
}

export interface BookCategoryView {
  readonly id: string;
  readonly name: string;
  readonly found: number;
  readonly total: number;
  readonly entries: readonly BookEntryView[];
}

/** Le carnet des collections, par catégorie, dans l'ordre des données (`place`: un seul lieu). */
export function collectionBook(
  world: ReadonlyWorld,
  content: Content,
  place?: string,
): BookCategoryView[] {
  const album = world.progress.album;
  return content.book.categories.map((category) => {
    const entries = entriesOf(content, category.id, place).map((entry): BookEntryView => {
      const find = album?.f[entry.id];
      const shown = find !== undefined || (album?.h.includes(entry.id) ?? false);
      return {
        id: entry.id,
        name: entry.name,
        place: entry.place,
        by: find === undefined ? [false, false] : [find[5] > 0, find[6] > 0],
        firstBy: find === undefined ? null : find[0],
        foundOn:
          find === undefined
            ? null
            : {
                day: find[1],
                minute: find[2],
                weather: WEATHERS[find[3]] ?? 'clear',
                season: SEASONS[find[4]] ?? 'spring',
              },
        rarity: shown ? entry.rarity : null,
        record: find?.length === 9 ? { value: find[7], by: find[8] } : null,
      };
    });
    return {
      id: category.id,
      name: category.name,
      found: entries.filter((e) => e.firstBy !== null).length,
      total: entries.length,
      entries,
    };
  });
}
