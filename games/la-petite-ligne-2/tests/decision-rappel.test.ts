// Décision à deux au comptoir tenu (« La Baronne », fournil d'Achille): chacun la dit depuis le
// côté client, la réplique d'Achille ne rouvre pas la boutique derrière elle, et le rappel durable
// (bandeau du HUD, onglet Quêtes) nomme la décision, le choix de l'autre et comment répondre;
// en désaccord, les deux choix, et chacun peut changer d'avis. Test court.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { decisionReminderTexts } from '../src/interface/rappel-decision';
import { aimOf } from '../src/simulation/briques/visee';
import { talkView } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { put } from './aides-noyau';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const Q = 'la-baronne';
const COUNTER = 'fournil-comptoir';
/** Côté client (rue) du comptoir du fournil (pièce en (68; 210), comptoir en (73; 212,5)), face au nord. */
const CLIENT: Readonly<Record<PlayerIndex, { x: number; y: number }>> = {
  0: { x: 72.6, y: 213.9 },
  1: { x: 73.6, y: 213.9 },
};
const NORTH = -Math.PI / 2;

/** Aubrune à 10 h, « La Baronne » à son étape de décision, les deux joueurs devant le comptoir. */
function atDecision(): Sim {
  const content = contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
  });
  const sim = newSim(content);
  wait(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  sim.world.progress.quests[Q] = {
    chapter: 'la-touche',
    step: 'decision',
    done: false,
    passed: ['legende', 'heure', 'appat', 'goujons', 'affut'],
  };
  remember(contextOf(sim), 'aubrune.baronne.legende', 'fait', 'duo');
  remember(contextOf(sim), 'aubrune.baronne.decision', 'ouvert', 'duo');
  for (const p of [0, 1] as const) sim.world.players[p].needs.hygiene = 100;
  sim.world.minutes = 600;
  wait(sim, 2);
  for (const p of [0, 1] as const) put(sim, p, CLIENT[p].x, CLIENT[p].y, NORTH);
  wait(sim, 0.1);
  return sim;
}

/** Touche d'action au comptoir, puis le dialogue jusqu'au bout avec cette option. */
function sayAtCounter(sim: Sim, player: PlayerIndex, option: string): string[] {
  put(sim, player, CLIENT[player].x, CLIENT[player].y, NORTH);
  expect(aimOf(sim, player)).toMatchObject({ id: COUNTER, verb: 'Parler', refusal: null });
  const events = act(sim, player, { type: 'act' });
  expect(events.some((e) => e.type === 'shop_opened')).toBe(false);
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const talk = sim.world.players[player].talk;
    if (talk === null) break;
    seen.push(talk.node);
    const options = talkView(sim.content, sim.world, player)?.options ?? [];
    if (options.length === 0) act(sim, player, { type: 'talk_next' });
    else act(sim, player, { type: 'talk_choose', option });
  }
  return seen;
}

describe('décision à deux au comptoir tenu', () => {
  it('waiting, split, agreed: depuis le côté client, sans boutique derrière, avec un rappel durable', () => {
    const sim = atDecision();
    const [zoe, sacha] = [sim.world.players[0].name, sim.world.players[1].name];
    expect(decisionReminderTexts(sim.world, sim.content, 0)).toEqual([]);

    // L'invité choisit seul: « Une voix », puis la conversation se clôt (pas d'offre de boutique).
    const first = sayAtCounter(sim, 1, 'friture');
    expect(first.at(-1)).toBe('une-voix');
    expect(sim.world.players[1].talk).toBeNull();
    const [waiting] = decisionReminderTexts(sim.world, sim.content, 0);
    expect(waiting?.head).toBe('Décision à deux : La Baronne');
    expect(waiting?.body).toBe(
      `${sacha} a choisi « On l'offre au café ». À toi : dis ton choix à Achille Pradel.`,
    );
    expect(decisionReminderTexts(sim.world, sim.content, 1)[0]?.body).toContain(
      `${zoe} n’a pas encore dit le sien`,
    );
    // Celui qui a choisi, entendu ce jour: le comptoir lui ouvre la boutique.
    put(sim, 1, CLIENT[1].x, CLIENT[1].y, NORTH);
    expect(aimOf(sim, 1)).toMatchObject({ id: COUNTER, verb: 'Acheter' });

    // L'hôte dit l'autre choix: deux avis, les deux choix affichés chez chacun.
    expect(sayAtCounter(sim, 0, 'relacher').at(-1)).toBe('desaccord');
    const [split] = decisionReminderTexts(sim.world, sim.content, 0);
    expect(split?.split).toBe(true);
    expect(split?.body).toContain('Toi : « On la relâche »');
    expect(split?.body).toContain(`${sacha} : « On l'offre au café »`);
    expect(decisionReminderTexts(sim.world, sim.content, 1)[0]?.body).toContain(
      "Toi : « On l'offre au café »",
    );

    // Désaccord: chacun peut changer d'avis au comptoir, même après avoir entendu Achille.
    expect(sayAtCounter(sim, 1, 'relacher').at(-1)).toBe('fin');
    expect(decisionReminderTexts(sim.world, sim.content, 0)).toEqual([]);
    expect(decisionReminderTexts(sim.world, sim.content, 1)).toEqual([]);
  });
});
