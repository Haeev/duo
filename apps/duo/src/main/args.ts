// Options de ligne de commande (ADR 0003, point 9; ADR 0013, prérequis 1).
// Présentes aussi dans les versions publiées: utiles au dépannage.
import path from 'node:path';

export interface CommandLineOptions {
  /** Dossier de données, appliqué avant le verrou d'instance unique. */
  readonly dataDir: string | null;
  /** Dossier de jeux supplémentaire (développement, tests, dépannage). */
  readonly gamesDir: string | null;
  /** Port de base de la liaison provisoire (deux instances sur une machine). */
  readonly liaisonPort: number | null;
  /** Adresse de l'autre ordinateur pour la liaison provisoire: `hôte:port`. */
  readonly peerAddress: { readonly host: string; readonly port: number } | null;
}

function readValue(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  for (const argument of argv) {
    if (argument.startsWith(prefix)) {
      const value = argument.slice(prefix.length).trim();
      return value === '' ? null : value;
    }
  }
  return null;
}

function parsePort(value: string | null): number | null {
  if (value === null || !/^\d{1,5}$/.test(value)) return null;
  const port = Number(value);
  return port >= 1024 && port <= 65535 ? port : null;
}

function parseAddress(value: string | null): CommandLineOptions['peerAddress'] {
  if (value === null) return null;
  const match = /^([A-Za-z0-9.-]+):(\d{1,5})$/.exec(value);
  if (match === null) return null;
  const host = match[1];
  const port = parsePort(match[2] ?? null);
  return host === undefined || port === null ? null : { host, port };
}

/** Lit les options; un chemin relatif est résolu depuis `cwd`. */
export function parseCommandLine(argv: readonly string[], cwd: string): CommandLineOptions {
  const dataDir = readValue(argv, 'duo-data-dir');
  const gamesDir = readValue(argv, 'duo-games-dir');
  return {
    dataDir: dataDir === null ? null : path.resolve(cwd, dataDir),
    gamesDir: gamesDir === null ? null : path.resolve(cwd, gamesDir),
    liaisonPort: parsePort(readValue(argv, 'duo-liaison-port')),
    peerAddress: parseAddress(readValue(argv, 'duo-peer-address')),
  };
}
