// Catalogue des jeux publiés (ADR 0010, point 2), schéma 1. Il n'est pas
// signé: la signature de chaque paquet suffit, et l'empreinte de l'archive
// écarte un téléchargement abîmé avant toute extraction. L'empreinte reste
// facultative à la lecture: un catalogue ancien qui ne la porterait pas est
// accepté (la signature du paquet est alors le seul contrôle); le flux de
// publication l'écrit toujours. Une entrée invalide est
// ignorée sans écarter les autres; un catalogue illisible ou d'un schéma
// inconnu est écarté en entier.
import * as v from 'valibot';
import {
  BridgeSchema,
  DurationSchema,
  GameIdSchema,
  MAX_PACKAGE_BYTES,
  MAX_METADATA_BYTES,
  SemverSchema,
  Sha256Schema,
  compareVersions,
} from './format.ts';

export const CATALOGUE_SCHEMA = 1;
/** Taille au plus de `catalogue.json` lu par l'application. */
export const MAX_CATALOGUE_BYTES = 1024 * 1024;

export const CatalogueEntrySchema = v.object({
  id: GameIdSchema,
  version: SemverSchema,
  manifeste: v.object({
    nom: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
    description: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
    mode: v.picklist(['coop', 'versus']),
    duree: DurationSchema,
    sdk: BridgeSchema,
  }),
  taille: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(1),
    v.maxValue(MAX_PACKAGE_BYTES + MAX_METADATA_BYTES),
  ),
  url: v.pipe(v.string(), v.url(), v.regex(/^https?:\/\//)),
  /** Empreinte SHA-256 de l'archive `.duogame`; absente d'un catalogue ancien. */
  sha256: v.optional(Sha256Schema),
});
export type CatalogueEntry = v.InferOutput<typeof CatalogueEntrySchema>;

const CatalogueEnvelopeSchema = v.object({
  schema: v.pipe(v.number(), v.integer()),
  jeux: v.pipe(v.array(v.unknown()), v.maxLength(1000)),
});

export type CatalogueParse =
  | { readonly ok: true; readonly entries: readonly CatalogueEntry[]; readonly skipped: number }
  | { readonly ok: false; readonly reason: 'invalid' | 'unknown-schema' };

/** Lit un catalogue déjà décodé du JSON. Pour un même jeu, la version la plus récente l'emporte. */
export function parseCatalogue(raw: unknown): CatalogueParse {
  const envelope = v.safeParse(CatalogueEnvelopeSchema, raw);
  if (!envelope.success) return { ok: false, reason: 'invalid' };
  if (envelope.output.schema !== CATALOGUE_SCHEMA) return { ok: false, reason: 'unknown-schema' };
  const byId = new Map<string, CatalogueEntry>();
  let skipped = 0;
  for (const item of envelope.output.jeux) {
    const entry = v.safeParse(CatalogueEntrySchema, item);
    if (!entry.success) {
      skipped += 1;
      continue;
    }
    const known = byId.get(entry.output.id);
    if (known === undefined || compareVersions(entry.output.version, known.version) > 0) {
      byId.set(entry.output.id, entry.output);
    }
  }
  return { ok: true, entries: [...byId.values()], skipped };
}

/** Lit le texte reçu (JSON); un texte qui n'en est pas est écarté. */
export function parseCatalogueText(text: string): CatalogueParse {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  return parseCatalogue(raw);
}
