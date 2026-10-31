/**
 * Suivi des performances du rendu: appels de dessin, triangles et programmes
 * relevés par `renderer.info` après chaque image, images par seconde, et un
 * petit indicateur à l'écran en mode développement (rouge au-delà des budgets
 * de la plateforme).
 */
import type { WebGLRenderer } from 'three';
import { RENDER_SETTINGS } from './reglages';

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  programs: number;
  geometries: number;
  textures: number;
  fps: number;
  /** Temps moyen d'une image (ms), sur la dernière période. */
  frameMs: number;
}

const MS_PER_SECOND = 1000;
const PERCENT = 100;
const OVERLAY_STYLE = [
  'position:absolute',
  'left:6px',
  'top:6px',
  'padding:4px 6px',
  'font:11px/1.35 ui-monospace,monospace',
  'color:#eaf2e3',
  'background:rgba(14,17,38,0.72)',
  'border-radius:4px',
  'pointer-events:none',
  'white-space:pre',
  'z-index:5',
].join(';');
const OVER_BUDGET_COLOR = '#ff8a7a';
const WITHIN_BUDGET_COLOR = '#eaf2e3';

export class PerfMonitor {
  readonly current: RenderStats = {
    drawCalls: 0,
    triangles: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
    fps: 0,
    frameMs: 0,
  };
  private frames = 0;
  private elapsed = 0;
  private maxCalls = 0;
  private readonly overlay: HTMLDivElement | null;
  private missing: readonly string[] = [];
  private resolution = 1;

  constructor(container: HTMLElement, showOverlay: boolean) {
    if (showOverlay) {
      this.overlay = document.createElement('div');
      this.overlay.setAttribute('data-testid', 'lpl-perf');
      this.overlay.style.cssText = OVERLAY_STYLE;
      container.appendChild(this.overlay);
    } else {
      this.overlay = null;
    }
  }

  /** Modèles remplacés par un substitut, listés dans l'indicateur. */
  setMissingModels(names: readonly string[]): void {
    this.missing = names;
  }

  /** Palier de résolution dynamique (1 = pleine résolution), affiché s'il a baissé. */
  setResolutionScale(scale: number): void {
    this.resolution = scale;
  }

  /** À appeler juste après `renderer.render()`. */
  record(renderer: WebGLRenderer, dt: number): void {
    const info = renderer.info;
    this.current.drawCalls = info.render.calls;
    this.current.triangles = info.render.triangles;
    this.current.programs = info.programs?.length ?? 0;
    this.current.geometries = info.memory.geometries;
    this.current.textures = info.memory.textures;
    this.maxCalls = Math.max(this.maxCalls, info.render.calls);
    this.frames += 1;
    this.elapsed += dt;
    if (this.elapsed >= RENDER_SETTINGS.budgets.statsRefreshSeconds) {
      this.current.fps = this.frames / this.elapsed;
      this.current.frameMs = (this.elapsed / this.frames) * MS_PER_SECOND;
      this.frames = 0;
      this.elapsed = 0;
      this.refreshOverlay();
      this.maxCalls = 0;
    }
  }

  private refreshOverlay(): void {
    if (this.overlay === null) {
      return;
    }
    const budgets = RENDER_SETTINGS.budgets;
    const s = this.current;
    const over =
      this.maxCalls > budgets.drawCalls ||
      s.triangles > budgets.triangles ||
      s.programs > budgets.programs;
    this.overlay.style.color = over ? OVER_BUDGET_COLOR : WITHIN_BUDGET_COLOR;
    const lines = [
      `${s.fps.toFixed(0)} i/s  ${s.frameMs.toFixed(1)} ms`,
      `appels ${s.drawCalls} (max ${this.maxCalls}) / ${budgets.drawCalls}`,
      `triangles ${(s.triangles / MS_PER_SECOND).toFixed(1)} k / ${budgets.triangles / MS_PER_SECOND} k`,
      `programmes ${s.programs} / ${budgets.programs}`,
      `géométries ${s.geometries}  textures ${s.textures}`,
    ];
    if (this.resolution < 1) {
      lines.push(`résolution ${(this.resolution * PERCENT).toFixed(0)} %`);
    }
    if (this.missing.length > 0) {
      lines.push(`substituts ${this.missing.length}`);
    }
    this.overlay.textContent = lines.join('\n');
  }

  dispose(): void {
    this.overlay?.remove();
  }
}
