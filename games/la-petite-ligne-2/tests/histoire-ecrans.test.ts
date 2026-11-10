// L'histoire à l'écran: fin de chapitre, consignes de gestes des scènes à deux, options de dialogue
// impossibles, carnet des histoires en actes. Modèles de vue purs, lus sur une vraie simulation.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { worldSources } from '../src/interface/carnet/lectures';
import { questsModel, turnQuestPage, orderQuests } from '../src/interface/carnet/quetes';
import {
  chapterEndModel,
  sceneCardModel,
  shownProgress,
  shownState,
} from '../src/interface/histoire/modele';
import { HISTOIRE_SETTINGS } from '../src/interface/histoire/reglages';
import { blockedText, TEXTS } from '../src/interface/textes';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { STORY } from '../src/simulation/quetes/reglages';
import { queueScene } from '../src/simulation/scenes/lecteur';
import { HOOKS } from '../src/simulation/quetes/crochets';
import { plan } from '../outils/nouveau';
import { act, contentWith, contextOf, newSim, wait } from './aides-l3';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';
const CHEF = 'cheffe-de-gare';
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));

function sceneFile(id: string, beats: Json[]): Json {
  return {
    schema: 1,
    id,
    title: 'Scène factice',
    together: false,
    roles: { a: 'Au levier', b: 'Au quai' },
    trigger: null,
    beats,
  };
}

function startScene(content: Content, id: string): ReturnType<typeof newSim> {
  const sim = newSim(content);
  wait(sim, 0.2);
  const story = sim.world.common.story;
  if (story !== undefined) {
    story.scene = null;
    story.queue = [];
  }
  expect(queueScene(contextOf(sim), id, 0, HOOKS)).toBe(true);
  return sim;
}

function holding(...players: PlayerIndex[]): [StepInput, StepInput] {
  return [
    { ...idleInput(0), act: players.includes(0) },
    { ...idleInput(0), act: players.includes(1) },
  ];
}

describe('écran de fin de chapitre', () => {
  const ending = {
    id: 'a-suivre',
    title: 'Chapitre 1 : Aubrune',
    lines: ['Le train repart.', 'Demain, la ville.'],
  };

  it('les deux voient le titre et le texte; chacun sait quand l’autre a fini, et l’écran part quand les deux ont fermé', () => {
    const content = contentWith((files) => {
      files[`lieux/${PLACE}/scenes/depart.json`] = sceneFile('depart', [
        { do: 'effects', effects: [{ type: 'travel_to', place: 'lieu-a-venir', ending }] },
        { do: 'wait', seconds: 0.5 },
      ]);
    });
    const sim = startScene(content, 'depart');
    const events = wait(sim, 0.9 + STORY.departureDelaySeconds);
    // L'événement qui annonce l'écran part, et chaque joueur en lit le modèle.
    expect(events).toContainEqual({ type: 'chapter_ended', place: PLACE, ending: 'a-suivre' });
    for (const player of [0, 1] as const)
      expect(chapterEndModel(sim.world, sim.content, player)).toMatchObject({
        title: 'Chapitre 1 : Aubrune',
        lines: ['Le train repart.', 'Demain, la ville.'],
        closed: false,
        otherClosed: false,
      });
    act(sim, 1, { type: 'chapter_end_close' });
    expect(chapterEndModel(sim.world, sim.content, 0)).toMatchObject({
      closed: false,
      otherClosed: true,
    });
    expect(chapterEndModel(sim.world, sim.content, 1)).toMatchObject({ closed: true });
    act(sim, 0, { type: 'chapter_end_close' });
    expect(chapterEndModel(sim.world, sim.content, 0)).toBeNull();
    expect(chapterEndModel(sim.world, sim.content, 1)).toBeNull();
  });
});

describe('gestes des scènes à deux: ce que chaque joueur voit', () => {
  const beats: Json[] = [
    {
      do: 'await',
      parts: [
        { role: 'a', hint: 'Tiens le levier.', done: [], gesture: { type: 'hold', seconds: 1 } },
        {
          role: 'b',
          hint: 'Reste au quai.',
          done: [],
          gesture: { type: 'stand', point: 'quai', seconds: 0.5 },
        },
      ],
      together: 0.5,
    },
    {
      do: 'await',
      parts: [
        { role: 'a', hint: 'Appuie avec l’autre.', done: [], gesture: { type: 'press' } },
        { role: 'b', hint: 'Appuie avec l’autre.', done: [], gesture: { type: 'press' } },
      ],
      together: 0.3,
    },
    { do: 'wait', seconds: 0.1 },
  ];

  function moveTo(sim: ReturnType<typeof newSim>, player: PlayerIndex, point: string): void {
    const at = sim.content.places[PLACE]?.map.points[point];
    if (at === undefined) throw new Error(point);
    sim.world.players[player].body.x = at.x;
    sim.world.players[player].body.y = at.y;
  }

  it('chacun voit sa consigne, sa jauge, celle de l’autre, le point à atteindre et le moment ensemble', () => {
    const sim = startScene(
      contentWith((files) => {
        files[`lieux/${PLACE}/scenes/gestes.json`] = sceneFile('gestes', beats);
      }),
      'gestes',
    );
    moveTo(sim, 1, 'guichet');
    wait(sim, 0.4, holding(0));
    const mine = sceneCardModel(sim.world, sim.content, 0);
    if (mine === null) throw new Error('attente');
    expect(mine).toMatchObject({ roleName: 'Au levier', together: 0.5, hasGesture: true });
    expect(mine.rows.map((r) => [r.who, r.gesture?.type, r.state])).toEqual([
      ['me', 'hold', 'active'],
      ['other', 'stand', 'idle'],
    ]);
    expect(mine.ensemble).toBe(false);
    // L'autre joueur, lui, a son geste en premier: se tenir au quai, loin pour l'instant.
    const theirs = sceneCardModel(sim.world, sim.content, 1);
    expect(theirs?.rows[0]?.gesture?.type).toBe('stand');
    expect(theirs?.rows[0]?.gesture?.target?.distance).toBeGreaterThan(5);
    expect(theirs?.rows[0]?.gesture?.target?.radius).toBeGreaterThan(0);
    // Les deux gestes tenus en même temps: le moment « ensemble ».
    moveTo(sim, 1, 'quai');
    wait(sim, 0.2, holding(0));
    expect(sceneCardModel(sim.world, sim.content, 0)).toMatchObject({
      ensemble: true,
      allDone: false,
    });
    // La suite: deux appuis ensemble, consigne identique pour les deux rôles.
    wait(sim, 1, holding(0));
    const press = sceneCardModel(sim.world, sim.content, 1);
    expect(press?.rows.map((r) => r.gesture?.type)).toEqual(['press', 'press']);
    expect(press?.beat).toBe(1);
  });

  it('la touche répond tout de suite: l’écho local avance avant l’hôte, sans jamais afficher « fait »', () => {
    const sim = startScene(
      contentWith((files) => {
        files[`lieux/${PLACE}/scenes/gestes.json`] = sceneFile('gestes', beats);
      }),
      'gestes',
    );
    const card = sceneCardModel(sim.world, sim.content, 0);
    const row = card?.rows[0];
    if (row === undefined) throw new Error('consigne');
    // Rien n'est encore arrivé de l'hôte: la jauge de la touche tenue bouge quand même.
    expect(shownProgress(row, null)).toBe(0);
    expect(shownProgress(row, 100)).toBeGreaterThan(0);
    expect(shownProgress(row, 100)).toBeCloseTo(0.1, 1);
    expect(shownProgress(row, 5000)).toBeLessThanOrEqual(HISTOIRE_SETTINGS.echoCap);
    expect(shownState(row, 100)).toBe('active');
    expect(shownState(row, null)).toBe('idle');
    // L'autre joueur n'a pas d'écho: on ne voit de lui que ce que l'hôte dit.
    const other = card?.rows[1];
    if (other === undefined) throw new Error('autre');
    expect(shownProgress(other, 5000)).toBe(0);
  });
});

// Tirets cadratin et demi-cadratin: interdits partout (écrits par leur code pour ne pas les mettre ici).
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`, 'u');

describe('options de dialogue impossibles: leur raison en clair', () => {
  const dialogue = {
    schema: 1,
    id: 'echange-factice',
    villager: CHEF,
    priority: 1000,
    when: [],
    once: null,
    start: 'choix',
    nodes: {
      choix: {
        kind: 'choice',
        options: [
          {
            id: 'payer',
            text: 'Deux pommes, une pour chacun.',
            when: [],
            effects: [
              { type: 'take_money', amount: 250 },
              { type: 'give_item', item: 'pomme', count: 1, to: 'duo' },
            ],
            next: null,
          },
          {
            id: 'rendre',
            text: 'Je te rends ta pomme.',
            when: [],
            effects: [{ type: 'take_item', item: 'pomme', count: 1, to: 'duo' }],
            next: null,
          },
          { id: 'causer', text: 'Il fait beau.', when: [], effects: [], next: null },
        ],
      },
    },
  };

  it('chaque raison a son texte, l’option reste dans la vue avec sa raison, et change avec l’état', () => {
    const sim = newSim(
      contentWith((files) => {
        files[`lieux/${PLACE}/dialogues/echange-factice.json`] = dialogue;
      }),
    );
    sim.world.players[0].money = 100;
    expect(startTalk(contextOf(sim), 0, CHEF)).toBe(true);
    const view = talkView(sim.content, sim.world, 0);
    const reasons = Object.fromEntries((view?.options ?? []).map((o) => [o.id, o.blocked]));
    expect(reasons).toEqual({ payer: 'not-enough-money', rendre: 'missing-item', causer: null });
    expect(blockedText('not-enough-money', 'Sacha')).toBe(
      TEXTS.dialogue.blocked['not-enough-money'],
    );
    // Les raisons « chez l'autre » nomment l'autre joueur.
    expect(blockedText('other-pockets-full', 'Sacha')).toContain('Sacha');
    expect(blockedText('other-not-enough-money', 'Sacha')).toContain('Sacha');
    // L'argent arrive: l'option se débloque dans la vue (l'écran se redessine sans changer de nœud).
    sim.world.players[0].money = 1000;
    const later = talkView(sim.content, sim.world, 0);
    expect(later?.options.find((o) => o.id === 'payer')?.blocked).toBeNull();
  });

  it('les six raisons sont écrites, sans le texte générique ni tiret', () => {
    const entries = Object.entries(TEXTS.dialogue.blocked);
    expect(entries).toHaveLength(6);
    for (const [key, text] of entries) {
      expect(text, key).not.toBe(TEXTS.dialogue.blockedDefault);
      expect(text, key).not.toMatch(DASHES);
    }
  });
});

describe('carnet: les suites d’une même histoire en une carte', () => {
  const line = (
    id: string,
    over: Partial<Parameters<typeof questsModel>[0][number]> = {},
  ): Parameters<typeof questsModel>[0][number] => ({
    id,
    kind: 'main',
    title: id,
    giver: null,
    chapters: [{ id: 'c', title: 'c', state: 'current' }],
    finished: false,
    step: `étape de ${id}`,
    together: false,
    target: null,
    ...over,
  });
  const act = (n: number, finished: boolean): ReturnType<typeof line> =>
    line(`acte-${String(n)}`, {
      saga: { id: 'aubrune', title: 'Aubrune', act: n },
      finished,
      step: finished ? '' : `étape de l’acte ${String(n)}`,
      chapters: [{ id: 'c', title: 'c', state: finished ? 'done' : 'current' }],
    });

  it('trois actes ne font qu’une carte: l’acte en cours est déplié, les autres tiennent sur une ligne', () => {
    const lines = [act(3, false), act(1, true), act(2, true), line('lavoir', { kind: 'side' })];
    const model = questsModel(lines, null, null);
    // Une seule carte pour l'histoire (la principale), une pour la suite seule.
    expect(model.main?.acts?.map((a) => [a.act, a.state, a.open])).toEqual([
      [1, 'done', false],
      [2, 'done', false],
      [3, 'current', true],
    ]);
    expect(model.main?.title).toBe('Aubrune');
    expect(model.main?.id).toBe('acte-3');
    expect(model.others.map((c) => c.title)).toEqual(['lavoir']);
    expect(model.others[0]?.acts).toBeNull();
    // Le détail d'un acte dit de quelle histoire il est; la sélection démarre sur l'acte en cours.
    expect(model.selected).toBe('acte-3');
    expect(model.detail?.saga).toEqual({ title: 'Aubrune', act: 3 });
    // Z et S passent d'un acte à l'autre, dans l'ordre; les actes finis se consultent.
    expect(orderQuests(lines).map((l) => l.id)).toEqual(['acte-1', 'acte-2', 'acte-3', 'lavoir']);
    expect(questsModel(lines, null, 'acte-1').detail?.step).toBe(TEXTS_DONE());
    expect(turnQuestPage(lines, 'acte-3', 1)).toBeNull();
  });

  it('une histoire finie reste en carte principale s’il n’y en a pas d’autre, tous ses actes repliés', () => {
    const lines = [act(1, true), act(2, true), line('lavoir', { kind: 'side' })];
    const model = questsModel(lines, null, null);
    expect(model.main).toMatchObject({ title: 'Aubrune', finished: true });
    expect(model.main?.acts?.every((a) => !a.open && a.state === 'done')).toBe(true);
    expect(model.others.map((c) => c.title)).toEqual(['lavoir']);
  });

  it('le carnet lit la saga des données (journal): deux suites du même acte-histoire se regroupent', () => {
    const sim = newSim(
      contentWith((files) => {
        for (const id of ['acte-un', 'acte-deux'])
          for (const file of plan(TEMPLATE_DIR, 'quete', id, PLACE))
            files[file.path] = {
              ...file.value,
              saga: { id: 'histoire', title: 'Histoire', act: id === 'acte-un' ? 1 : 2 },
            };
      }),
    );
    wait(sim, 0.3);
    const lines = worldSources(sim.content).quests(sim.world, 0);
    const sagas = lines.filter((l) => l.saga?.id === 'histoire');
    expect(sagas.map((l) => l.saga?.act).sort()).toEqual([1, 2]);
    const model = questsModel(lines, null, null);
    const card = [model.main, ...model.others].find(
      (c) => c?.acts !== null && c?.acts !== undefined,
    );
    expect(card?.acts).toHaveLength(2);
    expect(card?.title).toBe('Histoire');
  });
});

function TEXTS_DONE(): string {
  return 'Tout est dit. Merci pour ton aide.';
}
