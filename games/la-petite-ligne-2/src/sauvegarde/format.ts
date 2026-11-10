/**
 * Format versionné de la sauvegarde et migrations. Règles:
 * - `DATA_SCHEMA` (src/etat/monde.ts) est la version courante; la monter exige d'ajouter ici la
 *   migration de la version précédente ET une sauvegarde de référence `tests/donnees/sauvegarde-v<n>.json`
 *   (le test `sauvegarde.test.ts` échoue sinon).
 * - Pendant la refonte (jusqu'à l'Alpha), `STAGE_FLOOR` est la plus ancienne version acceptée: une
 *   sauvegarde plus ancienne est refusée poliment, la partie d'essai repart de zéro (client, 2026-11-10).
 *   À l'Alpha, `STAGE_FLOOR` passe à 1 et les migrations deviennent la seule voie.
 */
import * as v from 'valibot';
import { DATA_SCHEMA, WorldSchema, type WorldState } from '../etat/monde';

/** Plus ancien format encore repris, dans l'étape en cours de la refonte. */
export const STAGE_FLOOR = 1;

/** Une migration fait passer les données de la version `n` à `n + 1`. Pure, sans effet de bord. */
export type Migration = (data: unknown) => unknown;
export type MigrationTable = Readonly<Record<number, Migration>>;

/** `MIGRATIONS[n]`: de la version `n` à `n + 1`. Vide tant que le format n'a jamais changé. */
export const MIGRATIONS: MigrationTable = {};

export type ReadFailure = 'older-stage' | 'newer' | 'damaged';
export type ReadResult =
  | { readonly ok: true; readonly world: WorldState; readonly from: number }
  | { readonly ok: false; readonly kind: ReadFailure; readonly reason: string };

/**
 * Lit les données d'une sauvegarde: version, migrations, schéma. Ne lève jamais: tout ce qui est
 * inattendu (forme inconnue, migration qui plante) est un refus nommé.
 */
export function readSave(
  loaded: { readonly dataSchema: number; readonly data: unknown },
  table: MigrationTable = MIGRATIONS,
  current: number = DATA_SCHEMA,
  floor: number = STAGE_FLOOR,
): ReadResult {
  const from = loaded.dataSchema;
  if (!Number.isInteger(from) || from < 1)
    return { ok: false, kind: 'damaged', reason: `format illisible: ${String(from)}` };
  if (from > current)
    return { ok: false, kind: 'newer', reason: `format ${from}, plus récent que ${current}` };
  if (from < floor)
    return {
      ok: false,
      kind: 'older-stage',
      reason: `format ${from}, antérieur à l’étape en cours (${floor})`,
    };
  let data = loaded.data;
  for (let version = from; version < current; version++) {
    const migrate = table[version];
    if (migrate === undefined)
      return {
        ok: false,
        kind: 'damaged',
        reason: `migration ${version} vers ${version + 1} absente`,
      };
    try {
      data = migrate(data);
    } catch (error) {
      return {
        ok: false,
        kind: 'damaged',
        reason: `migration ${version} vers ${version + 1}: ${String(error)}`,
      };
    }
  }
  const parsed = v.safeParse(WorldSchema, data);
  if (!parsed.success) {
    const issue = parsed.issues[0];
    return {
      ok: false,
      kind: 'damaged',
      reason: `${v.getDotPath(issue) ?? 'racine'}: ${issue.message}`,
    };
  }
  return { ok: true, world: parsed.output, from };
}
