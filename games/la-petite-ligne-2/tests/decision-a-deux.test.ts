// Décision à deux: une étape factice que seuls deux choix concordants franchissent. Chacun
// choisit (effet `choose`), la condition `decision_is` dit où l'on en est. Tests courts.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { Condition, DecisionIs } from '../src/donnees/schemas/regles';
import { ProgressSchema } from '../src/etat/progression';
import { GameEventSchema } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { decisionState, decisionTaken } from '../src/simulation/quetes/decisions';
import { evaluate } from '../src/simulation/regles/conditions';
import { applyEffect } from '../src/simulation/regles/effets';
import { contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const QUEST = 'quete-decision';

/** Une suite d'une étape: choisir à deux la saison de la fête, chez la cheffe de gare. */
function content(edit?: (quest: Json, dialogue: Json) => void): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    const option = (id: string): Json => ({
      id,
      text: `Fête en ${id}.`,
      when: [],
      effects: [{ type: 'choose', decision: 'fete', option: id }],
      next: null,
    });
    const dialogue: Json = {
      schema: 1,
      id: 'decision-factice',
      villager: 'cheffe-de-gare',
      priority: -5,
      when: [],
      once: null,
      start: 'choix',
      nodes: { choix: { kind: 'choice', options: [option('ete'), option('automne')] } },
    };
    const quest: Json = {
      schema: 1,
      id: QUEST,
      kind: 'side',
      title: 'La saison de la fête',
      giver: 'cheffe-de-gare',
      requires: [],
      chapters: [
        {
          id: 'chapitre-1',
          title: 'Choisir à deux',
          steps: [
            {
              id: 'choisir',
              objective: 'Choisissez à deux la saison de la fête.',
              target: { villager: 'cheffe-de-gare' },
              done: [{ type: 'decision_is', decision: 'fete', state: 'agreed' }],
              decision: { id: 'fete', options: ['ete', 'automne'] },
              together: false,
              onStart: [],
              onDone: [],
            },
          ],
        },
      ],
    };
    edit?.(quest, dialogue);
    files['lieux/essai-gare/dialogues/decision-factice.json'] = dialogue;
    files[`lieux/essai-gare/quetes/${QUEST}.json`] = quest;
  });
}

function choose(sim: Sim, player: PlayerIndex, option: string): Sim['events'] {
  sim.events.length = 0;
  applyEffect(contextOf(sim), player, { type: 'choose', decision: 'fete', option });
  return [...sim.events];
}

function is(sim: Sim, actor: PlayerIndex | null, state: DecisionIs, option?: string): boolean {
  const c: Condition = {
    type: 'decision_is',
    decision: 'fete',
    state,
    ...(option === undefined ? {} : { option }),
  };
  return evaluate({ world: sim.world, content: sim.content, actor }, c);
}

function problems(edit: (quest: Json, dialogue: Json) => void): string {
  try {
    content(edit);
  } catch (error) {
    if (error instanceof ContentError) return error.problems.join('\n');
    throw error;
  }
  return '';
}

describe('décision à deux', () => {
  it('n’est prise que si les deux choix concordent; sinon elle attend, ou invite à s’accorder', () => {
    const sim = newSim(content());
    wait(sim, 0.5);
    expect(sim.world.progress.quests[QUEST]?.done).toBe(false);
    expect(decisionState(sim.world, 'fete')).toBe('open');

    // Une seule voix: elle attend l'autre.
    expect(choose(sim, 0, 'ete')).toEqual([
      { type: 'decision_changed', decision: 'fete', player: 0, option: 'ete', state: 'waiting' },
    ]);
    expect(is(sim, 0, 'mine', 'ete')).toBe(true);
    expect(is(sim, 1, 'mine')).toBe(false);
    expect(is(sim, 1, 'theirs', 'ete')).toBe(true);
    expect(is(sim, null, 'agreed')).toBe(false);

    // Deux avis: rien n'est pris, les données peuvent inviter à se mettre d'accord.
    expect(choose(sim, 1, 'automne')[0]).toMatchObject({ state: 'split' });
    expect(is(sim, null, 'split')).toBe(true);
    wait(sim, 0.5);
    expect(sim.world.progress.quests[QUEST]?.done).toBe(false);
    expect(decisionTaken(sim.world, 'fete')).toBeNull();

    // L'un change d'avis: la décision est prise, au nom des deux, et l'étape passe.
    const agreed = choose(sim, 1, 'ete');
    expect(agreed[0]).toMatchObject({ state: 'agreed', option: 'ete' });
    for (const event of agreed) expect(v.is(GameEventSchema, event)).toBe(true);
    expect(sim.world.progress.memory['decisions.fete']).toMatchObject({ v: 'ete', by: 'duo' });
    expect(is(sim, null, 'agreed', 'ete')).toBe(true);
    expect(is(sim, null, 'agreed', 'automne')).toBe(false);
    wait(sim, 0.5);
    expect(sim.world.progress.quests[QUEST]?.done).toBe(true);

    // Prise, elle ne bouge plus; une option inconnue n'est jamais retenue.
    expect(choose(sim, 0, 'automne')).toEqual([]);
    expect(decisionTaken(sim.world, 'fete')).toBe('ete');
    expect(v.is(ProgressSchema, sim.world.progress)).toBe(true);
    const fresh = newSim(content());
    expect(choose(fresh, 0, 'hiver')).toEqual([]);
    expect(decisionState(fresh.world, 'fete')).toBe('open');
  });

  it('refuse au chargement une décision mal déclarée', () => {
    expect(
      problems((quest) => {
        const step = ((quest.chapters as Json[])[0]?.steps as Json[])[0];
        if (step !== undefined) step.done = [{ type: 'together' }];
      }),
    ).toContain("sans attendre l'accord");
    expect(
      problems((quest) => {
        const step = ((quest.chapters as Json[])[0]?.steps as Json[])[0];
        if (step !== undefined) step.decision = { id: 'fete', options: ['ete', 'hiver'] };
      }),
    ).toMatch(
      /n'a pas d'option « automne »[\s\S]*aucun dialogue du lieu n'offre l'option « hiver »/,
    );
    expect(
      problems((_quest, dialogue) => {
        const nodes = dialogue.nodes as Record<string, { options: { effects: Json[] }[] }>;
        const effect = nodes.choix?.options[0]?.effects[0];
        if (effect !== undefined) effect.decision = 'inconnue';
      }),
    ).toContain('décision inconnue « inconnue »');
  });
});
