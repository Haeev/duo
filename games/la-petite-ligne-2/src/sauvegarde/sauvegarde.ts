/**
 * Sauvegarde: l'état complet (tous les lieux) en JSON, contrôlé par schéma à la lecture.
 * Jusqu'à l'Alpha, une sauvegarde d'un autre format ou d'un autre duo n'est pas migrée: la partie
 * repart de zéro (décision du client du 2026-11-10, ADR 0017) et l'écriture continue normalement.
 */
import type { LoadedSave, SaveSnapshot } from '@duo/sdk';
import * as v from 'valibot';
import type { Content } from '../donnees/charger';
import { DATA_SCHEMA, WorldSchema, type WorldState } from '../etat/monde';
import { MINUTES_PER_DAY } from '../simulation/noyau/constantes';
import type { Member } from '../simulation/noyau/monde';

export function snapshotOf(world: WorldState): SaveSnapshot {
  const hours = Math.floor(world.minutes / 60) % 24;
  const minutes = Math.floor(world.minutes % 60);
  const time = `${hours} h ${String(minutes).padStart(2, '0')}`;
  return {
    label: `Jour ${world.common.day}, ${time}`.slice(0, 40),
    dataSchema: DATA_SCHEMA,
    data: world,
  };
}

export type RestoreResult = { ok: true; world: WorldState } | { ok: false; reason: string };

/** Relit une sauvegarde; un refus dit pourquoi, pour le journal et pour le message aux joueurs. */
export function restoreWorld(
  content: Content,
  loaded: Pick<LoadedSave, 'dataSchema' | 'data'>,
  members: readonly [Member, Member],
): RestoreResult {
  if (loaded.dataSchema !== DATA_SCHEMA)
    return { ok: false, reason: `format ${loaded.dataSchema}, attendu ${DATA_SCHEMA}` };
  const parsed = v.safeParse(WorldSchema, loaded.data);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    return { ok: false, reason: `${v.getDotPath(issue) ?? 'racine'}: ${issue.message}` };
  }
  const world = parsed.output;
  const saved = world.players.map((p) => p.member).sort();
  const now = members.map((m) => m.id).sort();
  if (saved[0] !== now[0] || saved[1] !== now[1])
    return { ok: false, reason: 'sauvegarde d’un autre duo' };
  if (!(world.common.place in content.places) || !(world.common.place in world.places))
    return { ok: false, reason: `lieu inconnu: ${world.common.place}` };
  if (world.minutes >= MINUTES_PER_DAY) world.minutes = 0;
  return { ok: true, world };
}
