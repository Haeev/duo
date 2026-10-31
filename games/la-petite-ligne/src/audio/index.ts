/**
 * Son de La Petite Ligne: point d'entrée (`createAudio`, contrat `CreateAudio`
 * de `etat/vue.ts`), appelé par `main.ts`.
 *
 * - `load`: lit `sons.json`, décode les sons permanents (effets, interface,
 *   motifs des habitants); musiques, ambiances et train se décodent à la
 *   demande, sous le plafond de 128 Mo.
 * - `frame`: à chaque image, le cerveau lit l'état et les événements, le
 *   moteur joue. Pendant la pause de la plateforme, musique atténuée et effets
 *   suspendus.
 */
import type { DuoEvents, Logger, Unsubscribe } from '@duo/sdk';
import { createRandom, deriveSeed } from '@duo/sdk/sim';
import type { WorldEvent } from '../etat/types';
import type { AudioOptions, CreateAudio, GameAudio } from '../etat/vue';
import soundsFile from '../../assets/son/sons.json';
import { AudioBrain } from './cerveau';
import type { SoundRequest } from './declencheurs';
import { parseCatalogue } from './catalogue';
import { AudioEngine, type AudioHost, type EngineStats } from './moteur';
import { AUDIO_SETTINGS } from './reglages';

const SOUND_URLS = import.meta.glob<string>('../../assets/son/**/*.ogg', {
  query: '?url',
  import: 'default',
  eager: true,
});
const SOUND_PREFIX = '../../assets/son/';

/**
 * Ce que `main.ts` peut donner en plus du contrat (demandes de l'audio,
 * `ETAT.md`): sans eux, la pause se devine (le monde ne bouge plus, chez
 * l'hôte) et l'oreille garde l'orientation de départ de la caméra.
 */
export interface AudioExtras {
  /** `duo` du SDK: événements `pause` et `resume` de la plateforme. */
  lifecycle?: { on<K extends keyof DuoEvents>(event: K, listener: (payload: DuoEvents[K]) => void): Unsubscribe };
  /** `renderer.cameraYaw()`: gauche et droite de l'écran pour les oreilles. */
  cameraYaw?: () => number;
  /** `duo.log`. */
  log?: Logger;
}

export type AudioDiagnostics = EngineStats & { music: string | null; resting: boolean; paused: boolean; context: string };

export interface GameAudioWithStats extends GameAudio {
  /** Diagnostic (indicateur de développement): mémoire décodée, voix, musique. */
  stats(): AudioDiagnostics;
}

declare global {
  interface Window {
    /** En développement seulement: diagnostic du son pour les tests de qa-testeur (Playwright). */
    lplAudio?: { stats(): AudioDiagnostics };
  }
}

/** Adresse d'un fichier de `assets/son/` (Vite le copie avec une empreinte dans la version construite). */
function urlOf(file: string, fallback: (path: string) => string): string {
  return SOUND_URLS[`${SOUND_PREFIX}${file}`] ?? fallback(`assets/son/${file}`);
}

export function createAudio(options: AudioOptions & AudioExtras): GameAudioWithStats {
  const { view, audio } = options;
  const settings = AUDIO_SETTINGS;
  const warn = (message: string, data: Record<string, unknown>): void => {
    options.log?.warn(message, data);
  };
  const catalogue = parseCatalogue(soundsFile);
  const local = view.localCharacter();
  const seed = deriveSeed(view.world().seed, `audio:${local}`);
  const random = createRandom(seed);
  const host: AudioHost = audio;
  let engine: AudioEngine | null = null;
  let brain: AudioBrain | null = null;
  const events: WorldEvent[] = [];
  /** Sons demandés par l'interface depuis la dernière image (bus interface, non placés). */
  const uiShots: SoundRequest[] = [];
  const unsubscribers: (() => void)[] = [];
  unsubscribers.push(view.onEvent((event) => events.push(event)));

  let gameTime = 0;
  let platformPaused = false;
  let stalledFor = 0;
  let lastTick = -1;
  if (options.lifecycle !== undefined) {
    unsubscribers.push(
      options.lifecycle.on('pause', () => {
        platformPaused = true;
      }),
      options.lifecycle.on('resume', () => {
        platformPaused = false;
      }),
    );
  }
  const stallLimit = view.role === 'host' ? settings.pause.stallSecondsHost : settings.pause.stallSecondsGuest;

  const audioObject: GameAudioWithStats = {
    async load(onProgress) {
      const ctx = host.context;
      const e = new AudioEngine({
        host,
        catalogue,
        settings,
        map: view.map,
        random,
        decode: (file) => audio.load(urlOf(file, options.url)),
        warn,
      });
      engine = e;
      brain = new AudioBrain({ catalogue, settings, content: view.content, map: view.map, random });
      if (ctx.sampleRate !== catalogue.sampleRate) {
        options.log?.info('son: le contexte audio rééchantillonne', { context: ctx.sampleRate, files: catalogue.sampleRate });
      }
      await e.loadResident(onProgress);
    },

    frame(dt) {
      const e = engine;
      const b = brain;
      if (e === null || b === null) return;
      const world = view.world();
      // Sans les événements de la plateforme: chez l'hôte, un monde qui ne bouge plus est en pause.
      if (options.lifecycle === undefined && view.role === 'host') {
        stalledFor = world.tick === lastTick ? stalledFor + dt : 0;
        lastTick = world.tick;
      }
      const paused = platformPaused || stalledFor > stallLimit;
      e.setPaused(paused);
      if (paused) {
        events.length = 0;
        uiShots.length = 0;
        return;
      }
      gameTime += dt;
      const frame = b.update({
        world,
        local: view.localCharacter(),
        events,
        dt,
        alpha: view.alpha(),
        gameTime,
        musicTime: host.context.currentTime,
        yaw: options.cameraYaw?.() ?? settings.listener.defaultYaw,
      });
      events.length = 0;
      if (uiShots.length > 0) {
        frame.shots.push(...uiShots);
        uiShots.length = 0;
      }
      e.apply(frame);
    },

    ui(id) {
      // Un son inconnu du catalogue est ignoré: l'interface ne doit jamais casser le son.
      if (!catalogue.sounds.has(id) || uiShots.length >= settings.interface.maxQueued) return;
      uiShots.push({ sound: id, at: null, gainDb: 0, delay: 0, offset: 0, tag: null });
    },

    stats() {
      const base: EngineStats = engine?.stats() ?? { decodedMB: 0, peakMB: 0, files: 0, voices: 0, musicTracks: 0, ambienceBeds: 0, refused: 0, pending: 0 };
      const director = brain?.musicDirector() ?? null;
      return {
        ...base,
        music: director?.current() ?? null,
        resting: director?.resting() ?? false,
        paused: platformPaused || stalledFor > stallLimit,
        context: host.context.state,
      };
    },

    dispose() {
      for (const off of unsubscribers.splice(0)) off();
      events.length = 0;
      engine?.dispose();
      engine = null;
      brain = null;
      if (import.meta.env.DEV) delete window.lplAudio;
    },
  };
  if (import.meta.env.DEV) window.lplAudio = { stats: () => audioObject.stats() };
  return audioObject;
}

// Contrôle à la compilation: `createAudio` respecte le contrat de `etat/vue.ts`.
createAudio satisfies CreateAudio;
