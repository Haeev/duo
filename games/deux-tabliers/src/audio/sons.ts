/**
 * Sons de Deux Tabliers, lus dans `assets/son/sons.json` (sound designer): chaque identifiant a
 * ses fichiers (tirés au hasard), son bus et son volume. Les événements de la simulation se
 * traduisent en sons par `donnees/sons.json` (`{ "events": { "<type>": "<identifiant>" } }`).
 * Un identifiant sans fichier ne joue rien et ne bloque jamais (un avertissement par identifiant).
 *
 * Boucles suivies à chaque image (`update`, dix fois par seconde au plus):
 * - buse vapeur: quatre boucles en fondu selon la température du lait (`plan.milkTemperature`);
 * - rumeur: une nappe de salle selon le nombre de clients (`plan.murmur.roomBeds`);
 * - ambiance: la pièce, la place le matin ou le soir, la pluie (`plan.ambienceByTime`);
 * - radio du village pendant le service: deux stations (`plan.radio.stations`), la douce le
 *   matin, l'entraînante l'après-midi, musique en flux, souffle de la radio entre deux morceaux.
 * Sons placés dans l'espace (champ `spatial` du plan, `espace.ts`): les postes, la caisse, la
 * porte et les gestes de l'autre s'entendent d'où ils viennent, atténués avec la distance et
 * placés à gauche ou à droite selon le regard (`listen`); la buse aussi. Ambiances, radio et
 * interface restent partout.
 */
import { v, type Audio, type AudioBus, type Logger, type PlayingSound } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { DataFiles } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import { serviceGauge } from '../service';
import type { GameEvent } from '../simulation/evenements';
import { clockMinutes } from '../clientele';
import { eventPoint, placeSound, type Listener, type Placed, type Spatial } from './espace';

const SOUND_URLS = import.meta.glob<string>('../../assets/son/**/*.ogg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const SOUND_FILE = import.meta.glob<unknown>('../../assets/son/sons.json', {
  eager: true,
  import: 'default',
});
const PREFIX = '../../assets/son/';

const SoundsFileSchema = v.strictObject({ events: v.record(v.string(), v.string()) });

/** Adresses des fichiers du dossier `installation/` (démo v0.3), libérés à la première ouverture. */
export const INSTALLATION_URLS: ReadonlySet<string> = new Set(
  Object.entries(SOUND_URLS)
    .filter(([path]) => path.startsWith(`${PREFIX}installation/`))
    .map(([, url]) => url),
);

/**
 * Les sons de l'installation ne servent plus: maison déjà ouverte (ou jamais partie de rien).
 * Plafond mémoire du son (`assets/son/sons.json`, `plan.installation.decodeWhen`).
 */
export function installationSoundsDone(world: World): boolean {
  const i = world.installation ?? null;
  return i === null || i.stage === 'opened';
}

/** Retire des tampons décodés ceux de l'installation; rend le nombre de tampons libérés. */
export function releaseInstallationBuffers(
  buffers: Map<string, unknown>,
  urls: ReadonlySet<string> = INSTALLATION_URLS,
): number {
  let n = 0;
  for (const url of [...buffers.keys()])
    if (urls.has(url)) {
      buffers.delete(url);
      n++;
    }
  return n;
}

/** Son d'un geste de l'installation (`installation-gesture`), par geste. */
const GESTURE_SOUND: Readonly<Record<string, string>> = {
  sheet: 'sheet-pull',
  sweep: 'broom-sweep',
  wipe: 'sponge-glass',
  connect: 'machine-connect',
};

const Range = v.tuple([v.number(), v.number()]);
const PlanSchema = v.looseObject({
  sounds: v.record(
    v.string(),
    v.looseObject({
      bus: v.string(),
      files: v.array(v.string()),
      volumeDb: v.optional(v.number(), 0),
      pitchVariation: v.optional(v.number(), 0),
      spatial: v.optional(
        v.nullable(
          v.looseObject({
            distanceModel: v.optional(v.string()),
            refDistance: v.number(),
            rolloffFactor: v.number(),
            maxDistance: v.number(),
            cullBeyondM: v.optional(v.number()),
          }),
        ),
        null,
      ),
    }),
  ),
  music: v.record(
    v.string(),
    v.looseObject({ file: v.string(), volumeDb: v.optional(v.number(), 0) }),
  ),
  plan: v.looseObject({
    radio: v.looseObject({
      stations: v.record(v.string(), v.array(v.string())),
      gapSeconds: Range,
    }),
    milkTemperature: v.looseObject({
      bands: v.array(
        v.looseObject({
          fromC: v.number(),
          toC: v.number(),
          mix: v.record(v.string(), Range),
          rate: Range,
        }),
      ),
    }),
    murmur: v.looseObject({
      roomBeds: v.array(
        v.looseObject({ sound: v.string(), fromCustomers: v.number(), toCustomers: v.number() }),
      ),
    }),
  }),
});
type Plan = v.InferOutput<typeof PlanSchema>;

/** Index par nom de fichier sans extension (sons ajoutés hors de `sons.json`). */
export function soundIndex(
  urls: Readonly<Record<string, string>> = SOUND_URLS,
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [path, url] of Object.entries(urls)) {
    const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.ogg$/, '');
    index.set(name, url);
  }
  return index;
}

export interface PlayAt {
  volume?: number;
  bus?: AudioBus;
  /** Point du son (x, z): atténué et placé si le son est déclaré dans l'espace. */
  at?: readonly [number, number] | null;
}

export interface Sounds {
  play(id: string, options?: PlayAt): void;
  /** Où est et où regarde qui écoute (le joueur local, à chaque image). */
  listen(x: number, z: number, yawDeg: number): void;
  /** Son d'un événement de la simulation, s'il en a un. */
  onEvent(event: GameEvent): void;
  /** Boucles et radio d'après le monde (à chaque image). */
  update(world: World, local: PlayerIndex): void;
  dispose(): void;
}

const dbToGain = (db: number): number => Math.pow(10, db / 20);

function busOf(name: string): AudioBus {
  return name === 'music' ? 'music' : name === 'interface' ? 'interface' : 'effects';
}

interface LoopVoice {
  readonly gain: GainNode;
  readonly source: AudioBufferSourceNode;
  readonly panner: StereoPannerNode;
}

const STEAM_LOOPS = ['steam-aerate-loop', 'steam-roll-loop', 'steam-sing-loop', 'steam-hot-loop'];
/** Ambiances: un peu sous les effets (le bus « ambiance » du plan n'existe pas dans le SDK). */
const AMBIENCE_GAIN = 0.55;

export function createSounds(
  audio: Audio,
  log: Logger,
  files: DataFiles,
  content: Content,
): Sounds {
  const index = soundIndex();
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const warned = new Set<string>();
  const parsed = v.safeParse(SoundsFileSchema, files['sons.json'] ?? { events: {} });
  const byEvent: Readonly<Record<string, string>> = parsed.success ? parsed.output.events : {};
  if (!parsed.success) log.warn('donnees/sons.json invalide: aucun son d’événement');
  const planParsed = v.safeParse(PlanSchema, Object.values(SOUND_FILE)[0] ?? {});
  const plan: Plan | null = planParsed.success ? planParsed.output : null;
  if (!planParsed.success) log.warn('assets/son/sons.json illisible: sons par nom de fichier');

  const warn = (id: string): void => {
    if (warned.has(id)) return;
    warned.add(id);
    log.warn('son absent', { id });
  };

  /** Vrai une fois les sons de l'installation libérés: ils ne se rechargent plus. */
  let installationReleased = false;
  const loadUrl = (url: string): Promise<AudioBuffer | null> => {
    if (installationReleased && INSTALLATION_URLS.has(url)) return Promise.resolve(null);
    let p = buffers.get(url);
    if (p === undefined) {
      p = audio.load(url).then(
        (b) => b,
        (error: unknown) => {
          log.warn('son illisible', { url, error: String(error) });
          return null;
        },
      );
      buffers.set(url, p);
    }
    return p;
  };

  /** Un fichier de l'identifiant (tiré au hasard) et ses réglages, ou rien. */
  const pick = (
    id: string,
  ): { url: string; gain: number; rate: number; bus: AudioBus; spatial: Spatial | null } | null => {
    const entry = plan?.sounds[id];
    if (entry !== undefined && entry.files.length > 0) {
      const file = entry.files[Math.floor(Math.random() * entry.files.length)] ?? '';
      const url = SOUND_URLS[PREFIX + file];
      if (url === undefined) return null;
      const spread = entry.pitchVariation;
      return {
        url,
        gain: dbToGain(entry.volumeDb),
        rate: 1 + (Math.random() * 2 - 1) * spread,
        bus: busOf(entry.bus),
        spatial: entry.spatial,
      };
    }
    const url = index.get(id);
    return url === undefined ? null : { url, gain: 1, rate: 1, bus: 'effects', spatial: null };
  };
  const listener: Listener = { x: 0, z: 0, yawDeg: 0 };
  const placed: Placed = { gain: 1, pan: 0 };
  const play = (id: string, options: PlayAt = {}): void => {
    const p = pick(id);
    if (p === null) {
      warn(id);
      return;
    }
    const at = options.at ?? null;
    if (at !== null && p.spatial !== null) {
      placeSound(p.spatial, listener, at[0], at[1], placed);
      if (placed.gain <= 0.001) return;
      const gain = (options.volume ?? 1) * p.gain * placed.gain;
      const pan = placed.pan;
      void loadUrl(p.url).then((buffer) => {
        if (buffer === null || disposed) return;
        // Voix placée: source, gain, panoramique, puis le bus du SDK (volumes du joueur).
        const ctx = audio.context;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = p.rate;
        const g = ctx.createGain();
        g.gain.value = gain;
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;
        source
          .connect(g)
          .connect(panner)
          .connect(audio.bus(options.bus ?? p.bus));
        source.onended = () => {
          source.disconnect();
          g.disconnect();
          panner.disconnect();
        };
        source.start();
      });
      return;
    }
    void loadUrl(p.url).then((buffer) => {
      if (buffer !== null)
        audio.play(buffer, {
          bus: options.bus ?? p.bus,
          volume: (options.volume ?? 1) * p.gain,
          rate: p.rate,
        });
    });
  };

  // Boucles: une voix par identifiant, gain réglé en douceur.
  const loops = new Map<string, LoopVoice | 'loading'>();
  const want = new Map<string, number>();
  let disposed = false;
  const setLoop = (
    id: string,
    wanted: number,
    rate = 1,
    at: readonly [number, number] | null = null,
  ): void => {
    // Boucle placée (la buse): atténuée et placée comme un son ponctuel.
    const spatial = at === null ? null : (plan?.sounds[id]?.spatial ?? null);
    if (spatial !== null && at !== null) placeSound(spatial, listener, at[0], at[1], placed);
    const gain = spatial === null ? wanted : wanted * placed.gain;
    const pan = spatial === null ? 0 : placed.pan;
    want.set(id, gain);
    const voice = loops.get(id);
    if (voice === 'loading') return;
    if (voice !== undefined) {
      const t = audio.context.currentTime;
      voice.gain.gain.setTargetAtTime(gain, t, 0.15);
      voice.source.playbackRate.setTargetAtTime(rate, t, 0.1);
      voice.panner.pan.setTargetAtTime(pan, t, 0.1);
      return;
    }
    if (gain <= 0.001) return;
    const p = pick(id);
    if (p === null) {
      warn(id);
      return;
    }
    loops.set(id, 'loading');
    void loadUrl(p.url).then((buffer) => {
      if (buffer === null || disposed) {
        loops.delete(id);
        return;
      }
      const ctx = audio.context;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const node = ctx.createGain();
      node.gain.value = 0;
      const panner = ctx.createStereoPanner();
      source.connect(node).connect(panner).connect(audio.bus(p.bus));
      source.start();
      node.gain.setTargetAtTime((want.get(id) ?? 0) * p.gain, ctx.currentTime, 0.3);
      loops.set(id, { gain: node, source, panner });
    });
  };

  // Radio du village: un morceau en flux, puis le souffle, puis le suivant de la station.
  let radio: PlayingSound | null = null;
  let radioStation = '';
  let radioTrack = 0;
  let radioWait: ReturnType<typeof setTimeout> | null = null;
  const stopRadio = (): void => {
    if (radioWait !== null) clearTimeout(radioWait);
    radioWait = null;
    radio?.stop(1500);
    radio = null;
    radioStation = '';
    setLoop('radio-hiss-loop', 0);
  };
  const nextSong = (station: string): void => {
    const list = plan?.plan.radio.stations[station] ?? [];
    const id = list[radioTrack % Math.max(1, list.length)];
    radioTrack++;
    const music = id === undefined ? undefined : plan?.music[id];
    const url = music === undefined ? undefined : SOUND_URLS[PREFIX + music.file];
    if (url === undefined) return;
    setLoop('radio-hiss-loop', 0);
    const song = audio.playMusic(url, { loop: false, volume: 0.7, fadeInMs: 800 });
    radio = song;
    void song.ended.then(() => {
      if (radio !== song || disposed) return;
      setLoop('radio-hiss-loop', 0.5);
      const [lo, hi] = plan?.plan.radio.gapSeconds ?? [2, 4];
      radioWait = setTimeout(
        () => {
          radioWait = null;
          if (radioStation === station && !disposed) nextSong(station);
        },
        (lo + Math.random() * (hi - lo)) * 1000,
      );
    });
  };
  const tuneRadio = (station: string | null): void => {
    if (station === radioStation) return;
    if (station === null) {
      stopRadio();
      return;
    }
    const switching = radioStation !== '';
    stopRadio();
    radioStation = station;
    if (switching) play('radio-tune');
    nextSong(station);
  };

  let lastUpdate = -Infinity;
  const update = (world: World, local: PlayerIndex): void => {
    lastWorld = world;
    if (!installationReleased && installationSoundsDone(world)) {
      installationReleased = true;
      releaseInstallationBuffers(buffers);
    }
    const now = performance.now();
    if (now - lastUpdate < 100 || plan === null) return;
    lastUpdate = now;
    // Buse vapeur: fondus entre les quatre boucles selon la température du lait.
    const gauge = serviceGauge(content, world, local, 1 / 60);
    const mix = new Map<string, number>(STEAM_LOOPS.map((id) => [id, 0]));
    let rate = 1;
    if (gauge?.kind === 'steam') {
      const t = gauge.temperatureC;
      const band =
        plan.plan.milkTemperature.bands.find((b) => t >= b.fromC && t < b.toC) ??
        plan.plan.milkTemperature.bands.at(-1);
      if (band !== undefined) {
        const k = Math.max(0, Math.min(1, (t - band.fromC) / Math.max(1, band.toC - band.fromC)));
        for (const [id, [a, b]] of Object.entries(band.mix)) mix.set(id, a + (b - a) * k);
        rate = band.rate[0] + (band.rate[1] - band.rate[0]) * k;
      }
    }
    const wand = world.furniture.find((f) => f.type === 'buse-vapeur');
    const wandAt: [number, number] | null = wand === undefined ? null : [wand.x, wand.z];
    for (const [id, g] of mix) setLoop(id, g, rate, wandAt);
    // Rumeur de la salle: la nappe qui va avec le nombre de clients.
    const c = world.clientele;
    const people = c.groups.reduce((sum, g) => sum + (g.stage === 'leaving' ? 0 : g.size), 0);
    for (const bed of plan.plan.murmur.roomBeds)
      setLoop(
        bed.sound,
        people >= bed.fromCustomers && people < bed.toCustomers ? AMBIENCE_GAIN : 0,
      );
    // Ambiance: la pièce toujours, la place selon l'heure, ou la pluie.
    const rain = c.weather === 'pluie' || c.conditions.includes('averse');
    const minutes =
      c.phase === 'service' || c.phase === 'closing'
        ? clockMinutes(content.clientele, c)
        : c.phase === 'prep'
          ? content.clientele.days.open
          : content.clientele.days.close;
    setLoop('room-village', AMBIENCE_GAIN);
    setLoop('rain-glass', rain ? AMBIENCE_GAIN : 0);
    setLoop('ext-village-morning', !rain && minutes < 14 * 60 ? AMBIENCE_GAIN * 0.7 : 0);
    setLoop('ext-village-evening', !rain && minutes >= 14 * 60 ? AMBIENCE_GAIN * 0.7 : 0);
    // Radio: allumée pendant le service.
    const open = c.phase === 'service' || c.phase === 'closing';
    tuneRadio(open ? (minutes < 13 * 60 ? 'douce' : 'entrainante') : null);
  };

  let lastWorld: World | null = null;
  return {
    play,
    listen(x, z, yawDeg) {
      listener.x = x;
      listener.z = z;
      listener.yawDeg = yawDeg;
    },
    onEvent(event) {
      const at = lastWorld === null ? null : eventPoint(content, lastWorld, event);
      // Le pourboire tombe dans le bocal quand le client s'en va (il n'a pas d'événement à lui).
      if (event.type === 'clientele-left' && event.tip > 0)
        play(event.tip >= 100 ? 'tip-big' : 'tip-jar-2', { at });
      const id =
        event.type === 'installation-gesture' ? GESTURE_SOUND[event.gesture] : byEvent[event.type];
      if (id !== undefined) play(id, { at });
    },
    update,
    dispose() {
      disposed = true;
      stopRadio();
      for (const voice of loops.values()) {
        if (voice === 'loading') continue;
        voice.source.stop();
        voice.source.disconnect();
        voice.gain.disconnect();
        voice.panner.disconnect();
      }
      loops.clear();
    },
  };
}
