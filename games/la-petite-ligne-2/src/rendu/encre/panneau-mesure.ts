/**
 * Rendu encré: panneau de l'outil de mesure (ADR 0023, point 12). Fermé, il ne coûte rien (un
 * test par passe). Ouvert par `F9`, `Ctrl + Maj + M` ou `?mesure=1`: il compte appels et
 * triangles de chaque passe, chronomètre le processeur graphique quand
 * `EXT_disjoint_timer_query_webgl2` existe, lit la machine (processeur graphique, écran, espace
 * de couleur) et copie un relevé en texte. Il n'écrit rien nulle part et ne lit rien de la partie.
 */
import type { WebGLRenderer } from 'three';
import {
  FrameLog,
  type FrameSummary,
  liveLines,
  type MachineInfo,
  type PassCount,
  type PassIndex,
  PASSES,
  type RenderSnapshot,
  type PageInfo,
  reportText,
} from './mesure';
import { INK_SETTINGS } from './reglages';

/** Ce que le panneau demande au rendu. */
export interface MeterHost {
  snapshot(): RenderSnapshot;
  /** Échelle suivante: adaptative, puis chaque palier figé. Rend le libellé du nouveau mode. */
  cycleScale(): string;
  /** Repasse la mire de couleurs à la prochaine image. */
  requestChart(): void;
  setScale(scale: number | null): void;
}

/** Ce que le banc de mesure lit dans la page (`?mesure=1` seulement). */
export interface MeterProbe {
  /** Clés des programmes compilés (lequel est de trop quand le budget est dépassé). */
  programs(): string[];
  snapshot(): RenderSnapshot;
  passes(): readonly PassCount[];
  summary(): FrameSummary;
  report(): string | null;
  setScale(scale: number | null): void;
}

interface TimerExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

const NS_PER_MS = 1e6;

function matches(query: string): boolean {
  return typeof matchMedia === 'function' && matchMedia(query).matches;
}

/** Lit la machine: rien de personnel (ni nom, ni chemin), seulement le matériel et l'affichage. */
export function readMachine(renderer: WebGLRenderer): MachineInfo {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const attributes = gl.getContextAttributes();
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const engines = [/Electron\/[\d.]+/.exec(agent)?.[0], /Chrome\/[\d.]+/.exec(agent)?.[0]];
  const platform = /Windows NT [\d.]+|Mac OS X [\d_.]+|Linux/.exec(agent)?.[0] ?? 'inconnue';
  return {
    gpu: info === null ? '' : String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)),
    gpuVendor: info === null ? '' : String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)),
    browser: engines.filter((e) => e !== undefined).join(' ') || 'inconnu',
    platform,
    timerQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null,
    canvasColorSpace: gl.drawingBufferColorSpace,
    outputColorSpace: renderer.outputColorSpace,
    toneMapping: renderer.toneMapping === 0 ? 'aucun' : `Three.js ${String(renderer.toneMapping)}`,
    alpha: attributes?.alpha ?? false,
    premultipliedAlpha: attributes?.premultipliedAlpha ?? false,
    antialias: attributes?.antialias ?? false,
    samples: Number(gl.getParameter(gl.SAMPLES)),
    gamut: matches('(color-gamut: rec2020)')
      ? 'rec2020'
      : matches('(color-gamut: p3)')
        ? 'p3'
        : matches('(color-gamut: srgb)')
          ? 'srgb'
          : 'sous srgb',
    highDynamicRange: matches('(dynamic-range: high)'),
    colorDepth: typeof screen === 'undefined' ? 0 : screen.colorDepth,
    forcedColors: matches('(forced-colors: active)'),
    screen:
      typeof screen === 'undefined' ? '?' : `${String(screen.width)} x ${String(screen.height)}`,
  };
}

export class InkMeter {
  readonly log = new FrameLog();
  /** Panneau ouvert: les passes sont comptées et chronométrées. */
  active = false;
  private host: MeterHost | null = null;
  private renderer: WebGLRenderer | null = null;
  private machine: MachineInfo | null = null;
  private timer: TimerExtension | null = null;
  private readonly queries: (WebGLQuery | null)[] = PASSES.map(() => null);
  private readonly waiting: boolean[] = PASSES.map(() => false);
  private running = -1;
  private calls = 0;
  private triangles = 0;
  private panel: HTMLElement | null = null;
  private lines: HTMLElement | null = null;
  private output: HTMLElement | null = null;
  private note: HTMLElement | null = null;
  private refreshed = 0;
  private readonly onKey = (event: KeyboardEvent): void => {
    const combo = event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'm';
    if (event.code !== INK_SETTINGS.meter.key && !combo) return;
    event.preventDefault();
    this.toggle();
  };

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKey);
    const asked = new URLSearchParams(window.location.search).get(INK_SETTINGS.meter.param);
    this.active = asked === '1';
  }

  /** Branche le panneau sur le rendu (une fois, à la première image). */
  attach(renderer: WebGLRenderer, host: MeterHost): void {
    if (this.renderer !== null) return;
    this.renderer = renderer;
    this.host = host;
    if (this.active) this.open();
  }

  toggle(): void {
    if (this.active) {
      this.active = false;
      this.panel?.remove();
      this.panel = null;
    } else {
      this.active = true;
      this.open();
    }
  }

  private open(): void {
    const renderer = this.renderer;
    if (renderer === null || this.panel !== null) return;
    this.machine ??= readMachine(renderer);
    this.timer ??= renderer
      .getContext()
      .getExtension('EXT_disjoint_timer_query_webgl2') as TimerExtension | null;
    this.log.reset();
    this.host?.requestChart();
    this.build();
    // Le banc de mesure lit le panneau ouvert par cette porte (rien tant qu'il n'a pas été ouvert).
    const host = this.host;
    if (host !== null)
      (window as unknown as { __lplMesure?: MeterProbe }).__lplMesure = {
        programs: () =>
          (renderer.info.programs ?? []).map(
            (p) => `${p.name} x${String(p.usedTimes)} ${p.cacheKey}`,
          ),
        snapshot: () => host.snapshot(),
        passes: () => this.log.passes,
        summary: () => this.log.summary(),
        report: () => this.report(),
        setScale: (scale) => {
          host.setScale(scale);
          this.log.reset();
        },
      };
  }

  private button(label: string, action: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText =
      'font:inherit;color:#f4ead8;background:#3a2f2a;border:1px solid #8a7a66;border-radius:4px;padding:3px 8px;margin:6px 6px 0 0;cursor:pointer';
    button.addEventListener('click', action);
    return button;
  }

  private build(): void {
    const panel = document.createElement('div');
    panel.setAttribute('data-lpl-mesure', '');
    panel.style.cssText =
      'position:fixed;left:8px;top:8px;z-index:2147483000;max-width:520px;padding:8px 10px;' +
      'font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:#f4ead8;' +
      'background:rgba(24,18,16,0.9);border:1px solid #8a7a66;border-radius:6px;white-space:pre-wrap';
    const lines = document.createElement('div');
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:4px;color:#e8c46a';
    const output = document.createElement('div');
    output.style.cssText =
      'display:none;max-height:9em;overflow:auto;margin-top:6px;padding:4px;user-select:text;' +
      'color:#f4ead8;background:#181210;border:1px solid #8a7a66';
    panel.append(lines);
    panel.append(
      this.button('Copier le relevé', () => {
        this.copy();
      }),
      this.button('Remettre à zéro', () => {
        this.log.reset();
        this.host?.requestChart();
        note.textContent = 'Mesure remise à zéro.';
      }),
      this.button('Échelle', () => {
        const label = this.host?.cycleScale() ?? '';
        this.log.reset();
        this.host?.requestChart();
        note.textContent = `Échelle: ${label}. Mesure remise à zéro.`;
      }),
      this.button('Fermer', () => {
        this.toggle();
      }),
    );
    panel.append(note, output);
    // Le jeu ne doit pas prendre les clics ni les touches du panneau pour des actions.
    for (const type of ['pointerdown', 'mousedown', 'wheel', 'contextmenu'])
      panel.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    document.body.append(panel);
    this.panel = panel;
    this.lines = lines;
    this.output = output;
    this.note = note;
  }

  /**
   * La page autour du canevas, lue au moment du relevé (jamais à chaque image): canevas opaque
   * ou non, flous d'arrière-plan CSS affichés, cadence de l'écran (écart le plus fréquent entre
   * deux rappels d'image, arrondi aux cadences courantes).
   */
  private page(): PageInfo | null {
    const renderer = this.renderer;
    if (renderer === null || typeof document === 'undefined') return null;
    const opaque = renderer.getContext().getContextAttributes()?.alpha === false;
    let blurs = 0;
    for (const element of document.querySelectorAll<HTMLElement>('body *')) {
      if (element.offsetParent === null && element.tagName !== 'BODY') continue;
      const style = getComputedStyle(element);
      const filter = style.backdropFilter;
      if (filter !== '' && filter !== 'none') blurs += 1;
    }
    let best = 60;
    let bestCount = -1;
    for (const hz of [60, 75, 90, 120, 144]) {
      let count = 0;
      const beat = 1000 / hz;
      this.log.forEachBin((ms, n) => {
        if (Math.abs(ms - beat) < 1.5) count += n;
      });
      if (count > bestCount) {
        bestCount = count;
        best = hz;
      }
    }
    return { opaque, blurs, refreshHz: best };
  }

  /** Le relevé en texte (`null` tant que le panneau n'a jamais été ouvert). */
  report(): string | null {
    if (this.host === null || this.machine === null) return null;
    return reportText(this.log, this.host.snapshot(), this.machine, this.page());
  }

  private copy(): void {
    const text = this.report();
    const output = this.output;
    if (text === null || output === null) return;
    // Le relevé reste affiché: si le presse-papiers est refusé, il se copie à la main.
    output.textContent = text;
    output.style.display = 'block';
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(output);
    selection?.removeAllRanges();
    selection?.addRange(range);
    const done = (ok: boolean): void => {
      if (this.note !== null)
        this.note.textContent = ok
          ? 'Relevé copié: colle-le dans ton message.'
          : 'Copie refusée: sélectionne le texte ci-dessous et copie-le (Ctrl + C ou Cmd + C).';
    };
    // Copie de la sélection: la seule voie qui marche sans permission de presse-papiers (page
    // du jeu dans Duo). Dépréciée mais toujours servie par Chromium; l'interface moderne prend
    // le relais si elle échoue.
    const bySelection = (): boolean => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- voir ci-dessus
        return document.execCommand('copy');
      } catch {
        return false;
      }
    };
    if (bySelection()) {
      done(true);
      return;
    }
    // Absent hors contexte sécurisé, quoi qu'en disent les types.
    const clipboard = navigator.clipboard as Clipboard | undefined;
    if (clipboard === undefined) {
      done(false);
      return;
    }
    clipboard.writeText(text).then(
      () => {
        done(true);
      },
      () => {
        done(false);
      },
    );
  }

  /** Début d'une passe: compteurs relevés, chronomètre lancé s'il est libre. */
  begin(pass: PassIndex): void {
    const renderer = this.renderer;
    if (!this.active || renderer === null) return;
    this.calls = renderer.info.render.calls;
    this.triangles = renderer.info.render.triangles;
    const timer = this.timer;
    if (timer === null || this.waiting[pass] === true) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const query = (this.queries[pass] ??= gl.createQuery());
    gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
    this.running = pass;
  }

  /** Fin d'une passe; `pixels`: points de sa cible. */
  end(pass: PassIndex, pixels: number): void {
    const renderer = this.renderer;
    if (!this.active || renderer === null) return;
    const count = this.log.passes[pass];
    if (count !== undefined) {
      count.calls = renderer.info.render.calls - this.calls;
      count.triangles = renderer.info.render.triangles - this.triangles;
      count.pixels = pixels;
    }
    if (this.running !== pass || this.timer === null) return;
    (renderer.getContext() as WebGL2RenderingContext).endQuery(this.timer.TIME_ELAPSED_EXT);
    this.waiting[pass] = true;
    this.running = -1;
  }

  /** Passe sautée à cette image (ombre du soleil dedans, ombre de lampe de jour). */
  skip(pass: PassIndex): void {
    if (!this.active) return;
    const count = this.log.passes[pass];
    if (count === undefined) return;
    count.calls = 0;
    count.triangles = 0;
    count.pixels = 0;
  }

  /** Fin de l'image: durées, résultats des chronomètres arrivés, panneau rafraîchi. */
  frame(dtMs: number, cpuMs: number, now: number): void {
    const renderer = this.renderer;
    if (!this.active || renderer === null) return;
    this.log.add(dtMs, cpuMs);
    const timer = this.timer;
    if (timer !== null) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      for (let i = 0; i < this.queries.length; i += 1) {
        const query = this.queries[i];
        if (this.waiting[i] !== true || query === null || query === undefined) continue;
        if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE) !== true) continue;
        this.waiting[i] = false;
        if (gl.getParameter(timer.GPU_DISJOINT_EXT) === true) continue;
        const ms = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / NS_PER_MS;
        const count = this.log.passes[i];
        if (count !== undefined)
          count.gpuMs = count.gpuMs < 0 ? ms : count.gpuMs + (ms - count.gpuMs) * 0.1;
      }
    }
    if (now - this.refreshed < INK_SETTINGS.meter.refreshMs) return;
    this.refreshed = now;
    if (this.lines !== null && this.host !== null)
      this.lines.textContent = liveLines(this.log, this.host.snapshot()).join('\n');
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('keydown', this.onKey);
    this.panel?.remove();
    this.panel = null;
    const gl = this.renderer?.getContext() as WebGL2RenderingContext | undefined;
    for (const query of this.queries) if (query !== null) gl?.deleteQuery(query);
    this.renderer = null;
    this.host = null;
  }
}
