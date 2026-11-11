/**
 * État envoyé par différences et par morceaux, une clé par entité (mission M3, même méthode que
 * `progression.ts`, mais sans rien connaître du contenu). L'état est un objet JSON dont chaque
 * champ se transmet selon sa forme, lue à l'exécution:
 *
 * - objet (dictionnaire): une entrée par clé (meubles, habitants, commerces...);
 * - tableau d'objets qui ont tous un `id`: une entrée par `id`, ordre gardé (sol, meubles posés);
 * - tout le reste: la valeur entière, quand elle change (compteurs, jour du départ).
 *
 * Un système qui ajoute un champ à l'état d'un lieu est donc transmis sans rien coder de plus.
 * Une révision est complète (`base: -1`) ou une différence par rapport à la précédente; elle se
 * découpe en morceaux d'environ `partBytes`. Chez l'invité, l'état n'est publié qu'une révision
 * entière reçue et validée par le schéma complet: jamais d'état à moitié appliqué.
 */
import * as v from 'valibot';
import { IdSchema, IntSchema, TickSchema } from '../donnees/schemas/communs';

/** Forme d'un champ: dictionnaire, liste à identifiants, valeur entière. */
type Kind = 'd' | 'l' | 'v';

/** Une écriture: `[champ, forme, clé, valeur]`; sans valeur, un retrait. Clé vide pour une valeur entière. */
const OpSchema = v.union([
  // Le retrait d'abord, et strict: un 4e élément `unknown` accepterait `undefined` et ferait d'un
  // retrait une écriture.
  v.strictTuple([v.string(), v.picklist(['d', 'l', 'v']), v.string()]),
  v.strictTuple([v.string(), v.picklist(['d', 'l', 'v']), v.string(), v.unknown()]),
]);
type Op = v.InferOutput<typeof OpSchema>;

const MAX_OPS = 2000;

export const KeyedPartSchema = v.strictObject({
  tick: TickSchema,
  /** Ce que décrit l'état (le lieu): une différence ne s'applique qu'à la même cible. */
  target: IdSchema,
  rev: v.pipe(IntSchema, v.minValue(0)),
  /** Révision de départ; -1: révision complète, à partir d'un état vide. */
  base: v.pipe(IntSchema, v.minValue(-1)),
  part: v.pipe(IntSchema, v.minValue(0)),
  parts: v.pipe(IntSchema, v.minValue(1), v.maxValue(64)),
  ops: v.pipe(v.array(OpSchema), v.maxLength(MAX_OPS)),
});
export type KeyedPart = v.InferOutput<typeof KeyedPartSchema>;

type Doc = Record<string, unknown>;

const encoder = new TextEncoder();
function bytes(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

function isDict(value: unknown): value is Doc {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function idOf(value: unknown): string | null {
  if (!isDict(value)) return null;
  const id = value.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}

function kindOf(value: unknown): Kind {
  if (isDict(value)) return 'd';
  if (Array.isArray(value) && value.every((item) => idOf(item) !== null)) return 'l';
  return 'v';
}

/** Entrées d'un champ par clé (dictionnaire) ou par identifiant (liste), dans leur ordre. */
function entriesOf(kind: Kind, value: unknown): [string, unknown][] {
  if (kind === 'd' && isDict(value)) return Object.entries(value);
  if (kind === 'l' && Array.isArray(value))
    return value.map((item): [string, unknown] => [idOf(item) ?? '', item]);
  return [];
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** Une liste mise à jour sur place garde l'ordre: retraits, puis nouveaux à la fin. Sinon, révision complète. */
function keepsOrder(before: [string, unknown][], after: [string, unknown][]): boolean {
  const kept = new Set(after.map(([key]) => key));
  const old = new Set(before.map(([key]) => key));
  const expected = before.map(([key]) => key).filter((key) => kept.has(key));
  for (const [key] of after) if (!old.has(key)) expected.push(key);
  return expected.length === after.length && expected.every((key, i) => after[i]?.[0] === key);
}

/** Les écritures qui mènent de `from` (`null`: vide) à `to`; `null` si seule une complète convient. */
function diffOps(from: Doc | null, to: Doc): Op[] | null {
  const ops: Op[] = [];
  for (const [field, after] of Object.entries(to)) {
    const kind = kindOf(after);
    const before = from?.[field];
    if (kind === 'v') {
      if (before === undefined || !same(before, after)) ops.push([field, 'v', '', after]);
      continue;
    }
    const fresh = before === undefined || kindOf(before) !== kind;
    const old = fresh ? [] : entriesOf(kind, before);
    const now = entriesOf(kind, after);
    if (kind === 'l' && !fresh && !keepsOrder(old, now)) return null;
    // Un conteneur neuf part vide d'abord: un dictionnaire sans entrée existe quand même.
    if (fresh) ops.push([field, 'v', '', kind === 'd' ? {} : []]);
    const previous = new Map(old);
    for (const [key, value] of now) {
      const was = previous.get(key);
      if (was === undefined || !same(was, value)) ops.push([field, kind, key, value]);
    }
    const kept = new Set(now.map(([key]) => key));
    for (const [key] of old) if (!kept.has(key)) ops.push([field, kind, key]);
  }
  if (from !== null)
    for (const field of Object.keys(from)) if (!(field in to)) ops.push([field, 'v', '']);
  return ops;
}

/** Enveloppe d'un morceau, sans ses écritures (marge de taille). */
const ENVELOPE_BYTES = 160;

export interface KeyedRevision {
  readonly parts: KeyedPart[];
  /** `true`: la révision part complète (première, reprise, ordre changé, différence trop lourde). */
  readonly full: boolean;
  /** Aucune écriture: rien à envoyer pour une différence. */
  readonly empty: boolean;
}

/**
 * Les morceaux d'une révision. `previous` `null`: révision complète. Une différence plus lourde
 * que la moitié de l'état part en complète (pas plus lourde, et plus simple à rattraper).
 */
export function keyedParts(
  previous: Doc | null,
  current: Doc,
  head: {
    readonly target: string;
    readonly rev: number;
    readonly baseRev: number;
    readonly tick: number;
  },
  partBytes: number,
): KeyedRevision {
  let ops = diffOps(previous, current);
  let full = previous === null || ops === null;
  if (ops !== null && !full) {
    const size = ops.reduce((sum, op) => sum + bytes(op) + 1, 0);
    if (size > bytes(current) / 2) full = true;
  }
  if (full || ops === null) ops = diffOps(null, current) ?? [];
  const groups: Op[][] = [[]];
  let size = ENVELOPE_BYTES;
  for (const op of ops) {
    const group = groups[groups.length - 1];
    if (group === undefined) break;
    const opBytes = bytes(op) + 1;
    if (group.length > 0 && (size + opBytes > partBytes || group.length >= MAX_OPS)) {
      groups.push([op]);
      size = ENVELOPE_BYTES + opBytes;
    } else {
      group.push(op);
      size += opBytes;
    }
  }
  const parts = groups.map((group, part) => ({
    tick: head.tick,
    target: head.target,
    rev: head.rev,
    base: full ? -1 : head.baseRev,
    part,
    parts: groups.length,
    ops: group,
  }));
  return { parts, full, empty: ops.length === 0 };
}

/** Copie profonde par JSON: l'hôte garde ce que l'invité connaît, sans partage avec le monde. */
export function cloneDoc<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

function applyOp(doc: Doc, op: Op): void {
  const [field, kind, key] = op;
  const removing = op.length === 3;
  if (kind === 'v') {
    if (removing) Reflect.deleteProperty(doc, field);
    else doc[field] = cloneDoc(op[3]);
    return;
  }
  if (kind === 'd') {
    const known = doc[field];
    const dict: Doc = isDict(known) ? known : (doc[field] = {});
    if (removing) Reflect.deleteProperty(dict, key);
    else dict[key] = cloneDoc(op[3]);
    return;
  }
  const list: unknown[] = Array.isArray(doc[field]) ? (doc[field] as unknown[]) : (doc[field] = []);
  const index = list.findIndex((item) => idOf(item) === key);
  if (removing) {
    if (index >= 0) list.splice(index, 1);
  } else if (index >= 0) list[index] = cloneDoc(op[3]);
  else list.push(cloneDoc(op[3]));
}

/** Côté invité: assemble les révisions dans l'ordre; ordonné, idempotent, validé à chaque révision. */
export interface KeyedAssembler<T> {
  /** Renvoie l'état quand une révision vient d'être complétée et validée, sinon `null`. */
  receive(
    part: KeyedPart,
  ): { readonly target: string; readonly tick: number; readonly state: T } | null;
  current(): { readonly target: string; readonly tick: number; readonly state: T } | null;
}

export function createKeyedAssembler<TSchema extends v.GenericSchema>(
  schema: TSchema,
): KeyedAssembler<v.InferOutput<TSchema>> {
  type T = v.InferOutput<TSchema>;
  let current: { target: string; tick: number; state: T } | null = null;
  let applied = -1;
  let staging: Doc | null = null;
  let stagingRev = -1;
  let nextPart = 0;

  return {
    receive(part) {
      // Déjà appliquée, ou morceau en double d'une révision en cours: sans effet (idempotent).
      if (part.rev <= applied) return null;
      if (part.rev === stagingRev && staging !== null && part.part < nextPart) return null;
      if (part.part === 0) {
        if (part.base === -1) staging = {};
        else if (current !== null && part.base === applied && part.target === current.target)
          staging = cloneDoc(current.state as Doc);
        else staging = null;
        stagingRev = part.rev;
        nextPart = 0;
      }
      if (staging === null || part.rev !== stagingRev || part.part !== nextPart) {
        staging = null;
        return null;
      }
      for (const op of part.ops) applyOp(staging, op);
      nextPart += 1;
      if (nextPart < part.parts) return null;
      const done = v.safeParse(schema, staging);
      staging = null;
      if (!done.success) return null;
      current = { target: part.target, tick: part.tick, state: done.output };
      applied = part.rev;
      return current;
    },
    current() {
      return current;
    },
  };
}
