// 0.13, rythme des quêtes d'histoire (`docs/jeux/jeu-1/v0-13-habitants.md`, section 5.1): au plus
// deux histoires en cours, une neuve par jour, trois jours entre deux étapes d'un même habitant;
// les quêtes sans `story` n'y sont pas soumises.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Sim } from '../src/simulation/contexte';
import { updateQuests } from '../src/simulation/quetes';
import { newSim } from './aides';

/** Une quête toujours prête, finie dès que le drapeau `done:<id>` est posé. */
function quest(id: string, giver: string, story: number | null, after: string | null = null): unknown {
  return {
    id,
    kind: 'side',
    tier: 'P0',
    title: id,
    giver,
    ...(story === null ? {} : { story: { villager: giver, step: story } }),
    start: { when: after === null ? [] : [{ type: 'quest_done', quest: after }] },
    steps: [{ id: 'a', objective: 'Essai.', conditions: [{ type: 'flag', flag: `done:${id}` }] }],
    completionText: '',
  };
}

function paceSim(): Sim {
  const files = structuredClone(CONTENT_FILES);
  const raw = files.quetes as { quests: { start: { byEffect?: boolean } }[] };
  // Les quêtes du jeu ne partent que par effet ici: seules celles d'essai démarrent d'elles-mêmes.
  for (const q of raw.quests) q.start.byEffect = true;
  (raw.quests as unknown[]).push(
    quest('s_odette', 'odette', 2),
    quest('s_basile', 'basile', 2),
    quest('s_jeanne', 'jeanne', 2),
    quest('s_odette_2', 'odette', 3, 's_odette'),
    quest('plain_a', 'firmin', null),
    quest('plain_b', 'firmin', null),
  );
  const sim = newSim(3, loadContent(files));
  sim.world.quests = [];
  return sim;
}

const ids = (sim: Sim): string[] => sim.world.quests.filter((q) => q.status === 'active').map((q) => q.id).sort();

function finish(sim: Sim, id: string): void {
  sim.world.flags.push(`done:${id}`);
  updateQuests(sim);
}

describe('rythme des histoires', () => {
  it('une neuve par jour, deux en cours au plus, trois jours entre deux étapes du même habitant', () => {
    const sim = paceSim();
    const w = sim.world;
    w.clock.day = 10;
    updateQuests(sim);
    // Les quêtes sans histoire partent toutes; une seule histoire le premier jour.
    expect(ids(sim)).toEqual(['plain_a', 'plain_b', 's_odette']);
    updateQuests(sim);
    expect(ids(sim)).toHaveLength(3);
    w.clock.day = 11;
    updateQuests(sim);
    expect(ids(sim).filter((x) => x.startsWith('s_'))).toEqual(['s_basile', 's_odette']);
    // Deux en cours: Jeanne attend, même un jour nouveau.
    w.clock.day = 12;
    updateQuests(sim);
    expect(ids(sim).filter((x) => x.startsWith('s_'))).toEqual(['s_basile', 's_odette']);
    // Odette finit le jour 12: sa suite attend le jour 15; Jeanne passe le jour 13.
    finish(sim, 's_odette');
    expect(w.quests.find((q) => q.id === 's_odette')?.doneDay).toBe(12);
    w.clock.day = 13;
    updateQuests(sim);
    expect(ids(sim).filter((x) => x.startsWith('s_'))).toEqual(['s_basile', 's_jeanne']);
    finish(sim, 's_basile');
    w.clock.day = 14;
    updateQuests(sim);
    expect(ids(sim)).not.toContain('s_odette_2');
    w.clock.day = 15;
    updateQuests(sim);
    expect(ids(sim)).toContain('s_odette_2');
  });
});
