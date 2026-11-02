/**
 * Le tableau des annonces (tour 9, section 1): sorte du jour, gabarits possibles, tirage et
 * récompense. Pur (aucun générateur de la partie: `unitDraw`), pour que la simulation, les tests et
 * le script `tour9_automne.py` tirent la même suite d'annonces.
 */
import { dayOfSeason, seasonOfDay, weekdayOf } from '../donnees/calendrier';
import type { AnnonceDef, AnnonceKind, AnnonceLine, AnnonceReward, BoardSettings, Settings } from '../donnees/types';
import { unitDraw } from './tirage';

type Rules = Pick<Settings, 'calendar' | 'forage'>;

/** Sorte d'annonce affichée ce jour-là (`board.post`), ou `null` (pas d'affiche). */
export function postKindOn(board: BoardSettings, day: number): AnnonceKind | null {
  if (day < board.fromDay) return null;
  const weekday = weekdayOf(day);
  return board.post.find((p) => p.weekday === weekday)?.kind ?? null;
}

/**
 * Une cueillette peut-elle se trouver ce jour-là (de saison et dans sa plage de jours) ? Un objet
 * qui n'est pas une cueillette se trouve toujours.
 */
export function forageAvailableOn(settings: Rules, item: string, day: number): boolean {
  const def = settings.forage?.items.find((i) => i.item === item);
  if (def === undefined) return true;
  if (!def.seasons.includes(seasonOfDay(settings, day))) return false;
  if (def.days === null) return true;
  const d = dayOfSeason(settings, day);
  return d >= def.days[0] && d <= def.days[1];
}

/** Ce que le tirage lit de la partie. */
export interface AnnonceDrawInput {
  seed: number;
  day: number;
  /** Les derniers gabarits affichés et leur jour (règle des 10 jours). */
  recent: readonly { readonly gabarit: string; readonly day: number }[];
  /** Gabarits déjà affichés une fois. */
  posted: readonly string[];
  /** Habitant de l'annonce précédente, ou `null`. */
  lastGiver: string | null;
  /** Le duo peut-il fournir cette ligne (produit déjà obtenu, planches) ? */
  obtainable: (line: AnnonceLine) => boolean;
}

/** Variantes faisables d'un gabarit (lignes toutes obtenables, cueillettes de saison les trois jours). */
export function feasibleVariants(settings: Rules & Pick<Settings, 'board'>, def: AnnonceDef, input: Pick<AnnonceDrawInput, 'day' | 'obtainable'>): number[] {
  const days = settings.board?.deadlineDays ?? 1;
  const out: number[] = [];
  def.variants.forEach((lines, i) => {
    const ok = lines.every((l) => {
      for (let d = input.day; d < input.day + days; d++) if (!forageAvailableOn(settings, l.item, d)) return false;
      return input.obtainable(l);
    });
    if (ok) out.push(i);
  });
  return out;
}

/** Ce gabarit peut-il s'afficher ce jour-là (saison, jours de saison, faisabilité) ? Sans la règle des 10 jours. */
export function annonceEligible(settings: Rules & Pick<Settings, 'board'>, def: AnnonceDef, input: Pick<AnnonceDrawInput, 'day' | 'obtainable'>): boolean {
  if (!def.seasons.includes(seasonOfDay(settings, input.day))) return false;
  if (def.seasonDays !== null) {
    const d = dayOfSeason(settings, input.day);
    if (d < def.seasonDays[0] || d > def.seasonDays[1]) return false;
  }
  return feasibleVariants(settings, def, input).length > 0;
}

/** Tirage pondéré: le premier dont le cumul dépasse `u` (comme `pick_weighted` du script). */
function weighted<T>(u: number, pool: readonly T[], weight: (x: T) => number): T | null {
  const total = pool.reduce((sum, x) => sum + weight(x), 0);
  if (pool.length === 0 || total <= 0) return null;
  let acc = 0;
  for (const x of pool) {
    acc += weight(x) / total;
    if (u < acc) return x;
  }
  return pool[pool.length - 1] ?? null;
}

/**
 * L'annonce du jour (section 1.2), ou `null`: pas d'affiche ce jour-là, ou aucun gabarit possible.
 * Candidats de la sorte du jour, possibles, pas affichés depuis `noRepeatDays` jours; poids x
 * `neverPosted` aux jamais affichés, x `sameGiver` si l'habitant est celui de l'annonce précédente.
 * Variante (la vitrine d'Odette) tirée parmi les faisables par `unitDraw(seed, "annonce-variant", jour)`.
 */
export function drawAnnonce(
  settings: Rules & Pick<Settings, 'board'>,
  annonces: readonly AnnonceDef[],
  input: AnnonceDrawInput,
): { def: AnnonceDef; variant: number } | null {
  const board = settings.board;
  if (board === null) return null;
  const kind = postKindOn(board, input.day);
  if (kind === null) return null;
  const recentDay = (id: string): number | null => {
    let last: number | null = null;
    for (const r of input.recent) if (r.gabarit === id && (last === null || r.day > last)) last = r.day;
    return last;
  };
  const pool = annonces.filter((a) => {
    if (a.kind !== kind || !annonceEligible(settings, a, input)) return false;
    const last = recentDay(a.id);
    return last === null || input.day - last >= board.noRepeatDays;
  });
  const def = weighted(unitDraw(input.seed, 'annonce', input.day), pool, (a) => {
    let w = 1;
    if (!input.posted.includes(a.id)) w *= board.weights.neverPosted;
    if (a.giver === input.lastGiver) w *= board.weights.sameGiver;
    return w;
  });
  if (def === null) return null;
  const variants = feasibleVariants(settings, def, input);
  const u = variants.length > 1 ? unitDraw(input.seed, 'annonce-variant', input.day) : 0;
  const variant = variants[Math.min(variants.length - 1, Math.floor(u * variants.length))] ?? 0;
  return { def, variant };
}

/** Récompense (section 1.4): facteur x valeur de vente + ajout, arrondi à `round`, entre `min` et `max`. */
export function annonceReward(rule: AnnonceReward, lines: readonly AnnonceLine[], sellPrice: (item: string) => number): number {
  const value = lines.reduce((sum, l) => sum + l.count * sellPrice(l.item), 0);
  const raw = rule.factor * value + rule.add;
  const rounded = rule.round * Math.round(raw / rule.round);
  return Math.max(rule.min, Math.min(rule.max, rounded));
}
