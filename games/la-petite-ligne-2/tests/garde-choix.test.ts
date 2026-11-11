// Garde des choix d'un dialogue (retour du 2026-11-11): un joueur qui martèle Espace pour passer le
// texte ne valide pas le premier choix à son apparition, et ne tranche jamais une décision à deux
// (Entrée seule la valide). Test court, sans DOM.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { choiceKeyOutcome, isDecisionChoice } from '../src/interface/garde-choix';
import { UI_TUNING } from '../src/interface/reglages';
import { createWorld } from '../src/simulation/noyau/monde';
import { gameDataFiles, MEMBERS, SEED } from './aides';

const GUARD = UI_TUNING.choiceGuardMs;

/** Espace martelé toutes les `everyMs` pendant `forMs` depuis l'apparition des choix. */
function hammer(decision: boolean, everyMs: number, forMs: number): string[] {
  const out: string[] = [];
  for (let t = 0; t <= forMs; t += everyMs) out.push(choiceKeyOutcome('Space', t, GUARD, decision));
  return out;
}

describe('garde des choix', () => {
  it('la garde dure de l’ordre de 0,6 s: ni Espace ni Entrée n’y valident', () => {
    expect(GUARD).toBeGreaterThanOrEqual(400);
    expect(GUARD).toBeLessThanOrEqual(1000);
    for (const code of ['Space', 'Enter'])
      for (const decision of [false, true]) {
        expect(choiceKeyOutcome(code, 0, GUARD, decision)).toBe('swallow');
        expect(choiceKeyOutcome(code, GUARD - 1, GUARD, decision)).toBe('swallow');
      }
    // Les flèches restent libres pendant la garde.
    expect(choiceKeyOutcome('ArrowDown', 0, GUARD, false)).toBe('other');
  });

  it('choix ordinaire: Espace ou Entrée valident une fois la garde passée', () => {
    expect(choiceKeyOutcome('Space', GUARD, GUARD, false)).toBe('choose');
    expect(choiceKeyOutcome('Enter', GUARD + 50, GUARD, false)).toBe('choose');
    // Martelé toutes les 80 ms: rien avant la garde.
    const outcomes = hammer(false, 80, GUARD + 200);
    expect(outcomes.indexOf('choose') * 80).toBeGreaterThanOrEqual(GUARD);
  });

  it('décision à deux: Espace martelé ne tranche jamais, il rappelle Entrée; Entrée tranche', () => {
    const outcomes = hammer(true, 80, 5000);
    expect(outcomes).not.toContain('choose');
    expect(outcomes).toContain('remind');
    expect(choiceKeyOutcome('Enter', GUARD, GUARD, true)).toBe('choose');
  });

  it('une décision se reconnaît dans les données (option à effet `choose`), pas un choix ordinaire', () => {
    const content = loadContent(gameDataFiles());
    const world = createWorld(content, SEED, MEMBERS);
    const me = world.players[0];
    world.common.place = 'aubrune';
    me.talk = { villager: 'achille', dialogue: 'achille-decision', node: 'n3' };
    expect(isDecisionChoice(content, world, 0)).toBe(true);
    // La réplique qui précède la décision n'est pas un choix.
    me.talk = { villager: 'achille', dialogue: 'achille-decision', node: 'n2' };
    expect(isDecisionChoice(content, world, 0)).toBe(false);
    // Un choix du dialogue d'accueil de la gare d'essai: ordinaire (le nœud existe bien).
    world.common.place = 'essai-gare';
    me.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'choix' };
    const accueil = content.places['essai-gare']?.dialogues.find((d) => d.id === 'accueil');
    expect(accueil?.nodes.choix?.kind).toBe('choice');
    expect(isDecisionChoice(content, world, 0)).toBe(false);
    me.talk = null;
    expect(isDecisionChoice(content, world, 0)).toBe(false);
  });
});
