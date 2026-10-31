// Journal local (ADR 0015, point 1): JSON Lines écrit par le principal seul,
// nettoyé dès l'écriture (dossier personnel, nom de l'ordinateur, nom du compte),
// rotation sur 7 fichiers de 5 Mo au plus.
import { appendFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Journal {
  write(level: LogLevel, module: string, event: string, details?: Record<string, unknown>): void;
  /** Attend la fin des écritures en cours (fermeture, tests). */
  flush(): Promise<void>;
}

const MAX_FILES = 7;
const MAX_BYTES = 5 * 1024 * 1024;

export interface SanitizerContext {
  readonly homeDir: string;
  readonly hostName: string;
  readonly userName: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Retire du texte ce qui identifie la machine ou la personne (ADR 0015). */
export function createSanitizer(context: SanitizerContext): (text: string) => string {
  const replacements: [RegExp, string][] = [];
  const home = context.homeDir.replace(/[\\/]+$/, '');
  if (home.length > 1) {
    replacements.push([new RegExp(escapeRegExp(home), 'gi'), '~']);
    const forward = home.replace(/\\/g, '/');
    if (forward !== home) replacements.push([new RegExp(escapeRegExp(forward), 'gi'), '~']);
    const escaped = JSON.stringify(home).slice(1, -1);
    if (escaped !== home) replacements.push([new RegExp(escapeRegExp(escaped), 'gi'), '~']);
  }
  for (const [value, mask] of [
    [context.hostName, '<ordinateur>'],
    [context.userName, '<compte>'],
  ] as const) {
    if (value.length >= 3) replacements.push([new RegExp(escapeRegExp(value), 'gi'), mask]);
  }
  // Adresses matérielles et IPv6: jamais dans le journal.
  replacements.push([/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, '<adresse-materielle>']);
  // IPv6 complète, ou abrégée par « :: » (une heure « 21:40:05 » ne doit pas être masquée).
  replacements.push([/\b(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, '<ipv6>']);
  replacements.push([/(?:[0-9a-f]{1,4}:)*[0-9a-f]{0,4}::(?:[0-9a-f]{1,4}:)*[0-9a-f]{1,4}\b/gi, '<ipv6>']);
  return (text) => replacements.reduce((current, [pattern, mask]) => current.replace(pattern, mask), text);
}

function dayStamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function createJournal(dir: string, sanitize: (text: string) => string): Journal {
  let chain: Promise<void> = mkdir(dir, { recursive: true })
    .then(() => pruneOldFiles(dir))
    .catch(() => undefined);
  let full = false;

  return {
    write(level, module, event, details) {
      const now = new Date();
      const line = sanitize(
        JSON.stringify({
          at: now.toISOString(),
          mono: Math.round(performance.now()),
          level,
          module,
          event,
          ...(details === undefined ? {} : { details }),
        }),
      );
      const file = path.join(dir, `duo-${dayStamp(now)}.jsonl`);
      chain = chain.then(async () => {
        if (full) return;
        try {
          const info = await stat(file).catch(() => null);
          if (info !== null && info.size > MAX_BYTES) {
            full = true;
            return;
          }
          await appendFile(file, `${line}\n`, 'utf8');
        } catch {
          // Un journal qui ne s'écrit pas ne doit jamais arrêter Duo.
        }
      });
    },
    flush() {
      return chain;
    },
  };
}

async function pruneOldFiles(dir: string): Promise<void> {
  const files = (await readdir(dir)).filter((name) => /^duo-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)).sort();
  const excess = files.slice(0, Math.max(0, files.length - MAX_FILES));
  await Promise.all(excess.map((name) => rm(path.join(dir, name), { force: true })));
}

export function systemSanitizer(): (text: string) => string {
  let userName = '';
  try {
    userName = os.userInfo().username;
  } catch {
    userName = '';
  }
  return createSanitizer({ homeDir: os.homedir(), hostName: os.hostname(), userName });
}
