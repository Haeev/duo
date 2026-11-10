/**
 * Progression envoyée par différences et par morceaux (lot L1). La tranche entière approche son
 * budget (29 Ko au pire pour 32 Kio): elle part ici sur un canal fiable, en révisions. Une
 * révision est soit complète (`base: -1`, au départ, à la reprise et au filet de sécurité), soit
 * une différence par rapport à la révision précédente (clés écrites ou retirées). Chaque révision
 * se découpe en morceaux d'environ `partBytes`: aucune ne déborde, quel que soit le contenu.
 *
 * Canal proposé à L0 (`canaux.ts`): 8, fiable, budget 16 Kio. Tant qu'il n'y est pas, il vit ici.
 */
import * as v from 'valibot';
import { IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';
import { FactSchema, ProgressSchema, QuestSchema, type ProgressState } from '../etat/progression';

export const PROGRESS_PART_CHANNEL = 8;
export const PROGRESS_PART_BUDGET_BYTES = 16_384;

/** Les dictionnaires de la progression, envoyés clé par clé. */
const RECORDS = ['memory', 'bonds', 'quests', 'collections'] as const;
type RecordKey = (typeof RECORDS)[number];

const MAX_KEYS = 400;

const SetSchema = v.strictObject({
  memory: v.exactOptional(v.record(v.string(), FactSchema)),
  bonds: v.exactOptional(v.record(IdSchema, v.pipe(IntSchema, v.minValue(0)))),
  quests: v.exactOptional(v.record(IdSchema, QuestSchema)),
  collections: v.exactOptional(v.record(IdSchema, v.array(IdSchema))),
  opened: v.exactOptional(v.array(IdSchema)),
});
const KeysSchema = v.pipe(v.array(v.string()), v.maxLength(MAX_KEYS));
const DropSchema = v.strictObject({
  memory: v.exactOptional(KeysSchema),
  bonds: v.exactOptional(KeysSchema),
  quests: v.exactOptional(KeysSchema),
  collections: v.exactOptional(KeysSchema),
});

export const ProgressPartSchema = v.strictObject({
  tick: TickSchema,
  rev: v.pipe(IntSchema, v.minValue(0)),
  /** Révision de départ; -1: révision complète, à partir d'une progression vide. */
  base: v.pipe(IntSchema, v.minValue(-1)),
  part: v.pipe(IntSchema, v.minValue(0)),
  parts: v.pipe(IntSchema, v.minValue(1), v.maxValue(64)),
  set: SetSchema,
  drop: DropSchema,
});
export type ProgressPart = v.InferOutput<typeof ProgressPartSchema>;

type SetPart = ProgressPart['set'];
type DropPart = ProgressPart['drop'];

const encoder = new TextEncoder();
function bytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

function emptyProgress(): ProgressState {
  return { memory: {}, bonds: {}, quests: {}, collections: {}, opened: [] };
}

/** Copie profonde par JSON: l'hôte garde ce qu'il a envoyé, sans partage avec le monde. */
export function cloneProgress(progress: ProgressState): ProgressState {
  return v.parse(ProgressSchema, JSON.parse(JSON.stringify(progress)));
}

interface Entry {
  readonly kind: 'set' | 'drop';
  readonly record: RecordKey | 'opened';
  readonly key: string;
  readonly value: unknown;
  readonly size: number;
}

/** Les écritures qui mènent de `from` (`null`: vide) à `to`. */
function entries(from: ProgressState | null, to: ProgressState): Entry[] {
  const out: Entry[] = [];
  for (const record of RECORDS) {
    const before: Record<string, unknown> = from?.[record] ?? {};
    const after: Record<string, unknown> = to[record];
    for (const [key, value] of Object.entries(after)) {
      const old = before[key];
      if (old !== undefined && JSON.stringify(old) === JSON.stringify(value)) continue;
      out.push({ kind: 'set', record, key, value, size: bytes(key) + bytes(value) + 2 });
    }
    for (const key of Object.keys(before))
      if (!(key in after))
        out.push({ kind: 'drop', record, key, value: null, size: bytes(key) + 1 });
  }
  if (from === null || JSON.stringify(from.opened) !== JSON.stringify(to.opened))
    out.push({ kind: 'set', record: 'opened', key: '', value: to.opened, size: bytes(to.opened) });
  return out;
}

function applyEntry(set: SetPart, drop: DropPart, entry: Entry): void {
  if (entry.record === 'opened') {
    set.opened = entry.value as string[];
    return;
  }
  if (entry.kind === 'drop') {
    const list = drop[entry.record] ?? [];
    list.push(entry.key);
    drop[entry.record] = list;
    return;
  }
  // Les valeurs viennent d'une progression déjà valide: elles gardent le type de leur dictionnaire.
  const target = (set[entry.record] ?? {}) as Record<string, unknown>;
  target[entry.key] = entry.value;
  (set as Record<string, unknown>)[entry.record] = target;
}

/** Enveloppe d'un morceau, sans ses écritures (pour la marge de taille). */
const ENVELOPE_BYTES = 160;

/**
 * Les morceaux d'une révision. `previous` `null`: révision complète. Une différence plus lourde
 * que la moitié de la progression part en complète (plus simple à rattraper, pas plus lourde).
 */
export function progressParts(
  previous: ProgressState | null,
  current: ProgressState,
  rev: number,
  baseRev: number,
  tick: number,
  partBytes: number,
): ProgressPart[] {
  let list = entries(previous, current);
  let base = previous === null ? -1 : baseRev;
  if (previous !== null) {
    const diffSize = list.reduce((sum, e) => sum + e.size, 0);
    if (diffSize > bytes(current) / 2) {
      list = entries(null, current);
      base = -1;
    }
  }
  const groups: Entry[][] = [[]];
  let size = ENVELOPE_BYTES;
  let keys = 0;
  for (const entry of list) {
    const group = groups[groups.length - 1];
    if (group === undefined) break;
    if (group.length > 0 && (size + entry.size > partBytes || keys >= MAX_KEYS)) {
      groups.push([entry]);
      size = ENVELOPE_BYTES + entry.size;
      keys = 1;
    } else {
      group.push(entry);
      size += entry.size;
      keys += 1;
    }
  }
  return groups.map((group, part) => {
    const set: SetPart = {};
    const drop: DropPart = {};
    for (const entry of group) applyEntry(set, drop, entry);
    return { tick, rev, base, part, parts: groups.length, set, drop };
  });
}

/** Côté invité: assemble les révisions dans l'ordre; une révision orpheline attend la prochaine complète. */
export interface ProgressAssembler {
  /** Renvoie la progression quand une révision vient d'être complétée, sinon `null`. */
  receive(part: ProgressPart): ProgressState | null;
  current(): ProgressState | null;
  /** Reprise de la liaison: les différences attendent la prochaine révision complète. */
  reset(): void;
}

export function createProgressAssembler(): ProgressAssembler {
  let current: ProgressState | null = null;
  let applied = -1;
  let staging: ProgressState | null = null;
  let stagingRev = -1;
  let nextPart = 0;

  function apply(target: ProgressState, part: ProgressPart): void {
    for (const record of RECORDS) {
      const dict: Record<string, unknown> = target[record];
      for (const key of part.drop[record] ?? []) Reflect.deleteProperty(dict, key);
      for (const [key, value] of Object.entries(part.set[record] ?? {})) dict[key] = value;
    }
    if (part.set.opened !== undefined) target.opened = [...part.set.opened];
  }

  return {
    receive(part) {
      if (part.part === 0) {
        if (part.base === -1) staging = emptyProgress();
        else if (current !== null && part.base === applied) staging = cloneProgress(current);
        else staging = null;
        stagingRev = part.rev;
        nextPart = 0;
      }
      if (staging === null || part.rev !== stagingRev || part.part !== nextPart) {
        staging = null;
        return null;
      }
      apply(staging, part);
      nextPart += 1;
      if (nextPart < part.parts) return null;
      const done = v.safeParse(ProgressSchema, staging);
      staging = null;
      if (!done.success) return null;
      current = done.output;
      applied = part.rev;
      return current;
    },
    current() {
      return current;
    },
    reset() {
      // On garde la progression affichée: seules les différences attendent la prochaine complète.
      applied = -1;
      staging = null;
    },
  };
}
