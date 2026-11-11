/**
 * Les huit airs de la collection « Musiques » d'Aubrune: chaque fiche du carnet a son morceau du
 * même identifiant dans `musique.json`, ses fichiers existent, se décodent et durent ce que la table
 * annonce; la musique des fêtes et des veillées du quai désigne un air livré.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { choose, type MusicContext } from '../src/audio/musique/choix';
import { loadMusicTable } from '../src/audio/musique/table';

const SON_DIR = fileURLToPath(new URL('../assets/commun/son/', import.meta.url));
const CARNET_DIR = fileURLToPath(new URL('../donnees/commun/carnet/', import.meta.url));
const EVENTS_DIR = fileURLToPath(new URL('../donnees/lieux/aubrune/evenements/', import.meta.url));
const table = loadMusicTable();

interface EntryFile {
  readonly id: string;
  readonly category: string;
  readonly place: string;
}

const tunes = readdirSync(CARNET_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(CARNET_DIR, f), 'utf8')) as EntryFile)
  .filter((e) => e.category === 'musiques' && e.place === 'aubrune')
  .map((e) => e.id)
  .sort();

/** Durée d'un fichier Ogg Opus: granule de la dernière page moins le pré-saut, à 48 kHz. */
function opusSeconds(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  let preSkip = -1;
  let granule = 0n;
  while (offset < bytes.length) {
    if (view.getUint32(offset, false) !== 0x4f676753) throw new Error('pas de page Ogg');
    const segments = bytes[offset + 26] ?? 0;
    let body = 0;
    for (let s = 0; s < segments; s += 1) body += bytes[offset + 27 + s] ?? 0;
    if (preSkip < 0) {
      const head = new TextDecoder().decode(
        bytes.subarray(offset + 27 + segments, offset + 35 + segments),
      );
      if (head !== 'OpusHead') throw new Error('pas un flux Opus');
      preSkip = view.getUint16(offset + 27 + segments + 10, true);
    }
    granule = view.getBigUint64(offset + 6, true);
    offset += 27 + segments + body;
  }
  return (Number(granule) - preSkip) / 48000;
}

const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;

const at = (events: readonly string[], hour: number): MusicContext => ({
  place: 'aubrune',
  zone: null,
  hour,
  weather: 'clear',
  season: 'spring',
  phase: 'day',
  scene: null,
  events,
});

describe('airs de la collection', () => {
  const files = tunes.flatMap((id) =>
    Object.values(table.tracks[id]?.stems ?? {}).map((s) => s.file),
  );

  it('chaque fiche « Musiques » d’Aubrune a son morceau, de 45 à 90 s, en deux tiges', () => {
    expect(tunes).toHaveLength(8);
    for (const id of tunes) {
      const track = table.tracks[id];
      expect(track, id).toBeDefined();
      expect(track?.seconds, id).toBeGreaterThanOrEqual(45);
      expect(track?.seconds, id).toBeLessThanOrEqual(90);
      expect(Object.keys(track?.stems ?? {}).sort(), id).toEqual(['air', 'fond']);
    }
  });

  it('a des fichiers qui durent la boucle annoncée, amorces comprises', () => {
    expect(files).toHaveLength(16);
    for (const id of tunes) {
      const track = table.tracks[id];
      for (const stem of Object.values(track?.stems ?? {})) {
        const path = join(SON_DIR, stem.file);
        expect(existsSync(path), stem.file).toBe(true);
        const seconds = opusSeconds(new Uint8Array(readFileSync(path)));
        const expected = (track?.seconds ?? 0) + 2 * table.timing.preroll;
        expect(Math.abs(seconds - expected), stem.file).toBeLessThan(0.01);
      }
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

describe('musique des fêtes d’Aubrune', () => {
  const FEASTS = [
    'fete-des-barrieres-fleuries',
    'nuit-des-lumignons',
    'concours-de-la-soupe',
    'veillee-du-premier-train',
    'premiere-veillee-du-quai',
    'veillee-du-quai-printemps',
    'veillee-du-quai-ete',
    'veillee-du-quai-automne',
    'veillee-du-quai-hiver',
  ];

  it('chaque fête et chaque veillée joue un air livré, de jour comme le soir', () => {
    for (const id of FEASTS) {
      expect(existsSync(join(EVENTS_DIR, `${id}.json`)), id).toBe(true);
      for (const hour of [11, 20]) {
        const played = choose(table, at([id], hour)).track;
        expect(played, `${id} à ${String(hour)} h`).not.toBeNull();
        const track = table.tracks[played ?? ''];
        expect(track, `${id} à ${String(hour)} h`).toBeDefined();
        for (const stem of Object.values(track?.stems ?? {}))
          expect(existsSync(join(SON_DIR, stem.file)), stem.file).toBe(true);
      }
    }
  });

  it('donne à chaque fête son air, et le pas sur le train du samedi', () => {
    expect(choose(table, at(['fete-des-barrieres-fleuries'], 11)).track).toBe(
      'air-marche-de-la-halte',
    );
    expect(choose(table, at(['nuit-des-lumignons'], 23)).track).toBe('air-sonnerie-de-5h12');
    expect(choose(table, at(['concours-de-la-soupe'], 11)).track).toBe('air-chanson-des-marmites');
    expect(choose(table, at(['veillee-du-premier-train'], 20)).track).toBe('air-sonnerie-de-5h12');
    expect(choose(table, at(['veillee-du-quai-ete'], 20)).track).toBe('air-valse-de-la-minute');
    // Le samedi 13, la fête et le train du samedi sont en cours ensemble: la fête l'emporte.
    expect(choose(table, at(['train-du-samedi', 'fete-des-barrieres-fleuries'], 11)).track).toBe(
      'air-marche-de-la-halte',
    );
    expect(choose(table, at(['train-du-samedi'], 11)).track).toBe('air-sifflet-du-samedi');
  });
});
