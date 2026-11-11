// Briques de la mémoire des faits réclamées par l'écriture (test court): fait de qui agit ou de
// l'autre (`of`), jours écoulés (`days_since`), compteur (`fact_at_least`, effet `bump`), faits
// écrits par les commerces et par le moteur pour les souvenirs, faits connus du validateur des
// quêtes. Chaque brique est essayée sur un exemplaire factice ajouté aux données.
import { describe, expect, it } from 'vitest';
import { ContentError } from '../src/donnees/charger';
import type { Condition } from '../src/donnees/schemas/regles';
import { firstBuyKey, firstSaleKey, soldKey } from '../src/simulation/commerces/faits';
import { lastTalkKey } from '../src/simulation/dialogues/amitie';
import { endTalk, startTalk } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { evaluate } from '../src/simulation/regles/conditions';
import { recall, remember } from '../src/simulation/regles/memoire';
import { RULES } from '../src/simulation/regles/reglages';
import { noteFirstCatch, noteMemories } from '../src/simulation/regles/souvenirs';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;
const SHOP = 'buvette-de-la-gare';
const KEEPER = 'cheffe-de-gare';

/** Un dialogue factice de la cheffe, joué s'il est vrai (priorité de souvenir). */
function memoryDialogue(id: string, when: Condition[], effects: Json[] = []): Json {
  const line = { kind: 'line', speaker: KEEPER, text: 'Je me souviens.', emote: null, next: null };
  return {
    schema: 1,
    id,
    villager: KEEPER,
    priority: 30,
    when,
    once: null,
    start: effects.length > 0 ? 'e' : 'n1',
    nodes: {
      ...(effects.length > 0 ? { e: { kind: 'effects', effects, next: 'n1' } } : {}),
      n1: line,
    },
  };
}

const content = contentWith((files) => {
  files['lieux/essai-gare/dialogues/cheffe-moitie.json'] = memoryDialogue(
    'cheffe-moitie',
    [{ type: 'fact_at_least', key: `ventes.${SHOP}.pomme`, of: 'other', value: 12 }],
    [{ type: 'bump', key: 'essai-gare.moitie', by: 'actor', of: 'actor' }],
  );
  files['lieux/essai-gare/dialogues/cheffe-absence.json'] = memoryDialogue('cheffe-absence', [
    { type: 'days_since', key: 'amitie.cheffe-de-gare.jour', of: 'actor', atLeast: 3 },
  ]);
});

/** Une partie à 10 h, les deux joueurs devant le comptoir de la buvette d'essai. */
function atCounter(): Sim {
  const sim = newSim(content);
  sim.world.minutes = 600;
  for (const p of [0, 1] as const) {
    const body = sim.world.players[p].body;
    body.x = 20 + p * 0.6;
    body.y = 17.3;
  }
  return sim;
}

function talkTo(sim: Sim, player: 0 | 1): string | null {
  const ctx = contextOf(sim);
  startTalk(ctx, player, KEEPER);
  const dialogue = sim.world.players[player].talk?.dialogue ?? null;
  endTalk(ctx, player);
  return dialogue;
}

describe('faits: briques des conditions et des effets', () => {
  it('of: le fait de qui agit ou de l’autre; compteur au moins; jours écoulés', () => {
    const sim = atCounter();
    remember(contextOf(sim), 'habitants.cheffe-de-gare.cadeaux.j1', 12, 1);
    const ctx = (actor: 0 | 1 | null) => ({ world: sim.world, content, actor });
    const mine: Condition = {
      type: 'remembered',
      key: 'habitants.cheffe-de-gare.cadeaux',
      of: 'actor',
    };
    const theirs: Condition = { ...mine, of: 'other' };
    expect([evaluate(ctx(0), mine), evaluate(ctx(0), theirs)]).toEqual([false, true]);
    expect([evaluate(ctx(1), mine), evaluate(ctx(1), theirs)]).toEqual([true, false]);
    expect(evaluate(ctx(null), mine)).toBe(true);
    const atLeast = (value: number): Condition => ({
      type: 'fact_at_least',
      key: 'habitants.cheffe-de-gare.cadeaux',
      of: 'other',
      value,
    });
    expect([evaluate(ctx(0), atLeast(12)), evaluate(ctx(0), atLeast(13))]).toEqual([true, false]);
    const since = (atLeast?: number, atMost?: number): Condition => ({
      type: 'days_since',
      key: 'habitants.cheffe-de-gare.cadeaux.j1',
      ...(atLeast === undefined ? {} : { atLeast }),
      ...(atMost === undefined ? {} : { atMost }),
    });
    expect(evaluate(ctx(0), since(0, 0))).toBe(true);
    sim.world.common.day += 4;
    expect([
      evaluate(ctx(0), since(3)),
      evaluate(ctx(0), since(5)),
      evaluate(ctx(0), since(undefined, 3)),
    ]).toEqual([true, false, false]);
    // Fait absent: toujours faux.
    expect(evaluate(ctx(0), { type: 'days_since', key: 'essai-gare.rien', atMost: 99 })).toBe(
      false,
    );
  });

  it('commerces: premier achat, première vente, totaux; « ta moitié m’a vendu douze pommes »', () => {
    const sim = atCounter();
    const [me, mate] = sim.world.players;
    me.money = 1000;
    mate.toolbar[0] = { item: 'pomme', count: 14 };
    act(sim, 0, { type: 'shop_buy', shop: SHOP, item: 'pain', count: 2, chest: false });
    expect(recall(sim.world, firstBuyKey(SHOP, 0))).toMatchObject({ v: 'pain', by: 0, day: 1 });
    expect(talkTo(sim, 0)).not.toBe('cheffe-moitie');
    act(sim, 1, { type: 'shop_sell', shop: SHOP, item: 'pomme', count: 5 });
    sim.world.common.day += 1;
    act(sim, 1, { type: 'shop_sell', shop: SHOP, item: 'pomme', count: 7 });
    expect(recall(sim.world, firstSaleKey(SHOP, 1))).toMatchObject({ v: 'pomme', day: 1 });
    expect(recall(sim.world, soldKey(SHOP, 'pomme', 1))?.v).toBe(12);
    expect(recall(sim.world, soldKey(SHOP, 'pomme'))).toMatchObject({ v: 12, by: 'duo' });
    expect(recall(sim.world, soldKey(SHOP, 'pomme', 0))).toBeNull();
    // Le fait de l'autre: la cheffe en parle au joueur 0, pas au vendeur lui-même.
    expect(talkTo(sim, 1)).not.toBe('cheffe-moitie');
    expect(talkTo(sim, 0)).toBe('cheffe-moitie');
    expect(talkTo(sim, 0)).toBe('cheffe-moitie');
    // L'effet `bump` compte, attaché à celui qui parle.
    expect(recall(sim.world, 'essai-gare.moitie.j0')).toMatchObject({ v: 2, by: 0 });
  });

  it('days_since sur le dernier jour de conversation: trois jours sans se voir', () => {
    const sim = atCounter();
    expect(talkTo(sim, 0)).not.toBe('cheffe-absence');
    expect(recall(sim.world, lastTalkKey(KEEPER, 0))?.day).toBe(1);
    sim.world.common.day += 2;
    expect(talkTo(sim, 0)).not.toBe('cheffe-absence');
    sim.world.common.day += 3;
    expect(talkTo(sim, 0)).toBe('cheffe-absence');
    // Le jour même, l'absence est finie.
    expect(talkTo(sim, 0)).not.toBe('cheffe-absence');
  });

  it('souvenirs du moteur: première prise, nuit blanche, pluie dehors ensemble', () => {
    const M = RULES.memories;
    const sim = atCounter();
    noteFirstCatch(contextOf(sim), 1, 'ablette');
    noteFirstCatch(contextOf(sim), 1, 'carpe');
    expect(recall(sim.world, `${M.firstCatchKey}.j1`)).toMatchObject({ v: 'ablette', by: 1 });
    // L'aube arrive d'elle-même: personne n'a dormi.
    sim.world.minutes = sim.content.settings.clock.dayStart - 0.01;
    wait(sim, 0.2);
    expect(sim.world.common.day).toBe(2);
    for (const p of [0, 1])
      expect(recall(sim.world, `${M.sleeplessKey}.j${String(p)}`)?.day).toBe(2);
    // Pluie, les deux dehors côte à côte: le jour de pluie ensemble, au nom du duo.
    // (La graine fait pleuvoir ce matin-là: on repart sans le fait.)
    Reflect.deleteProperty(sim.world.progress.memory, M.rainTogetherKey);
    sim.world.common.weather = 'clear';
    noteMemories(contextOf(sim));
    expect(recall(sim.world, M.rainTogetherKey)).toBeNull();
    sim.world.common.weather = 'rain';
    sim.world.players[1].body.x += M.togetherRadius + 1;
    noteMemories(contextOf(sim));
    expect(recall(sim.world, M.rainTogetherKey)).toBeNull();
    sim.world.players[1].body.x = sim.world.players[0].body.x + 1;
    noteMemories(contextOf(sim));
    expect(recall(sim.world, M.rainTogetherKey)).toMatchObject({ v: 'rain', by: 'duo', day: 2 });
  });
});

describe('validateur des quêtes: faits du moteur', () => {
  function problemsWith(done: Json[]): string[] {
    try {
      contentWith((files) => {
        files['lieux/essai-gare/quetes/faits-factice.json'] = {
          schema: 1,
          id: 'faits-factice',
          kind: 'side',
          title: 'Faits',
          giver: null,
          requires: [],
          chapters: [
            {
              id: 'acte',
              title: 'Acte',
              steps: [
                {
                  id: 'lire',
                  objective: 'Fais quelque chose.',
                  target: null,
                  done,
                  together: false,
                  onStart: [],
                  onDone: [],
                },
              ],
            },
          ],
        };
      });
      return [];
    } catch (error) {
      if (error instanceof ContentError) return [...error.problems];
      throw error;
    }
  }

  it('une étape lit directement les faits des logements, des commerces et des décisions', () => {
    expect(
      problemsWith([
        { type: 'remembered', key: 'essai-gare.maison-essai.salle', equals: 'restored' },
        { type: 'remembered', key: 'essai-gare.maison-essai.confort-1' },
        { type: 'remembered', key: firstBuyKey(SHOP), of: 'actor', equals: 'pain' },
        { type: 'fact_at_least', key: soldKey(SHOP, 'buche'), value: 10 },
      ]),
    ).toEqual([]);
  });

  it('refuse une faute de frappe dans un fait du moteur', () => {
    const at = 'lieu essai-gare, quête faits-factice, étape lire';
    expect(
      problemsWith([
        { type: 'remembered', key: 'essai-gare.maison-essai.grenier' },
        { type: 'remembered', key: 'essai-gare.maison-essai.salle', equals: 'finie' },
        { type: 'fact_at_least', key: soldKey(SHOP, 'planche'), value: 1 },
        { type: 'remembered', key: firstBuyKey(SHOP), of: 'actor', equals: 'buche' },
      ]),
    ).toEqual([
      `${at}: condition impossible, aucune donnée n'écrit le fait « essai-gare.maison-essai.grenier »`,
      `${at}: condition impossible, le fait « essai-gare.maison-essai.salle » ne vaut jamais "finie"`,
      `${at}: condition impossible, aucune donnée n'écrit le fait « ventes.${SHOP}.planche »`,
      `${at}: condition impossible, le fait « ${firstBuyKey(SHOP, 0)} » ne vaut jamais "buche"`,
    ]);
  });
});
