// @ts-check
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import afterPack, {
  CPU_TYPES,
  archName,
  duoExecutableUuid,
  locateMachOUuid,
  macExecutablePath,
  readMachOUuid,
  uuidV5,
  writeMachOUuid,
} from '../after-pack.mjs';

/** UUID de l'exécutable principal d'Electron 45.2.0 arm64 (archive officielle). */
const ELECTRON_UUID = '4c4c446b-5555-3144-a1a1-136b14fc37ac';

/**
 * Mach-O 64 bits minimal: en-tête, une commande quelconque, puis les commandes LC_UUID voulues.
 * @param {{ cpuType?: number, uuids?: string[], magic?: number }} [options]
 * @returns {Buffer}
 */
function machO({ cpuType = CPU_TYPES.arm64, uuids = [ELECTRON_UUID], magic = 0xfeedfacf } = {}) {
  const other = Buffer.alloc(16);
  other.writeUInt32LE(0x2, 0); // LC_SYMTAB, sans importance ici
  other.writeUInt32LE(16, 4);
  const commands = [
    other,
    ...uuids.map((uuid) => {
      const command = Buffer.alloc(24);
      command.writeUInt32LE(0x1b, 0);
      command.writeUInt32LE(24, 4);
      Buffer.from(uuid.replace(/-/g, ''), 'hex').copy(command, 8);
      return command;
    }),
  ];
  const body = Buffer.concat(commands);
  const header = Buffer.alloc(32);
  header.writeUInt32LE(magic, 0);
  header.writeUInt32LE(cpuType, 4);
  header.writeUInt32LE(2, 12); // MH_EXECUTE
  header.writeUInt32LE(commands.length, 16);
  header.writeUInt32LE(body.length, 20);
  return Buffer.concat([header, body, Buffer.alloc(64, 0xaa)]);
}

describe('uuidV5', () => {
  it("reproduit l'exemple de la RFC 9562 (annexe A.4)", () => {
    expect(uuidV5('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'www.example.com')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('donne un UUID propre à Duo, stable, de version 5', () => {
    const identity = { appId: 'io.github.haeev.duo', electronVersion: '45.2.0', arch: 'arm64' };
    const uuid = duoExecutableUuid(identity);
    expect(uuid).toBe('61eafd8f-1762-5545-b737-ba6cfb46932d');
    expect(uuid).toBe(duoExecutableUuid(identity));
    expect(uuid).not.toBe(ELECTRON_UUID);
    expect(uuid[14]).toBe('5');
    expect(duoExecutableUuid({ ...identity, electronVersion: '45.3.0' })).not.toBe(uuid);
  });
});

describe('LC_UUID', () => {
  it("lit puis réécrit l'UUID sans toucher au reste", () => {
    const buffer = machO();
    const before = Buffer.from(buffer);
    expect(readMachOUuid(buffer)).toBe(ELECTRON_UUID);
    expect(locateMachOUuid(buffer).cpuType).toBe(CPU_TYPES.arm64);
    const target = '61eafd8f-1762-5545-b737-ba6cfb46932d';
    expect(writeMachOUuid(buffer, target)).toBe(ELECTRON_UUID);
    expect(readMachOUuid(buffer)).toBe(target);
    let changed = 0;
    for (let index = 0; index < buffer.length; index += 1)
      if (buffer[index] !== before[index]) changed += 1;
    expect(changed).toBeLessThanOrEqual(16);
    expect(buffer.length).toBe(before.length);
  });

  it("refuse un binaire universel, un fichier qui n'est pas un Mach-O et un UUID absent ou double", () => {
    const fat = Buffer.alloc(64);
    fat.writeUInt32BE(0xcafebabe, 0);
    expect(() => readMachOUuid(fat)).toThrow(/universel/);
    expect(() => readMachOUuid(Buffer.from('MZ'.padEnd(64, '\0')))).toThrow(/Mach-O/);
    expect(() => readMachOUuid(machO({ uuids: [] }))).toThrow(/0 commande/);
    expect(() => readMachOUuid(machO({ uuids: [ELECTRON_UUID, ELECTRON_UUID] }))).toThrow(
      /2 commande/,
    );
  });

  it('refuse des commandes de chargement qui sortent du fichier', () => {
    const buffer = machO();
    buffer.writeUInt32LE(10_000, 20);
    expect(() => readMachOUuid(buffer)).toThrow(/hors du fichier/);
  });
});

describe('archName', () => {
  it("traduit l'énumération Arch d'electron-builder", () => {
    expect(archName(3)).toBe('arm64');
    expect(archName(1)).toBe('x64');
    expect(archName('arm64')).toBe('arm64');
    expect(() => archName(9)).toThrow(/inconnue/);
  });
});

describe('crochet afterPack', () => {
  /** @type {string[]} */
  const dirs = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  /**
   * @param {string} platform
   * @param {Buffer} executable
   */
  async function pack(platform, executable) {
    const appOutDir = await mkdtemp(path.join(os.tmpdir(), 'duo-after-pack '));
    dirs.push(appOutDir);
    const file = macExecutablePath(appOutDir, 'Duo');
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, executable);
    await afterPack({
      electronPlatformName: platform,
      appOutDir,
      arch: 3,
      packager: {
        appInfo: { id: 'io.github.haeev.duo', productFilename: 'Duo' },
        info: { framework: { version: '45.2.0' } },
      },
    });
    return readFile(file);
  }

  it("réécrit l'UUID de l'exécutable macOS", async () => {
    const result = await pack('darwin', machO());
    expect(readMachOUuid(result)).toBe('61eafd8f-1762-5545-b737-ba6cfb46932d');
  });

  it('ne touche à rien hors de macOS', async () => {
    const result = await pack('win32', machO());
    expect(readMachOUuid(result)).toBe(ELECTRON_UUID);
  });

  it("échoue si l'exécutable n'est pas de l'architecture fabriquée", async () => {
    await expect(pack('darwin', machO({ cpuType: CPU_TYPES.x64 }))).rejects.toThrow(/processeur/);
  });
});
