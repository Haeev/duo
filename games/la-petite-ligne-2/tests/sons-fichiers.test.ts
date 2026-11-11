/**
 * Chaque fichier nommé par les tables sonores existe et se lit: pages Ogg complètes (somme de
 * contrôle de chaque page), en-tête Vorbis ou Opus, durée tirée de la dernière page. Si ffmpeg
 * est présent, chaque fichier est aussi décodé en entier (aucune erreur de décodage).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTables } from '../src/audio/table';

const SON_DIR = fileURLToPath(new URL('../assets/commun/son/', import.meta.url));
const tables = loadTables();

function manifestFiles(): string[] {
  const files = new Set<string>();
  for (const s of Object.values(tables.sounds)) s.files.forEach((f) => files.add(f));
  for (const t of Object.values(tables.voices.timbres)) files.add(t.file);
  for (const l of Object.values(tables.ambience.layers)) files.add(l.file);
  return [...files].sort();
}

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let r = i << 24;
    for (let k = 0; k < 8; k += 1) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc(page: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < page.length; i += 1) {
    // Le champ de contrôle (octets 22 à 25) compte pour zéro.
    const byte = i >= 22 && i < 26 ? 0 : (page[i] ?? 0);
    crc = ((crc << 8) ^ (CRC_TABLE[((crc >>> 24) ^ byte) & 0xff] ?? 0)) >>> 0;
  }
  return crc;
}

interface OggInfo {
  readonly codec: 'vorbis' | 'opus';
  readonly rate: number;
  readonly seconds: number;
}

/** Parcourt les pages Ogg; lève une erreur au premier défaut. */
function readOgg(bytes: Uint8Array): OggInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let codec: OggInfo['codec'] | null = null;
  let rate = 0;
  let preSkip = 0;
  let lastGranule = 0n;
  let pages = 0;
  while (offset < bytes.length) {
    if (view.getUint32(offset, false) !== 0x4f676753) throw new Error(`page ${pages}: pas de OggS`);
    const segments = bytes[offset + 26] ?? 0;
    let body = 0;
    for (let s = 0; s < segments; s += 1) body += bytes[offset + 27 + s] ?? 0;
    const size = 27 + segments + body;
    if (offset + size > bytes.length) throw new Error(`page ${pages}: tronquée`);
    const page = bytes.subarray(offset, offset + size);
    if (oggCrc(page) !== view.getUint32(offset + 22, true))
      throw new Error(`page ${pages}: somme de contrôle fausse`);
    const data = page.subarray(27 + segments);
    if (pages === 0) {
      const head = new TextDecoder().decode(data.subarray(0, 8));
      if (head.slice(1, 7) === 'vorbis' && data[0] === 1) {
        codec = 'vorbis';
        rate = new DataView(data.buffer, data.byteOffset).getUint32(12, true);
      } else if (head === 'OpusHead') {
        codec = 'opus';
        preSkip = new DataView(data.buffer, data.byteOffset).getUint16(10, true);
        rate = 48000;
      } else throw new Error('en-tête inconnu');
    }
    lastGranule = view.getBigUint64(offset + 6, true);
    offset += size;
    pages += 1;
  }
  if (codec === null || rate === 0) throw new Error('aucun flux');
  return { codec, rate, seconds: (Number(lastGranule) - preSkip) / rate };
}

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

describe('fichiers sonores des tables', () => {
  const files = manifestFiles();

  it('existent, ont des pages Ogg intactes et une durée plausible', () => {
    expect(files.length).toBeGreaterThan(50);
    for (const file of files) {
      const info = readOgg(new Uint8Array(readFileSync(join(SON_DIR, file))));
      expect(info.codec, file).toBe('vorbis');
      expect(info.rate, file).toBe(48000);
      expect(info.seconds, file).toBeGreaterThan(0.05);
      expect(info.seconds, file).toBeLessThan(file.startsWith('ambiances/') ? 40 : 10);
    }
  });

  it.skipIf(!ffmpeg)('se décodent en entier sans erreur (ffmpeg, un seul processus)', () => {
    const inputs = files.flatMap((file) => ['-i', join(SON_DIR, file)]);
    const outputs = files.flatMap((_, i) => ['-map', `${String(i)}:a`, '-f', 'null', '-']);
    const run = spawnSync('ffmpeg', ['-v', 'error', '-xerror', ...inputs, ...outputs], {
      encoding: 'utf8',
    });
    expect(`${String(run.status)} ${run.stderr}`.trim()).toBe('0');
  });
});
