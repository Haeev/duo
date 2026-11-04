/**
 * Format 14 (0.13, lot H1; conception `v0-13-habitants.md`, sections 0, 4.9 et 6.5): le carnet
 * des habitudes et les champs de l'amitié. Une sauvegarde d'avant se charge sans perte.
 */
import type { Content } from '../donnees/types';
import { emptyVillageFields } from '../etat/types-voisins';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Partie reprise d'une version antérieure (section 0): chaque habitant reçoit un lien de départ
 * (`bonds.earlierSaveStartPerQuest` par quête finie avec lui, au plus `earlierSaveStartMax`), et
 * les habitudes que le duo a forcément vues souvent sont au carnet (`habits.knownInEarlierSaves`).
 */
export function migrateToVillage(world: Record<string, unknown>, content: Content): void {
  const fields = emptyVillageFields();
  const b = content.settings.bonds;
  const quests = Array.isArray(world.quests) ? world.quests : [];
  for (const v of content.villagers) {
    const done = quests.filter(
      (q) =>
        isRecord(q) &&
        q.status === 'done' &&
        content.quests.find((d) => d.id === q.id)?.giver === v.id,
    ).length;
    const bond = Math.min(b.earlierSaveStartMax, done * b.earlierSaveStartPerQuest);
    if (bond > 0) fields.bonds[v.id] = bond;
  }
  for (const [villager, habits] of Object.entries(content.settings.habits.knownInEarlierSaves)) {
    if (habits.length > 0) fields.habits.known[villager] = [...habits];
  }
  Object.assign(world, fields);
}

/** Le carnet relu: assez de forme pour ne pas planter sur une sauvegarde abîmée (ce qui est invalide, ou `null`). */
export function villageShapeError(data: Record<string, unknown>): string | null {
  const h = data.habits;
  if (
    !isRecord(h) ||
    !isRecord(h.known) ||
    !isRecord(h.pending) ||
    !Array.isArray(h.log) ||
    !h.log.every((x) => typeof x === 'string')
  )
    return 'carnet des habitudes';
  for (const list of Object.values(h.known))
    if (!Array.isArray(list) || !list.every((x) => typeof x === 'string'))
      return 'carnet des habitudes';
  for (const per of Object.values(h.pending)) {
    if (!isRecord(per)) return 'carnet des habitudes';
    for (const p of Object.values(per))
      if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => typeof n === 'number'))
        return 'carnet des habitudes';
  }
  if (!isRecord(data.bonds) || !Object.values(data.bonds).every((n) => typeof n === 'number'))
    return 'liens';
  if (!isRecord(data.tastesKnown) || !isRecord(data.decisions) || !isRecord(data.storyDone))
    return 'amitié';
  return null;
}
