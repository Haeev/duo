// Rappel de la touche de course: une seule fois, après une longue marche dehors, jamais à qui court déjà.
import { describe, expect, it } from 'vitest';
import { createRunHint, RUN_HINT, type HintStorage } from '../src/interface/astuce-course';
import { fill, TEXTS } from '../src/interface/textes';
import { azertyLabel } from '../src/interface/index';
import { gameContent, gameDataFiles, newSim } from './aides';
import { loadContent } from '../src/donnees/charger';

const content = gameContent();

function memory(): HintStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/** `seconds` d'images à 60 par seconde, le joueur 0 à `speed`; vrai si le rappel est venu. */
function walk(
  hint: ReturnType<typeof createRunHint>,
  sim: ReturnType<typeof newSim>,
  speed: number,
  seconds: number,
  busy = false,
): number {
  let shown = 0;
  sim.world.players[0].body.speed = speed;
  for (let i = 0; i < seconds * 60; i++) if (hint.frame(1 / 60, sim.world, 0, busy)) shown += 1;
  return shown;
}

describe('rappel de la course', () => {
  it('vient une fois après une longue marche dehors, et s’en souvient', () => {
    const storage = memory();
    const sim = newSim(content);
    const hint = createRunHint(content, storage);
    expect(walk(hint, sim, 1.5, RUN_HINT.walkSeconds - 1)).toBe(0);
    // Un arrêt de plus d'une seconde remet la marche continue à zéro (un creux bref, non).
    expect(walk(hint, sim, 0, RUN_HINT.stillSeconds + 0.5)).toBe(0);
    expect(walk(hint, sim, 1.5, RUN_HINT.walkSeconds - 1)).toBe(0);
    expect(walk(hint, sim, 0, 0.2)).toBe(0);
    expect(walk(hint, sim, 1.5, 2)).toBe(1);
    expect(walk(hint, sim, 1.5, 30)).toBe(0);
    expect(storage.data.get(RUN_HINT.storageKey)).toBe('vu');
    // Partie suivante sur la même machine: plus de rappel.
    expect(walk(createRunHint(content, storage), sim, 1.5, 30)).toBe(0);
  });

  it('ne vient pas à qui court déjà, ni dans un menu, ni dans un lieu clos', () => {
    const sim = newSim(content);
    const runner = createRunHint(content, memory());
    expect(walk(runner, sim, 3.2, 0.1)).toBe(0);
    expect(walk(runner, sim, 1.5, 30)).toBe(0);
    expect(walk(createRunHint(content, memory()), sim, 1.5, 30, true)).toBe(0);
    const prologue = loadContent(gameDataFiles());
    const train = newSim(prologue);
    expect(train.world.common.place).toBe('train-de-nuit');
    expect(walk(createRunHint(prologue, memory()), train, 1.5, 30)).toBe(0);
  });

  it('dit la touche selon le clavier, sans tiret long', () => {
    const text = fill(TEXTS.notices.runHint, { touche: azertyLabel('ShiftLeft') });
    expect(text).toContain('Maj');
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
