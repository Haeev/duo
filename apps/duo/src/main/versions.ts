// Avis de nouvelle version de Duo (ADR 0011 section 3.6, M-35, CA-PF-127).
// Duo lit `duo-version.json` de la release marquée « Latest » au démarrage, puis
// toutes les 6 heures. Jamais bloquant: sans Internet, ou si le fichier est absent
// ou invalide, rien ne s'affiche. Aucune installation: « Télécharger » ouvre le
// lien de l'installateur dans le navigateur par défaut.
import * as v from 'valibot';
import type { AppUpdateView } from '../shared/app-update';
import type { Journal } from './journal';

/** Seul dépôt dont Duo accepte les adresses (ADR 0011). */
export const REPOSITORY_URL = 'https://github.com/Haeev/duo/';
export const VERSION_FILE_URL = `${REPOSITORY_URL}releases/latest/download/duo-version.json`;

export interface AppVersionConfig {
  /** Délai de lecture du fichier, en ms (requête et corps). */
  readonly timeoutMs: number;
  /** Lecture suivante si Duo reste ouvert, en ms. */
  readonly intervalMs: number;
  /** Taille au-delà de laquelle le fichier est écarté, en octets. */
  readonly maxBytes: number;
}

export const APP_VERSION_CONFIG: AppVersionConfig = {
  timeoutMs: 10_000,
  intervalMs: 6 * 60 * 60 * 1000,
  maxBytes: 64 * 1024,
};

// SemVer 2.0: X.Y.Z, suffixe de préversion facultatif, métadonnées de construction ignorées.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z.-]+)?$/;

interface SemVer {
  readonly core: readonly [number, number, number];
  readonly prerelease: readonly string[];
}

export function parseSemver(text: string): SemVer | null {
  const match = SEMVER.exec(text);
  if (match === null) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] === undefined ? [] : match[4].split('.'),
  };
}

function compareIdentifiers(a: string, b: string): number {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);
  if (numericA && numericB) return Number(a) - Number(b);
  if (numericA) return -1;
  if (numericB) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ordre SemVer: négatif si `a` précède `b`. Une préversion précède sa version
 * (`1.0.0-rc.1` < `1.0.0`). Versions illisibles: `null`.
 */
export function compareSemver(a: string, b: string): number | null {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (left === null || right === null) return null;
  for (let index = 0; index < 3; index += 1) {
    const delta = (left.core[index] ?? 0) - (right.core[index] ?? 0);
    if (delta !== 0) return delta;
  }
  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    return right.prerelease.length - left.prerelease.length;
  }
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const x = left.prerelease[index];
    const y = right.prerelease[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const delta = compareIdentifiers(x, y);
    if (delta !== 0) return delta;
  }
  return 0;
}

/** Versions de système « 13.5.1 », « 10.0.22631 »: comparaison numérique champ à champ. */
export function compareSystemVersions(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const right = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

const RepositoryUrl = v.pipe(v.string(), v.maxLength(300), v.startsWith(REPOSITORY_URL));
const SystemVersion = v.pipe(v.string(), v.regex(/^\d+(\.\d+){0,3}$/));

// Non strict: un champ ajouté par une version future de la publication est ignoré.
const VersionFileSchema = v.object({
  schema: v.literal(1),
  version: v.pipe(v.string(), v.regex(SEMVER)),
  publishedAt: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  summary: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(400)),
  page: RepositoryUrl,
  guide: RepositoryUrl,
  requires: v.optional(
    v.object({ darwin: v.optional(SystemVersion), win32: v.optional(SystemVersion) }),
    {},
  ),
  files: v.record(
    v.pipe(v.string(), v.regex(/^[a-z0-9]+-[a-z0-9_]+$/)),
    v.object({
      name: v.pipe(v.string(), v.regex(/^Duo-[A-Za-z0-9]+\.(dmg|exe|zip|AppImage)$/)),
      size: v.pipe(v.number(), v.integer(), v.minValue(1)),
      sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
    }),
  ),
});

export type VersionFile = v.InferOutput<typeof VersionFileSchema>;

export type VersionFileCheck =
  | { readonly ok: true; readonly file: VersionFile }
  | { readonly ok: false; readonly reason: string };

export function parseVersionFile(raw: unknown): VersionFileCheck {
  const parsed = v.safeParse(VersionFileSchema, raw);
  if (parsed.success) return { ok: true, file: parsed.output };
  return { ok: false, reason: parsed.issues.map((issue) => issue.message).join('; ') };
}

/** Machine qui lit l'avis: version de Duo, système et architecture. */
export interface MachineContext {
  readonly appVersion: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  /** `process.getSystemVersion()`: « 13.5.1 » sous macOS, « 10.0.22631 » sous Windows. */
  readonly systemVersion: string;
}

/** Avis à montrer, avec l'adresse que « Télécharger » ouvrira. */
export interface AppUpdateNotice {
  readonly view: AppUpdateView;
  /** `null` si le système est trop ancien: rien à télécharger. */
  readonly url: string | null;
}

export type Evaluation =
  | { readonly kind: 'notice'; readonly notice: AppUpdateNotice }
  | { readonly kind: 'none'; readonly reason: 'up-to-date' | 'prerelease' };

/**
 * Avis pour cette machine, ou rien. Une préversion n'est jamais annoncée, même si
 * elle se retrouvait « Latest » par erreur (ADR 0011, section 3.7).
 */
export function evaluateVersionFile(file: VersionFile, machine: MachineContext): Evaluation {
  const published = parseSemver(file.version);
  if (published === null || published.prerelease.length > 0) {
    return { kind: 'none', reason: 'prerelease' };
  }
  const order = compareSemver(file.version, machine.appVersion);
  if (order === null || order <= 0) return { kind: 'none', reason: 'up-to-date' };
  const base = { version: file.version, summary: file.summary };
  const system =
    machine.platform === 'darwin' ? 'macOS' : machine.platform === 'win32' ? 'Windows' : null;
  const minimum =
    machine.platform === 'darwin'
      ? file.requires.darwin
      : machine.platform === 'win32'
        ? file.requires.win32
        : undefined;
  if (
    system !== null &&
    minimum !== undefined &&
    compareSystemVersions(machine.systemVersion, minimum) < 0
  ) {
    return {
      kind: 'notice',
      notice: { view: { kind: 'unsupported', ...base, system, minimum }, url: null },
    };
  }
  const entry = file.files[`${machine.platform}-${machine.arch}`];
  if (entry === undefined || entry.name.endsWith('.zip')) {
    return { kind: 'notice', notice: { view: { kind: 'page', ...base }, url: file.page } };
  }
  // Lien direct de la version annoncée: le même fichier que `releases/latest/download/`.
  const url = `${REPOSITORY_URL}releases/download/v${file.version}/${entry.name}`;
  return {
    kind: 'notice',
    notice: { view: { kind: 'download', ...base, file: entry.name }, url },
  };
}

export type FetchLike = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

export interface AppVersionCheckerDeps {
  readonly url: string;
  readonly fetch: FetchLike;
  readonly machine: MachineContext;
  readonly journal: Journal;
  /** Avis à montrer, ou `null` pour le retirer. */
  readonly onChange: (view: AppUpdateView | null) => void;
  readonly config?: AppVersionConfig;
}

/**
 * Lecture périodique du fichier de version. « Plus tard » met de côté la version
 * annoncée jusqu'au prochain lancement de Duo (rien n'est enregistré): une version
 * plus récente encore, publiée entre-temps, est annoncée à la lecture suivante.
 */
export class AppVersionChecker {
  private notice: AppUpdateNotice | null = null;
  private dismissed: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running: Promise<void> | null = null;

  constructor(private readonly deps: AppVersionCheckerDeps) {}

  private get config(): AppVersionConfig {
    return this.deps.config ?? APP_VERSION_CONFIG;
  }

  start(): void {
    if (this.timer !== null) return;
    void this.check();
    this.timer = setInterval(() => {
      void this.check();
    }, this.config.intervalMs);
    // Le minuteur ne retient pas Node à la fermeture.
    this.timer.unref();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Une lecture; jamais d'exception. Deux appels rapprochés partagent la même lecture. */
  check(): Promise<void> {
    this.running ??= this.read().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Adresse à ouvrir pour l'avis affiché, `null` s'il n'y en a pas. */
  downloadUrl(): string | null {
    return this.visible()?.url ?? null;
  }

  later(): void {
    if (this.notice === null) return;
    this.dismissed = this.notice.view.version;
    this.deps.journal.write('info', 'versions', 'notice-later', { version: this.dismissed });
    this.deps.onChange(null);
  }

  private visible(): AppUpdateNotice | null {
    if (this.notice === null || this.notice.view.version === this.dismissed) return null;
    return this.notice;
  }

  private async read(): Promise<void> {
    let text: string;
    try {
      const response = await this.deps.fetch(this.deps.url, {
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
      if (!response.ok) {
        // Fichier absent (404, aucune release « Latest »): rien à montrer.
        this.deps.journal.write('info', 'versions', 'file-unavailable', {
          status: response.status,
        });
        return;
      }
      text = await response.text();
    } catch (error) {
      // Hors ligne ou délai dépassé: on garde ce qui est affiché, sans bruit.
      this.deps.journal.write('info', 'versions', 'unreachable', {
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (text.length > this.config.maxBytes) {
      this.deps.journal.write('warn', 'versions', 'file-too-large', { bytes: text.length });
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      this.deps.journal.write('warn', 'versions', 'file-invalid', { reason: 'JSON illisible' });
      return;
    }
    const parsed = parseVersionFile(raw);
    if (!parsed.ok) {
      this.deps.journal.write('warn', 'versions', 'file-invalid', { reason: parsed.reason });
      return;
    }
    const evaluation = evaluateVersionFile(parsed.file, this.deps.machine);
    this.deps.journal.write('info', 'versions', 'checked', {
      published: parsed.file.version,
      installed: this.deps.machine.appVersion,
      result: evaluation.kind === 'notice' ? evaluation.notice.view.kind : evaluation.reason,
    });
    this.notice = evaluation.kind === 'notice' ? evaluation.notice : null;
    this.deps.onChange(this.visible()?.view ?? null);
  }
}
