/**
 * Progression envoyée par différences et par morceaux (lot L1), sur le canal fiable 8. Une
 * révision est soit complète (`base: -1`, au départ, à la reprise et au filet de sécurité), soit
 * une différence par rapport à la révision précédente. Chaque révision se découpe en morceaux
 * d'environ `partBytes`: aucune ne déborde, quel que soit le contenu.
 *
 * La méthode est celle de l'état du lieu (`par-cles.ts`): elle ne connaît aucun champ. Tout champ
 * de `ProgressSchema` part donc sans rien coder ici, un dictionnaire clé par clé. L'ancienne
 * liste de champs écrite à la main avait oublié `album` (le carnet des collections ne partait
 * jamais chez l'invité, 2026-11-11).
 *
 * Un objet à champs fixes (`album`: `f` et `h`) s'aplatit en chemins (`album.f`, `album.h`), lus
 * dans le schéma: sans cela, une prise de plus renverrait tout l'album.
 */
import * as v from 'valibot';
import { ProgressSchema, type ProgressState } from '../etat/progression';
import {
  createKeyedAssembler,
  KeyedPartSchema,
  keyedParts,
  type KeyedAssembler,
  type KeyedPart,
} from './par-cles';

export const PROGRESS_PART_CHANNEL = 8;
export const PROGRESS_PART_BUDGET_BYTES = 16_384;

export const ProgressPartSchema = KeyedPartSchema;
export type ProgressPart = KeyedPart;

/** Cible des révisions de la progression (un seul document, contrairement aux lieux). */
export const PROGRESS_TARGET = 'progression';

type Doc = Record<string, unknown>;

/** Sous-champs d'un objet à champs fixes; `null`: valeur transmise telle quelle. */
interface Shape {
  readonly [field: string]: Shape | null;
}

function isDict(value: unknown): value is Doc {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** La forme d'un schéma Valibot: ses champs s'il est un objet à champs fixes, sinon `null`. */
function shapeOf(schema: unknown): Shape | null {
  let node = schema;
  // Facultatif ou annulable: la forme est celle du schéma enveloppé.
  while (isDict(node) && isDict(node.wrapped)) node = node.wrapped;
  if (!isDict(node) || (node.type !== 'strict_object' && node.type !== 'object')) return null;
  if (!isDict(node.entries)) return null;
  const shape: Record<string, Shape | null> = {};
  for (const [field, sub] of Object.entries(node.entries)) shape[field] = shapeOf(sub);
  return shape;
}

const PROGRESS_SHAPE: Shape = shapeOf(ProgressSchema) ?? {};

function flatten(value: Doc, shape: Shape, prefix: string, out: Doc): void {
  for (const [field, item] of Object.entries(value)) {
    if (item === undefined) continue;
    const path = prefix + field;
    const sub = shape[field] ?? null;
    if (sub !== null && isDict(item)) {
      // L'objet vide marque sa présence; ses champs suivent, un chemin chacun.
      out[path] = {};
      flatten(item, sub, `${path}.`, out);
    } else out[path] = item;
  }
}

function unflatten(doc: Doc, shape: Shape, prefix: string, used: Set<string>): Doc {
  const out: Doc = {};
  for (const [field, sub] of Object.entries(shape)) {
    const path = prefix + field;
    const item = doc[path];
    if (item === undefined) continue;
    used.add(path);
    out[field] = sub !== null && isDict(item) ? unflatten(doc, sub, `${path}.`, used) : item;
  }
  return out;
}

/** La progression telle qu'elle part: un champ par chemin, sans copie des valeurs. */
export function progressDoc(progress: ProgressState): Doc {
  const out: Doc = {};
  flatten(progress, PROGRESS_SHAPE, '', out);
  return out;
}

function progressOfDoc(doc: Doc): Doc {
  const used = new Set<string>();
  const out = unflatten(doc, PROGRESS_SHAPE, '', used);
  // Un chemin inconnu reste en place: le schéma strict le refuse, plutôt que de l'ignorer.
  for (const [path, item] of Object.entries(doc)) if (!used.has(path)) out[path] = item;
  return out;
}

/** Copie profonde par JSON, validée. */
export function cloneProgress(progress: ProgressState): ProgressState {
  return v.parse(ProgressSchema, JSON.parse(JSON.stringify(progress)));
}

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
  return keyedParts(
    previous === null ? null : progressDoc(previous),
    progressDoc(current),
    { target: PROGRESS_TARGET, rev, baseRev, tick },
    partBytes,
  ).parts;
}

/** Côté invité: assemble les révisions dans l'ordre; une révision orpheline attend la prochaine complète. */
export interface ProgressAssembler {
  /** Renvoie la progression quand une révision vient d'être complétée et validée, sinon `null`. */
  receive(part: ProgressPart): ProgressState | null;
  current(): ProgressState | null;
  /** Reprise de la liaison: les différences attendent la prochaine révision complète. */
  reset(): void;
}

export function createProgressAssembler(): ProgressAssembler {
  let published: ProgressState | null = null;
  let checked: ProgressState | null = null;
  // L'assembleur garde le document à plat (les différences s'y appliquent) et ne retient une
  // révision que si la progression qu'elle donne passe le schéma entier; le contrôle met de côté
  // la progression validée pour ne pas la valider deux fois.
  const keyed: KeyedAssembler<Doc> = createKeyedAssembler(
    v.pipe(
      v.record(v.string(), v.unknown()),
      v.check((doc) => {
        const parsed = v.safeParse(ProgressSchema, progressOfDoc(doc));
        checked = parsed.success ? parsed.output : null;
        return parsed.success;
      }),
    ),
  );
  const takeChecked = (): ProgressState | null => {
    const state = checked;
    checked = null;
    return state;
  };
  return {
    receive(part) {
      const done = keyed.receive(part);
      const state = takeChecked();
      if (done === null || state === null) return null;
      published = state;
      return published;
    },
    current() {
      return published;
    },
    reset() {
      // On garde la progression affichée: seules les différences attendent la prochaine complète.
      keyed.reset();
    },
  };
}
