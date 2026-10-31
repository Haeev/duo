// @ts-check
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_FUSES,
  fuseProblems,
  listAsarFiles,
  readAsarHeader,
  readFuseWire,
  readPeMachine,
  readPlist,
} from '../verifier-paquet.mjs';

const SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';

/**
 * @param {string} wire
 * @returns {Buffer}
 */
function binaryWithFuses(wire) {
  return Buffer.concat([
    Buffer.alloc(100, 0x41),
    Buffer.from(SENTINEL, 'ascii'),
    Buffer.from([1, wire.length]),
    Buffer.from(wire, 'ascii'),
    Buffer.alloc(100, 0x42),
  ]);
}

/**
 * Archive asar minimale (en-tête seulement, sans contenu).
 * @param {unknown} tree
 * @returns {Buffer}
 */
function asar(tree) {
  const json = Buffer.from(JSON.stringify(tree), 'utf8');
  const padded = Math.ceil(json.length / 4) * 4;
  const pickle = Buffer.alloc(8 + padded);
  pickle.writeUInt32LE(4 + padded, 0);
  pickle.writeUInt32LE(json.length, 4);
  json.copy(pickle, 8);
  const head = Buffer.alloc(8);
  head.writeUInt32LE(4, 0);
  head.writeUInt32LE(pickle.length, 4);
  return Buffer.concat([head, pickle]);
}

describe('fusibles', () => {
  it("relit le câblage et le compare à celui de l'ADR 0011", () => {
    const expected = EXPECTED_FUSES.map(([, value]) => value).join('');
    expect(expected).toBe('000011001');
    expect(readFuseWire(binaryWithFuses(expected))).toEqual({ version: 1, wire: expected });
    expect(fuseProblems(expected)).toEqual([]);
  });

  it('nomme chaque fusible mal réglé', () => {
    expect(fuseProblems('100011011')).toEqual([
      'runAsNode: 1 au lieu de 0',
      'grantFileProtocolExtraPrivileges: 1 au lieu de 0',
    ]);
  });

  it("signale une version d'Electron au nombre de fusibles différent", () => {
    expect(fuseProblems('0000110011')[0]).toMatch(/10 fusibles au lieu de 9/);
  });

  it('refuse un binaire sans sentinelle', () => {
    expect(() => readFuseWire(Buffer.alloc(200))).toThrow(/sentinelle/);
  });
});

describe('asar', () => {
  it("liste les fichiers de l'arborescence", () => {
    const tree = {
      files: {
        'package.json': { size: 10, offset: '0' },
        out: { files: { main: { files: { 'index.js': { size: 5, offset: '10' } } } } },
      },
    };
    expect(listAsarFiles(readAsarHeader(asar(tree))).sort()).toEqual([
      'out/main/index.js',
      'package.json',
    ]);
  });

  it("refuse un fichier qui n'est pas une archive", () => {
    expect(() => readAsarHeader(Buffer.alloc(32))).toThrow(/asar/);
  });
});

describe('Info.plist', () => {
  it('lit chaînes, booléens et présence des dictionnaires', () => {
    const plist = readPlist(`<?xml version="1.0"?><plist><dict>
      <key>CFBundleIdentifier</key><string>io.github.haeev.duo</string>
      <key>NSAppSleepDisabled</key><true/>
      <key>NSLocalNetworkUsageDescription</key>
      <string>Duo cherche l&apos;autre ordinateur</string>
      <key>ElectronAsarIntegrity</key><dict><key>Resources/app.asar</key><dict></dict></dict>
    </dict></plist>`);
    expect(plist.get('CFBundleIdentifier')).toBe('io.github.haeev.duo');
    expect(plist.get('NSAppSleepDisabled')).toBe(true);
    expect(plist.get('NSLocalNetworkUsageDescription')).toBe("Duo cherche l'autre ordinateur");
    expect(plist.has('ElectronAsarIntegrity')).toBe(true);
  });
});

describe('exécutable Windows', () => {
  it("lit le processeur de l'en-tête PE", () => {
    const buffer = Buffer.alloc(256);
    buffer.write('MZ', 0, 'ascii');
    buffer.writeUInt32LE(0x80, 0x3c);
    buffer.writeUInt32LE(0x00004550, 0x80);
    buffer.writeUInt16LE(0x8664, 0x84);
    expect(readPeMachine(buffer)).toBe(0x8664);
    expect(() => readPeMachine(Buffer.alloc(256))).toThrow(/Windows/);
  });
});
