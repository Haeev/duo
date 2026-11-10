// Rendu encré (ADR 0023, points 11 et 12): résolution interne adaptative (paliers, hystérésis,
// option figée) et outil de mesure (centiles, relevé en texte sans donnée personnelle). Logique
// pure: durées d'image fabriquées, aucun contexte WebGL.
import { describe, expect, it } from 'vitest';
import { InkScale, scaleFromAddress } from '../../src/rendu/encre/echelle';
import {
  FrameLog,
  gameHour,
  type MachineInfo,
  type RenderSnapshot,
  reportText,
} from '../../src/rendu/encre/mesure';
import { INK_SETTINGS } from '../../src/rendu/encre/reglages';

const R = INK_SETTINGS.resolution;

/** Fait passer `seconds` secondes d'images de `ms`; rend le nombre de changements d'échelle. */
function run(scale: InkScale, ms: number, seconds: number): number {
  let changes = 0;
  for (let t = 0; t < seconds * 1000; t += ms) if (scale.sample(ms)) changes += 1;
  return changes;
}

/** Images de `ms` jusqu'au prochain changement d'échelle (au plus `seconds` secondes). */
function untilChange(scale: InkScale, ms: number, seconds: number): boolean {
  for (let t = 0; t < seconds * 1000; t += ms) if (scale.sample(ms)) return true;
  return false;
}

describe('échelle interne adaptative', () => {
  it('reste à pleine finesse tant que le plancher de 30 images par seconde tient', () => {
    const scale = new InkScale();
    expect(run(scale, 16.7, 60)).toBe(0);
    expect(run(scale, 33.3, 60)).toBe(0);
    expect(scale.scale()).toBe(1);
  });

  it('descend par paliers sous le plancher, jamais sous 70 %', () => {
    const scale = new InkScale();
    run(scale, 45, 120);
    expect(scale.scale()).toBe(0.7);
    expect(Math.min(...R.steps)).toBeGreaterThanOrEqual(0.7);
    expect(scale.changeCount()).toBe(R.steps.length - 1);
  });

  it('ne descend pas sur un à-coup isolé ni pendant la mise en route d’un lieu', () => {
    const scale = new InkScale();
    run(scale, 16.7, 10);
    // Une demi-seconde lente: moins que `downSeconds`.
    expect(run(scale, 50, 0.5)).toBe(0);
    run(scale, 16.7, 5);
    scale.hold();
    expect(run(scale, 60, R.warmupSeconds - 0.5)).toBe(0);
    expect(scale.scale()).toBe(1);
  });

  it('remonte quand il y a de la marge, et une remontée ratée allonge l’attente', () => {
    const scale = new InkScale();
    expect(untilChange(scale, 45, 30)).toBe(true);
    expect(untilChange(scale, 45, 30)).toBe(true);
    const low = scale.scale();
    expect(low).toBe(R.steps[2]);
    // À 60 images par seconde, le palier du dessus tient sous le budget: on remonte, pas avant
    // `upSeconds` de marge tenue.
    expect(run(scale, 16.7, R.upSeconds - 1)).toBe(0);
    expect(untilChange(scale, 16.7, R.cooldownSeconds + 4)).toBe(true);
    expect(scale.scale()).toBe(R.steps[1]);
    // La remontée échoue (lent de nouveau): redescente, puis la remontée suivante attend plus.
    expect(untilChange(scale, 45, R.retrySeconds - 2)).toBe(true);
    expect(scale.scale()).toBe(low);
    expect(run(scale, 16.7, R.cooldownSeconds + R.upSeconds + 3)).toBe(0);
    expect(untilChange(scale, 16.7, R.upSeconds * R.retryFactor)).toBe(true);
    expect(scale.scale()).toBe(R.steps[1]);
  });

  it('à 30 images par seconde tout juste, ne tente pas de remonter (pas de va-et-vient)', () => {
    const scale = new InkScale();
    run(scale, 45, 8);
    const low = scale.scale();
    const count = scale.changeCount();
    run(scale, 30, 120);
    expect(scale.scale()).toBe(low);
    expect(scale.changeCount()).toBe(count);
  });

  it('se fige sur demande et ignore les images hors norme', () => {
    const scale = new InkScale();
    scale.fix(0.8);
    expect(run(scale, 80, 30)).toBe(0);
    expect(scale.scale()).toBe(0.8);
    scale.fix(null);
    expect(scale.scale()).toBe(1);
    // Onglet caché, chargement: des écarts de plus de `ignoreFrameMs` ne comptent pas.
    expect(run(scale, R.ignoreFrameMs + 50, 60)).toBe(0);
  });

  it('lit l’échelle demandée par l’adresse', () => {
    expect(scaleFromAddress('?echelle=0.8')).toBe(0.8);
    expect(scaleFromAddress('?echelle=auto')).toBe('auto');
    expect(scaleFromAddress('?echelle=3')).toBeUndefined();
    expect(scaleFromAddress('?autre=1')).toBeUndefined();
  });
});

const MACHINE: MachineInfo = {
  gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  gpuVendor: 'Google Inc. (Intel)',
  browser: 'Electron/38.0.0 Chrome/140.0.0.0',
  platform: 'Windows NT 10.0',
  timerQuery: false,
  canvasColorSpace: 'srgb',
  outputColorSpace: 'srgb',
  toneMapping: 'Three.js 6',
  alpha: false,
  premultipliedAlpha: true,
  antialias: false,
  samples: 0,
  gamut: 'srgb',
  highDynamicRange: false,
  colorDepth: 24,
  forcedColors: false,
  screen: '1366 x 768',
};

const SNAPSHOT: RenderSnapshot = {
  cssWidth: 1366,
  cssHeight: 768,
  pixelRatio: 1,
  canvasWidth: 1366,
  canvasHeight: 768,
  innerWidth: 1093,
  innerHeight: 614,
  scale: 0.8,
  scaleMode: 'auto',
  scaleChanges: 2,
  programs: 11,
  textures: 34,
  geometries: 64,
  textureMegabytes: 44,
  minutes: 17 * 60 + 5,
  sheet: 'aubrune-automne',
  indoor: false,
  chart: { expected: [163, 182, 89], read: [163, 182, 89] },
};

describe('outil de mesure', () => {
  it('compte moyenne, premier centile et images sous le plancher', () => {
    const log = new FrameLog();
    for (let i = 0; i < 980; i += 1) log.add(16.7, 3);
    for (let i = 0; i < 20; i += 1) log.add(50, 3);
    // Écart hors norme (fenêtre cachée): ignoré.
    log.add(4000, 3);
    const s = log.summary();
    expect(s.frames).toBe(1000);
    expect(s.averageMs).toBeCloseTo((980 * 16.7 + 20 * 50) / 1000, 3);
    expect(s.averageFps).toBeCloseTo(1000 / s.averageMs, 3);
    // 2 % des images à 50 ms: le 99e centile tombe dessus (20 images par seconde).
    expect(s.p99Ms).toBeCloseTo(50, 0);
    expect(s.lowFps).toBeCloseTo(20, 0);
    expect(s.overBudgetShare).toBeCloseTo(0.02, 5);
    expect(s.worstMs).toBe(50);
    expect(s.cpuMs).toBe(3);
    log.reset();
    expect(log.summary().frames).toBe(0);
  });

  it('écrit un relevé complet, lisible et sans donnée personnelle', () => {
    const log = new FrameLog();
    Object.assign(log.passes[0] ?? {}, { calls: 40, triangles: 98000, pixels: 2048 * 2048 });
    Object.assign(log.passes[2] ?? {}, { calls: 60, triangles: 120000, pixels: 1093 * 614 });
    Object.assign(log.passes[3] ?? {}, { calls: 2, triangles: 2, pixels: 1093 * 614 + 1366 * 768 });
    for (let i = 0; i < 600; i += 1) log.add(33.3, 6);
    log.noteScale(0.9);
    const text = reportText(log, SNAPSHOT, MACHINE);
    for (const wanted of [
      'Images par seconde: 30,0 en moyenne',
      'Échelle interne: 80 % (auto)',
      'canevas 1366 x 768, interne 1093 x 614',
      'rapport de pixels 1',
      'ombre du soleil: 40 appels, 98 000 triangles',
      'ombre de la lampe: sautée',
      'UHD Graphics 620',
      'espace srgb',
      'gamme srgb',
      '24 bits par point',
      '17 h 05',
      'Mire de couleurs: écart maximal 0 sur 255 (conforme)',
    ])
      expect(text).toContain(wanted);
    // Ni chemin de fichier, ni nom d'utilisateur, ni adresse: rien que le rendu et le matériel.
    expect(text).not.toMatch(/[A-Za-z]:\\|\/Users\/|\/home\/|@|https?:|\d+\.\d+\.\d+\.\d+:/);
    expect(text).not.toMatch(/[\u2013\u2014]/);
    expect(gameHour(-30)).toBe('23 h 30');
  });

  it('signale une mire de couleurs qui ne ressort pas telle quelle', () => {
    const text = reportText(
      new FrameLog(),
      { ...SNAPSHOT, chart: { expected: [163, 182, 89], read: [150, 182, 89] } },
      MACHINE,
    );
    expect(text).toContain('écart maximal 13 sur 255 (ÉCART)');
  });
});
