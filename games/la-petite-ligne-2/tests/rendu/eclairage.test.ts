// Foyers de lumière de la nuit: allumage des lampes du dehors, bâtiments éclairés d'après les
// données (commerces, plannings, fiches), et meubles bas jamais estompés devant un personnage.
import { describe, expect, it } from 'vitest';
import type { PlaceContent } from '../../src/donnees/charger';
import { towardCamera } from '../../src/rendu/camera';
import { lampPower } from '../../src/rendu/encre/matiere';
import { hostOf, lampPhase } from '../../src/rendu/encre/lumieres';
import { INK_SETTINGS } from '../../src/rendu/encre/reglages';
import {
  buildingLights,
  gameLightSheets,
  type LightSheets,
  lightSheets,
} from '../../src/rendu/lieu/eclairage';
import { Occlusion } from '../../src/rendu/occultation';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';
import { contentWith } from '../aides-l3';
import { newSim } from '../aides';

const AUBRUNE = 'aubrune';
const content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
  settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
});
const sim = newSim(content);

function place(): PlaceContent {
  const found = content.places[AUBRUNE];
  if (found === undefined) throw new Error('Aubrune absente');
  return found;
}

function litAt(minute: number, sheets: LightSheets = gameLightSheets(AUBRUNE)): number {
  sim.world.minutes = minute;
  const lit = buildingLights({ content, world: sim.world }, place(), sheets);
  return [...lit.values()].filter((l) => l.ground > 0 || l.upper > 0).length;
}

describe('lampes du dehors', () => {
  it('s’allument l’une après l’autre à la tombée du jour, toutes la nuit, aucune le jour', () => {
    const s = INK_SETTINGS.lamps;
    const early = { phase: 0 };
    const late = { phase: 1 };
    expect(lampPower(0, early)).toBe(0);
    expect(lampPower(s.from, early)).toBe(0);
    const dusk = s.from + s.ramp;
    expect(lampPower(dusk, early)).toBeCloseTo(1);
    expect(lampPower(dusk, late)).toBe(0);
    expect(lampPower(1, late)).toBe(1);
    // Une lanterne de porte suit le bâtiment qui la porte.
    expect(lampPower(1, { phase: 0, share: 0.25 })).toBeCloseTo(0.25);
    // Le rang est stable et propre à chaque lampe.
    expect(lampPhase('reverbere-quai-1')).toBe(lampPhase('reverbere-quai-1'));
    expect(lampPhase('reverbere-quai-1')).not.toBe(lampPhase('reverbere-quai-2'));
  });

  it('une lampe contre une façade est portée par ce bâtiment', () => {
    const hosts = [{ id: 'cafe', x: 10, y: 10, w: 6, h: 4 }];
    expect(hostOf(16.2, 12, hosts)).toBe('cafe');
    expect(hostOf(18, 12, hosts)).toBeUndefined();
  });
});

describe('bâtiments éclairés de l’intérieur', () => {
  it('le bourg s’éclaire le soir, en garde peu en pleine nuit, mais jamais aucun', () => {
    const evening = litAt(21 * 60);
    const deep = litAt(3 * 60);
    expect(evening).toBeGreaterThan(3);
    expect(deep).toBeGreaterThan(0);
    expect(deep).toBeLessThan(evening);
  });

  it('une fiche factice avec des plages s’allume sans autre changement (gabarit)', () => {
    const files = {
      'lieux/aubrune/batiments/factice.json': {
        id: 'factice',
        niveaux: 2,
        eclairage: [{ de: 1200, a: 60, niveau: 'tout', pourquoi: 'veillée de la maison factice' }],
      },
    };
    const sheets = lightSheets(files).get(AUBRUNE);
    if (sheets === undefined) throw new Error('fiche factice non lue');
    sim.world.minutes = 23 * 60;
    const night = buildingLights({ content, world: sim.world }, place(), sheets);
    expect(night.get('factice')).toEqual({ ground: 1, upper: 1 });
    sim.world.minutes = 12 * 60;
    const noon = buildingLights({ content, world: sim.world }, place(), sheets);
    expect(noon.has('factice')).toBe(false);
  });
});

describe('meubles bas', () => {
  it('un comptoir plus bas que les épaules ne s’estompe pas devant un personnage', () => {
    const occlusion = new Occlusion();
    const toCamera = towardCamera({ yaw: 0, pitch: (35 * Math.PI) / 180 });
    const height = RENDER_SETTINGS.occlusion.minHeight - 0.05;
    // Posé sur une estrade de 0,5 m: déclaré (son dessus dépasse la borne au sol) mais toujours bas
    // pour un personnage debout sur l'estrade derrière lui.
    const counter = {
      id: 'comptoir',
      min: { x: 8, y: 0.5, z: 9.6 },
      max: { x: 12, y: 0.5 + height, z: 10.2 },
    };
    expect(occlusion.add(counter)).toBe(true);
    occlusion.update(1 / 60, [{ x: 10, y: 0.5, z: 9 }], toCamera);
    expect(occlusion.opacity('comptoir')).toBe(1);
    // Le même personnage au sol, plus bas que le comptoir: il est caché, le comptoir s'efface.
    occlusion.update(1 / 60, [{ x: 10, y: 0, z: 9 }], toCamera);
    expect(occlusion.isHidden('comptoir')).toBe(true);
  });
});
