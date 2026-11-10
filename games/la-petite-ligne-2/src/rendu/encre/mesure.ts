/**
 * Rendu encré: outil de mesure (ADR 0023, point 12). Cette moitié est pure (ni WebGL ni page): le
 * journal des durées d'image, les compteurs par passe et le relevé en texte que le joueur colle
 * au studio. `panneau-mesure.ts` tient le panneau, les chronomètres du processeur graphique et la
 * lecture de la machine. Aucune donnée personnelle: ni nom, ni chemin, ni adresse, ni partie.
 */
import { INK_SETTINGS } from './reglages';

/** Les passes d'une image, dans l'ordre où elles se dessinent. */
export const PASSES = ['ombre du soleil', 'ombre de la lampe', 'scène', 'contour'] as const;
export type PassIndex = 0 | 1 | 2 | 3;

export interface PassCount {
  calls: number;
  triangles: number;
  /** Points de la cible de la passe (largeur x hauteur); 0: passe sautée. */
  pixels: number;
  /** Temps sur le processeur graphique (ms, moyenne glissante); -1: non mesuré. */
  gpuMs: number;
}

/** Ce que la machine dit d'elle-même (lu une fois par `panneau-mesure.ts`). */
export interface MachineInfo {
  readonly gpu: string;
  readonly gpuVendor: string;
  readonly browser: string;
  readonly platform: string;
  readonly timerQuery: boolean;
  /** Attributs du contexte WebGL et espace de couleur du tampon du canevas. */
  readonly canvasColorSpace: string;
  readonly outputColorSpace: string;
  readonly toneMapping: string;
  readonly alpha: boolean;
  readonly premultipliedAlpha: boolean;
  readonly antialias: boolean;
  readonly samples: number;
  /** Écran: gamme (`srgb`, `p3`, `rec2020`), plage dynamique, bits par point, taille en points CSS. */
  readonly gamut: string;
  readonly highDynamicRange: boolean;
  readonly colorDepth: number;
  readonly forcedColors: boolean;
  readonly screen: string;
}

/** L'état du rendu à l'instant du relevé (donné par `InkKit`). */
export interface RenderSnapshot {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly pixelRatio: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly scale: number;
  readonly scaleMode: 'auto' | 'figée';
  readonly scaleChanges: number;
  readonly programs: number;
  readonly textures: number;
  readonly geometries: number;
  readonly textureMegabytes: number;
  /** Heure du jeu (minutes depuis minuit), fiche d'ambiance, dedans ou dehors. */
  readonly minutes: number;
  readonly sheet: string | null;
  readonly indoor: boolean;
  /** Mire de couleurs: tons attendus et relus (0 à 255), ou `null` si elle n'a pas été passée. */
  readonly chart: { readonly expected: readonly number[]; readonly read: readonly number[] } | null;
}

export interface FrameSummary {
  readonly frames: number;
  readonly seconds: number;
  readonly averageFps: number;
  readonly averageMs: number;
  /** Durée au 99e centile (ms) et images par seconde correspondantes (le « premier centile »). */
  readonly p99Ms: number;
  readonly lowFps: number;
  readonly worstMs: number;
  /** Part des images plus longues que le budget (30 images par seconde). */
  readonly overBudgetShare: number;
  /** Temps du jeu sur le processeur pour dessiner une image (ms, moyenne). */
  readonly cpuMs: number;
}

const one = (value: number): string => (Math.round(value * 10) / 10).toFixed(1).replace('.', ',');
const whole = (value: number): string => String(Math.round(value));
const thousands = (value: number): string =>
  String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Journal des durées d'image: un histogramme à cases fixes (aucune allocation par image, durée
 * d'enregistrement libre) et les compteurs de chaque passe.
 */
export class FrameLog {
  private readonly bins: Uint32Array;
  private readonly binMs: number;
  private frames = 0;
  private totalMs = 0;
  private worst = 0;
  private over = 0;
  private cpuTotal = 0;
  /** Dernière image: compteurs par passe; `peak`: le plus haut total vu depuis la remise à zéro. */
  readonly passes: PassCount[] = PASSES.map(() => ({
    calls: 0,
    triangles: 0,
    pixels: 0,
    gpuMs: -1,
  }));
  readonly peak = { calls: 0, triangles: 0 };
  /** Changements d'échelle depuis la remise à zéro: seconde de l'enregistrement et échelle. */
  readonly scaleLog: { at: number; scale: number }[] = [];

  constructor(
    settings: typeof INK_SETTINGS.meter = INK_SETTINGS.meter,
    private readonly budgetMs: number = INK_SETTINGS.resolution.budgetMs,
    private readonly ignoreMs: number = settings.ignoreFrameMs,
  ) {
    this.bins = new Uint32Array(settings.bins);
    this.binMs = settings.binMs;
  }

  reset(): void {
    this.bins.fill(0);
    this.frames = 0;
    this.totalMs = 0;
    this.worst = 0;
    this.over = 0;
    this.cpuTotal = 0;
    this.peak.calls = 0;
    this.peak.triangles = 0;
    this.scaleLog.length = 0;
  }

  /** Une image: écart avec la précédente et temps passé à la dessiner (ms). */
  add(dtMs: number, cpuMs: number): void {
    // Fenêtre cachée, chargement: ces écarts ne disent rien du rendu.
    if (!(dtMs > 0) || dtMs > this.ignoreMs) return;
    const bin = Math.min(this.bins.length - 1, Math.floor(dtMs / this.binMs));
    this.bins[bin] = (this.bins[bin] ?? 0) + 1;
    this.frames += 1;
    this.totalMs += dtMs;
    this.cpuTotal += cpuMs;
    if (dtMs > this.worst) this.worst = dtMs;
    if (dtMs > this.budgetMs * 1.02) this.over += 1;
    let calls = 0;
    let triangles = 0;
    for (const pass of this.passes) {
      calls += pass.calls;
      triangles += pass.triangles;
    }
    if (calls > this.peak.calls) this.peak.calls = calls;
    if (triangles > this.peak.triangles) this.peak.triangles = triangles;
  }

  noteScale(scale: number): void {
    if (this.scaleLog.length < 40)
      this.scaleLog.push({ at: Math.round(this.totalMs / 1000), scale });
  }

  /** Durée sous laquelle passe la part `share` des images (ms), au milieu de sa case. */
  percentile(share: number): number {
    if (this.frames === 0) return 0;
    const wanted = Math.ceil(this.frames * share);
    let seen = 0;
    for (let i = 0; i < this.bins.length; i += 1) {
      seen += this.bins[i] ?? 0;
      if (seen >= wanted) return i === this.bins.length - 1 ? this.worst : (i + 0.5) * this.binMs;
    }
    return this.worst;
  }

  summary(): FrameSummary {
    const frames = this.frames;
    const averageMs = frames === 0 ? 0 : this.totalMs / frames;
    const p99Ms = this.percentile(0.99);
    return {
      frames,
      seconds: this.totalMs / 1000,
      averageFps: averageMs > 0 ? 1000 / averageMs : 0,
      averageMs,
      p99Ms,
      lowFps: p99Ms > 0 ? 1000 / p99Ms : 0,
      worstMs: this.worst,
      overBudgetShare: frames === 0 ? 0 : this.over / frames,
      cpuMs: frames === 0 ? 0 : this.cpuTotal / frames,
    };
  }
}

/** Heure du jeu lisible (« 17 h 05 »). */
export function gameHour(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60))} h ${String(m % 60).padStart(2, '0')}`;
}

/** Lignes courtes du panneau (rafraîchies deux fois par seconde). */
export function liveLines(log: FrameLog, snap: RenderSnapshot): string[] {
  const s = log.summary();
  const lines = [
    `${one(s.averageFps)} i/s en moyenne, ${one(s.lowFps)} au premier centile (${whole(s.seconds)} s)`,
    `image: ${one(s.averageMs)} ms, pire ${one(s.worstMs)} ms, jeu ${one(s.cpuMs)} ms`,
    `échelle ${whole(snap.scale * 100)} % (${snap.scaleMode}), ${String(snap.innerWidth)} x ${String(snap.innerHeight)} dans ${String(snap.canvasWidth)} x ${String(snap.canvasHeight)}`,
  ];
  log.passes.forEach((pass, i) => {
    const gpu = pass.gpuMs < 0 ? '' : `, ${one(pass.gpuMs)} ms`;
    lines.push(
      pass.pixels === 0
        ? `${PASSES[i] ?? ''}: sautée`
        : `${PASSES[i] ?? ''}: ${String(pass.calls)} appels, ${thousands(pass.triangles)} tri.${gpu}`,
    );
  });
  lines.push(`${String(snap.programs)} programmes, ${gameHour(snap.minutes)} au jeu`);
  return lines;
}

/** Le relevé complet, en texte, à coller au studio. */
export function reportText(log: FrameLog, snap: RenderSnapshot, machine: MachineInfo): string {
  const s = log.summary();
  const budget = INK_SETTINGS.budget;
  const lines = [
    'RELEVÉ DE RENDU: La Petite Ligne (rendu encré)',
    `Durée: ${whole(s.seconds)} s, ${String(s.frames)} images`,
    `Images par seconde: ${one(s.averageFps)} en moyenne, ${one(s.lowFps)} au premier centile`,
    `Temps par image: ${one(s.averageMs)} ms en moyenne, ${one(s.p99Ms)} ms au 99e centile, pire ${one(s.worstMs)} ms`,
    `Images sous 30 par seconde: ${one(s.overBudgetShare * 100)} %`,
    `Temps du jeu pour dessiner (processeur): ${one(s.cpuMs)} ms par image`,
    `Échelle interne: ${whole(snap.scale * 100)} % (${snap.scaleMode}), ${String(snap.scaleChanges)} changements`,
  ];
  if (log.scaleLog.length > 0)
    lines.push(
      `Paliers: ${log.scaleLog.map((c) => `${String(c.at)} s: ${whole(c.scale * 100)} %`).join(', ')}`,
    );
  lines.push(
    `Tampon: canevas ${String(snap.canvasWidth)} x ${String(snap.canvasHeight)}, interne ${String(snap.innerWidth)} x ${String(snap.innerHeight)}`,
    `Fenêtre: ${whole(snap.cssWidth)} x ${whole(snap.cssHeight)} points, rapport de pixels ${String(Math.round(snap.pixelRatio * 100) / 100).replace('.', ',')}`,
    'Passes (dernière image):',
  );
  let calls = 0;
  let triangles = 0;
  log.passes.forEach((pass, i) => {
    calls += pass.calls;
    triangles += pass.triangles;
    const gpu = pass.gpuMs < 0 ? 'non mesuré' : `${one(pass.gpuMs)} ms`;
    lines.push(
      pass.pixels === 0
        ? `  ${PASSES[i] ?? ''}: sautée`
        : `  ${PASSES[i] ?? ''}: ${String(pass.calls)} appels, ${thousands(pass.triangles)} triangles, ${thousands(pass.pixels)} points, processeur graphique ${gpu}`,
    );
  });
  lines.push(
    `Total: ${String(calls)} appels (budget ${String(budget.calls)}), ${thousands(triangles)} triangles (budget ${thousands(budget.triangles)}); pics ${String(log.peak.calls)} et ${thousands(log.peak.triangles)}`,
    `Programmes: ${String(snap.programs)} (budget ${String(budget.programs)}), textures ${String(snap.textures)}, géométries ${String(snap.geometries)}, mémoire de l'encre ${whole(snap.textureMegabytes)} Mo`,
    `Jeu: ${gameHour(snap.minutes)}, ambiance ${snap.sheet ?? 'defaut'}, ${snap.indoor ? 'dedans' : 'dehors'}`,
    `Processeur graphique: ${machine.gpu === '' ? 'inconnu' : machine.gpu}${machine.gpuVendor === '' ? '' : ` (${machine.gpuVendor})`}`,
    `Chronomètre du processeur graphique: ${machine.timerQuery ? 'oui' : 'non (EXT_disjoint_timer_query_webgl2 absent)'}`,
    `Navigateur: ${machine.browser}, ${machine.platform}`,
    `Canevas: espace ${machine.canvasColorSpace}, sortie ${machine.outputColorSpace}, mappage tonal ${machine.toneMapping}, alpha ${machine.alpha ? 'oui' : 'non'}, prémultiplié ${machine.premultipliedAlpha ? 'oui' : 'non'}, anticrénelage ${machine.antialias ? `oui (${String(machine.samples)})` : 'non'}`,
    `Écran: ${machine.screen} points, gamme ${machine.gamut}, plage dynamique ${machine.highDynamicRange ? 'haute (HDR)' : 'standard'}, ${String(machine.colorDepth)} bits par point, couleurs forcées ${machine.forcedColors ? 'oui' : 'non'}`,
  );
  if (snap.chart === null) lines.push('Mire de couleurs: non passée');
  else {
    const { expected, read } = snap.chart;
    let worst = 0;
    expected.forEach((value, i) => {
      worst = Math.max(worst, Math.abs(value - (read[i] ?? 0)));
    });
    lines.push(
      `Mire de couleurs: écart maximal ${String(worst)} sur 255 (${worst <= 1 ? 'conforme' : 'ÉCART'})`,
      `  attendu ${expected.join(' ')}`,
      `  relu    ${read.join(' ')}`,
    );
  }
  return lines.join('\n');
}
