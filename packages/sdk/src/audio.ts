// Module `audio`: un AudioContext, trois bus; gain effectif = volume général x volume du bus (H-22).
import type { Volumes } from '@duo/protocol';
import type { Audio, AudioBus, PlayingSound, PlayOptions } from './api';

export interface AudioInternal extends Audio {
  setVolumes(volumes: Volumes): void;
  dispose(): void;
}

interface Graph {
  readonly context: AudioContext;
  readonly master: GainNode;
  readonly buses: Readonly<Record<AudioBus, GainNode>>;
}

export function createAudio(initial: Volumes, resolveUrl: (path: string) => string): AudioInternal {
  let volumes = initial;
  let graph: Graph | null = null;
  const musics = new Set<HTMLAudioElement>();

  const applyVolumes = (g: Graph): void => {
    const t = g.context.currentTime;
    g.master.gain.setTargetAtTime(volumes.master, t, 0.02);
    g.buses.music.gain.setTargetAtTime(volumes.music, t, 0.02);
    g.buses.effects.gain.setTargetAtTime(volumes.effects, t, 0.02);
    g.buses.interface.gain.setTargetAtTime(volumes.interface, t, 0.02);
  };

  // Le navigateur garde le contexte suspendu jusqu'au premier geste du joueur.
  const unlock = (): void => {
    if (graph === null) return;
    void graph.context.resume();
    for (const music of musics) {
      if (music.paused) void music.play().catch(() => undefined);
    }
  };

  const ensure = (): Graph => {
    if (graph !== null) return graph;
    const context = new AudioContext();
    const master = context.createGain();
    master.connect(context.destination);
    const makeBus = (): GainNode => {
      const bus = context.createGain();
      bus.connect(master);
      return bus;
    };
    graph = {
      context,
      master,
      buses: { music: makeBus(), effects: makeBus(), interface: makeBus() },
    };
    master.gain.value = volumes.master;
    graph.buses.music.gain.value = volumes.music;
    graph.buses.effects.gain.value = volumes.effects;
    graph.buses.interface.gain.value = volumes.interface;
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return graph;
  };

  const fadeAndStop = (gain: GainNode, fadeOutMs: number, end: () => void): void => {
    const context = gain.context;
    if (fadeOutMs <= 0) {
      end();
      return;
    }
    const t = context.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + fadeOutMs / 1000);
    setTimeout(end, fadeOutMs + 20);
  };

  return {
    get context() {
      return ensure().context;
    },
    bus(name) {
      return ensure().buses[name];
    },
    async load(path) {
      const g = ensure();
      const response = await fetch(resolveUrl(path));
      if (!response.ok) {
        throw new Error(`audio: ${path} introuvable (${response.status})`);
      }
      return g.context.decodeAudioData(await response.arrayBuffer());
    },
    play(buffer, options: PlayOptions = {}): PlayingSound {
      const g = ensure();
      const source = g.context.createBufferSource();
      source.buffer = buffer;
      source.loop = options.loop ?? false;
      source.playbackRate.value = options.rate ?? 1;
      const gain = g.context.createGain();
      gain.gain.value = options.volume ?? 1;
      source.connect(gain);
      gain.connect(g.buses[options.bus ?? 'effects']);
      const ended = new Promise<void>((resolve) => {
        source.onended = () => {
          source.disconnect();
          gain.disconnect();
          resolve();
        };
      });
      source.start();
      return {
        ended,
        stop(fadeOutMs = 0) {
          fadeAndStop(gain, fadeOutMs, () => {
            try {
              source.stop();
            } catch {
              // Déjà arrêté.
            }
          });
        },
      };
    },
    playMusic(path, options = {}): PlayingSound {
      const g = ensure();
      const element = new Audio(resolveUrl(path));
      element.loop = options.loop ?? true;
      element.playbackRate = options.rate ?? 1;
      const source = g.context.createMediaElementSource(element);
      const gain = g.context.createGain();
      const volume = options.volume ?? 1;
      const fadeInMs = options.fadeInMs ?? 0;
      if (fadeInMs > 0) {
        gain.gain.setValueAtTime(0, g.context.currentTime);
        gain.gain.linearRampToValueAtTime(volume, g.context.currentTime + fadeInMs / 1000);
      } else {
        gain.gain.value = volume;
      }
      source.connect(gain);
      gain.connect(g.buses[options.bus ?? 'music']);
      musics.add(element);
      let resolveEnded: () => void = () => undefined;
      const ended = new Promise<void>((resolve) => {
        resolveEnded = resolve;
      });
      const finish = (): void => {
        element.pause();
        musics.delete(element);
        source.disconnect();
        gain.disconnect();
        element.removeAttribute('src');
        element.load();
        resolveEnded();
      };
      element.addEventListener('ended', finish, { once: true });
      void element.play().catch(() => undefined);
      return {
        ended,
        stop(fadeOutMs = 0) {
          fadeAndStop(gain, fadeOutMs, finish);
        },
      };
    },
    setVolumes(next) {
      volumes = next;
      if (graph !== null) applyVolumes(graph);
    },
    dispose() {
      if (graph === null) return;
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      for (const music of musics) {
        music.pause();
        music.removeAttribute('src');
      }
      musics.clear();
      void graph.context.close();
      graph = null;
    },
  };
}
