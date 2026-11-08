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
 * Pas de son placé dans l'espace pour la démo: tout part en stéréo, au volume du plan.
 */
import { v, type Audio, type AudioBus, type Logger, type PlayingSound } from '@duo/sdk';
import type { Content } from '../donnees/charger';
import type { DataFiles } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import { serviceGauge } from '../service';
import type { GameEvent } from '../simulation/evenements';
import { clockMinutes } from '../clientele';

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

const Range = v.tuple([v.number(), v.number()]);
const PlanSchema = v.looseObject({
  sounds: v.record(
    v.string(),
    v.looseObject({
      bus: v.string(),
      files: v.array(v.string()),
      volumeDb: v.optional(v.number(), 0),
      pitchVariation: v.optional(v.number(), 0),
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

export interface Sounds {
  play(id: string, options?: { volume?: number; bus?: AudioBus }): void;
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

  const loadUrl = (url: string): Promise<AudioBuffer | null> => {
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
  const pick = (id: string): { url: string; gain: number; rate: number; bus: AudioBus } | null => {
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
      };
    }
    const url = index.get(id);
    return url === undefined ? null : { url, gain: 1, rate: 1, bus: 'effects' };
  };

  const play = (id: string, options: { volume?: number; bus?: AudioBus } = {}): void => {
    const p = pick(id);
    if (p === null) {
      warn(id);
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
  const setLoop = (id: string, gain: number, rate = 1): void => {
    want.set(id, gain);
    const voice = loops.get(id);
    if (voice === 'loading') return;
    if (voice !== undefined) {
      const t = audio.context.currentTime;
      voice.gain.gain.setTargetAtTime(gain, t, 0.15);
      voice.source.playbackRate.setTargetAtTime(rate, t, 0.1);
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
      source.connect(node).connect(audio.bus(p.bus));
      source.start();
      node.gain.setTargetAtTime((want.get(id) ?? 0) * p.gain, ctx.currentTime, 0.3);
      loops.set(id, { gain: node, source });
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
    for (const [id, g] of mix) setLoop(id, g, rate);
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

  return {
    play,
    onEvent(event) {
      // Le pourboire tombe dans le bocal quand le client s'en va (il n'a pas d'événement à lui).
      if (event.type === 'clientele-left' && event.tip > 0)
        play(event.tip >= 100 ? 'tip-big' : 'tip-jar-2');
      const id = byEvent[event.type];
      if (id !== undefined) play(id);
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
      }
      loops.clear();
    },
  };
}
