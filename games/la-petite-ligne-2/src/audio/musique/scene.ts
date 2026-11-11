/**
 * Le son d'un air joué à l'instrument (Web Audio): l'accompagnement (la tige `fond` de
 * l'enregistrement, la tige `air` très bas pour guider), le décompte, et les notes des joueurs
 * synthétisées par le timbre de leur instrument (`timbres.ts`).
 *
 * Horloge: le premier temps de l'air est donné sur l'heure de session commune aux deux machines.
 * On le convertit en instant du contexte audio tel que le joueur l'ENTEND (sortie de la carte son
 * comprise, `getOutputTimestamp`): l'accompagnement y est programmé, les frappes du clavier sont
 * datées sur cette même horloge (`airAt`), et les notes de l'autre voix y tombent à leur instant
 * écrit. Rien n'est joué « à l'arrivée d'un message ».
 */
import type { StageSound } from '../../simulation/musique/poste';
import { MUSIC } from '../../simulation/musique/reglages';
import { dbToGain } from '../espace';
import type { MusicTable } from './schemas';
import type { Timbre, TimbreTable } from './timbres';

export interface StageAudioOptions {
  readonly context: BaseAudioContext;
  /** Sortie: l'entrée de la régie au niveau du joueur (`MusicDirector.input`), ou un bus. */
  readonly output: AudioNode;
  readonly table: MusicTable;
  readonly timbres: TimbreTable;
  /** Adresse servie d'un fichier sous `assets/commun/son/`, `null` s'il manque. */
  readonly assetUrl: (file: string) => string | null;
  /** Heure de session commune (`net.sessionTimeMs`). */
  readonly sessionNow: () => number;
  /** Horloge locale des événements du clavier (`performance.now`); les tests donnent la leur. */
  readonly perfNow?: () => number;
  /** La musique du lieu se tait pendant l'air, dès qu'on l'entend assez (`MusicDirector.hush`). */
  readonly hush?: (on: boolean) => void;
  readonly warn?: (message: string, data?: unknown) => void;
  /** Charge un fichier (tests et rendu hors ligne); par défaut `fetch` puis décodage. */
  readonly load?: (url: string) => Promise<AudioBuffer>;
}

export interface StageAudio extends StageSound {
  /** Instant de l'air d'une frappe du clavier (`KeyboardEvent.timeStamp`), `null` hors d'un air. */
  airAt(timeStampMs: number): number | null;
  /** Décode d'avance l'accompagnement d'un air (ouverture du cahier, rendu hors ligne). */
  prepare(air: string): Promise<void>;
  dispose(): void;
}

interface Voice {
  readonly oscillator: OscillatorNode;
  readonly stopAt: number;
}

const ROLES = ['fond', 'air'] as const;
const FADE_IN = 0.02;

export function createStageAudio(options: StageAudioOptions): StageAudio {
  const { context: ctx, table, timbres } = options;
  const warn = options.warn ?? ((): void => undefined);
  const perfNow = options.perfNow ?? ((): number => performance.now());
  const master = ctx.createGain();
  master.connect(options.output);
  let disposed = false;
  /** Niveau de l'air (1 pour qui joue, selon la distance pour qui écoute) et musique du lieu tue. */
  let level = 1;
  let hushed = false;

  function hush(on: boolean): void {
    if (hushed === on) return;
    hushed = on;
    options.hush?.(on);
  }

  // --- Horloge ---------------------------------------------------------------------------------
  /** Instant du contexte que le joueur entend à l'instant `perfMs` de l'horloge locale. */
  function heardAt(perfMs: number): number {
    const live = ctx as Partial<AudioContext>;
    const stamp = live.getOutputTimestamp?.();
    if (stamp?.contextTime !== undefined && (stamp.performanceTime ?? 0) > 0)
      return stamp.contextTime + (perfMs - (stamp.performanceTime ?? 0)) / 1000;
    const latency = live.outputLatency ?? live.baseLatency ?? 0;
    return ctx.currentTime - latency + (perfMs - perfNow()) / 1000;
  }

  // --- Fichiers --------------------------------------------------------------------------------
  const load =
    options.load ??
    (async (url: string): Promise<AudioBuffer> => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
      const decoder = new OfflineAudioContext(1, 1, table.timing.decodeRate);
      return decoder.decodeAudioData(await response.arrayBuffer());
    });
  const stems = new Map<string, Promise<ReadonlyMap<string, AudioBuffer>>>();

  function stemsOf(air: string): Promise<ReadonlyMap<string, AudioBuffer>> {
    const known = stems.get(air);
    if (known !== undefined) return known;
    const track = table.tracks[air];
    const pending = Promise.all(
      ROLES.map(async (role): Promise<readonly [string, AudioBuffer | null]> => {
        const file = track?.stems[role]?.file;
        const url = file === undefined ? null : options.assetUrl(file);
        if (url === null) return [role, null];
        try {
          return [role, await load(url)];
        } catch (error) {
          warn('musique jouée: accompagnement illisible', { file, error: String(error) });
          return [role, null];
        }
      }),
    ).then((entries) => {
      const found = new Map<string, AudioBuffer>();
      for (const [role, buffer] of entries) if (buffer !== null) found.set(role, buffer);
      if (found.size === 0) warn('musique jouée: air sans accompagnement', { air });
      return found;
    });
    stems.set(air, pending);
    return pending;
  }

  // --- Air en cours ----------------------------------------------------------------------------
  let playing: {
    /** Instant du contexte où le premier temps s'entend. */
    readonly startCtx: number;
    readonly bus: GainNode;
    readonly sources: AudioBufferSourceNode[];
  } | null = null;
  const voices = new Map<number, Voice>();
  const waves = new Map<string, PeriodicWave>();
  let nextId = 1;

  function timbreOf(id: string): Timbre {
    const found = timbres.timbres[id] ?? timbres.timbres[timbres.fallback];
    if (found === undefined) throw new Error(`timbre inconnu « ${id} »`);
    return found;
  }

  function waveOf(id: string, timbre: Timbre): PeriodicWave {
    let wave = waves.get(id);
    if (wave === undefined) {
      const real = new Float32Array(timbre.harmonics.length + 1);
      const imag = new Float32Array(timbre.harmonics.length + 1);
      timbre.harmonics.forEach((level, index) => {
        imag[index + 1] = level;
      });
      wave = ctx.createPeriodicWave(real, imag);
      waves.set(id, wave);
    }
    return wave;
  }

  function click(at: number, accent: boolean, out: AudioNode): void {
    const { hz, accentHz, ms, volumeDb } = timbres.countIn;
    const oscillator = ctx.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = accent ? accentHz : hz;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(dbToGain(volumeDb), at + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
    oscillator.connect(gain);
    gain.connect(out);
    oscillator.start(at);
    oscillator.stop(at + ms / 1000 + 0.01);
    oscillator.onended = (): void => {
      gain.disconnect();
    };
  }

  function stopPlaying(fadeSeconds: number): void {
    const current = playing;
    if (current === null) return;
    playing = null;
    const t = ctx.currentTime;
    current.bus.gain.cancelScheduledValues(t);
    current.bus.gain.setTargetAtTime(0, t, fadeSeconds / 3);
    for (const source of current.sources) {
      try {
        source.stop(t + fadeSeconds * 1.5);
      } catch {
        // Jamais partie, ou déjà arrêtée.
      }
    }
    setTimeoutSafe(() => {
      current.bus.disconnect();
    }, fadeSeconds * 2000);
    hush(false);
  }

  /** Débranche plus tard; sans minuteur (rendu hors ligne), le nœud reste branché, muet. */
  function setTimeoutSafe(run: () => void, ms: number): void {
    if (typeof setTimeout === 'function' && 'resume' in ctx) setTimeout(run, ms);
  }

  return {
    prepare(air) {
      return stemsOf(air).then(() => undefined);
    },
    start(spec) {
      if (disposed) return;
      stopPlaying(0.05);
      const perfStart = perfNow() + (spec.startAtMs - options.sessionNow());
      const startCtx = heardAt(perfStart);
      const bus = ctx.createGain();
      bus.connect(master);
      const mine = { startCtx, bus, sources: [] as AudioBufferSourceNode[] };
      playing = mine;
      // Décompte: un coup par temps, le premier plus aigu, jusqu'au premier temps de l'air.
      const beat = 60 / spec.score.tempo;
      const beats = Math.round(spec.leadMs / 1000 / beat);
      for (let k = Math.min(beats, MUSIC.countIn.beats); k >= 1; k--) {
        const at = startCtx - k * beat;
        if (at > ctx.currentTime) click(at, k === MUSIC.countIn.beats, bus);
      }
      const seconds = spec.score.lengthMs / 1000;
      const tail = MUSIC.tailMs / 1000;
      void stemsOf(spec.air).then((buffers) => {
        if (disposed || playing !== mine) return;
        const track = table.tracks[spec.air];
        for (const role of ROLES) {
          const buffer = buffers.get(role);
          const stem = track?.stems[role];
          if (buffer === undefined || stem === undefined) continue;
          const db = stem.volumeDb + (role === 'air' ? MUSIC.sound.guideDb : 0);
          if (db <= -60) continue;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          const gain = ctx.createGain();
          const panner = ctx.createStereoPanner();
          panner.pan.value = stem.pan;
          source.connect(gain);
          gain.connect(panner);
          panner.connect(bus);
          // Parti en retard (décodage lent): on entre dans l'air là où il en est.
          const late = Math.max(0, ctx.currentTime + 0.02 - startCtx);
          const at = startCtx + late;
          const level = dbToGain(db);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(level, at + FADE_IN);
          gain.gain.setValueAtTime(level, startCtx + seconds);
          gain.gain.linearRampToValueAtTime(0, startCtx + seconds + tail);
          source.start(at, table.timing.preroll + spec.score.startMs / 1000 + late);
          source.stop(startCtx + seconds + tail + 0.05);
          mine.sources.push(source);
        }
      });
    },
    airNow() {
      return playing === null ? null : (heardAt(perfNow()) - playing.startCtx) * 1000;
    },
    airAt(timeStampMs) {
      return playing === null ? null : (heardAt(timeStampMs) - playing.startCtx) * 1000;
    },
    note(spec) {
      const id = nextId;
      nextId += 1;
      if (disposed || playing === null) return id;
      const timbre = timbreOf(spec.timbre);
      const partner = spec.who === 'partner';
      const at = Math.max(
        ctx.currentTime,
        spec.atMs === null ? ctx.currentTime : playing.startCtx + spec.atMs / 1000,
      );
      const hold = Math.max(0.08, spec.ms / 1000);
      const attack = timbre.attackMs / 1000;
      const release = timbre.releaseMs / 1000;
      const peak = dbToGain(timbre.volumeDb + (partner ? MUSIC.sound.partnerDb : 0));
      const oscillator = ctx.createOscillator();
      oscillator.setPeriodicWave(waveOf(spec.timbre, timbre));
      oscillator.frequency.value = 440 * 2 ** ((spec.midi - 69) / 12);
      const envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(peak, at + attack);
      envelope.gain.setTargetAtTime(peak * timbre.sustain, at + attack, timbre.decayMs / 3000);
      envelope.gain.setTargetAtTime(0, at + hold, release / 3);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = timbre.lowpassHz;
      tone.Q.value = 0.6;
      const panner = ctx.createStereoPanner();
      panner.pan.value = partner ? MUSIC.sound.partnerPan : -MUSIC.sound.partnerPan / 3;
      oscillator.connect(envelope);
      envelope.connect(tone);
      tone.connect(panner);
      panner.connect(master);
      const stopAt = at + hold + release * 2;
      if (timbre.vibrato !== undefined && hold > timbre.vibrato.delayMs / 1000) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = timbre.vibrato.hz;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, at);
        depth.gain.setTargetAtTime(timbre.vibrato.cents, at + timbre.vibrato.delayMs / 1000, 0.12);
        lfo.connect(depth);
        depth.connect(oscillator.detune);
        lfo.start(at);
        lfo.stop(stopAt);
      }
      if (spec.sour) {
        // Un couac: la note part un peu basse et s'affaisse encore.
        oscillator.detune.setValueAtTime(MUSIC.sound.falseCents * 0.6, at);
        oscillator.detune.setTargetAtTime(
          MUSIC.sound.falseCents * 1.4,
          at + 0.03,
          MUSIC.sound.falseGlideMs / 3000,
        );
      }
      oscillator.start(at);
      oscillator.stop(stopAt);
      voices.set(id, { oscillator, stopAt });
      oscillator.onended = (): void => {
        voices.delete(id);
        panner.disconnect();
      };
      return id;
    },
    level(gain) {
      if (disposed) return;
      const next = Math.max(0, Math.min(1, gain));
      // Relevé à chaque image pour qui écoute: on ne touche au gain que s'il a bougé.
      if (Math.abs(next - level) >= 0.01 || (next === 0) !== (level === 0)) {
        level = next;
        master.gain.setTargetAtTime(level, ctx.currentTime, 0.05);
      }
      hush(playing !== null && level > MUSIC.listen.hushAbove);
    },
    sour(id) {
      const voice = voices.get(id);
      if (voice === undefined || ctx.currentTime >= voice.stopAt) return;
      voice.oscillator.detune.setTargetAtTime(
        MUSIC.sound.falseCents,
        ctx.currentTime,
        MUSIC.sound.falseGlideMs / 3000,
      );
    },
    stop() {
      stopPlaying(MUSIC.tailMs / 1000 / 2);
    },
    dispose() {
      stopPlaying(0.02);
      disposed = true;
      for (const voice of voices.values()) {
        try {
          voice.oscillator.stop();
        } catch {
          // Déjà arrêtée.
        }
      }
      voices.clear();
      master.disconnect();
    },
  };
}
