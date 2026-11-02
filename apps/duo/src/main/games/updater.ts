// Recherche et téléchargement des jeux publiés (ADR 0010, points 2 et 4).
// Le catalogue est lu une fois le lanceur affiché, puis toutes les 6 heures;
// un nouveau jeu ou une version plus récente, que cette version de Duo sait
// faire tourner, est téléchargé dans `games/.incoming/` (`.part`), contrôlé
// (taille, SHA-256), puis confié à l'installateur. Jamais pendant un salon ou
// une partie: un téléchargement en cours est interrompu et repris au retour.
// Échec: nouvel essai après 1, 5 puis 15 minutes, puis on attend la recherche
// suivante.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import {
  MAX_CATALOGUE_BYTES,
  compareVersions,
  packageFileName,
  parseCatalogueText,
  type CatalogueEntry,
} from '@duo/paquet';
import type { Journal } from '../journal';
import type { InstallOutcome, InstallRequest } from './installer';
import { bridgeCovers } from './manifest';

export const CATALOGUE_URL =
  'https://github.com/Haeev/duo/releases/download/catalogue/catalogue.json';
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const RETRY_DELAYS_MS: readonly number[] = [60_000, 5 * 60_000, 15 * 60_000];
const FETCH_TIMEOUT_MS = 15_000;

/** Sous-ensemble de `fetch` employé: `net.fetch` d'Electron (mandataire du système) ou celui de Node. */
export type FetchLike = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

export interface UpdaterDeps {
  readonly catalogueUrl: string;
  readonly fetch: FetchLike;
  /** `games/.incoming`. */
  readonly incomingDir: string;
  readonly install: (request: InstallRequest) => Promise<InstallOutcome>;
  /** Version que Duo fait tourner pour ce jeu, `null` s'il est absent. */
  readonly effectiveVersion: (id: string) => string | null;
  /** Faux pendant un salon ou une partie. */
  readonly isIdle: () => boolean;
  /** Adresses de paquets admises (https seulement dans les versions publiées). */
  readonly allowUrl: (url: string) => boolean;
  readonly onInstalled: (outcome: Extract<InstallOutcome, { ok: true }>) => Promise<void> | void;
  readonly journal: Journal;
  readonly retryDelaysMs?: readonly number[];
  readonly intervalMs?: number;
}

export type CheckResult =
  | { readonly kind: 'done'; readonly installed: number }
  | { readonly kind: 'deferred' }
  | {
      readonly kind: 'failed';
      readonly step: 'catalogue' | 'download' | 'install';
      readonly detail: string;
    };

class Busy extends Error {}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class GameUpdater {
  private interval: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private running: Promise<CheckResult> | null = null;
  private pending = false;
  private abort: AbortController | null = null;
  private stopped = false;

  constructor(private readonly deps: UpdaterDeps) {}

  /** Première recherche tout de suite (le lanceur est affiché), puis toutes les 6 heures. */
  start(): void {
    this.stopped = false;
    this.interval = setInterval(() => {
      this.failures = 0;
      void this.check();
    }, this.deps.intervalMs ?? CHECK_INTERVAL_MS);
    void this.check();
  }

  stop(): void {
    this.stopped = true;
    if (this.interval !== null) clearInterval(this.interval);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.interval = null;
    this.retryTimer = null;
    this.abort?.abort();
  }

  /** Salon ouvert ou partie lancée: le téléchargement en cours s'interrompt. */
  suspend(): void {
    this.abort?.abort();
  }

  /** Retour au salon ou à la bibliothèque: une recherche reportée reprend. */
  resume(): void {
    if (this.pending && this.running === null && !this.stopped) void this.check();
  }

  /** Une recherche à la fois; reportée si Duo n'est pas au repos. */
  check(): Promise<CheckResult> {
    if (this.running !== null) return this.running;
    const run = this.runCheck().finally(() => {
      this.running = null;
    });
    this.running = run;
    return run;
  }

  private async runCheck(): Promise<CheckResult> {
    if (!this.deps.isIdle()) {
      this.pending = true;
      return { kind: 'deferred' };
    }
    this.pending = false;
    const result = await this.attempt();
    if (result.kind === 'deferred') this.pending = true;
    if (result.kind === 'failed') {
      this.failures += 1;
      const delays = this.deps.retryDelaysMs ?? RETRY_DELAYS_MS;
      const delay = delays[this.failures - 1];
      this.deps.journal.write('warn', 'games', 'update-failed', {
        step: result.step,
        detail: result.detail,
        failures: this.failures,
        retryInMs: delay ?? null,
      });
      if (delay !== undefined && !this.stopped) {
        if (this.retryTimer !== null) clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          void this.check();
        }, delay);
      }
    } else if (result.kind === 'done') {
      this.failures = 0;
    }
    return result;
  }

  private async attempt(): Promise<CheckResult> {
    let entries: readonly CatalogueEntry[];
    try {
      entries = await this.readCatalogue();
    } catch (error) {
      return { kind: 'failed', step: 'catalogue', detail: describe(error) };
    }
    const wanted = entries.filter((entry) => {
      const current = this.deps.effectiveVersion(entry.id);
      const newer = current === null || compareVersions(entry.version, current) > 0;
      // Version que cette application ne sait pas faire tourner: indisponible (M-13), pas téléchargée.
      return newer && bridgeCovers(entry.manifeste.sdk) && this.deps.allowUrl(entry.url);
    });
    let installed = 0;
    for (const entry of wanted) {
      if (!this.deps.isIdle()) return { kind: 'deferred' };
      let archive: string;
      try {
        archive = await this.download(entry);
      } catch (error) {
        if (error instanceof Busy) return { kind: 'deferred' };
        return {
          kind: 'failed',
          step: 'download',
          detail: `${entry.id}@${entry.version}: ${describe(error)}`,
        };
      }
      if (!this.deps.isIdle()) {
        // L'archive contrôlée reste dans `.incoming`: elle sera retéléchargée, rien n'est installé en partie.
        await rm(archive, { force: true });
        return { kind: 'deferred' };
      }
      const outcome = await this.deps.install({
        archive,
        move: true,
        expected: { id: entry.id, version: entry.version },
        sha256: entry.sha256,
      });
      await rm(archive, { force: true });
      if (outcome.ok) {
        installed += 1;
        this.deps.journal.write('info', 'games', 'game-installed', {
          id: outcome.id,
          version: outcome.version,
          previous: outcome.previous,
        });
        await this.deps.onInstalled(outcome);
      } else if (outcome.reason !== 'not-newer') {
        return {
          kind: 'failed',
          step: 'install',
          detail: `${entry.id}@${entry.version}: ${JSON.stringify(outcome)}`,
        };
      }
    }
    return { kind: 'done', installed };
  }

  private async readCatalogue(): Promise<readonly CatalogueEntry[]> {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    const response = await this.deps.fetch(this.deps.catalogueUrl, { signal });
    if (!response.ok) throw new Error(`catalogue: HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > MAX_CATALOGUE_BYTES) throw new Error('catalogue trop gros');
    const parsed = parseCatalogueText(text);
    if (!parsed.ok) throw new Error(`catalogue écarté: ${parsed.reason}`);
    if (parsed.skipped > 0) {
      this.deps.journal.write('warn', 'games', 'catalogue-entries-skipped', {
        count: parsed.skipped,
      });
    }
    return parsed.entries;
  }

  /** Télécharge un paquet dans `.incoming`, contrôle sa taille et son empreinte. */
  private async download(entry: CatalogueEntry): Promise<string> {
    await mkdir(this.deps.incomingDir, { recursive: true });
    const target = path.join(this.deps.incomingDir, packageFileName(entry.id, entry.version));
    const partial = `${target}.part`;
    const controller = new AbortController();
    this.abort = controller;
    try {
      const response = await this.deps.fetch(entry.url, { signal: controller.signal });
      if (!response.ok || response.body === null) throw new Error(`HTTP ${response.status}`);
      const declared = Number(response.headers.get('content-length') ?? Number.NaN);
      if (Number.isFinite(declared) && declared !== entry.taille) {
        throw new Error(`taille annoncée ${declared}, ${entry.taille} attendus`);
      }
      const hash = createHash('sha256');
      let received = 0;
      const meter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          received += chunk.length;
          if (received > entry.taille) {
            callback(new Error(`plus de ${entry.taille} octets reçus`));
            return;
          }
          hash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
        meter,
        createWriteStream(partial),
      );
      if (received !== entry.taille)
        throw new Error(`${received} octets reçus, ${entry.taille} attendus`);
      // Fichier abîmé: supprimé, la recherche suivante recommence (UX 7.3).
      if (hash.digest('hex') !== entry.sha256)
        throw new Error('empreinte SHA-256 différente du catalogue');
      await rename(partial, target);
      return target;
    } catch (error) {
      await rm(partial, { force: true });
      if (controller.signal.aborted) throw new Busy('téléchargement interrompu');
      throw error;
    } finally {
      if (this.abort === controller) this.abort = null;
    }
  }
}
