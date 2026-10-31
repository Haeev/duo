/**
 * Moteur Web Audio du jeu: applique les décisions du cerveau (`cerveau.ts`).
 *
 * Graphe, branché sur les bus du SDK (volumes de la plateforme appliqués par
 * lui):
 * - musique: pistes -> atténuation (duck) -> pause -> bus `music`;
 * - effets: voix -> limiteur -> pause -> bus `effects`; l'ambiance est un
 *   sous-bus des effets (le SDK n'a que trois bus), avec le passe-bas de
 *   l'intérieur pour les ambiances du dehors;
 * - interface: voix -> limiteur -> pause -> bus `interface`.
 * Les boucles se jouent par `AudioBufferSourceNode` (`loopStart`, `loopEnd`),
 * jamais par `<audio loop>`, qui insère un clic dans Chromium (son.md 6).
 */
import type { AudioBus } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { Vec2 } from '../etat/types';
import type { BrainFrame, SyncState } from './cerveau';
import type { Catalogue, MusicDef, SoundDef } from './catalogue';
import type { LoopWish, SoundRequest } from './declencheurs';
import { distanceBetween, distanceGain, withinCull } from './espace';
import { BufferCache, decodedBytes } from './memoire';
import { type MusicCommand, positionOf } from './musique';
import { type AudioSettings, dbToGain } from './reglages';
import { riverSources, type RiverSource } from './ambiances';
import { VariantPicker, drawVariation, type Variation } from './variantes';
import { VoicePool } from './voix';
import type { GameMap } from '../etat/carte';

/** Ce que le moteur demande à la plateforme audio (le module `audio` du SDK le fournit). */
export interface AudioHost {
  readonly context: BaseAudioContext;
  bus(name: AudioBus): AudioNode;
}

export interface EngineOptions {
  host: AudioHost;
  catalogue: Catalogue;
  settings: AudioSettings;
  map: GameMap;
  random: RandomSource;
  /** Décode un fichier de `assets/son/` (chemin relatif à ce dossier). */
  decode(file: string): Promise<AudioBuffer>;
  warn(message: string, data: Record<string, unknown>): void;
  /** Le contexte joue vraiment (sinon les sons ponctuels sont ignorés: ils partiraient tous au réveil du contexte). */
  live?: () => boolean;
}

export interface EngineStats {
  decodedMB: number;
  peakMB: number;
  files: number;
  voices: number;
  musicTracks: number;
  ambienceBeds: number;
  refused: number;
  /** Décodages en cours. */
  pending: number;
}

interface Voice {
  poolId: number;
  def: SoundDef;
  file: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
  at: Vec2 | null;
  /** Gain hors distance (niveau, variation, autre joueur). */
  level: number;
  startedAt: number;
  offset: number;
  rate: number;
  tag: string | null;
  loopKey: string | null;
  done: boolean;
  /** En fondu de sortie: on ne touche plus à son gain. */
  stopping: boolean;
  /** Dernier gain de distance appliqué (on ne le réécrit que s'il change). */
  distanceGain: number;
}

interface Track {
  id: string;
  def: MusicDef;
  source: AudioBufferSourceNode;
  gain: GainNode;
  stopping: boolean;
  once: boolean;
}

interface TrackRequest {
  id: string;
  offset: number;
  fadeIn: number;
  /** Temps de la commande: le départ réel est avancé d'autant. */
  at: number;
  once: boolean;
}

interface PendingTrack extends TrackRequest {
  retryAt: number | null;
  token: number;
}

interface BedSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
  panner: PannerNode | null;
  river: RiverSource | null;
}

interface Bed {
  id: string;
  file: string;
  def: SoundDef;
  out: GainNode;
  sources: BedSource[];
  target: number;
  silentSince: number | null;
}

interface SyncTrack {
  waiting: boolean;
  lastExpected: number;
}

const FAST_FADE = 0.03;
const MUSIC_RETRY_MARGIN = 0.1;
const TARGET_EPSILON = 0.002;
/** Une ambiance tue depuis ce temps (en rampes) est arrêtée et son tampon libéré. */
const BED_STOP_RAMPS = 3;
const OPEN_FILTER_HZ = 20000;
const PANNER_FAR = 10000;
/** Écart relatif de gain de distance sous lequel on ne réécrit pas le gain d'une voix. */
const DISTANCE_GAIN_STEP = 0.02;
const DISTANCE_TIME_CONSTANT = 0.05;

export class AudioEngine {
  private readonly ctx: BaseAudioContext;
  private readonly cache: BufferCache<AudioBuffer>;
  private readonly pool: VoicePool;
  private readonly picker: VariantPicker;
  private readonly variation: Variation = { rate: 1, gainDb: 0 };
  private readonly voices = new Map<number, Voice>();
  private readonly byLoop = new Map<string, Voice>();
  private readonly byTag = new Map<string, Voice>();
  private readonly syncTracks = new Map<string, SyncTrack>();
  private readonly tracks: Track[] = [];
  private pending: PendingTrack | null = null;
  private pendingToken = 0;
  private readonly beds = new Map<string, Bed>();
  private readonly ducks: { db: number; until: number }[] = [];
  private duckDb = 0;
  private readonly river: RiverSource[];
  private readonly indoorAmbience: Set<string>;
  private readonly trainFiles: string[];
  private trainWanted = false;
  private listener: { at: Vec2; inHouse: boolean } = { at: { x: 0, y: 0 }, inHouse: false };
  private inHouse: boolean | null = null;
  private paused = false;
  private disposed = false;
  private readonly wishedLoops = new Set<string>();

  // Graphe.
  private readonly musicIn: GainNode;
  private readonly duck: GainNode;
  private readonly musicPause: GainNode;
  private readonly effectsIn: GainNode;
  private readonly effectsLimiter: DynamicsCompressorNode;
  private readonly effectsPause: GainNode;
  private readonly outdoorIn: GainNode;
  private readonly lowpass: BiquadFilterNode;
  private readonly interior: GainNode;
  private readonly indoorIn: GainNode;
  private readonly uiIn: GainNode;
  private readonly uiLimiter: DynamicsCompressorNode;
  private readonly uiPause: GainNode;
  private readonly graph: AudioNode[];

  constructor(private readonly options: EngineOptions) {
    const { host, catalogue, settings } = options;
    const ctx = host.context;
    this.ctx = ctx;
    const memory = settings.memory;
    this.cache = new BufferCache<AudioBuffer>({
      capBytes: memory.capBytes,
      bytesPerSample: memory.bytesPerSample,
      estimate: (file) => this.estimate(file),
      load: (file) => options.decode(file),
      now: () => ctx.currentTime,
      warn: (message, data) => {
        options.warn(message, data);
      },
    });
    this.pool = new VoicePool(catalogue.mix.maxEffectVoices);
    this.picker = new VariantPicker(options.random);
    this.river = riverSources(options.map, settings.ambience.river);
    this.indoorAmbience = new Set(catalogue.ambienceRules.filter((r) => r.rain === 'indoor').map((r) => r.ambience));
    this.trainFiles = [...catalogue.sounds.values()].flatMap((s) => s.files).filter((f) => f.startsWith('train/'));

    const gain = (value = 1): GainNode => {
      const node = ctx.createGain();
      node.gain.value = value;
      return node;
    };
    const limiter = (): DynamicsCompressorNode => {
      const l = catalogue.mix.limiter;
      const node = ctx.createDynamicsCompressor();
      node.threshold.value = l.thresholdDb;
      node.knee.value = l.kneeDb;
      node.ratio.value = l.ratio;
      node.attack.value = l.attackSeconds;
      node.release.value = l.releaseSeconds;
      return node;
    };
    this.musicIn = gain();
    this.duck = gain();
    this.musicPause = gain();
    this.musicIn.connect(this.duck).connect(this.musicPause).connect(host.bus('music'));
    this.effectsIn = gain();
    this.effectsLimiter = limiter();
    this.effectsPause = gain();
    this.effectsIn.connect(this.effectsLimiter).connect(this.effectsPause).connect(host.bus('effects'));
    this.outdoorIn = gain();
    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = OPEN_FILTER_HZ;
    this.interior = gain();
    this.indoorIn = gain();
    this.outdoorIn.connect(this.lowpass).connect(this.interior).connect(this.effectsIn);
    this.indoorIn.connect(this.effectsIn);
    this.uiIn = gain();
    this.uiLimiter = limiter();
    this.uiPause = gain();
    this.uiIn.connect(this.uiLimiter).connect(this.uiPause).connect(host.bus('interface'));
    this.graph = [
      this.musicIn,
      this.duck,
      this.musicPause,
      this.effectsIn,
      this.effectsLimiter,
      this.effectsPause,
      this.outdoorIn,
      this.lowpass,
      this.interior,
      this.indoorIn,
      this.uiIn,
      this.uiLimiter,
      this.uiPause,
    ];
  }

  /** Décode les sons permanents (effets, interface, motifs). */
  async loadResident(onProgress: (ratio: number) => void): Promise<void> {
    const folders = this.options.settings.memory.residentFolders;
    const files = [...new Set([...this.options.catalogue.sounds.values()].flatMap((s) => s.files))].filter((f) =>
      folders.some((folder) => f.startsWith(folder)),
    );
    let done = 0;
    onProgress(0);
    await Promise.all(
      files.map(async (file) => {
        await this.cache.request(file, true);
        done += 1;
        onProgress(done / files.length);
      }),
    );
  }

  /** Pause de la plateforme: musique atténuée, effets et interface suspendus. */
  setPaused(paused: boolean): void {
    if (paused === this.paused || this.disposed) return;
    this.paused = paused;
    const t = this.ctx.currentTime;
    const tc = this.options.settings.pause.rampSeconds / 3;
    const music = paused ? dbToGain(this.options.settings.pause.musicDb) : 1;
    const other = paused ? 0 : 1;
    this.musicPause.gain.setTargetAtTime(music, t, tc);
    this.effectsPause.gain.setTargetAtTime(other, t, tc);
    this.uiPause.gain.setTargetAtTime(other, t, tc);
  }

  /** Applique une image du cerveau. */
  apply(frame: BrainFrame): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    this.listener = frame.listener;
    this.placeListener(frame);
    this.updateInterior(frame.listener.inHouse);
    this.updateTrainBuffers(frame.trainDay);
    for (const command of frame.music) this.music(command);
    this.retryPending(now);
    const live = this.options.live?.() ?? this.ctx.state === 'running';
    if (live) for (const shot of frame.shots) this.play(shot, false);
    this.reconcileLoops(frame.loops);
    this.syncVoices(frame.syncs, now);
    this.updateBeds(frame, now);
    this.updatePlaced();
    this.updateDuck(now);
  }

  stats(): EngineStats {
    const c = this.cache.stats();
    const mb = (b: number): number => Math.round((b / (1024 * 1024)) * 10) / 10;
    return {
      decodedMB: mb(c.usedBytes),
      peakMB: mb(c.peakBytes),
      files: c.files,
      voices: this.pool.active(this.ctx.currentTime).length,
      musicTracks: this.tracks.length,
      ambienceBeds: this.beds.size,
      refused: c.refused,
      pending: c.pending,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of this.voices.values()) this.kill(voice.source);
    for (const track of this.tracks) this.kill(track.source);
    for (const bed of this.beds.values()) for (const s of bed.sources) this.kill(s.source);
    for (const node of this.graph) node.disconnect();
    this.voices.clear();
    this.byLoop.clear();
    this.byTag.clear();
    this.tracks.length = 0;
    this.beds.clear();
    this.pool.clear();
    this.cache.dispose();
  }

  // -------------------------------------------------------------------------
  // Sons ponctuels et boucles d'effets

  /** Lance un son; renvoie la voix, ou `null` (absent, trop loin, pas décodé, refusé par la file). */
  private play(request: SoundRequest, loop: boolean, loopKey: string | null = null): Voice | null {
    const def = this.options.catalogue.sounds.get(request.sound);
    if (def === undefined) return null;
    const spatial = def.spatial !== null && request.at !== null ? def.spatial : null;
    let distance = 0;
    if (spatial !== null && request.at !== null) {
      distance = distanceBetween(this.listener.at, request.at);
      if (!loop && !withinCull(spatial, distance)) return null;
    }
    const index = this.picker.pick(def.id, def.files.length, def.shuffle);
    const file = def.files[index] ?? def.files[0];
    if (file === undefined) return null;
    const buffer = this.cache.get(file);
    if (buffer === null) {
      void this.cache.request(file);
      return null;
    }
    const now = this.ctx.currentTime;
    const admission = this.pool.admit({
      sound: def.id,
      priority: def.priority,
      now,
      maxVoices: def.maxVoices,
      minIntervalSeconds: loop ? 0 : def.minIntervalSeconds,
    });
    if (admission.kind === 'reject') return null;
    for (const id of admission.evict) {
      const victim = this.voices.get(id);
      if (victim !== undefined) this.stopVoice(victim, FAST_FADE);
    }
    const v = drawVariation(this.options.random, def.pitchVariation, def.gainVariationDb, this.variation);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = v.rate;
    if (loop && def.loop !== null) {
      source.loop = true;
      source.loopStart = def.loop.start;
      source.loopEnd = def.loop.end;
    }
    const level = dbToGain(def.volumeDb + v.gainDb + request.gainDb);
    const gain = this.ctx.createGain();
    const dGain = spatial === null ? 1 : distanceGain(spatial, distance);
    gain.gain.value = level * dGain;
    let panner: PannerNode | null = null;
    source.connect(gain);
    if (spatial !== null && request.at !== null) {
      panner = this.createPanner(request.at);
      gain.connect(panner).connect(this.busOf(def));
    } else {
      gain.connect(this.busOf(def));
    }
    const offset = loop ? (request.offset > 0 ? request.offset : def.playFrom) : request.offset;
    const startAt = now + Math.max(0, request.delay);
    const fileSeconds = def.durations[index] ?? buffer.duration;
    const playSeconds = Math.max(0, fileSeconds - offset) / v.rate;
    const endsAt = loop ? Number.POSITIVE_INFINITY : startAt + playSeconds;
    const poolId = this.pool.add(def.id, def.priority, now, endsAt);
    const voice: Voice = {
      poolId,
      def,
      file,
      source,
      gain,
      panner,
      at: request.at === null ? null : { x: request.at.x, y: request.at.y },
      level,
      startedAt: startAt,
      offset,
      rate: v.rate,
      tag: request.tag,
      loopKey,
      done: false,
      stopping: false,
      distanceGain: dGain,
    };
    this.voices.set(poolId, voice);
    this.cache.pin(file);
    source.onended = () => {
      this.finish(voice);
    };
    source.start(startAt, Math.min(offset, buffer.duration));
    if (def.duckDb < 0) this.ducks.push({ db: def.duckDb, until: loop ? now + 1 : endsAt });
    if (request.tag !== null) this.byTag.set(request.tag, voice);
    if (loopKey !== null) this.byLoop.set(loopKey, voice);
    return voice;
  }

  private finish(voice: Voice): void {
    if (voice.done) return;
    voice.done = true;
    voice.source.disconnect();
    voice.gain.disconnect();
    voice.panner?.disconnect();
    this.voices.delete(voice.poolId);
    this.pool.remove(voice.poolId);
    this.cache.unpin(voice.file);
    if (voice.tag !== null && this.byTag.get(voice.tag) === voice) this.byTag.delete(voice.tag);
    if (voice.loopKey !== null && this.byLoop.get(voice.loopKey) === voice) this.byLoop.delete(voice.loopKey);
  }

  private stopVoice(voice: Voice, fade: number): void {
    if (voice.done || voice.stopping) return;
    voice.stopping = true;
    const t = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + fade);
    this.pool.setEnd(voice.poolId, t + fade);
    try {
      voice.source.stop(t + fade + FAST_FADE);
    } catch {
      this.finish(voice);
    }
    if (voice.tag !== null && this.byTag.get(voice.tag) === voice) this.byTag.delete(voice.tag);
    if (voice.loopKey !== null && this.byLoop.get(voice.loopKey) === voice) this.byLoop.delete(voice.loopKey);
  }

  private reconcileLoops(loops: readonly LoopWish[]): void {
    const wished = this.wishedLoops;
    wished.clear();
    for (const wish of loops) {
      wished.add(wish.key);
      const voice = this.byLoop.get(wish.key);
      if (voice === undefined) {
        this.play({ sound: wish.sound, at: wish.at, gainDb: wish.gainDb, delay: 0, offset: 0, tag: null }, true, wish.key);
        continue;
      }
      if (wish.at !== null && voice.at !== null) {
        voice.at.x = wish.at.x;
        voice.at.y = wish.at.y;
      }
    }
    for (const [key, voice] of this.byLoop) {
      if (!wished.has(key)) this.stopVoice(voice, this.options.settings.loopFadeSeconds);
    }
  }

  /** Recale les longs sons d'une séquence sur son horloge (horloge du jeu arrêtée, pause). */
  private syncVoices(syncs: readonly SyncState[], now: number): void {
    const s = this.options.settings.sequences;
    for (const sync of syncs) {
      const voice = this.byTag.get(sync.tag);
      const state = this.syncTracks.get(sync.tag) ?? { waiting: false, lastExpected: sync.expected ?? 0 };
      this.syncTracks.set(sync.tag, state);
      if (sync.expected === null) {
        if (voice !== undefined) this.stopVoice(voice, s.resyncFadeSeconds);
        this.syncTracks.delete(sync.tag);
        continue;
      }
      const at = voice?.at ?? null;
      if (at !== null && sync.at !== null) {
        at.x = sync.at.x;
        at.y = sync.at.y;
      }
      if (voice !== undefined && !state.waiting) {
        const actual = voice.offset + Math.max(0, now - voice.startedAt) * voice.rate;
        if (Math.abs(actual - sync.expected) > s.resyncToleranceSeconds) {
          this.stopVoice(voice, s.resyncFadeSeconds);
          state.waiting = true;
        }
      } else if (sync.expected > state.lastExpected + TARGET_EPSILON) {
        const started = this.play({ sound: sync.sound, at: sync.at, gainDb: 0, delay: 0, offset: sync.expected, tag: sync.tag }, false);
        if (started !== null) {
          state.waiting = false;
          started.gain.gain.setValueAtTime(0, now);
          started.gain.gain.linearRampToValueAtTime(started.level, now + s.resyncFadeSeconds);
        }
      }
      state.lastExpected = sync.expected;
    }
  }

  /** Les sons placés suivent l'oreille (et leur source quand elle bouge: boucles, train). */
  private updatePlaced(): void {
    const t = this.ctx.currentTime;
    for (const voice of this.voices.values()) {
      if (voice.done || voice.stopping || voice.panner === null || voice.at === null || voice.def.spatial === null) continue;
      if (voice.loopKey !== null || voice.tag !== null) this.setPosition(voice.panner, voice.at);
      const g = distanceGain(voice.def.spatial, distanceBetween(this.listener.at, voice.at));
      if (Math.abs(g - voice.distanceGain) < DISTANCE_GAIN_STEP * voice.distanceGain) continue;
      voice.distanceGain = g;
      voice.gain.gain.setTargetAtTime(voice.level * g, t, DISTANCE_TIME_CONSTANT);
    }
  }

  // -------------------------------------------------------------------------
  // Musique

  private music(command: MusicCommand): void {
    const catalogue = this.options.catalogue;
    switch (command.kind) {
      case 'prefetch': {
        const def = catalogue.music.get(command.id);
        if (def !== undefined && this.cache.canFit(def.file)) void this.cache.request(def.file);
        break;
      }
      case 'stop':
        if (this.pending?.id === command.id) this.pending = null;
        for (const track of this.tracks) if (track.id === command.id && !track.stopping && !track.once) this.stopTrack(track, command.fadeOut);
        break;
      case 'start':
        this.requestTrack({ id: command.id, offset: command.offset, fadeIn: command.fadeIn, at: this.ctx.currentTime, once: false });
        break;
      case 'once':
        this.requestTrack({ id: command.id, offset: 0, fadeIn: 0, at: this.ctx.currentTime, once: true });
        break;
    }
  }

  private requestTrack(request: TrackRequest): void {
    const def = this.options.catalogue.music.get(request.id);
    if (def === undefined) return;
    const ready = this.cache.get(def.file);
    if (ready !== null) {
      if (!request.once) this.pending = null;
      this.startTrack(def, ready, request);
      return;
    }
    if (request.once) {
      // Fanfare, air de fin: décodés à l'avance; sinon ils partent dès qu'ils sont prêts, à leur place.
      void this.cache.request(def.file).then((buffer) => {
        if (buffer !== null && !this.disposed) this.startTrack(def, buffer, request);
      });
      return;
    }
    this.pendingToken += 1;
    const pending: PendingTrack = { ...request, retryAt: null, token: this.pendingToken };
    this.pending = pending;
    if (!this.cache.canFit(def.file)) {
      // Place insuffisante pendant un fondu: on attend la fin des pistes qui s'effacent.
      pending.retryAt = this.ctx.currentTime + this.longestFade() + MUSIC_RETRY_MARGIN;
      return;
    }
    void this.cache.request(def.file).then((buffer) => {
      if (this.disposed || this.pending?.token !== pending.token) return;
      if (buffer === null) {
        pending.retryAt = this.ctx.currentTime + this.longestFade() + MUSIC_RETRY_MARGIN;
        return;
      }
      this.pending = null;
      this.startTrack(def, buffer, pending);
    });
  }

  private retryPending(now: number): void {
    const p = this.pending;
    if (p === null) return;
    const retryAt = p.retryAt;
    if (retryAt === null || now < retryAt) return;
    this.pending = null;
    this.requestTrack(p);
  }

  private longestFade(): number {
    let longest = 0;
    for (const track of this.tracks) if (track.stopping) longest = Math.max(longest, track.def.fadeOutSeconds, this.options.catalogue.mix.crossfadeSeconds);
    return longest;
  }

  private startTrack(def: MusicDef, buffer: AudioBuffer, request: TrackRequest): void {
    const now = this.ctx.currentTime;
    const late = Math.max(0, now - request.at);
    // La piste démarre où elle en serait sans le temps de décodage.
    const offset = request.once ? late : positionOf(def, { startedAt: request.at, offset: request.offset }, now);
    if (request.once && offset >= def.duration - 1) return;
    if (!request.once) {
      for (const track of this.tracks) if (track.id === def.id && !track.stopping) this.stopTrack(track, FAST_FADE);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    if (def.loop !== null && !request.once) {
      source.loop = true;
      source.loopStart = def.loop.start;
      source.loopEnd = def.loop.end;
    }
    const gain = this.ctx.createGain();
    const level = dbToGain(def.volumeDb);
    if (request.fadeIn > 0) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + request.fadeIn);
    } else {
      gain.gain.value = level;
    }
    source.connect(gain).connect(this.musicIn);
    const track: Track = { id: def.id, def, source, gain, stopping: false, once: request.once };
    this.tracks.push(track);
    this.cache.pin(def.file);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      const i = this.tracks.indexOf(track);
      if (i >= 0) this.tracks.splice(i, 1);
      this.cache.unpin(def.file);
      // Une seule musique décodée à la fois: libérée après son fondu (son.md 6).
      if (!this.tracks.some((t) => t.def.file === def.file)) this.cache.release(def.file);
    };
    source.start(now, Math.min(offset, buffer.duration));
  }

  private stopTrack(track: Track, fade: number): void {
    track.stopping = true;
    const t = this.ctx.currentTime;
    const f = Math.max(FAST_FADE, fade);
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(0, t + f);
    try {
      track.source.stop(t + f + FAST_FADE);
    } catch {
      // Déjà arrêtée.
    }
  }

  private updateDuck(now: number): void {
    let db = 0;
    for (let i = this.ducks.length - 1; i >= 0; i -= 1) {
      const d = this.ducks[i];
      if (d === undefined) continue;
      if (d.until <= now) this.ducks.splice(i, 1);
      else db = Math.min(db, d.db);
    }
    for (const voice of this.byLoop.values()) if (voice.def.duckDb < 0) db = Math.min(db, voice.def.duckDb);
    if (db === this.duckDb) return;
    const mix = this.options.catalogue.mix;
    const tc = (db < this.duckDb ? mix.duckAttackSeconds : mix.duckReleaseSeconds) / 3;
    this.duckDb = db;
    this.duck.gain.setTargetAtTime(dbToGain(db), now, Math.max(0.001, tc));
  }

  // -------------------------------------------------------------------------
  // Ambiances

  private updateBeds(frame: BrainFrame, now: number): void {
    const tc = this.options.settings.ambience.rampSeconds / 3;
    for (const [id, target] of frame.ambience) {
      const def = this.options.catalogue.sounds.get(id);
      const file = def?.files[0];
      if (def === undefined || file === undefined) continue;
      let bed = this.beds.get(id);
      if (bed === undefined) {
        if (target <= 0) {
          if (!frame.ambienceNeeded.has(id)) this.cache.release(file);
          else void this.cache.request(file);
          continue;
        }
        const buffer = this.cache.get(file);
        if (buffer === null) {
          void this.cache.request(file);
          continue;
        }
        bed = this.createBed(def, file, buffer);
        this.beds.set(id, bed);
      }
      if (Math.abs(bed.target - target) > TARGET_EPSILON) {
        bed.target = target;
        bed.out.gain.setTargetAtTime(target, now, Math.max(0.01, tc));
      }
      if (target <= 0) {
        bed.silentSince ??= now;
        if (now - bed.silentSince > this.options.settings.ambience.rampSeconds * BED_STOP_RAMPS) this.stopBed(bed, frame.ambienceNeeded.has(id));
      } else {
        bed.silentSince = null;
      }
    }
    // Rivière: chaque source suit la distance à l'oreille.
    for (const bed of this.beds.values()) {
      const spatial = bed.def.spatial;
      if (spatial === null) continue;
      for (const s of bed.sources) {
        if (s.river === null) continue;
        const d = distanceBetween(this.listener.at, s.river.at);
        s.gain.gain.setTargetAtTime(dbToGain(s.river.gainDb) * distanceGain(spatial, d), now, 0.1);
      }
    }
  }

  private createBed(def: SoundDef, file: string, buffer: AudioBuffer): Bed {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.indoorAmbience.has(def.id) ? this.indoorIn : this.outdoorIn);
    const sources: BedSource[] = [];
    const placed = def.spatial !== null ? this.river : [null];
    for (const river of placed) {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const loop = def.loop;
      let offset = def.playFrom;
      if (loop !== null) {
        source.loopStart = loop.start;
        source.loopEnd = loop.end;
        // Chaque source part d'ailleurs dans la boucle: les copies ne se répondent pas.
        offset = this.options.random.float(loop.start, loop.end);
      }
      const gain = ctx.createGain();
      source.connect(gain);
      let panner: PannerNode | null = null;
      if (river !== null) {
        panner = this.createPanner(river.at);
        gain.connect(panner).connect(out);
        gain.gain.value = 0;
      } else {
        gain.connect(out);
      }
      source.start(ctx.currentTime, offset);
      sources.push({ source, gain, panner, river });
    }
    this.cache.pin(file);
    return { id: def.id, file, def, out, sources, target: 0, silentSince: null };
  }

  private stopBed(bed: Bed, keepBuffer: boolean): void {
    for (const s of bed.sources) {
      this.kill(s.source);
      s.source.disconnect();
      s.gain.disconnect();
      s.panner?.disconnect();
    }
    bed.out.disconnect();
    this.beds.delete(bed.id);
    this.cache.unpin(bed.file);
    if (!keepBuffer) this.cache.release(bed.file);
  }

  private updateInterior(inHouse: boolean): void {
    if (inHouse === this.inHouse) return;
    const first = this.inHouse === null;
    this.inHouse = inHouse;
    const interior = this.options.catalogue.interior;
    const t = this.ctx.currentTime;
    const frequency = inHouse ? interior.lowpassHz : OPEN_FILTER_HZ;
    const level = inHouse ? dbToGain(interior.ambienceDb) : 1;
    if (first) {
      this.lowpass.frequency.value = frequency;
      this.interior.gain.value = level;
      return;
    }
    const end = t + interior.rampSeconds;
    this.lowpass.frequency.cancelScheduledValues(t);
    this.lowpass.frequency.setValueAtTime(this.lowpass.frequency.value, t);
    this.lowpass.frequency.exponentialRampToValueAtTime(frequency, end);
    this.interior.gain.cancelScheduledValues(t);
    this.interior.gain.setValueAtTime(this.interior.gain.value, t);
    this.interior.gain.linearRampToValueAtTime(level, end);
  }

  // -------------------------------------------------------------------------
  // Divers

  private updateTrainBuffers(wanted: boolean): void {
    if (wanted === this.trainWanted) return;
    this.trainWanted = wanted;
    const fanfare = this.options.catalogue.music.get('fanfare-train')?.file;
    const files = fanfare === undefined ? this.trainFiles : [...this.trainFiles, fanfare];
    for (const file of files) {
      if (wanted) void this.cache.request(file);
      else this.cache.release(file);
    }
  }

  private placeListener(frame: BrainFrame): void {
    const l = this.ctx.listener;
    const ear = frame.listener.ear;
    const yaw = frame.listener.yaw;
    l.positionX.value = ear.x;
    l.positionY.value = 0;
    l.positionZ.value = ear.y;
    l.forwardX.value = Math.cos(yaw);
    l.forwardY.value = 0;
    l.forwardZ.value = Math.sin(yaw);
    l.upX.value = 0;
    l.upY.value = 1;
    l.upZ.value = 0;
  }

  private createPanner(at: Vec2): PannerNode {
    const panner = this.ctx.createPanner();
    // Panoramique seul (peu coûteux): la distance est calculée par `distanceGain`.
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'linear';
    panner.refDistance = 1;
    panner.maxDistance = PANNER_FAR;
    panner.rolloffFactor = 0;
    this.setPosition(panner, at);
    return panner;
  }

  private setPosition(panner: PannerNode, at: Vec2): void {
    panner.positionX.value = at.x;
    panner.positionY.value = 0;
    panner.positionZ.value = at.y;
  }

  private busOf(def: SoundDef): AudioNode {
    switch (def.bus) {
      case 'ui':
        return this.uiIn;
      case 'effects':
        return this.effectsIn;
      case 'ambience':
        return this.indoorAmbience.has(def.id) ? this.indoorIn : this.outdoorIn;
    }
  }

  private kill(source: AudioBufferSourceNode): void {
    try {
      source.stop();
    } catch {
      // Pas encore démarrée ou déjà arrêtée.
    }
  }

  /** Taille décodée prévue d'un fichier, d'après `sons.json`, à la fréquence du contexte. */
  private estimate(file: string): number {
    const { catalogue, settings } = this.options;
    const rate = this.ctx.sampleRate;
    for (const music of catalogue.music.values()) {
      if (music.file === file) return decodedBytes(music.duration, rate, 2, settings.memory.bytesPerSample);
    }
    for (const sound of catalogue.sounds.values()) {
      const index = sound.files.indexOf(file);
      if (index >= 0) return decodedBytes(sound.durations[index] ?? 0, rate, sound.channels, settings.memory.bytesPerSample);
    }
    return 0;
  }
}
