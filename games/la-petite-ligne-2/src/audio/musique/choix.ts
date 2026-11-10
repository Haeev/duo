/**
 * Choix de la musique, logique pure (testée dans Node): du contexte du jeu (lieu, heure, météo,
 * saison, phase, scène, événement) vers un morceau et des couches, et d'un événement vers un jingle.
 */
import type { GameEvent } from '../../simulation/noyau/evenements';
import type { JingleRule, MusicTable, When } from './schemas';

export interface MusicContext {
  readonly place: string;
  /** Zone du lieu où se trouve le joueur de cette machine, `null` si inconnue. */
  readonly zone: string | null;
  /** Heure de jeu, de 0 à 24. */
  readonly hour: number;
  readonly weather: string;
  readonly season: string;
  readonly phase: string;
  readonly scene: string | null;
  readonly events: readonly string[];
}

export interface MusicChoice {
  readonly rule: string | null;
  readonly track: string | null;
  readonly pacing: string;
  /** Écart de niveau par rôle de tige (dB), somme des couches retenues. */
  readonly stemsDb: Readonly<Record<string, number>>;
  readonly gainDb: number;
  /** Passe-bas du morceau (Hz), `null`: ouvert. */
  readonly lowpassHz: number | null;
  /** Couches retenues (pour les tests et le diagnostic). */
  readonly modifiers: readonly string[];
}

/** Tranche horaire de cette heure (la première de la table qui la contient). */
export function bandOf(table: MusicTable, hour: number): string | null {
  const h = ((hour % 24) + 24) % 24;
  for (const [id, [from, to]] of Object.entries(table.bands)) {
    if (from === to) return id;
    if (from < to ? h >= from && h < to : h >= from || h < to) return id;
  }
  return null;
}

function listed(list: readonly string[] | undefined, value: string | null): boolean {
  return list === undefined || (value !== null && list.includes(value));
}

export function whenMatches(when: When, ctx: MusicContext, band: string | null): boolean {
  return (
    listed(when.places, ctx.place) &&
    listed(when.zones, ctx.zone) &&
    listed(when.bands, band) &&
    listed(when.weathers, ctx.weather) &&
    listed(when.seasons, ctx.season) &&
    listed(when.phases, ctx.phase) &&
    listed(when.scenes, ctx.scene) &&
    (when.events === undefined || when.events.some((id) => ctx.events.includes(id)))
  );
}

/** Ce qui doit jouer dans ce contexte: première règle qui convient, puis toutes les couches qui conviennent. */
export function choose(table: MusicTable, ctx: MusicContext): MusicChoice {
  const band = bandOf(table, ctx.hour);
  const rule = table.rules.find((r) => whenMatches(r.when, ctx, band)) ?? null;
  const stemsDb: Record<string, number> = {};
  let gainDb = 0;
  let lowpassHz: number | null = null;
  const used: string[] = [];
  if (rule !== null && rule.play !== null) {
    for (const modifier of table.modifiers) {
      if (!whenMatches(modifier.when, ctx, band)) continue;
      used.push(modifier.id);
      gainDb += modifier.gainDb;
      for (const [stem, db] of Object.entries(modifier.stemsDb))
        stemsDb[stem] = (stemsDb[stem] ?? 0) + db;
      if (modifier.lowpassHz !== undefined)
        lowpassHz =
          lowpassHz === null ? modifier.lowpassHz : Math.min(lowpassHz, modifier.lowpassHz);
    }
  }
  return {
    rule: rule?.id ?? null,
    track: rule?.play ?? null,
    pacing: rule?.pacing ?? 'steady',
    stemsDb,
    gainDb,
    lowpassHz,
    modifiers: used,
  };
}

export interface JingleHit {
  readonly jingle: string;
  /** L'événement concerne l'autre joueur: un peu plus bas. */
  readonly own: boolean;
}

type Fields = Readonly<Record<string, unknown>>;

function ruleMatches(rule: JingleRule, event: Fields): boolean {
  if (event.type !== rule.on) return false;
  return Object.entries(rule.where).every(([field, expected]) => event[field] === expected);
}

/** Le jingle que cet événement déclenche pour le joueur `local`, ou `null`. */
export function jingleForEvent(
  table: MusicTable,
  event: GameEvent,
  local: 0 | 1 | null,
): JingleHit | null {
  const fields = event as unknown as Fields;
  for (const rule of table.jingleRules) {
    if (!ruleMatches(rule, fields)) continue;
    const raw = fields[rule.actor];
    const actor = raw === 0 || raw === 1 ? raw : null;
    const own = actor === null || actor === local;
    if (rule.audience === 'own' && !own) return null;
    return { jingle: rule.jingle, own };
  }
  return null;
}
