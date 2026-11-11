/**
 * Tire la partition de jeu d'un air de son fichier MIDI (la source de vérité de la musique,
 * `assets-src/son/musique/midi/`), et l'écrit dans le bloc `score` de `donnees/commun/airs/<id>.json`:
 *   pnpm partition                      tous les airs de donnees/commun/airs/
 *   pnpm partition air-marche-de-la-halte
 *   pnpm partition --pistes air-marche-de-la-halte    liste les pistes du MIDI (noms, notes, mesures)
 * Le haut du fichier (rang, difficulté, voix et leurs pistes) reste écrit à la main; `score` est
 * toujours recalculé. `tests/musique-jouee.test.ts` refuse une partition qui ne sort pas d'ici.
 * Lancé par Node tel quel (types effacés).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface MidiNote {
  /** Début et durée, en noires. */
  readonly beat: number;
  readonly beats: number;
  readonly pitch: number;
}

export interface MidiTrack {
  readonly name: string;
  readonly percussion: boolean;
  readonly notes: readonly MidiNote[];
}

export interface MidiFile {
  /** Noires par minute. */
  readonly tempo: number;
  /** Noires par mesure (une mesure à 6/8 en compte 3). */
  readonly beatsPerBar: number;
  readonly tracks: readonly MidiTrack[];
}

function readVariable(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  let next = at;
  for (;;) {
    const byte = bytes[next] ?? 0;
    next += 1;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next };
  }
}

function text(bytes: Uint8Array, from: number, length: number): string {
  return new TextDecoder('utf-8').decode(bytes.subarray(from, from + length));
}

/** Lit un fichier MIDI de type 1: tempo, mesure, et les notes de chaque piste nommée. */
export function parseMidi(bytes: Uint8Array): MidiFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (text(bytes, 0, 4) !== 'MThd') throw new Error('fichier MIDI illisible (en-tête absent)');
  const ticksPerBeat = view.getUint16(12);
  let at = 8 + view.getUint32(4);
  let tempo = 120;
  let beatsPerBar = 4;
  const tracks: MidiTrack[] = [];
  while (at + 8 <= bytes.length) {
    const kind = text(bytes, at, 4);
    const end = at + 8 + view.getUint32(at + 4);
    at += 8;
    if (kind !== 'MTrk') {
      at = end;
      continue;
    }
    let name = '';
    let tick = 0;
    let status = 0;
    let percussion = false;
    const open = new Map<number, number>();
    const notes: MidiNote[] = [];
    while (at < end) {
      const delta = readVariable(bytes, at);
      tick += delta.value;
      at = delta.next;
      let first = bytes[at] ?? 0;
      if (first === 0xff) {
        const type = bytes[at + 1] ?? 0;
        const length = readVariable(bytes, at + 2);
        if (type === 0x03) name = text(bytes, length.next, length.value);
        else if (type === 0x51)
          tempo =
            60_000_000 /
            (((bytes[length.next] ?? 0) << 16) |
              ((bytes[length.next + 1] ?? 0) << 8) |
              (bytes[length.next + 2] ?? 0));
        else if (type === 0x58)
          beatsPerBar = ((bytes[length.next] ?? 4) * 4) / 2 ** (bytes[length.next + 1] ?? 2);
        at = length.next + length.value;
        continue;
      }
      if (first === 0xf0 || first === 0xf7) {
        const length = readVariable(bytes, at + 1);
        at = length.next + length.value;
        continue;
      }
      if ((first & 0x80) !== 0) {
        status = first;
        at += 1;
        first = bytes[at] ?? 0;
      }
      const type = status & 0xf0;
      const second = type === 0xc0 || type === 0xd0 ? 0 : (bytes[at + 1] ?? 0);
      at += type === 0xc0 || type === 0xd0 ? 1 : 2;
      if (type !== 0x90 && type !== 0x80) continue;
      if ((status & 0x0f) === 9) percussion = true;
      const started = open.get(first);
      if (started !== undefined) {
        notes.push({
          beat: started / ticksPerBeat,
          beats: Math.max(1, tick - started) / ticksPerBeat,
          pitch: first,
        });
        open.delete(first);
      }
      if (type === 0x90 && second > 0) open.set(first, tick);
    }
    at = end;
    if (notes.length > 0) {
      notes.sort((a, b) => a.beat - b.beat || a.pitch - b.pitch);
      tracks.push({ name, percussion, notes });
    }
  }
  return { tempo, beatsPerBar, tracks };
}

interface Part {
  readonly track: string;
  readonly fromBar?: number;
  readonly toBar?: number;
  readonly transpose?: number;
}

interface Voice {
  readonly name: string;
  readonly parts: readonly Part[];
}

/** Le haut d'un fichier d'air: ce que lit la dérivation (le schéma complet est `schemas/air.ts`). */
export interface AirSource {
  readonly id: string;
  readonly source: {
    readonly midi: string;
    readonly fromBar: number;
    readonly bars: number;
    readonly minGapMs: number;
    readonly laneBars?: number;
  };
  readonly voices: { readonly solo: Voice; readonly duo?: readonly [Voice, Voice] };
}

export type ScoreNote = [number, number, number, number];

export interface Score {
  tempo: number;
  beatsPerBar: number;
  startMs: number;
  lengthMs: number;
  solo: ScoreNote[];
  duo?: [ScoreNote[], ScoreNote[]];
}

/**
 * Grille de mise en place: un douzième de noire (doubles croches, triolets, balancement). Les
 * notes du MIDI portent un petit retard d'interprétation, jamais d'avance: l'arrondi les ramène
 * sur la mesure écrite.
 */
const GRID = 12;
const LANES = 4;
const MIN_NOTE_MS = 120;
/** Queue de note: une note tenue s'arrête un peu avant la suivante. */
const BREATH_MS = 30;

interface Placed {
  readonly beat: number;
  readonly beats: number;
  readonly pitch: number;
}

/** Poids d'une note pour l'élagage: le premier temps, puis les temps, puis les demi-temps. */
function strength(note: Placed, beatsPerBar: number): number {
  const inBar = note.beat % beatsPerBar;
  const onBar = Math.abs(inBar) < 1e-6 ? 4 : 0;
  const onBeat = Math.abs(note.beat - Math.round(note.beat)) < 1e-6 ? 2 : 0;
  const onHalf = Math.abs(note.beat * 2 - Math.round(note.beat * 2)) < 1e-6 ? 1 : 0;
  return onBar + onBeat + onHalf + Math.min(0.9, note.beats / 4);
}

function voiceNotes(midi: MidiFile, air: AirSource, voice: Voice): ScoreNote[] {
  const { fromBar, bars, minGapMs } = air.source;
  const laneBars = air.source.laneBars ?? 4;
  const msPerBeat = 60_000 / midi.tempo;
  const first = fromBar * midi.beatsPerBar;
  const last = (fromBar + bars) * midi.beatsPerBar;
  // 1. Les notes des pistes nommées, ramenées sur la grille, dans l'extrait.
  const byBeat = new Map<number, Placed>();
  for (const part of voice.parts) {
    const track = midi.tracks.find((t) => t.name === part.track);
    if (track === undefined)
      throw new Error(
        `${air.id}: piste « ${part.track} » absente de ${air.source.midi} (pistes: ${midi.tracks.map((t) => t.name).join(', ')})`,
      );
    if (track.percussion)
      throw new Error(`${air.id}: « ${part.track} » est une piste de percussions, sans hauteur`);
    const from = Math.max(first, (part.fromBar ?? 0) * midi.beatsPerBar);
    const to = Math.min(last, (part.toBar ?? 1e9) * midi.beatsPerBar);
    for (const note of track.notes) {
      const beat = Math.round(note.beat * GRID) / GRID;
      if (beat < from - 1e-6 || beat >= to - 1e-6) continue;
      const placed = { beat, beats: note.beats, pitch: note.pitch + (part.transpose ?? 0) };
      const key = Math.round(beat * GRID);
      const known = byBeat.get(key);
      // Deux notes au même instant (accord, doublure): la plus aiguë chante.
      if (known === undefined || placed.pitch > known.pitch) byBeat.set(key, placed);
    }
  }
  const all = [...byBeat.values()].sort((a, b) => a.beat - b.beat);
  // 2. Élagage: jamais deux frappes à moins de `minGapMs`; les temps forts restent.
  const kept: Placed[] = [];
  const ranked = [...all].sort(
    (a, b) => strength(b, midi.beatsPerBar) - strength(a, midi.beatsPerBar) || a.beat - b.beat,
  );
  for (const note of ranked) {
    const near = kept.some((k) => Math.abs(k.beat - note.beat) * msPerBeat < minGapMs - 0.5);
    if (!near) kept.push(note);
  }
  kept.sort((a, b) => a.beat - b.beat);
  // 3. Les touches: dans chaque groupe de mesures, les hauteurs du grave à l'aigu.
  const group = (note: Placed): number =>
    Math.floor((note.beat - first) / (laneBars * midi.beatsPerBar));
  const pitches = new Map<number, number[]>();
  for (const note of kept) {
    const list = pitches.get(group(note)) ?? [];
    if (!list.includes(note.pitch)) list.push(note.pitch);
    pitches.set(group(note), list);
  }
  for (const list of pitches.values()) list.sort((a, b) => a - b);
  return kept.map((note, index): ScoreNote => {
    const list = pitches.get(group(note)) ?? [note.pitch];
    const rank = list.indexOf(note.pitch);
    const lane =
      list.length >= LANES
        ? Math.floor((rank * LANES) / list.length)
        : Math.floor((LANES - list.length) / 2) + rank;
    const at = Math.round((note.beat - first) * msPerBeat);
    const next = kept[index + 1];
    const until = next === undefined ? Infinity : (next.beat - first) * msPerBeat - BREATH_MS;
    const length = Math.min(note.beats * msPerBeat, until - at);
    return [at, lane, note.pitch, Math.max(MIN_NOTE_MS, Math.round(length / 10) * 10)];
  });
}

/** La partition d'un air: fonction pure du haut du fichier et du MIDI. */
export function deriveScore(air: AirSource, midi: MidiFile): Score {
  const msPerBeat = 60_000 / midi.tempo;
  const score: Score = {
    tempo: Math.round(midi.tempo * 100) / 100,
    beatsPerBar: midi.beatsPerBar,
    startMs: Math.round(air.source.fromBar * midi.beatsPerBar * msPerBeat),
    lengthMs: Math.round(air.source.bars * midi.beatsPerBar * msPerBeat),
    solo: voiceNotes(midi, air, air.voices.solo),
  };
  if (air.voices.duo !== undefined)
    score.duo = [
      voiceNotes(midi, air, air.voices.duo[0]),
      voiceNotes(midi, air, air.voices.duo[1]),
    ];
  return score;
}

/** Texte du fichier: le haut comme Prettier l'écrit, une ligne par note pour relire la partition. */
export function formatAir(air: Record<string, unknown>, score: Score): string {
  const head = Object.fromEntries(Object.entries(air).filter(([key]) => key !== 'score'));
  const notes = (list: readonly ScoreNote[], indent: string): string =>
    `[\n${list.map((n) => `${indent}  [${n.join(', ')}]`).join(',\n')}\n${indent}]`;
  const lines = [
    `    "tempo": ${String(score.tempo)}`,
    `    "beatsPerBar": ${String(score.beatsPerBar)}`,
    `    "startMs": ${String(score.startMs)}`,
    `    "lengthMs": ${String(score.lengthMs)}`,
    `    "solo": ${notes(score.solo, '    ')}`,
  ];
  if (score.duo !== undefined)
    lines.push(
      `    "duo": [\n      ${notes(score.duo[0], '      ')},\n      ${notes(score.duo[1], '      ')}\n    ]`,
    );
  const body = JSON.stringify(head, null, 2).replace(/\n\}$/, '');
  return `${body},\n  "score": {\n${lines.join(',\n')}\n  }\n}\n`;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const AIR_DIR = join(ROOT, 'donnees', 'commun', 'airs');
export const MIDI_DIR = join(ROOT, 'assets-src', 'son', 'musique', 'midi');

function readAir(id: string): Record<string, unknown> & AirSource {
  const path = join(AIR_DIR, `${id}.json`);
  if (!existsSync(path)) throw new Error(`air inconnu: ${path}`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown> & AirSource;
}

function readMidi(file: string): MidiFile {
  const path = join(MIDI_DIR, file);
  if (!existsSync(path)) throw new Error(`fichier MIDI absent: ${path}`);
  return parseMidi(new Uint8Array(readFileSync(path)));
}

function listTracks(id: string): string {
  const air = readAir(id);
  const midi = readMidi(air.source.midi);
  const rows = midi.tracks.map((track) => {
    const bars = track.notes.map((n) => Math.floor(n.beat / midi.beatsPerBar));
    const low = Math.min(...track.notes.map((n) => n.pitch));
    const high = Math.max(...track.notes.map((n) => n.pitch));
    return `  ${track.name.padEnd(14)} ${String(track.notes.length).padStart(4)} notes, mesures ${String(Math.min(...bars))} à ${String(Math.max(...bars))}, hauteurs ${String(low)} à ${String(high)}${track.percussion ? ' (percussions)' : ''}`;
  });
  return `${air.source.midi}: ${String(midi.tempo)} à la noire, ${String(midi.beatsPerBar)} noires par mesure\n${rows.join('\n')}`;
}

function main(args: readonly string[]): void {
  if (args[0] === '--pistes') {
    for (const id of args.slice(1)) process.stdout.write(`${listTracks(id)}\n`);
    return;
  }
  const ids =
    args.length > 0
      ? args
      : readdirSync(AIR_DIR)
          .filter((name) => name.endsWith('.json'))
          .map((name) => name.slice(0, -'.json'.length));
  for (const id of ids) {
    const air = readAir(id);
    const score = deriveScore(air, readMidi(air.source.midi));
    writeFileSync(join(AIR_DIR, `${id}.json`), formatAir(air, score));
    const duo =
      score.duo === undefined
        ? ''
        : `, duo ${String(score.duo[0].length)} et ${String(score.duo[1].length)}`;
    process.stdout.write(
      `${id}: ${String(score.lengthMs / 1000)} s, ${String(score.solo.length)} notes seul${duo}\n`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
