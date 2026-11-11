/**
 * Lectures pures de la musique jouée, les mêmes chez l'hôte, chez l'invité et dans l'interface:
 * instrument en main, cahier de fanfare (airs connus, airs que l'instrument sait jouer, meilleur
 * mot), notes d'une voix, décompte avant le premier temps.
 */
import type { Content } from '../../donnees/charger';
import type { AirNote, AirScore, PlayableAirDef } from '../../donnees/schemas/air';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ItemDef } from '../../donnees/schemas/objets';
import type { Stack } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { isFound } from '../collections/registre';
import { recall } from '../regles/memoire';
import type { VoiceId } from './evenements';
import { MUSIC, type Rating } from './reglages';

export type Instrument = NonNullable<ItemDef['instrument']>;

/** L'instrument tenu en main (case choisie de la barre), ou `null`. */
export function heldInstrument(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): {
  readonly item: string;
  readonly instrument: Instrument;
  readonly stack: Readonly<Stack>;
} | null {
  const state = world.players[player];
  const stack = state.selected === null ? null : (state.toolbar[state.selected] ?? null);
  const instrument = stack === null ? undefined : content.items[stack.item]?.instrument;
  return stack === null || instrument === undefined
    ? null
    : { item: stack.item, instrument, stack };
}

/** Les airs qui ont leur partition, dans l'ordre du cahier. */
export function playableAirs(content: Content): PlayableAirDef[] {
  return Object.values(content.airs)
    .filter((air) => air.score !== undefined)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Cet instrument sait-il jouer cet air ? Son niveau ouvre les premiers rangs du cahier (4.5). */
export function instrumentPlays(content: Content, instrument: Instrument, air: string): boolean {
  const limit = MUSIC.airsPerTier[instrument.tier];
  const rank = playableAirs(content).findIndex((a) => a.id === air);
  return rank >= 0 && (limit === null || rank < limit);
}

export function bestKey(air: string): string {
  return `${MUSIC.memory.bestPrefix}${air}`;
}

/** Meilleur mot obtenu sur cet air (commun au duo), `null`: jamais joué. */
export function bestRating(world: ReadonlyWorld, air: string): Rating | null {
  const value = recall(world, bestKey(air))?.v;
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
}

export interface SongbookLine {
  readonly air: PlayableAirDef;
  readonly name: string;
  /** L'air est dans la collection du duo (carnet, famille des musiques). */
  readonly known: boolean;
  /** L'instrument en main sait le jouer. */
  readonly allowed: boolean;
  readonly best: Rating | null;
}

/** Les airs jouables que le duo a appris (chez l'hôte: l'album des collections fait foi). */
export function knownAirs(content: Content, world: ReadonlyWorld): string[] {
  return playableAirs(content)
    .filter((air) => isFound(world, air.id))
    .map((air) => air.id);
}

/**
 * Le cahier de fanfare de ce joueur, avec l'instrument qu'il tient. `known`: les airs appris,
 * tels que l'hôte les a annoncés à l'ouverture du cahier; absent: lus dans l'album (hôte).
 */
export function songbook(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
  known: readonly string[] = knownAirs(content, world),
): SongbookLine[] {
  const held = heldInstrument(content, world, player);
  return playableAirs(content).map((air) => ({
    air,
    name: content.book.entries[air.id]?.name ?? air.id,
    known: known.includes(air.id),
    allowed: held !== null && instrumentPlays(content, held.instrument, air.id),
    best: bestRating(world, air.id),
  }));
}

/** Les notes d'une voix; sans voix de duo écrites, tout le monde joue la voix seule. */
export function notesOf(score: AirScore, voice: VoiceId): readonly AirNote[] {
  if (voice === 'solo' || score.duo === undefined) return score.solo;
  return score.duo[voice];
}

/** Voix de chaque joueur selon qui joue: seul, la voix seule; à deux, le meneur prend la première. */
export function voicesFor(
  score: AirScore,
  leader: PlayerIndex,
  playing: readonly [boolean, boolean],
): [VoiceId | null, VoiceId | null] {
  const both = playing[0] && playing[1];
  const voiceOf = (player: PlayerIndex): VoiceId | null => {
    if (!playing[player]) return null;
    if (!both || score.duo === undefined) return 'solo';
    return player === leader ? 0 : 1;
  };
  return [voiceOf(0), voiceOf(1)];
}

/** Durée d'un temps (ms). */
export function beatMs(score: AirScore): number {
  return 60_000 / score.tempo;
}

/** Décompte avant le premier temps (ms): un nombre entier de temps de l'air. */
export function leadMs(score: AirScore): number {
  const beat = beatMs(score);
  return Math.max(MUSIC.countIn.beats, Math.ceil(MUSIC.countIn.minMs / beat)) * beat;
}
