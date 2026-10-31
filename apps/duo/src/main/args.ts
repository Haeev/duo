// Options de ligne de commande (ADR 0003, point 9; ADR 0013, prérequis 1).
// Présentes aussi dans les versions publiées: utiles au dépannage.
import path from 'node:path';
import { parseNetworkCommandLine, type NetworkCommandLine } from '@duo/liaison';

export interface CommandLineOptions {
  /** Dossier de données, appliqué avant le verrou d'instance unique. */
  readonly dataDir: string | null;
  /** Dossier de jeux supplémentaire (développement, tests, dépannage). */
  readonly gamesDir: string | null;
  /**
   * Réseau (ADR 0008): `--duo-port=<n>` (port UDP et TCP de base, 39420 par défaut),
   * `--duo-peer=<adresse>:<port>` (destination directe, répétable) et
   * `--duo-allow-loopback` (deux instances sur une même machine).
   */
  readonly network: NetworkCommandLine;
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

/** Lit les options; un chemin relatif est résolu depuis `cwd`. */
export function parseCommandLine(argv: readonly string[], cwd: string): CommandLineOptions {
  const dataDir = readValue(argv, 'duo-data-dir');
  const gamesDir = readValue(argv, 'duo-games-dir');
  return {
    dataDir: dataDir === null ? null : path.resolve(cwd, dataDir),
    gamesDir: gamesDir === null ? null : path.resolve(cwd, gamesDir),
    network: parseNetworkCommandLine(argv),
  };
}
