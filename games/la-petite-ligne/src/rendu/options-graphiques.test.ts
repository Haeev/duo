// Options graphiques de la 0.13: préréglage vers paramètres, lecture tolérante, filet de sécurité.
// Durées d'image fabriquées, aucune carte graphique.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GRAPHICS_OPTIONS,
  GRAPHICS_PRESETS,
  type GraphicsOptions,
  loadGraphicsOptions,
  lowerOptions,
  parseGraphicsOptions,
  saveGraphicsOptions,
  sessionGraphicsStorage,
  withLevel,
} from '../etat/options-graphiques';
import { choosePreset, optionsModel } from '../interface/options';
import {
  QualityGovernor,
  resolveProfile,
  sizeSettingsOf,
  type GovernorChange,
} from './options-graphiques';
import { renderPixelSize } from './qualite';
import { RENDER_SETTINGS } from './reglages';
import { AMBIANCE_SETTINGS } from './reglages-ambiance';

const HZ_60 = 1 / 60;
/** 30 images par seconde: sous le seuil du repli (40). */
const SLOW = 1 / 30;
const opts = (
  preset: GraphicsOptions['preset'],
  extra: Partial<GraphicsOptions> = {},
): GraphicsOptions => ({
  ...DEFAULT_GRAPHICS_OPTIONS,
  preset,
  ...extra,
});

function run(governor: QualityGovernor, frame: number, seconds: number): GovernorChange[] {
  const changes: GovernorChange[] = [];
  for (let t = 0; t < seconds; t += frame) {
    const change = governor.sample(frame);
    if (change !== null) changes.push(change);
  }
  return changes;
}

describe('préréglages vers paramètres du rendu', () => {
  it("Auto garde la qualité adaptative et l'image de la 0.12", () => {
    const p = resolveProfile(DEFAULT_GRAPHICS_OPTIONS);
    expect(p.guard).toBe('adaptive');
    expect(p.shadows).toEqual({
      enabled: true,
      mapSize: AMBIANCE_SETTINGS.shadows.mapSize,
      detailMapSize: AMBIANCE_SETTINGS.shadows.detailMapSize,
    });
    expect(p.resolution.maxPhysicalPixels).toBe(RENDER_SETTINGS.renderer.maxPhysicalPixels);
    expect(p.resolution.minCrispRatio).toBe(RENDER_SETTINGS.renderer.minCrispRatio);
    expect(p.effectsShare).toBe(1);
  });

  it('Haute: ombres fines, netteté Retina; Moyenne: celle de la 0.12; Basse: sans ombres', () => {
    const high = resolveProfile(opts('high'));
    const medium = resolveProfile(opts('medium'));
    const low = resolveProfile(opts('low'));
    expect(high.shadows.mapSize).toBe(2048);
    expect(high.resolution.maxPhysicalPixels).toBeGreaterThan(medium.resolution.maxPhysicalPixels);
    expect(medium.shadows).toEqual(resolveProfile(DEFAULT_GRAPHICS_OPTIONS).shadows);
    expect(low.shadows.enabled).toBe(false);
    expect(low.effectsShare).toBeLessThan(1);
    expect([high.guard, medium.guard, low.guard]).toEqual(['safety', 'safety', 'none']);
    expect(resolveProfile(opts('high', { neverReduce: true })).guard).toBe('none');
  });

  it('netteté: Mac Retina plus net en Haute, PC 1366x768 net en Moyenne, réduit en Basse', () => {
    const mac = { cssWidth: 1440, cssHeight: 900, devicePixelRatio: 2, devicePixels: null };
    const pc = { cssWidth: 1366, cssHeight: 768, devicePixelRatio: 1, devicePixels: null };
    const size = (surface: typeof mac, preset: 'high' | 'medium' | 'low'): number => {
      const r = resolveProfile(opts(preset)).resolution;
      return renderPixelSize(surface, r.scale, false, sizeSettingsOf(r)).width;
    };
    expect(size(mac, 'high')).toBeGreaterThan(size(mac, 'medium'));
    expect(size(pc, 'high')).toBe(1366);
    expect(size(pc, 'medium')).toBe(1366);
    expect(size(pc, 'low')).toBe(Math.round(1366 * 0.8));
  });

  it("un réglage fin changé: Personnalisée, ou le préréglage qu'il retrouve", () => {
    const custom = withLevel(opts('medium'), { shadows: 'fine' });
    expect(custom.preset).toBe('custom');
    expect(custom.custom).toEqual({ ...GRAPHICS_PRESETS.medium, shadows: 'fine' });
    expect(withLevel(custom, { shadows: 'soft' }).preset).toBe('medium');
    expect(choosePreset(opts('high'), 'custom').custom).toEqual(GRAPHICS_PRESETS.high);
    expect(optionsModel(opts('auto')).auto).toBe(true);
  });
});

describe('lecture tolérante et mémoire', () => {
  it('garde ce qui est lisible, remplace le reste par défaut', () => {
    expect(parseGraphicsOptions(null)).toEqual(DEFAULT_GRAPHICS_OPTIONS);
    expect(parseGraphicsOptions('{"preset":"high"}')).toEqual(DEFAULT_GRAPHICS_OPTIONS);
    expect(parseGraphicsOptions([1, 2])).toEqual(DEFAULT_GRAPHICS_OPTIONS);
    const parsed = parseGraphicsOptions({
      preset: 'ultra',
      custom: { shadows: 'fine', resolution: 4 },
      neverReduce: 'oui',
    });
    expect(parsed.preset).toBe('auto');
    expect(parsed.custom).toEqual({ shadows: 'fine', resolution: 'standard', effects: 'full' });
    expect(parsed.neverReduce).toBe(false);
  });

  it('écrit puis relit les mêmes options; une mémoire en panne ne gêne rien', () => {
    const storage = sessionGraphicsStorage();
    const chosen = withLevel(opts('high', { neverReduce: true }), { effects: 'reduced' });
    saveGraphicsOptions(storage, chosen);
    expect(loadGraphicsOptions(storage)).toEqual(chosen);
    const broken = {
      read: (): unknown => {
        throw new Error('disque');
      },
      write: (): void => {
        throw new Error('disque');
      },
    };
    expect(() => {
      saveGraphicsOptions(broken, chosen);
    }).not.toThrow();
    expect(loadGraphicsOptions(broken)).toEqual(DEFAULT_GRAPHICS_OPTIONS);
  });
});

describe('filet de sécurité', () => {
  it('Haute à 30 images par seconde: Moyenne au bout de quelques secondes, puis Basse, puis plus rien', () => {
    const governor = new QualityGovernor(opts('high'), () => 1);
    const changes = run(governor, SLOW, 60);
    expect(changes.map((c) => (c.kind === 'reduced' ? c.options.preset : c.kind))).toEqual([
      'medium',
      'low',
    ]);
    expect(governor.current().preset).toBe('low');
    expect(governor.currentProfile().guard).toBe('none');
    // Échauffement (5 s) puis lenteur tenue (8 s): pas avant 13 s.
    const again = new QualityGovernor(opts('high'), () => 1);
    expect(run(again, SLOW, 12)).toEqual([]);
  });

  it('fluide, ou « Ne jamais réduire »: aucun cran', () => {
    expect(run(new QualityGovernor(opts('high'), () => 1), HZ_60, 60)).toEqual([]);
    expect(
      run(new QualityGovernor(opts('high', { neverReduce: true }), () => 1), SLOW, 60),
    ).toEqual([]);
  });

  it("Personnalisée: baisse un réglage par cran, les ombres fines d'abord", () => {
    const custom = withLevel(opts('high'), { effects: 'reduced' });
    expect(lowerOptions(custom)?.custom).toEqual({
      shadows: 'soft',
      resolution: 'max',
      effects: 'reduced',
    });
    const steps: string[] = [];
    let o: GraphicsOptions | null = custom;
    while (o !== null) {
      steps.push(`${o.preset}:${o.custom.shadows}/${o.custom.resolution}/${o.custom.effects}`);
      o = lowerOptions(o);
    }
    expect(steps.at(-1)).toBe('low:off/reduced/reduced');
  });

  it('Auto: les décisions de la qualité adaptative passent telles quelles', () => {
    const governor = new QualityGovernor(DEFAULT_GRAPHICS_OPTIONS, () => 1);
    const changes = run(governor, SLOW, 30);
    expect(changes[0]).toEqual({ kind: 'adaptive', change: { kind: 'light', final: false } });
    expect(governor.current().preset).toBe('auto');
  });
});
