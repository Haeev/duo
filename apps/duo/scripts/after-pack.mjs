// @ts-check
// Crochet `afterPack` d'electron-builder (ADR 0011, section 3.2).
//
// Sous macOS, l'exécutable principal d'Electron porte le même UUID pour toutes
// les applications d'une version d'Electron (45.2.0 arm64: 4c4c446b-...-136b14fc37ac).
// Or l'autorisation « Réseau local » de macOS s'appuie sur cet UUID, qui doit
// être unique (notes techniques TN3179 et TN3178 d'Apple). Le crochet le
// remplace par un UUID v5 dérivé de l'appId, de la version d'Electron et de
// l'architecture: propre à Duo, stable tant que le binaire d'Electron ne change pas.
//
// electron-builder appelle ce crochet après la copie des ressources, avant les
// fusibles et la signature ad hoc: la signature couvre donc l'exécutable modifié.
// Sans dépendance, pour tourner sous macOS, Windows et Linux.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** En-tête Mach-O 64 bits, petit-boutiste (arm64 et x86_64). */
const MH_MAGIC_64 = 0xfeedfacf;
/** Même nombre lu à l'envers: binaire gros-boutiste, inconnu sous macOS moderne. */
const MH_CIGAM_64 = 0xcffaedfe;
/** Binaires universels (« fat »), lus en gros-boutiste. */
const FAT_MAGIC = 0xcafebabe;
const FAT_MAGIC_64 = 0xcafebabf;
const MACH_HEADER_64_SIZE = 32;
const LC_UUID = 0x1b;
const UUID_COMMAND_SIZE = 24;

/** Processeurs d'un en-tête Mach-O (`cputype`). */
export const CPU_TYPES = /** @type {const} */ ({ x64: 0x01000007, arm64: 0x0100000c });

/** Espace de noms « URL » de la RFC 9562 (UUID v5). */
const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

/** Valeurs de l'énumération `Arch` d'electron-builder (paquet builder-util). */
const ARCH_NAMES = ['ia32', 'x64', 'armv7l', 'arm64', 'universal'];

/**
 * @param {string} uuid forme textuelle, tirets compris
 * @returns {Buffer} 16 octets
 */
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) throw new Error(`UUID invalide: ${uuid}`);
  return Buffer.from(hex, 'hex');
}

/**
 * @param {Uint8Array} bytes 16 octets
 * @returns {string} forme textuelle en minuscules
 */
export function formatUuid(bytes) {
  const hex = Buffer.from(bytes).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * UUID version 5 (SHA-1 d'un espace de noms et d'un nom), RFC 9562.
 * @param {string} namespace UUID de l'espace de noms
 * @param {string} name nom, encodé en UTF-8
 * @returns {string}
 */
export function uuidV5(namespace, name) {
  const digest = createHash('sha1')
    .update(uuidToBytes(namespace))
    .update(Buffer.from(name, 'utf8'))
    .digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/**
 * UUID attendu pour l'exécutable principal de Duo sous macOS. La CI le compare
 * à celui que lit `dwarfdump --uuid` sur l'application fabriquée.
 * @param {{ appId: string, electronVersion: string, arch: string }} identity
 * @returns {string}
 */
export function duoExecutableUuid({ appId, electronVersion, arch }) {
  return uuidV5(NAMESPACE_URL, `duo:${appId}:electron-${electronVersion}:darwin-${arch}`);
}

/**
 * Commande `LC_UUID` d'un Mach-O 64 bits mince: position de ses 16 octets et processeur.
 * Un binaire universel est refusé: Duo ne fabrique que des binaires minces (ADR 0011, 3.1).
 * @param {Buffer} buffer contenu de l'exécutable
 * @returns {{ offset: number, cpuType: number }}
 */
export function locateMachOUuid(buffer) {
  if (buffer.length < MACH_HEADER_64_SIZE) throw new Error('fichier trop court pour un Mach-O');
  const magicLittle = buffer.readUInt32LE(0);
  const magicBig = buffer.readUInt32BE(0);
  if (magicBig === FAT_MAGIC || magicBig === FAT_MAGIC_64) {
    throw new Error(
      'binaire universel (fat): non pris en charge, Duo fabrique un binaire par architecture',
    );
  }
  if (magicLittle === MH_CIGAM_64) throw new Error('Mach-O gros-boutiste: non pris en charge');
  if (magicLittle !== MH_MAGIC_64) {
    throw new Error(`pas un Mach-O 64 bits (nombre magique 0x${magicLittle.toString(16)})`);
  }
  const cpuType = buffer.readUInt32LE(4);
  const commandCount = buffer.readUInt32LE(16);
  const commandsSize = buffer.readUInt32LE(20);
  const end = MACH_HEADER_64_SIZE + commandsSize;
  if (end > buffer.length) throw new Error('commandes de chargement hors du fichier');

  /** @type {number[]} */
  const found = [];
  let offset = MACH_HEADER_64_SIZE;
  for (let index = 0; index < commandCount; index += 1) {
    if (offset + 8 > end) throw new Error(`commande de chargement ${index} tronquée`);
    const command = buffer.readUInt32LE(offset);
    const size = buffer.readUInt32LE(offset + 4);
    if (size < 8 || offset + size > end) {
      throw new Error(`taille invalide pour la commande de chargement ${index}`);
    }
    if (command === LC_UUID) {
      if (size !== UUID_COMMAND_SIZE) throw new Error('commande LC_UUID de taille inattendue');
      found.push(offset + 8);
    }
    offset += size;
  }
  const [uuidOffset] = found;
  if (found.length !== 1 || uuidOffset === undefined) {
    throw new Error(`${found.length} commande(s) LC_UUID trouvée(s), une seule attendue`);
  }
  return { offset: uuidOffset, cpuType };
}

/**
 * @param {Buffer} buffer contenu de l'exécutable
 * @returns {string}
 */
export function readMachOUuid(buffer) {
  const { offset } = locateMachOUuid(buffer);
  return formatUuid(buffer.subarray(offset, offset + 16));
}

/**
 * Remplace l'UUID dans le tampon (modifié sur place).
 * @param {Buffer} buffer contenu de l'exécutable
 * @param {string} uuid nouvel UUID
 * @returns {string} UUID remplacé
 */
export function writeMachOUuid(buffer, uuid) {
  const { offset } = locateMachOUuid(buffer);
  const previous = formatUuid(buffer.subarray(offset, offset + 16));
  uuidToBytes(uuid).copy(buffer, offset);
  return previous;
}

/**
 * Nom d'architecture d'electron-builder.
 * @param {number | string} arch valeur de l'énumération `Arch`, ou son nom
 * @returns {string}
 */
export function archName(arch) {
  const name = typeof arch === 'number' ? ARCH_NAMES[arch] : arch;
  if (name === undefined || !ARCH_NAMES.includes(name))
    throw new Error(`architecture inconnue: ${String(arch)}`);
  return name;
}

/**
 * Chemin de l'exécutable principal dans le dossier produit par electron-builder.
 * @param {string} appOutDir dossier de sortie de l'empaquetage
 * @param {string} productFilename nom de fichier du produit (`Duo`)
 * @returns {string}
 */
export function macExecutablePath(appOutDir, productFilename) {
  return path.join(appOutDir, `${productFilename}.app`, 'Contents', 'MacOS', productFilename);
}

/**
 * Partie du contexte `afterPack` d'electron-builder lue par ce crochet.
 * @typedef {object} AfterPackContext
 * @property {string} electronPlatformName `darwin`, `win32`, `linux` ou `mas`
 * @property {string} appOutDir dossier de l'application empaquetée
 * @property {number} arch valeur de l'énumération `Arch`
 * @property {{ appInfo: { id: string, productFilename: string }, info: { framework: { version: string } } }} packager
 */

/**
 * Point d'entrée appelé par electron-builder.
 * @param {AfterPackContext} context
 * @returns {Promise<void>}
 */
export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const { appInfo, info } = context.packager;
  const arch = archName(context.arch);
  const executable = macExecutablePath(context.appOutDir, appInfo.productFilename);
  const uuid = duoExecutableUuid({
    appId: appInfo.id,
    electronVersion: info.framework.version,
    arch,
  });

  const buffer = await readFile(executable);
  const { cpuType } = locateMachOUuid(buffer);
  const expectedCpu = arch === 'arm64' ? CPU_TYPES.arm64 : arch === 'x64' ? CPU_TYPES.x64 : null;
  if (expectedCpu === null || cpuType !== expectedCpu) {
    throw new Error(
      `exécutable ${executable}: processeur 0x${cpuType.toString(16)} inattendu pour ${arch}`,
    );
  }
  const previous = writeMachOUuid(buffer, uuid);
  if (previous === uuid) return;
  await writeFile(executable, buffer);
  process.stdout.write(
    `  • after-pack: UUID de ${path.basename(executable)} ${previous} remplacé par ${uuid}\n`,
  );
}
