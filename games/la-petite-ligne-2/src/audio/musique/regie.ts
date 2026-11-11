/**
 * Régie de la musique (Web Audio). Elle ne connaît aucun morceau par son nom: elle lit la table
 * (`donnees/musique.json`), demande à `choix.ts` ce qui doit jouer, à `rythme.ts` quand se taire,
 * et fait les fondus.
 *
 * Graphe: tiges (mono, panoramique, niveau par rôle) -> gain du morceau (fondu enchaîné) -> somme
 * -> passe-bas (couches « feutré ») -> gain des couches -> recul sous les jingles -> niveau du joueur
 * -> bus `music` du SDK. Les jingles rejoignent le niveau du joueur sans passer par le recul.
 * Boucles par `AudioBufferSourceNode` avec `loopStart` et `loopEnd`: les fichiers portent une amorce
 * de chaque côté de la boucle (le codage ne marque pas le raccord), toutes les tiges d'un morceau
 * démarrent au même instant. Les morceaux sont décodés à la demande, à la fréquence de la table.
 */
import type { AudioBus } from '@duo/sdk';
import type { RandomSource } from '@duo/sdk/sim';
import type { GameView } from '../../session';
import type { GameEvent } from '../../simulation/noyau/evenements';
import { calendarOf } from '../../simulation/monde/calendrier';
import { dbToGain } from '../espace';
import { choose, jingleForEvent, type MusicChoice, type MusicContext } from './choix';
import { loadMusicSettings, saveMusicSettings, type MusicSettings } from './reglages';
import { Pacer } from './rythme';
import type { MusicTable } from './schemas';

export interface MusicHost {
  readonly context: BaseAudioContext;
  bus(name: AudioBus): AudioNode;
}

export interface MusicOptions {
  readonly host: MusicHost;
  readonly view: GameView;
  readonly table: MusicTable;
  /** Adresse servie d'un fichier sous `assets/commun/son/`, `null` s'il manque. */
  readonly assetUrl: (file: string) => string | null;
  readonly random: RandomSource;
  /** Zone du lieu sous un point (`riviere`, `voie`...); absent: aucune zone. */
  readonly zoneAt?: (x: number, y: number) => string | null;
  /** Événements du calendrier en cours; absent: ceux que la régie a vus commencer. */
  readonly activeEvents?: () => readonly string[];
  readonly storage?: Storage | null;
  readonly warn?: (message: string, data?: unknown) => void;
  /** Charge un fichier (tests: tampon fabriqué). Par défaut `fetch` puis décodage à `decodeRate`. */
  readonly load?: (url: string) => Promise<AudioBuffer>;
}

export interface MusicState {
  /** Morceau entendu (ou en fondu d'entrée), `null` pendant un silence. */
  readonly track: string | null;
  readonly rule: string | null;
  readonly quiet: boolean;
  readonly modifiers: readonly string[];
  readonly lowpassHz: number | null;
  readonly decoded: readonly string[];
  /** Air écouté depuis le carnet (`listen`), `null`: aucun. */
  readonly listening: string | null;
}

export interface MusicDirector {
  /** À appeler à chaque image de rendu (le temps écoulé en secondes). */
  frame(dt: number): void;
  settings(): MusicSettings;
  setSettings(patch: Partial<MusicSettings>): void;
  state(): MusicState;
  /** Joue un jingle de la table (cartes de diagnostic, tests). */
  playJingle(id: string, own?: boolean): void;
  /** Résolu quand les jingles sont décodés. */
  ready(): Promise<void>;
  /** Ce morceau existe-t-il dans la table (un air du carnet qui a son enregistrement) ? */
  listenable(trackId: string): boolean;
  /**
   * Écoute d'un air, pour ce joueur seulement (bouton « Écouter » du carnet): la musique
   * d'ambiance s'efface, l'air passe une fois en entier, sans les couches de météo, puis
   * l'ambiance revient. Un second appel remplace l'air. `false`: morceau inconnu.
   */
  listen(trackId: string): boolean;
  /** Arrête l'écoute (fermer le carnet, « Arrêter »); l'ambiance revient. Sans écoute: rien. */
  stopListening(): void;
  /** Air écouté, `null`: aucun (l'écoute finie d'elle-même revient à `null`). */
  listening(): string | null;
  dispose(): void;
}

interface Loaded {
  readonly stems: ReadonlyMap<string, AudioBuffer>;
}

interface Voice {
  readonly track: string;
  readonly gain: GainNode;
  readonly stems: ReadonlyMap<
    string,
    { readonly gain: GainNode; readonly source: AudioBufferSourceNode }
  >;
}

const OPEN_HZ = 20000;
const REMOVED_DB = -60;

export function createMusicDirector(options: MusicOptions): MusicDirector {
  const { host, view, table, random } = options;
  const ctx = host.context;
  const warn = options.warn ?? ((): void => undefined);
  const storage = options.storage ?? null;
  const timing = table.timing;
  let settings = loadMusicSettings(table, storage);
  let disposed = false;

  // --- Graphe --------------------------------------------------------------------------------
  const sum = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = OPEN_HZ;
  tone.Q.value = 0.5;
  const shade = ctx.createGain();
  const duck = ctx.createGain();
  const level = ctx.createGain();
  sum.connect(tone);
  tone.connect(shade);
  shade.connect(duck);
  duck.connect(level);
  level.connect(host.bus('music'));
  const jingleBus = ctx.createGain();
  jingleBus.connect(level);

  function applySettings(): void {
    const target = settings.muted ? 0 : settings.music * dbToGain(table.defaults.levelDb);
    level.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  }
  applySettings();

  // --- Fichiers ------------------------------------------------------------------------------
  const load =
    options.load ??
    (async (url: string): Promise<AudioBuffer> => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
      const decoder = new OfflineAudioContext(1, 1, timing.decodeRate);
      return decoder.decodeAudioData(await response.arrayBuffer());
    });

  async function loadFile(file: string): Promise<AudioBuffer | null> {
    const url = options.assetUrl(file);
    if (url === null) {
      warn('musique: fichier absent', { file });
      return null;
    }
    try {
      return await load(url);
    } catch (error) {
      warn('musique: fichier illisible', { file, error: String(error) });
      return null;
    }
  }

  const tracks = new Map<string, Promise<Loaded | null>>();
  const decoded: string[] = [];
  const jingles = new Map<string, AudioBuffer>();

  function loadTrack(id: string): Promise<Loaded | null> {
    const known = tracks.get(id);
    if (known !== undefined) return known;
    const def = table.tracks[id];
    if (def === undefined) return Promise.resolve(null);
    const pending = Promise.all(
      Object.entries(def.stems).map(
        async ([role, stem]) => [role, await loadFile(stem.file)] as const,
      ),
    ).then((entries): Loaded | null => {
      const stems = new Map<string, AudioBuffer>();
      for (const [role, buffer] of entries) if (buffer !== null) stems.set(role, buffer);
      if (stems.size === 0) return null;
      decoded.push(id);
      return { stems };
    });
    tracks.set(id, pending);
    return pending;
  }

  /** Libère les morceaux décodés les plus anciens (jamais celui qui joue ou s'éteint). */
  function evict(): void {
    const inUse = new Set([
      active?.track,
      listened?.track,
      listened?.voice?.track,
      ...leaving.map((v) => v.track),
    ]);
    while (decoded.length > timing.residentTracks + inUse.size) {
      const index = decoded.findIndex((id) => !inUse.has(id));
      if (index < 0) return;
      const [id] = decoded.splice(index, 1);
      if (id !== undefined) tracks.delete(id);
    }
  }

  const ready = Promise.all(
    Object.entries(table.jingles).map(async ([id, def]) => {
      const buffer = await loadFile(def.file);
      if (buffer !== null) jingles.set(id, buffer);
    }),
  ).then(() => undefined);

  // --- Voix ----------------------------------------------------------------------------------
  let active: Voice | null = null;
  const leaving: Voice[] = [];
  const starting = new Set<string>();
  /**
   * Écoute d'un air du carnet: la voix (nulle pendant le décodage) et l'instant de fin, sur
   * l'horloge des images. Elle passe après le recul des jingles, avant le niveau du joueur, sans
   * passe-bas ni couches: on écoute l'air tel qu'il est.
   */
  const listenFade = timing.listenFadeSeconds ?? 1;
  let listened: { readonly track: string; voice: Voice | null; endsAt: number } | null = null;

  function startVoice(
    id: string,
    loaded: Loaded,
    fadeSeconds: number,
    out: AudioNode = sum,
  ): Voice | null {
    const def = table.tracks[id];
    if (def === undefined) return null;
    const t = ctx.currentTime + 0.05;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.setTargetAtTime(1, t, fadeSeconds / 3);
    gain.connect(out);
    const stems = new Map<string, { gain: GainNode; source: AudioBufferSourceNode }>();
    for (const [role, stem] of Object.entries(def.stems)) {
      const buffer = loaded.stems.get(role);
      if (buffer === undefined) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.loopStart = timing.preroll;
      source.loopEnd = timing.preroll + def.seconds;
      const stemGain = ctx.createGain();
      stemGain.gain.value = dbToGain(stem.volumeDb);
      const panner = ctx.createStereoPanner();
      panner.pan.value = stem.pan;
      source.connect(stemGain);
      stemGain.connect(panner);
      panner.connect(gain);
      source.start(t, timing.preroll);
      stems.set(role, { gain: stemGain, source });
    }
    return { track: id, gain, stems };
  }

  function release(voice: Voice, seconds: number): void {
    const t = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setTargetAtTime(0, t, seconds / 3);
    for (const { source } of voice.stems.values()) source.stop(t + seconds * 1.5);
    leaving.push(voice);
    const source = voice.stems.values().next().value?.source;
    if (source === undefined) return;
    source.onended = (): void => {
      voice.gain.disconnect();
      const index = leaving.indexOf(voice);
      if (index >= 0) leaving.splice(index, 1);
      evict();
    };
  }

  function stemTargets(voice: Voice, choice: MusicChoice): void {
    const def = table.tracks[voice.track];
    if (def === undefined) return;
    const t = ctx.currentTime;
    for (const [role, stem] of Object.entries(def.stems)) {
      const node = voice.stems.get(role);
      if (node === undefined) continue;
      const db = stem.volumeDb + (choice.stemsDb[role] ?? 0);
      node.gain.gain.setTargetAtTime(db <= REMOVED_DB ? 0 : dbToGain(db), t, 1.5);
    }
  }

  // --- Jingles -------------------------------------------------------------------------------
  const lastJingle = new Map<string, number>();
  let clock = 0;

  function playJingle(id: string, own = true): void {
    if (disposed) return;
    const def = table.jingles[id];
    const buffer = jingles.get(id);
    if (def === undefined || buffer === undefined) return;
    const last = lastJingle.get(id);
    if (last !== undefined && clock - last < timing.jingleCooldownSeconds) return;
    lastJingle.set(id, clock);
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = dbToGain(def.volumeDb + (own ? 0 : timing.otherPlayerDb));
    source.connect(gain);
    gain.connect(jingleBus);
    source.onended = (): void => {
      source.disconnect();
      gain.disconnect();
    };
    source.start(t);
    // La musique recule sous le jingle (attaque rapide) et revient doucement à sa fin.
    duck.gain.cancelScheduledValues(t);
    duck.gain.setTargetAtTime(dbToGain(def.duckDb), t, 0.08);
    duck.gain.setTargetAtTime(1, t + def.seconds, 0.6);
  }

  const calendar = new Set<string>();
  const unsubscribe = view.onEvent((event: GameEvent) => {
    if (event.type === 'calendar_started') calendar.add(event.event);
    else if (event.type === 'calendar_ended') calendar.delete(event.event);
    const hit = jingleForEvent(table, event, view.localIndex());
    if (hit !== null) playJingle(hit.jingle, hit.own);
  });

  // --- Contexte, choix, rythme -----------------------------------------------------------------
  let pacer = new Pacer(random);
  let lastPlace: string | null = null;
  let holdUntil = 0;
  let lastChoice: MusicChoice = choose(table, {
    place: '',
    zone: null,
    hour: 12,
    weather: 'clear',
    season: 'spring',
    phase: 'day',
    scene: null,
    events: [],
  });
  let quiet = false;
  let tickClock = 0;

  function contextNow(): MusicContext | null {
    const world = view.world();
    if (world === null) return null;
    const local = view.localIndex();
    const body = local === null ? undefined : world.players[local].body;
    const zone = body === undefined ? null : (options.zoneAt?.(body.x, body.y) ?? null);
    return {
      place: world.common.place,
      zone,
      hour: (world.minutes / 60) % 24,
      weather: world.common.weather,
      season: calendarOf(view.content, world.common.day).season,
      phase: world.common.phase,
      scene: world.common.story?.scene?.id ?? null,
      events: options.activeEvents?.() ?? [...calendar],
    };
  }

  function tick(dt: number): void {
    const now = contextNow();
    if (now === null) return;
    if (now.place !== lastPlace) {
      // Arrivée dans un lieu: son thème court, puis la musique reprend après un instant.
      lastPlace = now.place;
      calendar.clear();
      pacer = new Pacer(random);
      const arrival = table.arrivals[now.place];
      if (arrival !== undefined) {
        playJingle(arrival, true);
        holdUntil = clock + timing.arrivalHoldSeconds;
      }
    }
    lastChoice = choose(table, now);
    const wanted = clock < holdUntil ? null : lastChoice.track;
    const pacing = table.pacings[lastChoice.pacing] ?? null;
    const step = pacer.update(dt, wanted, pacing);
    quiet = step.mode === 'quiet';
    // Pendant une écoute, l'ambiance se tait; le rythme continue de compter.
    follow(listened === null ? step.track : null);
    const t = ctx.currentTime;
    tone.frequency.setTargetAtTime(lastChoice.lowpassHz ?? OPEN_HZ, t, 2);
    shade.gain.setTargetAtTime(dbToGain(lastChoice.gainDb), t, 2);
    if (active !== null) stemTargets(active, lastChoice);
  }

  /** Amène la voix en cours au morceau voulu: fondu enchaîné, ou fondu de sortie vers un silence. */
  function follow(wanted: string | null): void {
    if (wanted === null) {
      if (active !== null) {
        release(active, timing.fadeSeconds);
        active = null;
      }
      return;
    }
    if (active?.track === wanted || starting.has(wanted)) return;
    starting.add(wanted);
    void loadTrack(wanted).then((loaded) => {
      starting.delete(wanted);
      if (disposed || loaded === null) return;
      // Les règles ont pu changer pendant le décodage: on ne démarre que ce qui est encore voulu.
      if (pacerTrackNow() !== wanted) return;
      const previous = active;
      const seconds = previous === null ? timing.fadeSeconds : timing.crossfadeSeconds;
      const voice = startVoice(wanted, loaded, seconds);
      if (voice === null) return;
      if (previous !== null) release(previous, seconds);
      active = voice;
      stemTargets(voice, lastChoice);
      evict();
    });
  }

  function pacerTrackNow(): string | null {
    return quiet || clock < holdUntil || listened !== null ? null : lastChoice.track;
  }

  function listen(trackId: string): boolean {
    const def = table.tracks[trackId];
    if (disposed || def === undefined) return false;
    stopListening(false);
    if (active !== null) {
      release(active, listenFade);
      active = null;
    }
    const mine = { track: trackId, voice: null as Voice | null, endsAt: Infinity };
    listened = mine;
    void loadTrack(trackId).then((loaded) => {
      // Arrêtée ou remplacée pendant le décodage: rien ne part.
      if (disposed || listened !== mine) return;
      if (loaded === null) {
        listened = null;
        return;
      }
      mine.voice = startVoice(trackId, loaded, listenFade, duck);
      // L'air passe une fois: sa sortie s'achève quand la boucle reviendrait au début.
      mine.endsAt = clock + Math.max(listenFade, def.seconds - listenFade);
    });
    return true;
  }

  function stopListening(resume = true): void {
    if (listened === null) return;
    if (listened.voice !== null) release(listened.voice, listenFade);
    listened = null;
    // L'ambiance revient tout de suite, sans attendre le prochain tick.
    if (resume) follow(pacerTrackNow());
  }

  function frame(dt: number): void {
    if (disposed) return;
    clock += dt;
    if (listened !== null && clock >= listened.endsAt) stopListening();
    tickClock += dt;
    if (tickClock < timing.tickSeconds) return;
    const elapsed = tickClock;
    tickClock = 0;
    tick(elapsed);
  }

  return {
    frame,
    settings: () => settings,
    setSettings(patch) {
      settings = { ...settings, ...patch };
      applySettings();
      saveMusicSettings(table, storage, settings);
    },
    state: () => ({
      track: active?.track ?? null,
      rule: lastChoice.rule,
      quiet,
      modifiers: lastChoice.modifiers,
      lowpassHz: lastChoice.lowpassHz,
      decoded: [...decoded],
      listening: listened?.track ?? null,
    }),
    playJingle,
    ready: () => ready,
    listenable: (trackId) => table.tracks[trackId] !== undefined,
    listen,
    stopListening: () => {
      stopListening();
    },
    listening: () => listened?.track ?? null,
    dispose() {
      disposed = true;
      unsubscribe();
      const heard = listened?.voice ?? null;
      listened = null;
      for (const voice of [
        ...(active === null ? [] : [active]),
        ...(heard === null ? [] : [heard]),
        ...leaving,
      ]) {
        for (const { source } of voice.stems.values()) {
          try {
            source.stop();
          } catch {
            // Déjà arrêtée.
          }
        }
        voice.gain.disconnect();
      }
      active = null;
      leaving.length = 0;
      level.disconnect();
      jingleBus.disconnect();
    },
  };
}
