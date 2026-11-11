// Agenda des événements lu par les données (gabarits d'événement, de quête et de commerce): la
// condition `event_is`, les faits du calendrier connus du contrôle des suites, la décision à deux
// rejouable à chaque occurrence, les commerces fermés par une fête, l'annonce de la veille.
// Événements, suites et commerces factices de la gare d'essai; tests courts.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError, type Content } from '../src/donnees/charger';
import type { Condition, EventIs } from '../src/donnees/schemas/regles';
import { CommonSchema } from '../src/etat/commun';
import { isTrading, shopDef } from '../src/simulation/commerces/prix';
import { shopClosedLine } from '../src/simulation/dialogues/commerce';
import { talkView } from '../src/simulation/dialogues/conversation';
import { DIALOGUES } from '../src/simulation/dialogues/reglages';
import { isShopOpen } from '../src/simulation/habitants/lecture';
import type { Sim } from '../src/simulation/noyau/pas';
import { decisionTaken, previousDecision } from '../src/simulation/quetes/decisions';
import { evaluate } from '../src/simulation/regles/conditions';
import { applyEffect } from '../src/simulation/regles/effets';
import { contentWith, contextOf, wait } from './aides-l3';
import { gameContent, newSim } from './aides';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';
/** Fête d'essai des données: printemps, jour 3, 10 h à 22 h, sans condition. */
const FETE = 'fete-d-essai';
const SHOP = 'buvette-de-la-gare';

function eventFile(id: string, extra: Json = {}): Json {
  return {
    schema: 1,
    id,
    name: 'Événement factice',
    kind: 'other',
    when: { type: 'date', season: 'spring', day: 2 },
    days: 1,
    hours: { from: 600, to: 1320 },
    conditions: [],
    announce: false,
    activates: { facts: [], shop: null, tune: null },
    ...extra,
  };
}

function questFile(requires: Condition[], decision?: Json): Json {
  const option = (id: string): Json => ({
    id,
    text: `Fête en ${id}.`,
    when: [],
    effects: [{ type: 'choose', decision: 'tradition', option: id }],
    next: null,
  });
  return {
    schema: 1,
    id: 'quete-agenda',
    kind: 'side',
    title: 'Une tradition',
    giver: 'cheffe-de-gare',
    requires,
    chapters: [
      {
        id: 'chapitre-1',
        title: 'Choisir',
        steps: [
          {
            id: 'choisir',
            objective: 'Choisissez à deux.',
            target: { villager: 'cheffe-de-gare' },
            done: [{ type: 'decision_is', decision: 'tradition', state: 'agreed' }],
            decision: { id: 'tradition', options: ['ete', 'automne'], ...decision },
            together: false,
            onStart: [],
            onDone: [],
          },
        ],
      },
    ],
    dialogue: {
      schema: 1,
      id: 'tradition-factice',
      villager: 'cheffe-de-gare',
      priority: -5,
      when: [],
      once: null,
      start: 'choix',
      nodes: { choix: { kind: 'choice', options: [option('ete'), option('automne')] } },
    },
  };
}

/** Le contenu avec ces fichiers factices de la gare d'essai (chemin relatif au lieu). */
function withFiles(add: Record<string, Json>): Content {
  return contentWith((files) => {
    for (const [path, file] of Object.entries(add)) {
      const { dialogue, ...rest } = file as Json & { dialogue?: Json };
      files[`lieux/${PLACE}/${path}`] = rest;
      if (dialogue !== undefined)
        files[`lieux/${PLACE}/dialogues/${String(dialogue.id)}.json`] = dialogue;
    }
  });
}

function problemsOf(build: () => Content): string[] {
  try {
    build();
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
}

function at(sim: Sim, day: number, minutes: number): void {
  sim.world.common.day = day;
  sim.world.minutes = minutes;
  wait(sim, 0.2);
}

function eventIs(sim: Sim, when: EventIs, events: string[] = [FETE]): boolean {
  return evaluate(
    { world: sim.world, content: sim.content, actor: null },
    {
      type: 'event_is',
      events,
      when,
    },
  );
}

describe('agenda des événements', () => {
  it('event_is: demain, aujourd’hui, en cours, commencé jusqu’à l’aube suivante', () => {
    const sim = newSim(gameContent());
    wait(sim, 0.2);
    at(sim, 2, 900);
    expect([eventIs(sim, 'tomorrow'), eventIs(sim, 'today')]).toEqual([true, false]);
    at(sim, 3, 540);
    expect([eventIs(sim, 'today'), eventIs(sim, 'on'), eventIs(sim, 'begun')]).toEqual([
      true,
      false,
      false,
    ]);
    at(sim, 3, 600);
    expect([eventIs(sim, 'on'), eventIs(sim, 'begun')]).toEqual([true, true]);
    expect(sim.world.progress.memory[`agenda.${PLACE}.${FETE}`]?.v).toBe(3);
    // Après ses heures, la journée reste celle de la fête; le lendemain, plus rien.
    at(sim, 3, 1400);
    expect([eventIs(sim, 'on'), eventIs(sim, 'begun')]).toEqual([false, true]);
    at(sim, 4, 400);
    expect([eventIs(sim, 'begun'), eventIs(sim, 'today')]).toEqual([false, false]);
    // Au chargement: événement inconnu, conditions qui se citent en boucle.
    const unknown = problemsOf(() =>
      withFiles({
        'quetes/quete-agenda.json': questFile([
          { type: 'event_is', events: ['nulle-part'], when: 'on' },
        ]),
      }),
    );
    expect(unknown.join('\n')).toContain('événement inconnu « nulle-part »');
    const loop = problemsOf(() =>
      withFiles({
        'evenements/a.json': eventFile('a', {
          conditions: [
            { type: 'not', condition: { type: 'event_is', events: ['b'], when: 'today' } },
          ],
        }),
        'evenements/b.json': eventFile('b', {
          conditions: [{ type: 'event_is', events: ['a'], when: 'today' }],
        }),
      }),
    );
    expect(loop.join('\n')).toContain('conditions en boucle');
  });

  it('le contrôle des suites connaît les faits écrits par le calendrier', () => {
    const fact: Condition = { type: 'remembered', key: 'essai-gare.factice.jour', equals: 'oui' };
    const event = eventFile('jour-factice', {
      activates: {
        facts: [{ key: 'essai-gare.factice.jour', value: 'oui' }],
        shop: null,
        tune: null,
      },
    });
    expect(
      problemsOf(() =>
        withFiles({
          'evenements/jour-factice.json': event,
          'quetes/quete-agenda.json': questFile([fact]),
        }),
      ),
    ).toEqual([]);
    const never = problemsOf(() =>
      withFiles({
        'evenements/jour-factice.json': event,
        'quetes/quete-agenda.json': questFile([{ ...fact, equals: 'non' }]),
      }),
    );
    expect(never.join('\n')).toContain('ne vaut jamais "non"');
  });

  it('une décision rejouable se rouvre à chaque occurrence, l’an dernier en mémoire', () => {
    const content = withFiles({ 'quetes/quete-agenda.json': questFile([], { reopens: [FETE] }) });
    const sim = newSim(content);
    wait(sim, 0.2);
    const ctx = contextOf(sim);
    const choose = (player: 0 | 1, option: string): void => {
      applyEffect(ctx, player, { type: 'choose', decision: 'tradition', option });
    };
    choose(0, 'ete');
    choose(1, 'ete');
    expect(decisionTaken(sim.world, 'tradition')).toBe('ete');
    at(sim, 3, 600);
    expect(decisionTaken(sim.world, 'tradition')).toBeNull();
    expect(sim.world.progress.memory['decisions.tradition.j0']).toBeUndefined();
    expect(previousDecision(sim.world, 'tradition')).toBe('ete');
    const last: Condition = {
      type: 'decision_is',
      decision: 'tradition',
      state: 'last',
      option: 'ete',
    };
    expect(evaluate({ world: sim.world, content, actor: 0 }, last)).toBe(true);
    // Rouverte une fois par occurrence: l'accord de cette année tient jusqu'à l'an prochain.
    choose(0, 'automne');
    choose(1, 'automne');
    at(sim, 3, 900);
    expect(decisionTaken(sim.world, 'tradition')).toBe('automne');
    at(sim, 3 + 56, 600);
    expect(decisionTaken(sim.world, 'tradition')).toBeNull();
    expect(previousDecision(sim.world, 'tradition')).toBe('automne');
    // Sans `reopens`: prise une fois pour toutes.
    const once = newSim(withFiles({ 'quetes/quete-agenda.json': questFile([]) }));
    wait(once, 0.2);
    applyEffect(contextOf(once), 0, { type: 'choose', decision: 'tradition', option: 'ete' });
    applyEffect(contextOf(once), 1, { type: 'choose', decision: 'tradition', option: 'ete' });
    at(once, 3, 600);
    expect(decisionTaken(once.world, 'tradition')).toBe('ete');
  });

  it('une fête ferme les commerces pour la journée, et le commerçant le dit', () => {
    const closed = 'Fermé pour la fête: je suis attendue sur le quai.';
    const content = contentWith((files) => {
      files[`lieux/${PLACE}/evenements/fermeture.json`] = eventFile('fermeture', {
        closes: { shops: [SHOP] },
      });
      const shop = files[`lieux/${PLACE}/commerces/${SHOP}.json`] as Json;
      shop.lines = { closed };
    });
    const sim = newSim(content);
    wait(sim, 0.2);
    const def = shopDef(sim, SHOP);
    if (def === null) throw new Error(SHOP);
    at(sim, 2, 540);
    expect(isTrading(sim, def)).toBe(true);
    at(sim, 2, 600);
    expect(isTrading(sim, def)).toBe(false);
    expect(isShopOpen(sim, SHOP)).toBe(false);
    // Une conversation ordinaire avec la commerçante (quotidien, sans `open_shop`).
    const any = sim.content.places[PLACE]?.dialogues.find((d) => d.villager === 'cheffe-de-gare');
    if (any === undefined) throw new Error('dialogue de la cheffe');
    const dialogue = { ...any, priority: 0, nodes: {} };
    expect(shopClosedLine(sim, 'cheffe-de-gare', dialogue, false)).toBe(closed);
    // La page réservée se lit comme une réplique du commerçant.
    sim.world.players[0].talk = {
      villager: 'cheffe-de-gare',
      dialogue: dialogue.id,
      node: DIALOGUES.shopClosed.node,
    };
    expect(talkView(sim.content, sim.world, 0)).toMatchObject({
      speaker: 'cheffe-de-gare',
      text: closed,
      options: [],
    });
    sim.world.players[0].talk = null;
    // Après minuit, toujours la même journée de jeu; à l'aube suivante, rouvert.
    at(sim, 2, 1430);
    expect(isTrading(sim, def)).toBe(false);
    at(sim, 3, 540);
    expect(isTrading(sim, def)).toBe(true);
    expect(shopClosedLine(sim, 'cheffe-de-gare', dialogue, false)).toBeNull();
    // Commerce à fermer inconnu: refusé au chargement.
    const wrong = problemsOf(() =>
      contentWith((files) => {
        files[`lieux/${PLACE}/evenements/fermeture.json`] = eventFile('fermeture', {
          closes: { shops: ['nulle-boutique'] },
        });
      }),
    );
    expect(wrong.join('\n')).toContain('commerce à fermer inconnu « nulle-boutique »');
  });

  it('l’annonce de la veille: dans l’état commun des deux joueurs et dans l’événement du soir', () => {
    const sim = newSim(gameContent());
    wait(sim, 0.2);
    sim.world.common.day = 2;
    sim.world.minutes = 400;
    const events = wait(sim, 0.2);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'outlook_ready', place: PLACE, day: 3, events: [FETE] }),
    );
    // `common` est la tranche partagée: l'invité reçoit la même annonce que l'hôte.
    expect(sim.world.common.outlook?.events).toEqual([FETE]);
    expect(v.is(CommonSchema, sim.world.common)).toBe(true);
    expect(eventIs(sim, 'tomorrow')).toBe(true);
  });
});
