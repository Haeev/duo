/**
 * Banc du son (outil de développement, pas le jeu): fait tourner le vrai
 * moteur (`moteur.ts`) et le vrai cerveau (`cerveau.ts`) dans un
 * `OfflineAudioContext` de Chromium, piloté pas à pas par la vraie simulation
 * et le robot. Chaque bus du SDK sort sur ses propres voies (musique 1-2,
 * effets 3-4, interface 5-6): on mesure ce qui sonne, quand, et à quel niveau.
 *
 * Page: `/src/audio/banc/index.html` du serveur de Vite du jeu; Playwright
 * appelle `window.lplAudioBanc.run(scénario)`.
 */
import type { AudioBus } from '@duo/sdk';
import { createRandom } from '@duo/sdk/sim';
import soundsFile from '../../../assets/son/sons.json';
import type { AuthoredIntent } from '../../etat/actions';
import { loadContent } from '../../donnees/contenu';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { loadMap } from '../../donnees/carte';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import { SIM_DT } from '../../simulation/constantes';
import type { Sim } from '../../simulation/contexte';
import { createWorld } from '../../simulation/monde';
import { step } from '../../simulation/pas';
import { createRobot } from '../../simulation/robot';
import { AudioBrain, type BrainFrame } from '../cerveau';
import { parseCatalogue } from '../catalogue';
import { AudioEngine, type EngineStats } from '../moteur';
import { AUDIO_SETTINGS } from '../reglages';

const URLS = import.meta.glob<string>('../../../assets/son/**/*.ogg', { query: '?url', import: 'default', eager: true });
const PREFIX = '../../../assets/son/';
const RATE = 48000;
const WINDOW_SECONDS = 0.05;
const BUSES: readonly AudioBus[] = ['music', 'effects', 'interface'];
const SCREEN_DWELL_SECONDS = 8;
const SCREEN_INTENTS = new Set(['create_character', 'start_day', 'night_choice']);

export type Scenario = 'arrivee' | 'depart' | 'matin' | 'pluie' | 'boucle' | 'nuit' | 'interieur';

export interface BancResult {
  scenario: Scenario;
  seconds: number;
  /** Niveau RMS (dBFS) de chaque bus par fenêtre de 50 ms. */
  envelopes: Record<AudioBus, number[]>;
  shots: { t: number; sound: string; placed: boolean }[];
  music: { t: number; kind: string; id: string }[];
  stats: EngineStats;
  warnings: string[];
  listener: { x: number; y: number; inHouse: boolean };
  /** Contrôle de la boucle (scénario `boucle`): écart au fichier de part et d'autre du raccord. */
  seam: { beforeError: number; afterError: number; afterCorrelation: number } | null;
  /** Mélange stéréo 16 bits (base64), pour l'écoute. */
  mixBase64: string | null;
}

declare global {
  interface Window {
    lplAudioBanc?: { ready: boolean; run(scenario: Scenario, withMix: boolean): Promise<BancResult> };
  }
}

const content = loadContent(CONTENT_FILES);
const map = loadMap(MAP_FILES).map;
const catalogue = parseCatalogue(soundsFile);

function fastForward(until: (sim: Sim) => boolean): Sim {
  const sim = createWorld(content, map, 20261031, [
    { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
    { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
  ]);
  const robot = createRobot();
  let guard = 0;
  while (!until(sim) && guard < 30 * 60 * 120) {
    step(sim, robot.decide(sim));
    guard += 1;
  }
  return sim;
}

function dwellingRobot(): (sim: Sim, t: number) => { controls: ReturnType<ReturnType<typeof createRobot>['decide']>['controls']; intents: AuthoredIntent[] } {
  const robot = createRobot();
  let screen = '';
  let since = 0;
  return (sim, t) => {
    const decision = robot.decide(sim);
    const me = sim.world.characters.find((c) => c.id === 'p1');
    const now = `${sim.world.phase}:${me?.status ?? ''}:${sim.world.clock.day}`;
    if (now !== screen) {
      screen = now;
      since = t;
    }
    if (t - since < SCREEN_DWELL_SECONDS) decision.intents = decision.intents.filter((a) => !SCREEN_INTENTS.has(a.intent.type));
    return decision;
  };
}

interface Setup {
  sim: Sim | null;
  seconds: number;
  /** Image synthétique (sans simulation), pour le contrôle de la boucle, de l'intérieur et de la pause. */
  synthetic?: (frame: BrainFrame, index: number, engine: AudioEngine) => void;
}

function setupOf(scenario: Scenario): Setup {
  switch (scenario) {
    case 'arrivee':
      return { sim: fastForward((s) => s.world.clock.day === 8 && s.world.phase === 'day' && s.world.clock.minutes >= 9 * 60 + 15), seconds: 52 };
    case 'depart':
      return { sim: fastForward((s) => s.world.clock.day === 8 && s.world.clock.minutes >= 15 * 60 + 40), seconds: 34 };
    case 'matin':
      return { sim: fastForward((s) => s.world.clock.day === 2 && s.world.phase === 'night'), seconds: 24 };
    case 'nuit':
      return { sim: fastForward((s) => s.world.clock.day === 3 && s.world.clock.minutes >= 19 * 60 && s.world.characters.every((c) => c.inHouse)), seconds: 30 };
    case 'pluie':
      return { sim: fastForward((s) => s.world.clock.day === 4 && s.world.phase === 'day' && s.world.clock.minutes >= 8 * 60), seconds: 30 };
    case 'interieur':
      // Vent dehors 0 à 3 s, dans la maisonnette 3 à 6 s, dehors ensuite; pause de la plateforme de 8 à 10 s.
      return {
        sim: null,
        seconds: 12,
        synthetic: (frame, index, engine) => {
          const t = index * SIM_DT;
          frame.ambience.set('wind', 1);
          frame.ambienceNeeded.add('wind');
          frame.listener.inHouse = t >= 3 && t < 6;
          frame.music = index === 0 ? [{ kind: 'start', id: 'halte-matin', offset: 10, fadeIn: 0, at: 0 }] : [];
          engine.setPaused(t >= 8 && t < 10);
        },
      };
    case 'boucle':
      return {
        sim: null,
        seconds: 10,
        synthetic: (frame, index) => {
          if (index === 0) frame.music = [{ kind: 'start', id: 'halte-matin', offset: 90, fadeIn: 0, at: 0 }];
          else frame.music = [];
        },
      };
  }
}

function emptyFrame(): BrainFrame {
  return {
    listener: { at: { x: 30, y: 25 }, ear: { x: 30, y: 25 }, yaw: AUDIO_SETTINGS.listener.defaultYaw, inHouse: false },
    shots: [],
    loops: [],
    music: [],
    ambience: new Map(),
    ambienceNeeded: new Set(),
    syncs: [],
    trainDay: false,
    bed: null,
    timeline: { arrival: null, departure: null },
  };
}

function rmsDb(data: Float32Array[], from: number, to: number): number {
  let sum = 0;
  let n = 0;
  for (const channel of data) {
    for (let i = from; i < to && i < channel.length; i += 1) {
      const v = channel[i] ?? 0;
      sum += v * v;
      n += 1;
    }
  }
  const rms = n === 0 ? 0 : Math.sqrt(sum / n);
  return rms <= 1e-9 ? -120 : 20 * Math.log10(rms);
}

function toBase64Mix(buffer: AudioBuffer): string {
  const length = buffer.length;
  const pcm = new Int16Array(length * 2);
  const ch = (i: number): Float32Array => buffer.getChannelData(i);
  const [m0, m1, e0, e1, u0, u1] = [ch(0), ch(1), ch(2), ch(3), ch(4), ch(5)];
  for (let i = 0; i < length; i += 1) {
    const l = (m0[i] ?? 0) + (e0[i] ?? 0) + (u0[i] ?? 0);
    const r = (m1[i] ?? 0) + (e1[i] ?? 0) + (u1[i] ?? 0);
    pcm[i * 2] = Math.max(-32768, Math.min(32767, Math.round(l * 32767)));
    pcm[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(r * 32767)));
  }
  const bytes = new Uint8Array(pcm.buffer);
  let text = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(text);
}

async function run(scenario: Scenario, withMix: boolean): Promise<BancResult> {
  const setup = setupOf(scenario);
  const ctx = new OfflineAudioContext({ numberOfChannels: 6, length: Math.ceil(setup.seconds * RATE), sampleRate: RATE });
  ctx.destination.channelInterpretation = 'discrete';
  const merger = ctx.createChannelMerger(6);
  merger.connect(ctx.destination);
  const buses = new Map<AudioBus, GainNode>();
  BUSES.forEach((name, i) => {
    const bus = ctx.createGain();
    const split = ctx.createChannelSplitter(2);
    bus.connect(split);
    split.connect(merger, 0, i * 2);
    split.connect(merger, 1, i * 2 + 1);
    buses.set(name, bus);
  });
  const warnings: string[] = [];
  const random = createRandom(7);
  const engine = new AudioEngine({
    host: {
      context: ctx,
      bus: (name) => {
        const bus = buses.get(name);
        if (bus === undefined) throw new Error(`bus ${name}`);
        return bus;
      },
    },
    catalogue,
    settings: AUDIO_SETTINGS,
    map,
    random,
    decode: async (file) => {
      const url = URLS[`${PREFIX}${file}`];
      if (url === undefined) throw new Error(`fichier absent: ${file}`);
      const response = await fetch(url);
      return ctx.decodeAudioData(await response.arrayBuffer());
    },
    warn: (message, data) => warnings.push(`${message} ${JSON.stringify(data)}`),
    live: () => true,
  });
  await engine.loadResident(() => undefined);
  const brain = new AudioBrain({ catalogue, settings: AUDIO_SETTINGS, content, map, random });
  const sim = setup.sim;
  const decide = dwellingRobot();
  const shots: BancResult['shots'] = [];
  const music: BancResult['music'] = [];
  const frames = Math.floor(setup.seconds / SIM_DT) - 1;
  let gameTime = 0;
  let lastFrame: BrainFrame = emptyFrame();
  const frameAt = async (index: number): Promise<void> => {
    let frame: BrainFrame;
    if (sim === null) {
      frame = emptyFrame();
      setup.synthetic?.(frame, index, engine);
    } else {
      if (index > 0) step(sim, decide(sim, gameTime));
      frame = brain.update({
        world: sim.world,
        local: 'p1',
        events: index > 0 ? sim.events : [],
        dt: SIM_DT,
        alpha: 1,
        gameTime,
        musicTime: ctx.currentTime,
        yaw: AUDIO_SETTINGS.listener.defaultYaw,
      });
    }
    const t = ctx.currentTime;
    for (const s of frame.shots) shots.push({ t, sound: s.sound, placed: s.at !== null });
    for (const c of frame.music) music.push({ t, kind: c.kind, id: c.id });
    engine.apply(frame);
    lastFrame = frame;
    gameTime += SIM_DT;
    // Le décodage prend du temps réel: le rendu attend, comme si le tampon était prêt à temps.
    let waited = 0;
    while (engine.stats().pending > 0 && waited < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      waited += 5;
    }
  };
  await frameAt(0);
  for (let i = 1; i <= frames; i += 1) {
    const index = i;
    void ctx.suspend(i * SIM_DT).then(async () => {
      await frameAt(index);
      await ctx.resume();
    });
  }
  const rendered = await ctx.startRendering();
  const stats = engine.stats();
  const data = (i: number): Float32Array => rendered.getChannelData(i);
  const windowLength = Math.round(WINDOW_SECONDS * RATE);
  const envelopes = { music: [] as number[], effects: [] as number[], interface: [] as number[] };
  BUSES.forEach((name, b) => {
    const channels = [data(b * 2), data(b * 2 + 1)];
    for (let from = 0; from < rendered.length; from += windowLength) envelopes[name].push(rmsDb(channels, from, from + windowLength));
  });
  let seam: BancResult['seam'] = null;
  if (scenario === 'boucle') seam = await checkSeam(ctx, rendered);
  const mixBase64 = withMix ? toBase64Mix(rendered) : null;
  engine.dispose();
  return {
    scenario,
    seconds: setup.seconds,
    envelopes,
    shots,
    music,
    stats,
    warnings,
    listener: { x: lastFrame.listener.at.x, y: lastFrame.listener.at.y, inHouse: lastFrame.listener.inHouse },
    seam,
    mixBase64,
  };
}

/** La musique part à 90 s du fichier: le raccord (97 s) tombe à 7 s du rendu, où l'on doit retrouver 1 s du fichier. */
async function checkSeam(ctx: BaseAudioContext, rendered: AudioBuffer): Promise<BancResult['seam']> {
  const def = catalogue.music.get('halte-matin');
  const url = URLS[`${PREFIX}musique/halte-matin.ogg`];
  if (def === undefined || def.loop === null || url === undefined) return null;
  const source = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
  const gain = Math.pow(10, def.volumeDb / 20);
  const startOffset = 90;
  const seamAt = def.loop.end - startOffset;
  const span = Math.round(0.5 * RATE);
  const compare = (renderFrom: number, fileFrom: number): { error: number; correlation: number } => {
    const r = rendered.getChannelData(0);
    const f = source.getChannelData(0);
    let err = 0;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    const r0 = Math.round(renderFrom * RATE);
    const f0 = Math.round(fileFrom * RATE);
    for (let i = 0; i < span; i += 1) {
      const x = r[r0 + i] ?? 0;
      const y = (f[f0 + i] ?? 0) * gain;
      err = Math.max(err, Math.abs(x - y));
      sxy += x * y;
      sxx += x * x;
      syy += y * y;
    }
    return { error: err, correlation: sxy / Math.sqrt(Math.max(1e-12, sxx * syy)) };
  };
  const before = compare(seamAt - 0.6, def.loop.end - 0.6);
  const after = compare(seamAt + 0.05, def.loop.start + 0.05);
  return { beforeError: before.error, afterError: after.error, afterCorrelation: after.correlation };
}

window.lplAudioBanc = { ready: true, run };
const status = document.getElementById('statut');
if (status !== null) status.textContent = 'Prêt: window.lplAudioBanc.run("arrivee").';
