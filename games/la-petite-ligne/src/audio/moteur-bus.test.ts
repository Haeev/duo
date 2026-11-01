/**
 * Bus musique pour un son (son.md, question S3): un motif accordé des moments ou des saisons
 * (`star-chime-*`, `glow-shimmer`, `mist-lift`, `season-turn-*`) passe par le réglage Musique du
 * joueur, mais après les atténuations de la musique: la descente de l'apogée (`momentDuck`) ne le
 * baisse pas. Contrôlé sur le vrai moteur, avec un faux contexte Web Audio qui note les branchements.
 */
import { describe, expect, it } from 'vitest';
import type { AudioBus } from '@duo/sdk';
import { createRandom } from '@duo/sdk/sim';
import soundsFile from '../../assets/son/sons.json';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import type { BrainFrame } from './cerveau';
import { parseCatalogue } from './catalogue';
import type { SoundRequest } from './declencheurs';
import { AudioEngine } from './moteur';
import { AUDIO_SETTINGS, dbToGain } from './reglages';

class FakeParam {
  value = 1;
  readonly targets: number[] = [];
  setTargetAtTime(v: number): this {
    this.targets.push(v);
    this.value = v;
    return this;
  }
  setValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime(v: number): this {
    this.value = v;
    return this;
  }
  cancelScheduledValues(): this {
    return this;
  }
}

/** Un nœud qui accepte tout ce que le moteur règle, et note où il est branché. */
class FakeNode {
  readonly out: FakeNode[] = [];
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
  readonly playbackRate = new FakeParam();
  readonly positionX = new FakeParam();
  readonly positionY = new FakeParam();
  readonly positionZ = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  constructor(readonly label: string) {}
  connect(node: FakeNode): FakeNode {
    this.out.push(node);
    return node;
  }
  disconnect(): void {
    this.out.length = 0;
  }
  started = 0;
  start(): void {
    this.started += 1;
  }
  stop(): void {
    this.onended = null;
  }
}

class FakeContext {
  readonly sampleRate = 48000;
  readonly state = 'running';
  currentTime = 0;
  readonly sources: FakeNode[] = [];
  readonly listener = {
    positionX: new FakeParam(),
    positionY: new FakeParam(),
    positionZ: new FakeParam(),
    forwardX: new FakeParam(),
    forwardY: new FakeParam(),
    forwardZ: new FakeParam(),
    upX: new FakeParam(),
    upY: new FakeParam(),
    upZ: new FakeParam(),
  };
  createGain(): FakeNode {
    return new FakeNode('gain');
  }
  createDynamicsCompressor(): FakeNode {
    return new FakeNode('limiter');
  }
  createBiquadFilter(): FakeNode {
    return new FakeNode('filter');
  }
  createPanner(): FakeNode {
    return new FakeNode('panner');
  }
  createBufferSource(): FakeNode {
    const s = new FakeNode('source');
    this.sources.push(s);
    return s;
  }
}

/** Chemin d'un nœud jusqu'à un bus du SDK (premier branchement à chaque pas). */
function pathFrom(node: FakeNode): FakeNode[] {
  const path: FakeNode[] = [node];
  let current = node;
  while (current.out.length > 0 && path.length < 20) {
    const next = current.out[0];
    if (next === undefined) break;
    path.push(next);
    current = next;
  }
  return path;
}

function setup(): { ctx: FakeContext; engine: AudioEngine; buses: Map<AudioBus, FakeNode> } {
  const ctx = new FakeContext();
  const buses = new Map<AudioBus, FakeNode>();
  const catalogue = parseCatalogue(soundsFile);
  const engine = new AudioEngine({
    host: {
      // Faux contexte: seules les méthodes utilisées par le moteur existent (test du graphe).
      context: ctx as unknown as BaseAudioContext,
      bus: (name) => {
        const node = buses.get(name) ?? new FakeNode(`bus:${name}`);
        buses.set(name, node);
        return node as unknown as AudioNode;
      },
    },
    catalogue,
    settings: AUDIO_SETTINGS,
    map: loadMap(MAP_FILES).map,
    random: createRandom(7),
    decode: (file) => Promise.resolve({ length: 48000, numberOfChannels: 2, duration: 1, file } as unknown as AudioBuffer),
    warn: () => undefined,
    live: () => true,
  });
  return { ctx, engine, buses };
}

function frame(over: Partial<BrainFrame>): BrainFrame {
  return {
    listener: { at: { x: 0, y: 0 }, ear: { x: 0, y: 0 }, yaw: 0, inHouse: false },
    shots: [],
    loops: [],
    music: [],
    ambience: new Map(),
    ambienceNeeded: new Set(),
    syncs: [],
    trainDay: false,
    momentFiles: new Set(),
    momentDuck: { db: 0, attackSeconds: 0.5, releaseSeconds: 2 },
    bed: null,
    timeline: { arrival: null, departure: null },
    ...over,
  };
}

const shot = (sound: string): SoundRequest => ({ sound, at: null, gainDb: 0, delay: 0, offset: 0, tag: null });

describe('bus musique pour un son (S3)', () => {
  it('sons.json met les motifs accordés sur le bus musique', () => {
    const catalogue = parseCatalogue(soundsFile);
    const music = [...catalogue.sounds.values()].filter((s) => s.bus === 'music').map((s) => s.id).sort();
    expect(music).toEqual(
      [
        'glow-shimmer',
        'mist-lift',
        'season-turn-autumn',
        'season-turn-spring',
        'season-turn-summer',
        'season-turn-winter',
        'star-chime-1',
        'star-chime-2',
        'star-chime-3',
        'star-chime-4',
        'star-chime-5',
      ].sort(),
    );
  });

  it("une étoile filante sort sur le bus Musique, après la descente de l'apogée", async () => {
    const { ctx, engine, buses } = setup();
    const catalogue = parseCatalogue(soundsFile);
    const files = new Set(catalogue.sounds.get('star-chime-3')?.files ?? []);
    expect(files.size).toBe(1);
    // Le moment s'installe: ses fichiers se décodent; puis l'apogée descend la musique de 9 dB.
    engine.apply(frame({ momentFiles: files }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    engine.apply(frame({ momentFiles: files, momentDuck: { db: -9, attackSeconds: 0.5, releaseSeconds: 2 }, shots: [shot('star-chime-3')] }));
    const source = ctx.sources.at(-1);
    expect(source).toBeDefined();
    if (source === undefined) return;
    expect(source.started).toBe(1);
    const path = pathFrom(source);
    const musicBus = buses.get('music');
    expect(path.at(-1)).toBe(musicBus);
    // Source, gain de la voix, pause de la musique, bus: aucune atténuation entre les deux.
    expect(path.map((n) => n.label)).toEqual(['source', 'gain', 'gain', 'bus:music']);
    const ducked = path.filter((n) => n.gain.targets.some((v) => Math.abs(v - dbToGain(-9)) < 1e-9));
    expect(ducked).toEqual([]);
    engine.dispose();
  });

  it("le même instant, un son d'interface garde son limiteur et son bus", async () => {
    const { ctx, engine, buses } = setup();
    await engine.loadResident(() => undefined);
    engine.apply(frame({ shots: [shot('ui-confirm')] }));
    const source = ctx.sources.at(-1);
    expect(source).toBeDefined();
    if (source === undefined) return;
    const path = pathFrom(source);
    expect(path.at(-1)).toBe(buses.get('interface'));
    expect(path.map((n) => n.label)).toContain('limiter');
    engine.dispose();
  });
});
