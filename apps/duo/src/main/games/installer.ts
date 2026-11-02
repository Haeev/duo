// Installation d'un paquet `.duogame` dans le dossier de données (ADR 0010,
// point 5), identique pour un téléchargement et un import:
//   1. vérification complète du paquet;
//   2. règle de version: jamais une version plus ancienne ou égale à celle que
//      Duo fait déjà tourner (ADR 0006), pont suffisant (M-13);
//   3. extraction dans `games/<id>/<version>.tmp/`, chaque fichier contrôlé;
//   4. renommage en `games/<id>/<version>/`, puis bascule atomique du pointeur
//      `games/<id>/current.json` (fichier temporaire puis renommage);
//   5. archive gardée en `games/<id>/<version>.duogame` (copie vers l'autre
//      machine), anciennes versions supprimées.
// L'appelant garantit qu'aucun salon ni aucune partie n'utilise le jeu.
import { copyFile, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import * as v from 'valibot';
import {
  PACKAGE_EXTENSION,
  SemverSchema,
  Sha256Schema,
  compareVersions,
  verifyPackage,
  type PackageProblem,
  type TrustedKey,
} from '@duo/paquet';
import { writeFileSafe } from '../data/safe-write';
import { bridgeCovers, checkManifest } from './manifest';

export const CURRENT_FILE = 'current.json';

/** Pointeur de la version installée d'un jeu. */
export const CurrentPointerSchema = v.object({
  schema: v.literal(1),
  version: SemverSchema,
  sha256: v.nullable(Sha256Schema),
});
export type CurrentPointer = v.InferOutput<typeof CurrentPointerSchema>;

/**
 * Pointeur d'un jeu installé, `null` s'il est absent ou illisible. Sans copie de
 * secours: elle désignerait une version déjà supprimée.
 */
export async function readCurrentPointer(gameDir: string): Promise<CurrentPointer | null> {
  try {
    const parsed = v.safeParse(
      CurrentPointerSchema,
      JSON.parse(await readFile(path.join(gameDir, CURRENT_FILE), 'utf8')),
    );
    return parsed.success ? parsed.output : null;
  } catch {
    return null;
  }
}

export type InstallOutcome =
  | {
      readonly ok: true;
      readonly id: string;
      readonly name: string;
      readonly version: string;
      /** Version que Duo faisait tourner avant (`null`: nouveau jeu). */
      readonly previous: string | null;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid';
      readonly problem: PackageProblem | 'mismatch';
      readonly detail: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'not-newer';
      readonly name: string;
      readonly version: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'unsupported';
      readonly name: string;
      readonly sdk: string;
    }
  | { readonly ok: false; readonly reason: 'io'; readonly detail: string };

export interface InstallRequest {
  readonly archive: string;
  /** Vrai: l'archive (dans `games/.incoming/`) est déplacée; faux: copiée (import d'un fichier). */
  readonly move: boolean;
  /** Jeu attendu (téléchargement d'après le catalogue): un autre paquet est refusé. */
  readonly expected?: { readonly id: string; readonly version: string };
  readonly sha256?: string;
}

export interface InstallerDeps {
  /** `<données>/games`. */
  readonly gamesDir: string;
  readonly trustedKeys: readonly TrustedKey[];
  /** Version que Duo fait tourner pour ce jeu (installée ou embarquée), `null` s'il est absent. */
  readonly effectiveVersion: (id: string) => string | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const fullManifestCheck = (
  raw: unknown,
): { ok: true } | { ok: false; problems: readonly string[] } => {
  const check = checkManifest(raw);
  return check.ok ? { ok: true } : { ok: false, problems: check.problems };
};

export class GameInstaller {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: InstallerDeps) {}

  /** Une installation à la fois. */
  install(request: InstallRequest): Promise<InstallOutcome> {
    const run = this.queue.then(() => this.run(request));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async run(request: InstallRequest): Promise<InstallOutcome> {
    const { trustedKeys } = this.deps;
    const checked = await verifyPackage(request.archive, {
      trustedKeys,
      checkManifest: fullManifestCheck,
    });
    if (!checked.ok)
      return { ok: false, reason: 'invalid', problem: checked.problem, detail: checked.detail };
    const { id, version, manifest } = checked;
    const expected = request.expected;
    if (expected !== undefined && (expected.id !== id || expected.version !== version)) {
      return {
        ok: false,
        reason: 'invalid',
        problem: 'mismatch',
        detail: `paquet ${id}@${version}, catalogue ${expected.id}@${expected.version}`,
      };
    }
    if (!bridgeCovers(manifest.sdk)) {
      return { ok: false, reason: 'unsupported', name: manifest.name, sdk: manifest.sdk };
    }
    const installed =
      (await readCurrentPointer(path.join(this.deps.gamesDir, id)))?.version ?? null;
    const known = this.deps.effectiveVersion(id);
    const previous =
      installed === null
        ? known
        : known === null || compareVersions(installed, known) > 0
          ? installed
          : known;
    if (previous !== null && compareVersions(version, previous) <= 0) {
      return { ok: false, reason: 'not-newer', name: manifest.name, version: previous };
    }

    const gameDir = path.join(this.deps.gamesDir, id);
    const staging = path.join(gameDir, `${version}.tmp`);
    const finalDir = path.join(gameDir, version);
    try {
      await mkdir(gameDir, { recursive: true });
      await rm(staging, { recursive: true, force: true });
      // Seconde lecture: chaque fichier est écrit pendant le contrôle de son empreinte.
      const extracted = await verifyPackage(request.archive, {
        trustedKeys,
        checkManifest: fullManifestCheck,
        extractTo: staging,
      });
      if (!extracted.ok) {
        await rm(staging, { recursive: true, force: true });
        return {
          ok: false,
          reason: 'invalid',
          problem: extracted.problem,
          detail: extracted.detail,
        };
      }
      // Reste d'une installation interrompue, jamais pointé (sa version n'est pas plus récente sinon).
      await rm(finalDir, { recursive: true, force: true });
      await rename(staging, finalDir);
      const kept = path.join(gameDir, `${version}${PACKAGE_EXTENSION}`);
      if (request.move) await rename(request.archive, kept);
      else await copyFile(request.archive, kept);
      const sha256 =
        request.sha256 !== undefined && v.is(Sha256Schema, request.sha256) ? request.sha256 : null;
      const pointer: CurrentPointer = { schema: 1, version, sha256 };
      await writeFileSafe(
        path.join(gameDir, CURRENT_FILE),
        `${JSON.stringify(pointer, null, 2)}\n`,
        {
          backup: false,
        },
      );
      await this.removeOthers(gameDir, version);
    } catch (error) {
      await rm(staging, { recursive: true, force: true }).catch(() => undefined);
      return { ok: false, reason: 'io', detail: message(error) };
    }
    return { ok: true, id, name: manifest.name, version, previous };
  }

  /** Anciennes versions: aucune partie ne les utilise, puisqu'on n'installe jamais pendant une partie. */
  private async removeOthers(gameDir: string, keep: string): Promise<void> {
    const keepNames = new Set([keep, `${keep}${PACKAGE_EXTENSION}`, CURRENT_FILE]);
    for (const entry of await readdir(gameDir)) {
      if (keepNames.has(entry) || entry.startsWith(CURRENT_FILE)) continue;
      await rm(path.join(gameDir, entry), { recursive: true, force: true });
    }
  }
}
