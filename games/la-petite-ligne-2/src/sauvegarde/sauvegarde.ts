/**
 * Sauvegarde: l'état complet (tous les lieux) en JSON, contrôlé et migré à la lecture.
 * Pendant la refonte, une sauvegarde d'une étape précédente est refusée poliment et la partie
 * repart de zéro (décision du client du 2026-11-10, ADR 0017); l'écriture continue normalement.
 */
import type { LoadedSave, SaveSnapshot } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import { DATA_SCHEMA, type WorldState } from '../etat/monde';
import type { Member } from '../simulation/noyau/monde';
import { readSave, type ReadFailure } from './format';
import { matchMembers, seatMembers, settleForResume } from './reprise';
import { storyProgress } from './seance';
import { fillText, SAVE_TEXTS } from './textes';

const LABEL_MAX = 40;

/** Ce que le salon de Duo montre d'une partie: où, quand, qui. */
export interface SaveSummary {
  readonly place: string;
  readonly day: number;
  readonly hours: number;
  readonly minutes: number;
  readonly players: readonly [string, string];
}

export function summaryOf(world: WorldState, content?: Content): SaveSummary {
  return {
    place: content?.places[world.common.place]?.def.name ?? '',
    day: world.common.day,
    hours: Math.floor(world.minutes / 60) % 24,
    minutes: Math.floor(world.minutes % 60),
    players: [world.players[0].name, world.players[1].name],
  };
}

/** Fiche du salon, 40 caractères au plus: les prénoms sautent d'abord, puis le nom du lieu se coupe. */
export function labelOf(summary: SaveSummary): string {
  const values = {
    place: summary.place,
    day: summary.day,
    hours: summary.hours,
    minutes: String(summary.minutes).padStart(2, '0'),
    players: summary.players.join(SAVE_TEXTS.playersJoin),
  };
  if (summary.place === '')
    return fillText(SAVE_TEXTS.labelWithoutPlace, values).slice(0, LABEL_MAX);
  const full = fillText(SAVE_TEXTS.labelWithPlayers, values);
  if (full.length <= LABEL_MAX) return full;
  const plain = fillText(SAVE_TEXTS.label, values);
  if (plain.length <= LABEL_MAX) return plain;
  const tail = fillText(SAVE_TEXTS.label, { ...values, place: '' });
  const room = LABEL_MAX - tail.length - 1;
  return `${summary.place.slice(0, Math.max(1, room))}…${tail}`.slice(0, LABEL_MAX);
}

/**
 * Instantané à enregistrer. Les données sont l'état lui-même, sans copie: le SDK les sérialise
 * tout de suite (avant le prochain pas), et une copie profonde coûterait autant que l'écriture.
 */
export function snapshotOf(world: WorldState, content?: Content): SaveSnapshot {
  // Avancement de l'histoire: la plateforme le reprend dans la fiche, l'historique et le score.
  const progress = content === undefined ? null : storyProgress(content, world);
  return {
    label: labelOf(summaryOf(world, content)),
    ...(progress === null ? {} : { progress }),
    dataSchema: DATA_SCHEMA,
    data: world,
  };
}

/** Message à montrer aux joueurs à la reprise: `info` (reprise avec une remarque) ou `refused` (partie neuve). */
export interface ResumeNotice {
  readonly kind: 'info' | 'refused';
  readonly message: string;
}

export type RestoreResult =
  | { readonly ok: true; readonly world: WorldState; readonly notice: ResumeNotice | null }
  | { readonly ok: false; readonly reason: string; readonly notice: ResumeNotice };

const REFUSAL_TEXT: Readonly<Record<ReadFailure | 'other-duo' | 'unknown-place', string>> = {
  'older-stage': SAVE_TEXTS.refused.olderStage,
  newer: SAVE_TEXTS.refused.newer,
  damaged: SAVE_TEXTS.refused.damaged,
  'other-duo': SAVE_TEXTS.refused.otherDuo,
  'unknown-place': SAVE_TEXTS.refused.unknownPlace,
};

function refusal(kind: keyof typeof REFUSAL_TEXT, reason: string): RestoreResult {
  return { ok: false, reason, notice: { kind: 'refused', message: REFUSAL_TEXT[kind] } };
}

/**
 * Relit une sauvegarde pour ces deux joueurs. Ne lève jamais: un refus dit pourquoi (`reason`, pour
 * le journal) et ce qu'il faut dire aux joueurs (`notice`). Un seul joueur connu de la sauvegarde:
 * l'autre prend la place du personnage absent (voir `matchMembers`).
 */
export function restoreWorld(
  content: Content,
  loaded: Pick<LoadedSave, 'dataSchema' | 'data'>,
  members: readonly [Member, Member],
): RestoreResult {
  const read = readSave(loaded);
  if (!read.ok) return refusal(read.kind, read.reason);
  const world = read.world;
  const match = matchMembers(world, members);
  if (match.kind === 'other-duo') return refusal('other-duo', 'sauvegarde d’un autre duo');
  const place = world.common.place;
  if (!(place in content.places) || !(place in world.places))
    return refusal('unknown-place', `lieu inconnu: ${place}`);
  const replaced = seatMembers(world, members, match);
  settleForResume(content, world);
  return {
    ok: true,
    world,
    notice: replaced === null ? null : { kind: 'info', message: replaced },
  };
}
