// Résultat de séance pour Duo (cahier 4.11): l'avancement de l'histoire part avec chaque
// sauvegarde, et la séance se résume en trois nombres (jours vécus, étapes, entrées ajoutées).
import { describe, expect, it } from 'vitest';
import { snapshotOf } from '../src/sauvegarde/sauvegarde';
import { sessionSummary, storyProgress, tallyOf } from '../src/sauvegarde/seance';
import { gameContent, newSim } from './aides';

const content = gameContent();

describe('résultat de séance', () => {
  it('l’avancement suit les actes d’Aubrune et part avec la sauvegarde', () => {
    const sim = newSim(content);
    expect(storyProgress(content, sim.world)).toBe(0);
    expect(snapshotOf(sim.world, content).progress).toBe(0);
    const first = content.places.aubrune?.quests['le-train-de-5h12'];
    const step = first?.chapters[0]?.steps[0]?.id;
    if (first === undefined || step === undefined) throw new Error('premier acte absent');
    sim.world.progress.quests[first.id] = {
      chapter: first.chapters[0]?.id ?? '',
      step,
      done: false,
      passed: [step],
    };
    const one = storyProgress(content, sim.world) ?? 0;
    expect(one).toBeGreaterThan(0);
    expect(one).toBeLessThan(0.1);
    const state = sim.world.progress.quests[first.id];
    if (state === undefined) throw new Error('suite non écrite');
    state.done = true;
    expect(storyProgress(content, sim.world)).toBeGreaterThan(one);
    expect(snapshotOf(sim.world, content).progress).toBe(storyProgress(content, sim.world));
  });

  it('résume la séance: jours vécus, étapes franchies, entrées ajoutées', () => {
    const sim = newSim(content);
    const start = tallyOf(content, sim.world);
    sim.world.common.day += 2;
    sim.world.progress.quests['sonnerie-essai'] = {
      chapter: 'un-drole-de-bruit',
      step: 'parler',
      done: false,
      passed: ['parler'],
    };
    sim.world.progress.collections.insectes = ['papillon-citron', 'luciole-d-essai'];
    const summary = sessionSummary(content, start, sim.world);
    expect(summary.stats).toEqual([
      { label: 'Jours vécus', value: '2' },
      { label: 'Étapes de quête franchies', value: '1' },
      { label: 'Entrées de collection ajoutées', value: '2' },
    ]);
    for (const stat of summary.stats ?? []) expect(stat.label.length).toBeLessThanOrEqual(32);
    expect(summary.progress).toBe(0);
  });
});
