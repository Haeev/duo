// Qualité adaptative (risque 1 du gauntlet, tour 2): durées d'image injectées, aucune carte graphique.
import { describe, expect, it } from 'vitest';
import { AdaptiveQuality, renderPixelSize, type QualityChange } from './qualite';
import { RENDER_SETTINGS } from './reglages';

const HZ_60 = 1 / 60;
const LAST_STEP = RENDER_SETTINGS.dynamicResolution.steps.length - 1;

/**
 * Joue `seconds` secondes d'images de `frame` secondes (ou d'un motif répété)
 * et rend les changements décidés, datés depuis le début de l'appel.
 */
function run(
  quality: AdaptiveQuality,
  frame: number | readonly number[],
  seconds: number,
): { at: number; change: QualityChange }[] {
  const pattern = typeof frame === 'number' ? [frame] : frame;
  const changes: { at: number; change: QualityChange }[] = [];
  let t = 0;
  for (let i = 0; t < seconds; i++) {
    const dt = pattern[i % pattern.length] ?? HZ_60;
    t += dt;
    const change = quality.sample(dt);
    if (change !== null) changes.push({ at: t, change });
  }
  return changes;
}

/**
 * Écran à 60 Hz synchronisé: une image en retard se présente à la période
 * suivante (33 ms). Une sur vingt en retard: 17,5 ms en moyenne.
 */
const ONE_LATE_IN_20 = [...Array.from({ length: 19 }, () => HZ_60), 2 * HZ_60];

/** Fait tomber la qualité jusqu'au mode léger avec des images de 30 ms. */
function untilLight(quality: AdaptiveQuality): number {
  const changes = run(quality, 0.03, 60);
  const light = changes.find((c) => c.change.kind === 'light');
  expect(light, 'repli vers le mode léger').toBeDefined();
  return light?.at ?? 0;
}

describe('qualité adaptative du rendu', () => {
  it('ne change rien à 60 images par seconde, même pendant une heure', () => {
    const quality = new AdaptiveQuality();
    expect(run(quality, HZ_60, 3600)).toEqual([]);
    expect(quality.resolutionStep()).toBe(0);
    expect(quality.isLight()).toBe(false);
  });

  it('ne prend pas un écran à 48 ou 50 Hz pour une machine trop lente', () => {
    for (const hz of [48, 50]) {
      const quality = new AdaptiveQuality();
      expect(run(quality, 1 / hz, 600), `écran à ${hz} Hz`).toEqual([]);
    }
  });

  it('descend les paliers puis passe au mode léger quand le dernier ne suffit plus', () => {
    const quality = new AdaptiveQuality();
    const changes = run(quality, 0.03, 60);
    expect(changes.map((c) => c.change)).toEqual([
      { kind: 'step', step: 1 },
      { kind: 'step', step: 2 },
      { kind: 'step', step: LAST_STEP },
      { kind: 'light', final: false },
    ]);
    const s = RENDER_SETTINGS.dynamicResolution;
    const light = changes[changes.length - 1]?.at ?? 0;
    // Échauffement, trois paliers espacés, puis la lenteur tenue au dernier palier (une image de marge).
    const expected =
      s.warmupSeconds +
      (LAST_STEP - 1) * s.cooldownSeconds +
      s.cooldownSeconds +
      RENDER_SETTINGS.autoLight.slowSeconds;
    expect(light).toBeGreaterThan(expected - 0.1);
    expect(light).toBeLessThan(expected + 3);
    expect(quality.isLight()).toBe(true);
    expect(quality.resolutionStep()).toBe(LAST_STEP);
  });

  it('se replie aussi sur une machine très lente (7 images par seconde), mais ignore les longues coupures', () => {
    const slow = new AdaptiveQuality();
    untilLight(slow);
    const veryslow = new AdaptiveQuality();
    expect(run(veryslow, 0.15, 120).some((c) => c.change.kind === 'light')).toBe(true);
    // Onglet caché, pause, compilation: des images d'une demi-seconde ne comptent pas.
    const paused = new AdaptiveQuality();
    expect(run(paused, 0.5, 600)).toEqual([]);
  });

  it("ne se replie pas sur une lenteur brève au dernier palier (pas d'à-coup)", () => {
    const quality = new AdaptiveQuality();
    const steps = run(quality, 0.03, 14);
    expect(steps.map((c) => c.change.kind)).toEqual(['step', 'step', 'step']);
    // Lent 2 s, puis rapide 10 s, plusieurs fois: la lenteur (décroissance de la moyenne comprise)
    // ne dure jamais assez, et son compte repart de zéro.
    for (let i = 0; i < 5; i++) {
      expect(run(quality, 0.03, 2)).toEqual([]);
      expect(run(quality, HZ_60, 10)).toEqual([]);
    }
    expect(quality.isLight()).toBe(false);
  });

  it("reste en mode léger tant que les images ne sont pas au rythme de l'écran (hystérésis)", () => {
    // Une image sur vingt en retard: pas assez lent pour quitter la qualité normale...
    const normal = new AdaptiveQuality();
    expect(run(normal, ONE_LATE_IN_20, 600)).toEqual([]);
    // ... ni assez confortable pour y revenir depuis le mode léger.
    const quality = new AdaptiveQuality();
    untilLight(quality);
    expect(run(quality, ONE_LATE_IN_20, 600)).toEqual([]);
    expect(quality.isLight()).toBe(true);
  });

  it('revient une fois après une longue période confortable, et un second repli est définitif', () => {
    const quality = new AdaptiveQuality();
    untilLight(quality);
    const back = run(quality, HZ_60, 120);
    expect(back.map((c) => c.change)).toEqual([{ kind: 'normal' }]);
    const auto = RENDER_SETTINGS.autoLight;
    // Retour au dernier palier, après la période de confort exigée.
    expect(back[0]?.at).toBeGreaterThanOrEqual(auto.returnSeconds);
    expect(quality.resolutionStep()).toBe(LAST_STEP);
    expect(quality.isLight()).toBe(false);
    // De nouveau lent: repli définitif, plus aucun retour ensuite.
    const again = run(quality, 0.03, 60);
    expect(again.map((c) => c.change)).toEqual([{ kind: 'light', final: true }]);
    expect(run(quality, HZ_60, 3600)).toEqual([]);
    expect(quality.isLight()).toBe(true);
  });

  it('prend les seuils dans la configuration typée', () => {
    const quality = new AdaptiveQuality({
      dynamicResolution: { ...RENDER_SETTINGS.dynamicResolution, steps: [1], warmupSeconds: 0 },
      autoLight: { ...RENDER_SETTINGS.autoLight, slowSeconds: 1, maxReturns: 0 },
    });
    const changes = run(quality, 0.03, 10);
    expect(changes.map((c) => c.change)).toEqual([{ kind: 'light', final: true }]);
  });
});

// Retour R07 (2026-11-01): tout était flou sur le PC Windows. Écran de portable 1366x768
// à 100, 125 et 150 %: le tampon doit avoir les pixels physiques de l'écran, à tout palier
// de la résolution dynamique et après le repli automatique (qui garde la résolution).
describe('taille du rendu (R07)', () => {
  const lastScale = RENDER_SETTINGS.dynamicResolution.steps[LAST_STEP] ?? 1;
  const screens = [
    { dpr: 1, css: [1366, 768] },
    { dpr: 1.25, css: [1092.8, 614.4] },
    { dpr: 1.5, css: [910.67, 512] },
  ] as const;

  for (const screen of screens) {
    it(`1366x768 à ${String(screen.dpr * 100)} %: pixels physiques exacts au dernier palier`, () => {
      // Le conteneur arrondit sa taille CSS; la boîte physique donne la vraie taille.
      const surface = {
        cssWidth: Math.round(screen.css[0]),
        cssHeight: Math.round(screen.css[1]),
        devicePixelRatio: screen.dpr,
        devicePixels: { width: 1366, height: 768 },
      };
      for (const scale of [1, lastScale]) {
        const size = renderPixelSize(surface, scale, false);
        expect([size.width, size.height]).toEqual([1366, 768]);
      }
    });

    it(`1366x768 à ${String(screen.dpr * 100)} %: jamais sous le pixel physique sans boîte physique`, () => {
      const surface = {
        cssWidth: Math.round(screen.css[0]),
        cssHeight: Math.round(screen.css[1]),
        devicePixelRatio: screen.dpr,
        devicePixels: null,
      };
      const size = renderPixelSize(surface, lastScale, false);
      expect(Math.abs(size.width - 1366)).toBeLessThanOrEqual(1);
      expect(Math.abs(size.height - 768)).toBeLessThanOrEqual(1);
    });
  }

  it('boîte physique incohérente (échelle émulée sans elle): on reprend CSS x dpr', () => {
    const surface = {
      cssWidth: 1093,
      cssHeight: 614,
      devicePixelRatio: 1.25,
      devicePixels: { width: 1093, height: 614 },
    };
    const size = renderPixelSize(surface, lastScale, false);
    expect(Math.abs(size.width - 1366)).toBeLessThanOrEqual(1);
    expect(Math.abs(size.height - 768)).toBeLessThanOrEqual(1);
  });

  it('Retina: la résolution dynamique descend, jamais sous 1,5 pixel par point', () => {
    const surface = {
      cssWidth: 800,
      cssHeight: 500,
      devicePixelRatio: 2,
      devicePixels: { width: 1600, height: 1000 },
    };
    expect(renderPixelSize(surface, 1, false)).toEqual({ width: 1600, height: 1000, ratio: 2 });
    expect(renderPixelSize(surface, lastScale, false).width).toBe(1200);
  });

  it('le budget de 1920x1080 pixels physiques tient toujours', () => {
    const surface = {
      cssWidth: 1440,
      cssHeight: 900,
      devicePixelRatio: 2,
      devicePixels: { width: 2880, height: 1800 },
    };
    const size = renderPixelSize(surface, 1, false);
    expect(size.width * size.height).toBeLessThanOrEqual(1920 * 1080 + 2000);
  });

  it('le mode léger demandé (tests en rendu logiciel) garde sa basse résolution', () => {
    const surface = {
      cssWidth: 1366,
      cssHeight: 768,
      devicePixelRatio: 1,
      devicePixels: { width: 1366, height: 768 },
    };
    const size = renderPixelSize(surface, 1, true);
    expect(size.width * size.height).toBeLessThanOrEqual(
      RENDER_SETTINGS.light.maxPhysicalPixels + 2000,
    );
  });
});
