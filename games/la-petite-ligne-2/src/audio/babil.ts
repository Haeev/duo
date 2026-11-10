/**
 * Babil: une voix par personnage, faite de syllabes courtes sur un timbre d'instrument. Chaque
 * lettre annoncée par l'interface (`onBabble`) devient une note: les voyelles chantent plus long,
 * les consonnes plus bref, la ponctuation donne le ton de la fin de phrase. Logique pure; la
 * hauteur, le timbre et le débit viennent de `donnees/voix.json`.
 */
import type { VoiceDef, VoiceTable } from './schemas';

export interface Rng {
  float(min: number, max: number): number;
}

export interface Syllable {
  readonly timbreFile: string;
  /** Vitesse de lecture qui amène la note du fichier à la hauteur voulue. */
  readonly rate: number;
  readonly durationMs: number;
  readonly gainDb: number;
  readonly midi: number;
}

export class Babbler {
  private readonly lastAt = new Map<string, number>();

  constructor(
    private readonly table: VoiceTable,
    private readonly random: Rng,
  ) {}

  voiceOf(id: string): VoiceDef {
    return (
      this.table.voices[id] ?? this.table.voices[this.table.fallback] ?? firstVoice(this.table)
    );
  }

  /**
   * La syllabe d'une lettre, ou `null` (espace, débit trop rapide). `speaker`: le personnage qui
   * parle, pour que deux voix ne se coupent pas la parole; `voiceId`: sa voix.
   */
  syllable(speaker: string, voiceId: string, char: string, nowMs: number): Syllable | null {
    if (char.trim() === '') return null;
    const voice = this.voiceOf(voiceId);
    const last = this.lastAt.get(speaker);
    if (last !== undefined && nowMs - last < voice.minGapMs) return null;
    this.lastAt.set(speaker, nowMs);
    const timbre = this.table.timbres[voice.timbre];
    if (timbre === undefined) return null;

    const lower = char.toLowerCase();
    const punct = this.table.punctuation[lower];
    const vowel = this.table.vowels.includes(lower);
    // Le même caractère donne toujours le même degré: la voix est reconnaissable d'une phrase à l'autre.
    const code = lower.codePointAt(0) ?? 0;
    const degree =
      punct !== undefined
        ? 0
        : vowel
          ? (this.table.vowels.indexOf(lower) * 3) % voice.span
          : (code * 5 + 2) % voice.span;
    const scale = voice.scale;
    const steps = scale[degree % scale.length] ?? 0;
    let midi = voice.tonicMidi + steps + 12 * Math.floor(degree / scale.length);
    midi += voice.wobble > 0 ? this.random.float(-voice.wobble, voice.wobble) : 0;
    let length = vowel ? voice.vowelLength : voice.consonantLength;
    let gainDb = voice.volumeDb;
    if (punct !== undefined) {
      midi = voice.tonicMidi + (scale[Math.floor(scale.length / 2)] ?? 0) + punct.semitones;
      length = punct.length;
      gainDb += punct.gainDb;
    }
    return {
      timbreFile: timbre.file,
      rate: Math.pow(2, (midi - timbre.rootMidi) / 12),
      durationMs: Math.round(voice.noteMs * length),
      gainDb,
      midi,
    };
  }

  reset(): void {
    this.lastAt.clear();
  }
}

function firstVoice(table: VoiceTable): VoiceDef {
  const first = Object.values(table.voices)[0];
  if (first === undefined) throw new Error('voix.json: aucune voix');
  return first;
}
