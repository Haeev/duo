/** Adresse et port d'une extrémité (IPv4 seulement en version 1). */
export interface Endpoint {
  readonly host: string;
  readonly port: number;
}

/** Interface réseau retenue pour la découverte (reseau.md, section 4.3). */
export interface RetainedInterface {
  readonly name: string;
  readonly address: string;
  readonly netmask: string;
  readonly prefix: number;
  readonly broadcast: string;
  readonly kind: 'physical' | 'virtual';
}

/** Forme de `os.networkInterfaces()`, reprise ici pour que le cœur ne dépende pas de `node:os`. */
export type RawInterfaces = Readonly<
  Record<
    string,
    | readonly {
        readonly address: string;
        readonly netmask: string;
        readonly family: string | number;
        readonly internal: boolean;
      }[]
    | undefined
  >
>;

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Adresse IPv4 en entier non signé, ou `null` si elle est mal formée. */
export function parseIPv4(text: string): number | null {
  const match = IPV4.exec(text);
  if (match === null) return null;
  let value = 0;
  for (let index = 1; index <= 4; index += 1) {
    const part = Number(match[index]);
    if (part > 255) return null;
    value = value * 256 + part;
  }
  return value;
}

export function formatIPv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => String(Math.floor(value / 2 ** shift) % 256)).join('.');
}

/** Retire le préfixe `::ffff:` des adresses IPv4 vues par une socket double pile. */
export function normalizeAddress(address: string): string {
  return address.startsWith('::ffff:') ? address.slice(7) : address;
}

function inRange(value: number, base: string, prefix: number): boolean {
  const start = parseIPv4(base);
  if (start === null) return false;
  const size = 2 ** (32 - prefix);
  return value >= start && value < start + size;
}

/** Plages privées retenues: 10/8, 172.16/12, 192.168/16, et 169.254/16 (câble direct sans box). */
export function isPrivateIPv4(address: string): boolean {
  const value = parseIPv4(normalizeAddress(address));
  if (value === null) return false;
  return (
    inRange(value, '10.0.0.0', 8) ||
    inRange(value, '172.16.0.0', 12) ||
    inRange(value, '192.168.0.0', 16) ||
    inRange(value, '169.254.0.0', 16)
  );
}

export function isLoopbackIPv4(address: string): boolean {
  const value = parseIPv4(normalizeAddress(address));
  return value !== null && inRange(value, '127.0.0.0', 8);
}

/** Source admise: privée, ou boucle locale si les tests à deux instances l'autorisent. */
export function isAcceptedSource(address: string, allowLoopback: boolean): boolean {
  return isPrivateIPv4(address) || (allowLoopback && isLoopbackIPv4(address));
}

export function prefixLength(netmask: string): number {
  const value = parseIPv4(netmask);
  if (value === null) return 32;
  let bits = 0;
  for (let shift = 31; shift >= 0; shift -= 1) {
    if (Math.floor(value / 2 ** shift) % 2 === 1) bits += 1;
    else break;
  }
  return bits;
}

/** Adresse de diffusion dirigée d'un réseau (par exemple 192.168.1.255 pour un /24). */
export function directedBroadcast(address: string, netmask: string): string | null {
  const value = parseIPv4(address);
  const mask = parseIPv4(netmask);
  if (value === null || mask === null) return null;
  const hostBits = 2 ** 32 - 1 - mask;
  const network = value - (value % (hostBits + 1));
  return formatIPv4(network + hostBits);
}

/** Deux adresses dans le même réseau, d'après le masque de la première. */
export function sameSubnet(address: string, other: string, netmask: string): boolean {
  const a = parseIPv4(address);
  const b = parseIPv4(other);
  const prefix = prefixLength(netmask);
  if (a === null || b === null) return false;
  const size = 2 ** (32 - prefix);
  return Math.floor(a / size) === Math.floor(b / size);
}

const VIRTUAL_NAME =
  /vethernet|virtualbox|vmware|hyper-v|wsl|docker|bridge|br-|veth|utun|tap|tun|wg\d|tailscale|zerotier|nordlynx|openvpn|wireguard|vboxnet|vmnet/i;

/** Nom qui évoque un adaptateur virtuel ou un VPN (classé en dernier, jamais écarté). */
export function isLikelyVirtual(name: string): boolean {
  return VIRTUAL_NAME.test(name);
}

/**
 * Interfaces retenues: IPv4 non internes dans une plage privée. Les physiques
 * d'abord, puis les virtuelles, chacune dans l'ordre du système.
 */
export function selectInterfaces(raw: RawInterfaces): RetainedInterface[] {
  const retained: RetainedInterface[] = [];
  for (const [name, entries] of Object.entries(raw)) {
    for (const entry of entries ?? []) {
      const isIPv4 = entry.family === 'IPv4' || entry.family === 4;
      if (!isIPv4 || entry.internal || !isPrivateIPv4(entry.address)) continue;
      const broadcast = directedBroadcast(entry.address, entry.netmask);
      if (broadcast === null) continue;
      retained.push({
        name,
        address: entry.address,
        netmask: entry.netmask,
        prefix: prefixLength(entry.netmask),
        broadcast,
        kind: isLikelyVirtual(name) ? 'virtual' : 'physical',
      });
    }
  }
  return [
    ...retained.filter((entry) => entry.kind === 'physical'),
    ...retained.filter((entry) => entry.kind === 'virtual'),
  ];
}

/** Résultat de la lecture d'une adresse saisie par le joueur. */
export type ManualAddress = { readonly ok: true; readonly host: string } | { readonly ok: false };

/**
 * Lit une adresse IPv4 tapée à la main: espaces retirés, virgule acceptée pour le
 * point (pavé numérique français, H-05). Un port éventuel est ignoré: Duo essaie
 * lui-même ses trois ports.
 */
export function parseManualAddress(input: string): ManualAddress {
  const cleaned = input.trim().replace(/\s+/g, '').replace(/,/g, '.');
  const withoutPort = cleaned.replace(/:\d{1,5}$/, '');
  const value = parseIPv4(withoutPort);
  if (value === null) return { ok: false };
  return { ok: true, host: formatIPv4(value) };
}

export function endpointKey(endpoint: Endpoint): string {
  return `${endpoint.host}:${endpoint.port}`;
}

/** Lit « adresse:port » (option `--duo-peer`). */
export function parseEndpoint(text: string): Endpoint | null {
  const match = /^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/.exec(text.trim());
  if (match === null) return null;
  const host = match[1] ?? '';
  const port = Number(match[2]);
  if (parseIPv4(host) === null || port < 1 || port > 65535) return null;
  return { host, port };
}
