/**
 * Moteur Web Audio du jeu. Il ne connaît aucun son par son nom: il lit les tables (`table.ts`),
 * écoute les événements de la simulation, la visée, les pas des deux personnages et le babil de
 * l'interface, et joue ce que les tables décident.
 *
 * Graphe (les bus de la plateforme s'appliquent par-dessus):
 * voix -> gain de catégorie (effets, interface, babil, ambiance, réglés par le joueur) -> bus SDK
 * `effects` (effets, babil, ambiance) ou `interface`.
 * Boucles par `AudioBufferSourceNode` (jamais `<audio loop>`, qui marque le raccord).
 */
import type { AudioBus } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { GameView } from '../session';
import type { BabbleInfo } from '../interface/dialogue';
import type { GameEvent } from '../simulation/noyau/evenements';
import { layerGains } from './ambiance';
import { Babbler } from './babil';
import { dbToGain, place, type Placement } from './espace';
import { StepTracker, stepSound } from './pas';
import { VoicePool } from './pool';
import {
  categoryGain,
  defaultSettings,
  loadSettings,
  saveSettings,
  type AudioSettings,
} from './reglages';
import { soundsForEvent, type HeardEvent } from './regles';
import { heldPick, heldValue, JointTracker, type JointHit } from './tenus';
import { CATEGORIES, type Category, type SoundDef } from './schemas';
import type { AudioTables } from './table';

/** Ce que le moteur demande à la plateforme audio (le module `audio` du SDK le fournit). */
export interface AudioHost {
  readonly context: BaseAudioContext;
  bus(name: AudioBus): AudioNode;
}

export interface AudioEngineOptions {
  readonly host: AudioHost;
  readonly view: GameView;
  readonly tables: AudioTables;
  /** Adresse servie d'un fichier sous `assets/commun/son/` (`effets/page.ogg`), `null` s'il manque. */
  readonly assetUrl: (file: string) => string | null;
  readonly random: RandomSource;
  /** Lacet de la caméra (radians): il tourne le panoramique avec l'écran. */
  readonly cameraYaw: () => number;
  /** Surface sous un point (`grass`, `dirt`, `paved`); absent: la surface par défaut. */
  readonly surfaceAt?: (x: number, y: number) => string | null;
  readonly storage?: Storage | null;
  readonly now?: () => number;
  readonly warn?: (message: string, data?: unknown) => void;
  /** Charge un fichier (tests: tampon fabriqué). Par défaut `fetch` puis `decodeAudioData`. */
  readonly load?: (url: string) => Promise<AudioBuffer>;
}

export interface AudioEngine {
  /** À brancher sur `onBabble` de l'interface. */
  onBabble(info: BabbleInfo): void;
  /** Signal de l'interface (`carnet-ouvre`, `choix`...): le son vient de `evenements.json` (`cues`). */
  cue(name: string): void;
  /** À appeler à chaque image de rendu: pas, visée, fondu des ambiances. */
  frame(dt: number): void;
  settings(): AudioSettings;
  setSettings(patch: Partial<AudioSettings>): void;
  /** Sons et tampons chargés (tests et cartes de diagnostic). */
  stats(): {
    readonly loaded: number;
    readonly missing: readonly string[];
    readonly voices: number;
  };
  /** Résolu quand les fichiers de départ sont décodés. */
  ready(): Promise<void>;
  dispose(): void;
}

const ZERO_PLACEMENT: Placement = { gain: 1, pan: 0, audible: true };

interface ActiveVoice {
  readonly poolId: number;
  readonly sound: string;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
}

export function createAudioEngine(options: AudioEngineOptions): AudioEngine {
  const { host, view, tables, random } = options;
  const ctx = host.context;
  const now = options.now ?? ((): number => performance.now());
  const warn = options.warn ?? ((): void => undefined);
  const storage = options.storage ?? null;
  let settings = loadSettings(tables.tuning, storage);
  let disposed = false;

  // Un gain par catégorie, branché au bon bus de la plateforme.
  const busOf: Record<Category, AudioBus> = {
    effects: 'effects',
    interface: 'interface',
    babble: 'interface',
    ambience: 'effects',
  };
  const categoryNodes = {} as Record<Category, GainNode>;
  for (const category of CATEGORIES) {
    const node = ctx.createGain();
    node.connect(host.bus(busOf[category]));
    categoryNodes[category] = node;
  }
  function applySettings(): void {
    for (const category of CATEGORIES) {
      categoryNodes[category].gain.setTargetAtTime(
        categoryGain(settings, category),
        ctx.currentTime,
        0.02,
      );
    }
  }
  applySettings();

  // --- Fichiers ---------------------------------------------------------------------------
  const buffers = new Map<string, AudioBuffer>();
  const missing: string[] = [];
  const load =
    options.load ??
    (async (url: string): Promise<AudioBuffer> => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
      return ctx.decodeAudioData(await response.arrayBuffer());
    });
  const wanted = new Set<string>();
  for (const sound of Object.values(tables.sounds))
    for (const file of sound.files) wanted.add(file);
  for (const timbre of Object.values(tables.voices.timbres)) wanted.add(timbre.file);
  for (const layer of Object.values(tables.ambience.layers)) wanted.add(layer.file);
  const loading = Promise.all(
    [...wanted].map(async (file) => {
      const url = options.assetUrl(file);
      if (url === null) {
        missing.push(file);
        warn('audio: fichier absent', { file });
        return;
      }
      try {
        buffers.set(file, await load(url));
      } catch (error) {
        missing.push(file);
        warn('audio: fichier illisible', { file, error: String(error) });
      }
    }),
  ).then(() => undefined);

  // --- Lecture ----------------------------------------------------------------------------
  const pool = new VoicePool(tables.tuning.maxVoices);
  const active = new Map<number, ActiveVoice>();
  const lastVariant = new Map<string, number>();

  function pickFile(id: string, def: SoundDef): string {
    const count = def.files.length;
    let index = 0;
    if (count > 1) {
      const previous = lastVariant.get(id);
      index =
        previous === undefined ? random.int(0, count) : (previous + random.int(1, count)) % count;
      lastVariant.set(id, index);
    }
    return def.files[index] ?? def.files[0] ?? '';
  }

  /** Joue un son de la table. `extraDb`: écart de niveau (l'autre joueur), `placement`: écoute placée. */
  function play(id: string, placement: Placement, extraDb: number): void {
    if (disposed || !placement.audible) return;
    const def = tables.sounds[id];
    if (def === undefined) return;
    const buffer = buffers.get(pickFile(id, def));
    if (buffer === undefined) return;
    const t = ctx.currentTime;
    const admission = pool.admit({
      sound: id,
      priority: def.priority,
      now: t,
      maxVoices: def.maxVoices,
      minIntervalSeconds: def.minIntervalMs / 1000,
    });
    if (admission.kind === 'reject') return;
    for (const victim of admission.evict) {
      const voice = active.get(victim);
      if (voice === undefined) continue;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, 0.01);
      voice.source.stop(t + 0.05);
      pool.remove(victim);
      active.delete(victim);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const held = def.loop !== undefined && def.loop.to > def.loop.from;
    if (held) {
      source.loop = true;
      source.loopStart = def.loop?.from ?? 0;
      source.loopEnd = Math.min(def.loop?.to ?? buffer.duration, buffer.duration);
    }
    source.playbackRate.value =
      def.pitchVariation > 0 ? 1 + random.float(-def.pitchVariation, def.pitchVariation) : 1;
    const gain = ctx.createGain();
    const variation =
      def.gainVariationDb > 0 ? random.float(-def.gainVariationDb, def.gainVariationDb) : 0;
    gain.gain.value = dbToGain(def.volumeDb + extraDb + variation) * placement.gain;
    source.connect(gain);
    let tail: AudioNode = gain;
    if (placement.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = placement.pan;
      gain.connect(panner);
      tail = panner;
    }
    tail.connect(categoryNodes[def.category]);
    const ends = held ? Number.POSITIVE_INFINITY : t + buffer.duration / source.playbackRate.value;
    const poolId = pool.add(id, def.priority, t, ends);
    active.set(poolId, { poolId, sound: id, source, gain });
    source.onended = (): void => {
      source.disconnect();
      tail.disconnect();
      pool.remove(poolId);
      active.delete(poolId);
    };
    source.start();
  }

  /** Fait taire les voix d'un son (un son tenu): fondu court, puis arrêt. */
  function silence(id: string): void {
    const t = ctx.currentTime;
    const fade = tables.tuning.heldFadeSeconds;
    for (const voice of active.values()) {
      if (voice.sound !== id) continue;
      voice.gain.gain.cancelScheduledValues(t);
      voice.gain.gain.setTargetAtTime(0, t, fade / 3);
      voice.source.stop(t + fade);
      pool.remove(voice.poolId);
      active.delete(voice.poolId);
    }
  }

  function listenerPose(): { x: number; y: number } | null {
    const local = view.localIndex();
    const body = local === null ? undefined : view.world()?.players[local].body;
    return body === undefined ? null : { x: body.x, y: body.y };
  }

  /** Écoute placée d'un joueur: soi-même au plein niveau et au centre, l'autre selon la distance. */
  function playAt(id: string, actor: 0 | 1 | null, placed: boolean, own: boolean): void {
    const space = tables.tuning.space;
    if (!placed || actor === null) {
      play(id, ZERO_PLACEMENT, own || actor === null ? 0 : space.otherPlayerDb);
      return;
    }
    if (own) {
      play(id, ZERO_PLACEMENT, 0);
      return;
    }
    const world = view.world();
    const listener = listenerPose();
    const body = world?.players[actor].body;
    if (listener === null || body === undefined) {
      play(id, ZERO_PLACEMENT, space.otherPlayerDb);
      return;
    }
    play(id, place(space, listener, body, options.cameraYaw()), space.otherPlayerDb);
  }

  // --- Événements de la simulation -----------------------------------------------------------
  /** Un événement (de la simulation, ou que le moteur se donne): chaque règle qui convient joue. */
  function hear(event: HeardEvent): void {
    for (const hit of soundsForEvent(tables.events, event, view.localIndex())) {
      if (hit.stop) silence(hit.sound);
      else playAt(hit.sound, hit.actor, hit.placed, hit.own);
    }
  }
  const unsubscribe = view.onEvent((event: GameEvent) => {
    hear(event);
  });

  // --- Sons tenus réglés par le monde (roulement selon la vitesse) -----------------------------
  interface HeldVoice {
    readonly sound: string;
    readonly source: AudioBufferSourceNode;
    readonly gain: GainNode;
  }
  const heldVoices: (HeldVoice | null)[] = tables.tuning.held.map(() => null);

  function fadeOut(voice: HeldVoice, seconds: number): void {
    const t = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + seconds);
    voice.source.stop(t + seconds + 0.02);
  }

  function startHeld(id: string, rate: number, seconds: number): HeldVoice | null {
    const def = tables.sounds[id];
    const buffer = def === undefined ? undefined : buffers.get(def.files[0] ?? '');
    if (def === undefined || buffer === undefined) return null;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const from = Math.min(def.loop?.from ?? 0, buffer.duration);
    source.loopStart = from;
    source.loopEnd = Math.min(def.loop?.to ?? buffer.duration, buffer.duration);
    source.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(dbToGain(def.volumeDb), t + seconds);
    source.connect(gain);
    gain.connect(categoryNodes[def.category]);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };
    // Pris dans la boucle, pas à l'attaque du fichier: le fondu croisé ne fait pas de coup.
    source.start(t, from);
    return { sound: id, source, gain };
  }

  function updateHeld(world: ReturnType<GameView['world']>): void {
    const t = ctx.currentTime;
    tables.tuning.held.forEach((def, index) => {
      const pick =
        world?.common.phase === 'day' ? heldPick(def, heldValue(world, def.source)) : null;
      const voice = heldVoices[index] ?? null;
      if (voice !== null && voice.sound === pick?.sound) {
        voice.source.playbackRate.setTargetAtTime(pick.rate, t, 0.1);
        return;
      }
      if (voice !== null) fadeOut(voice, def.crossfadeSeconds);
      heldVoices[index] =
        pick === null ? null : startHeld(pick.sound, pick.rate, def.crossfadeSeconds);
    });
  }

  // --- Joints de rail ---------------------------------------------------------------------------
  const joints = tables.tuning.joints === undefined ? null : new JointTracker(tables.tuning.joints);
  const jointHits: JointHit[] = [];

  // --- Babil ------------------------------------------------------------------------------------
  const babbler = new Babbler(tables.voices, random);
  const voiceOfVillager = new Map<string, string>();
  for (const placeContent of Object.values(view.content.places)) {
    for (const villager of placeContent.villagers) voiceOfVillager.set(villager.id, villager.voice);
  }

  function onBabble(info: BabbleInfo): void {
    if (disposed) return;
    const voiceId = voiceOfVillager.get(info.villager) ?? tables.voices.fallback;
    const syllable = babbler.syllable(info.villager, voiceId, info.char, now());
    if (syllable === null) return;
    const buffer = buffers.get(syllable.timbreFile);
    if (buffer === undefined) return;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = syllable.rate;
    const gain = ctx.createGain();
    const length = syllable.durationMs / 1000;
    const peak = dbToGain(syllable.gainDb);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.006);
    gain.gain.setTargetAtTime(0, t + length * 0.6, length * 0.2);
    source.connect(gain);
    gain.connect(categoryNodes.babble);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(t);
    source.stop(t + length * 1.6 + 0.05);
  }

  // --- Ambiances ------------------------------------------------------------------------------------
  interface Layer {
    readonly gain: GainNode;
    readonly baseDb: number;
    source: AudioBufferSourceNode | null;
  }
  const layers = new Map<string, Layer>();
  for (const [id, layer] of Object.entries(tables.ambience.layers)) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(categoryNodes.ambience);
    layers.set(id, { gain, baseDb: layer.volumeDb, source: null });
  }
  let ambienceClock = 0;
  const AMBIENCE_PERIOD = 0.25;

  function updateAmbience(): void {
    const world = view.world();
    if (world === null) return;
    const gains = layerGains(tables.ambience, world.minutes, world.common.phase === 'travel');
    const t = ctx.currentTime;
    for (const [id, layer] of layers) {
      const file = tables.ambience.layers[id]?.file;
      const buffer = file === undefined ? undefined : buffers.get(file);
      if (layer.source === null && buffer !== undefined) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(layer.gain);
        source.start();
        layer.source = source;
      }
      const target = (gains[id] ?? 0) * dbToGain(layer.baseDb);
      layer.gain.gain.setTargetAtTime(target, t, tables.ambience.fadeSeconds / 3);
    }
  }

  // --- Image par image: pas, visée -----------------------------------------------------------------
  const trackers = [
    new StepTracker(tables.tuning.steps),
    new StepTracker(tables.tuning.steps),
  ] as const;
  let lastAim: string | null = null;

  function frame(dt: number): void {
    if (disposed) return;
    const world = view.world();
    const local = view.localIndex();
    updateHeld(world);
    if (world === null || local === null) return;
    if (world.common.phase === 'day') {
      if (joints !== null) {
        joints.update(world, dt, jointHits);
        for (const hit of jointHits) hear(hit);
      }
      for (const index of [0, 1] as const) {
        const body = world.players[index].body;
        if (trackers[index].update(body) > 0) {
          const surface = options.surfaceAt?.(body.x, body.y) ?? null;
          playAt(stepSound(tables.tuning.steps, surface), index, true, index === local);
        }
      }
      const aim = view.aim(local);
      const key = aim === null ? null : `${aim.kind}:${aim.id}`;
      if (key !== lastAim) {
        lastAim = key;
        if (key !== null) play(tables.events.aim, ZERO_PLACEMENT, 0);
      }
    } else {
      for (const tracker of trackers) tracker.reset();
      joints?.reset();
      lastAim = null;
    }
    ambienceClock += dt;
    if (ambienceClock >= AMBIENCE_PERIOD) {
      ambienceClock = 0;
      updateAmbience();
    }
  }

  return {
    onBabble,
    cue(name) {
      const id = tables.events.cues[name];
      if (id !== undefined) play(id, ZERO_PLACEMENT, 0);
    },
    frame,
    settings: () => settings,
    setSettings(patch) {
      settings = { ...settings, ...patch };
      applySettings();
      saveSettings(tables.tuning, storage, settings);
    },
    stats: () => ({ loaded: buffers.size, missing, voices: active.size }),
    ready: () => loading,
    dispose() {
      disposed = true;
      unsubscribe();
      for (const voice of active.values()) {
        try {
          voice.source.stop();
        } catch {
          // Déjà arrêtée.
        }
      }
      for (const voice of heldVoices) {
        try {
          voice?.source.stop();
        } catch {
          // Déjà arrêtée.
        }
      }
      for (const layer of layers.values()) {
        try {
          layer.source?.stop();
        } catch {
          // Déjà arrêtée.
        }
        layer.gain.disconnect();
      }
      for (const category of CATEGORIES) categoryNodes[category].disconnect();
      active.clear();
      pool.clear();
    },
  };
}

export { defaultSettings };
