// Format du paquet `.duogame` (ADR 0010, point 1): une archive zip qui contient
// le site construit du jeu, son manifeste `duo-game.json`, la liste signée de
// ses fichiers `duo-files.json` et la signature `duo-files.sig`.
import * as v from 'valibot';

export const MANIFEST_NAME = 'duo-game.json';
export const FILE_LIST_NAME = 'duo-files.json';
export const SIGNATURE_NAME = 'duo-files.sig';
export const PACKAGE_EXTENSION = '.duogame';

/** Plafond de la plateforme: taille totale extraite d'un paquet (ADR 0010, point 1). */
export const MAX_PACKAGE_BYTES = 200 * 1024 * 1024;
/** Liste des fichiers, signature et manifeste: lus en mémoire, donc bornés. */
export const MAX_METADATA_BYTES = 4 * 1024 * 1024;
/** Nombre d'entrées au plus: un site de jeu en a quelques centaines. */
export const MAX_ENTRIES = 20_000;

const SEMVER_PATTERN = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/;
const BRIDGE_PATTERN = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;

/** Même règle que le manifeste (`@duo/protocol`): l'identifiant nomme aussi un dossier. */
export const GameIdSchema = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9-]{1,31}$/));
export const SemverSchema = v.pipe(v.string(), v.regex(SEMVER_PATTERN));
export const BridgeSchema = v.pipe(v.string(), v.regex(BRIDGE_PATTERN));
export const Sha256Schema = v.pipe(v.string(), v.regex(SHA256_PATTERN));
export const KeyIdSchema = v.pipe(v.string(), v.regex(KEY_ID_PATTERN));

const MinutesSchema = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(600));
export const DurationSchema = v.pipe(
  v.tuple([MinutesSchema, MinutesSchema]),
  v.check(([min, max]) => min <= max),
);

/**
 * Champs du manifeste dont le paquet a besoin. Le manifeste complet est validé
 * par `@duo/protocol` (option `checkManifest` de la vérification).
 */
export const ManifestCoreSchema = v.looseObject({
  schema: v.literal(1),
  id: GameIdSchema,
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(40)),
  version: SemverSchema,
  sdk: BridgeSchema,
  mode: v.picklist(['coop', 'versus']),
  durationMinutes: DurationSchema,
  description: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
  entry: v.pipe(v.string(), v.minLength(1)),
});
export type ManifestCore = v.InferOutput<typeof ManifestCoreSchema>;

export const FileRecordSchema = v.strictObject({
  path: v.string(),
  size: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(MAX_PACKAGE_BYTES)),
  sha256: Sha256Schema,
});
export type FileRecord = v.InferOutput<typeof FileRecordSchema>;

/** `duo-files.json`: identifiant et version liés à la signature, puis chaque fichier. */
export const FileListSchema = v.strictObject({
  schema: v.literal(1),
  id: GameIdSchema,
  version: SemverSchema,
  files: v.pipe(v.array(FileRecordSchema), v.minLength(1), v.maxLength(MAX_ENTRIES)),
});
export type FileList = v.InferOutput<typeof FileListSchema>;

/** `duo-files.sig`: signature Ed25519 des octets exacts de `duo-files.json`. */
export const SignatureFileSchema = v.strictObject({
  schema: v.literal(1),
  keyId: KeyIdSchema,
  signature: v.pipe(v.string(), v.base64(), v.length(88)),
});
export type SignatureFile = v.InferOutput<typeof SignatureFileSchema>;

// Noms réservés de Windows, avec ou sans extension: un tel fichier ne s'écrit pas sur le PC.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
// Caractères refusés par Windows dans un nom de fichier, et caractères de contrôle.
// eslint-disable-next-line no-control-regex -- les caractères de contrôle sont justement ceux qu'on refuse
const FORBIDDEN_CHARS = /[<>:"|?*\u0000-\u001f\\]/;

/**
 * Chemin d'un fichier du paquet: relatif, séparé par `/`, sans `.` ni `..`, et
 * écrivable tel quel sous macOS et sous Windows. Complète `validateFileName` de yauzl.
 */
export function isSafePackagePath(relative: string): boolean {
  if (relative === '' || relative.length > 400 || relative.startsWith('/')) return false;
  return relative
    .split('/')
    .every(
      (segment) =>
        segment !== '' &&
        segment !== '.' &&
        segment !== '..' &&
        segment.length <= 255 &&
        !FORBIDDEN_CHARS.test(segment) &&
        !segment.endsWith('.') &&
        !segment.endsWith(' ') &&
        !WINDOWS_RESERVED.test(segment),
    );
}

/** Compare deux versions `MAJEUR.MINEUR.CORRECTIF`: négatif si `a` est la plus ancienne. */
export function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export function isVersion(text: string): boolean {
  return SEMVER_PATTERN.test(text);
}

/** Nom du fichier d'un paquet: `<id>-<version>.duogame`. */
export function packageFileName(id: string, version: string): string {
  return `${id}-${version}${PACKAGE_EXTENSION}`;
}
