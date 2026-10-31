import { describe, expect, it } from 'vitest';
import soundsFile from '../../assets/son/sons.json';
import { parseCatalogue } from './catalogue';
import { BufferCache, type DecodedBuffer, decodedBytes } from './memoire';
import { AUDIO_SETTINGS } from './reglages';

const MB = 1024 * 1024;
const RATE = 48000;

/** Faux décodeur: un tampon de la taille prévue, rendu au prochain tour. */
function fakeCache(sizes: Map<string, number>, cap: number, warnings: string[] = []): { cache: BufferCache<DecodedBuffer>; clock: { t: number } } {
  const clock = { t: 0 };
  const cache = new BufferCache<DecodedBuffer>({
    capBytes: cap,
    bytesPerSample: 4,
    estimate: (file) => sizes.get(file) ?? 0,
    load: (file) => {
      const bytes = sizes.get(file);
      if (bytes === undefined) return Promise.reject(new Error(`absent: ${file}`));
      return Promise.resolve({ length: bytes / 4, numberOfChannels: 1 });
    },
    now: () => clock.t,
    warn: (message) => warnings.push(message),
  });
  return { cache, clock };
}

describe('mémoire des sons décodés', () => {
  it('compte les octets décodés et libère le moins récemment servi quand la place manque', async () => {
    const sizes = new Map([
      ['a', 40 * MB],
      ['b', 40 * MB],
      ['c', 40 * MB],
    ]);
    const { cache, clock } = fakeCache(sizes, 100 * MB);
    await cache.request('a');
    clock.t = 1;
    await cache.request('b');
    clock.t = 2;
    cache.get('a');
    clock.t = 3;
    await cache.request('c');
    expect(cache.stats().usedBytes).toBe(80 * MB);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
  });

  it('ne libère jamais un son tenu (en lecture) ni un son permanent; refuse alors', async () => {
    const sizes = new Map([
      ['effets', 30 * MB],
      ['musique', 40 * MB],
      ['autre', 40 * MB],
    ]);
    const warnings: string[] = [];
    const { cache } = fakeCache(sizes, 100 * MB, warnings);
    await cache.request('effets', true);
    await cache.request('musique');
    cache.pin('musique');
    expect(cache.canFit('autre')).toBe(false);
    expect(await cache.request('autre')).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(cache.stats().refused).toBe(1);
    cache.unpin('musique');
    expect(await cache.request('autre')).not.toBeNull();
    expect(cache.has('effets')).toBe(true);
    expect(cache.has('musique')).toBe(false);
  });

  it('oublie un fichier illisible sans planter', async () => {
    const warnings: string[] = [];
    const { cache } = fakeCache(new Map(), 10 * MB, warnings);
    expect(await cache.request('manquant.ogg')).toBeNull();
    expect(cache.stats().usedBytes).toBe(0);
    expect(warnings).toEqual(['son illisible']);
  });

  it('tient le pic d un samedi sous 128 Mo avec les vrais fichiers (permanents, ambiances, train, fondu de deux musiques)', async () => {
    const catalogue = parseCatalogue(soundsFile);
    const sizes = new Map<string, number>();
    for (const s of catalogue.sounds.values()) {
      s.files.forEach((f, i) => sizes.set(f, decodedBytes(s.durations[i] ?? 0, RATE, s.channels, 4)));
    }
    for (const m of catalogue.music.values()) sizes.set(m.file, decodedBytes(m.duration, RATE, 2, 4));
    const { cache } = fakeCache(sizes, AUDIO_SETTINGS.memory.capBytes);
    const resident = [...sizes.keys()].filter((f) => AUDIO_SETTINGS.memory.residentFolders.some((d) => f.startsWith(d)));
    for (const f of resident) await cache.request(f, true);
    const residentMB = cache.stats().usedBytes / MB;
    expect(residentMB).toBeGreaterThan(20);
    expect(residentMB).toBeLessThan(30);
    // Ambiances du jour, qui jouent.
    for (const id of ['river', 'wind', 'birds-morning', 'village']) {
      const file = catalogue.sounds.get(id)?.files[0] ?? '';
      await cache.request(file);
      cache.pin(file);
    }
    // Train décodé d'avance (pas en lecture), locomotive à l'arrêt en lecture.
    for (const f of [...sizes.keys()].filter((k) => k.startsWith('train/'))) await cache.request(f);
    cache.pin('train/train-idle-loop.ogg');
    await cache.request('musique/fanfare-train.ogg');
    // Le thème du matin joue, celui de l'après-midi arrive en fondu à la même position.
    await cache.request('musique/halte-matin.ogg');
    cache.pin('musique/halte-matin.ogg');
    const afternoon = await cache.request('musique/halte-apres-midi.ogg');
    expect(afternoon).not.toBeNull();
    const stats = cache.stats();
    expect(stats.usedBytes).toBeLessThanOrEqual(AUDIO_SETTINGS.memory.capBytes);
    expect(stats.peakBytes).toBeLessThanOrEqual(AUDIO_SETTINGS.memory.capBytes);
    expect(stats.refused).toBe(0);
    // La locomotive à l'arrêt, tenue, est restée.
    expect(cache.has('train/train-idle-loop.ogg')).toBe(true);
  });

  it('calcule la taille décodée en float32', () => {
    expect(decodedBytes(98, 48000, 2, 4)).toBe(98 * 48000 * 2 * 4);
    expect(decodedBytes(98, 44100, 2, 4)).toBe(98 * 44100 * 2 * 4);
  });
});
