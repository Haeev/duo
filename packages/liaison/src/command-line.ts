import { parseEndpoint } from './addresses.ts';
import type { Endpoint } from './addresses.ts';

/** Options réseau de la ligne de commande (ADR 0003 point 9, ADR 0008). */
export interface NetworkCommandLine {
  /** `--duo-port=<n>`: port UDP et TCP de base. */
  readonly port?: number;
  /** `--duo-peer=<adresse>:<port>`, répétable: destinations directes (boucle locale). */
  readonly peers: readonly Endpoint[];
  /** `--duo-allow-loopback`: sources 127.0.0.0/8 admises. */
  readonly allowLoopback: boolean;
  /** Options reconnues mais mal écrites, à signaler dans le journal. */
  readonly invalid: readonly string[];
}

/** Lit les options réseau parmi les arguments du processus; ignore les autres. */
export function parseNetworkCommandLine(argv: readonly string[]): NetworkCommandLine {
  let port: number | undefined;
  const peers: Endpoint[] = [];
  let allowLoopback = false;
  const invalid: string[] = [];
  for (const argument of argv) {
    if (argument === '--duo-allow-loopback') {
      allowLoopback = true;
    } else if (argument.startsWith('--duo-port=')) {
      const value = Number(argument.slice('--duo-port='.length));
      if (Number.isInteger(value) && value >= 1024 && value <= 65_533) port = value;
      else invalid.push(argument);
    } else if (argument.startsWith('--duo-peer=')) {
      const endpoint = parseEndpoint(argument.slice('--duo-peer='.length));
      if (endpoint === null) invalid.push(argument);
      else peers.push(endpoint);
    }
  }
  return { ...(port === undefined ? {} : { port }), peers, allowLoopback, invalid };
}
