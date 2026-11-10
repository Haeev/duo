/**
 * Verrous d'histoire (ADR 0022): un passage fermé par un obstacle visible, ouvert quand toutes
 * ses conditions (`opens`) sont vraies. Aucun état propre: tout se déduit de la progression et de
 * l'heure, transmises à l'invité. L'hôte et la prédiction de l'invité trouvent donc les mêmes
 * obstacles. Fonctions pures.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { LockDef } from '../../donnees/schemas/lieu';
import type { ReadonlyWorld } from '../../etat/monde';
import { evaluateAll } from '../regles/conditions';

/** Ce que lit un lieu: l'état transmis et le contenu (un `SimContext` ou un `Look` conviennent). */
export interface PlaceLook {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** Les verrous de la carte, dans l'ordre du fichier (le même chez les deux joueurs). */
export function locksOf(place: PlaceContent): readonly (readonly [string, LockDef])[] {
  return Object.entries(place.map.locks ?? {});
}

export function isLockDefOpen(look: PlaceLook, lock: LockDef): boolean {
  return evaluateAll({ world: look.world, content: look.content, actor: null }, lock.opens);
}

/** Le verrou `id` du lieu courant est-il ouvert ? Un verrou inconnu compte pour ouvert. */
export function isLockOpen(look: PlaceLook, id: string): boolean {
  const lock = look.content.places[look.world.common.place]?.map.locks?.[id];
  return lock === undefined || isLockDefOpen(look, lock);
}

/**
 * Relit l'état des verrous d'un lieu dans `states` (1 ouvert, 0 fermé, dans l'ordre du fichier);
 * vrai si l'un a changé. Sans allocation: les caches des obstacles et des zones s'y fient.
 */
export function refreshLockStates(
  look: PlaceLook,
  place: PlaceContent,
  states: Uint8Array,
): boolean {
  let changed = false;
  let i = 0;
  const locks = place.map.locks;
  for (const id in locks) {
    const lock = locks[id];
    const open = lock === undefined || isLockDefOpen(look, lock) ? 1 : 0;
    if (states[i] !== open) {
      states[i] = open;
      changed = true;
    }
    i++;
  }
  return changed;
}

/** Nombre de verrous du lieu (taille du tableau d'états). */
export function lockCount(place: PlaceContent): number {
  return Object.keys(place.map.locks ?? {}).length;
}

/** Identifiants des verrous fermés du lieu courant. */
export function closedLocks(look: PlaceLook): ReadonlySet<string> {
  const out = new Set<string>();
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return out;
  for (const [id, lock] of locksOf(place)) if (!isLockDefOpen(look, lock)) out.add(id);
  return out;
}

/** Le verrou dont cet objet de la carte est l'obstacle visible, `null` s'il n'en est d'aucun. */
export function lockOfObject(place: PlaceContent, object: string): string | null {
  for (const [id, lock] of locksOf(place)) if (lock.object === object) return id;
  return null;
}

/** Marque d'un 1 dans `cells` les cases des verrous fermés (`states` de `refreshLockStates`). */
export function markClosedLocks(
  place: PlaceContent,
  states: Uint8Array,
  cells: Uint8Array,
  width: number,
  height: number,
): void {
  let i = 0;
  for (const [, lock] of locksOf(place)) {
    if (states[i++] === 1) continue;
    for (const r of lock.rects)
      for (let cy = Math.max(0, r.y); cy < Math.min(height, r.y + r.h); cy++)
        for (let cx = Math.max(0, r.x); cx < Math.min(width, r.x + r.w); cx++)
          cells[cy * width + cx] = 1;
  }
}
