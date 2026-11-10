// Manques du moteur révélés par l'écriture des actes 2 et 3 (ecriture-actes-2-3.md, sections 8
// et 9): chaque nouveauté est essayée par un exemplaire factice ajouté par le test, sans code.
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ContentError, type Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { bondKey } from '../src/etat/progression';
import { BUDGET_BYTES } from '../src/reseau/canaux';
import { basePrice } from '../src/simulation/commerces/prix';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { HOOKS } from '../src/simulation/quetes/crochets';
import { chapterEndView, journal } from '../src/simulation/quetes/lecture';
import { STORY } from '../src/simulation/quetes/reglages';
import { queueScene } from '../src/simulation/scenes/lecteur';
import { sceneView } from '../src/simulation/scenes/lecture';
import { giveItem } from '../src/simulation/sac/actions';
import { countHeld } from '../src/simulation/regles/conditions';
import { plan } from '../outils/nouveau';
import { act, contentWith, contextOf, newSim, wait } from './aides-l3';
import { MEMBERS, SEED } from './aides';

type Json = Record<string, unknown>;
const PLACE = 'essai-gare';
const CHEF = 'cheffe-de-gare';
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));

function problemsWith(edit: (files: Record<string, Json>) => void): string[] {
  try {
    contentWith(edit);
    return [];
  } catch (error) {
    if (error instanceof ContentError) return [...error.problems];
    throw error;
  }
}

function moveTo(sim: Sim, player: PlayerIndex, point: string): void {
  const at = sim.content.places[PLACE]?.map.points[point];
  if (at === undefined) throw new Error(point);
  sim.world.players[player].body.x = at.x;
  sim.world.players[player].body.y = at.y;
}

/** Une scène factice du lieu d'essai, sans déclencheur, lancée par le test. */
function scene(id: string, beats: Json[], roles = true): Json {
  return {
    schema: 1,
    id,
    title: 'Scène factice',
    together: false,
    roles: roles ? { a: 'Au levier', b: 'Au quai' } : null,
    trigger: null,
    beats,
  };
}

function withScene(id: string, beats: Json[]): Content {
  return contentWith((files) => {
    files[`lieux/${PLACE}/scenes/${id}.json`] = scene(id, beats);
  });
}

function startScene(content: Content, id: string): Sim {
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

/** Commandes d'un pas: touche d'action tenue par ces joueurs. */
function holding(...players: PlayerIndex[]): [StepInput, StepInput] {
  return [
    { ...idleInput(0), act: players.includes(0) },
    { ...idleInput(0), act: players.includes(1) },
  ];
}

describe('habitants: planning changé pendant une conversation', () => {
  it('il écoute sur place, puis reprend son planning courant à la fin de la conversation', () => {
    const content = contentWith((all) => {
      for (const file of plan(TEMPLATE_DIR, 'habitant', 'facteur', PLACE))
        all[file.path] = file.value;
    });
    const world = createWorld(content, SEED, MEMBERS);
    world.minutes = 11 * 60 + 59;
    world.players[0].body = { x: 17, y: 18, facing: 0, speed: 0 };
    world.players[1].body = { x: 23, y: 18, facing: 0, speed: 0 };
    const sim = createSim(content, world);
    wait(sim, 0.2);
    const facteur = sim.world.places[PLACE]?.villagers.facteur;
    if (facteur?.life === undefined) throw new Error('facteur');
    expect(facteur.life.activity).toBe('travailler');
    const post = { x: facteur.body.x, y: facteur.body.y };
    // On lui parle; midi sonne: sa ligne change pendant la conversation.
    facteur.talkingWith = 0;
    sim.world.minutes = 12 * 60;
    wait(sim, 1.5);
    expect(facteur.body).toMatchObject(post);
    expect(facteur.life).toMatchObject({ pose: 'stand', activity: null });
    // Fin de la conversation: il part vers sa flânerie au lieu de la commencer sur place.
    facteur.talkingWith = null;
    wait(sim, 0.5);
    expect(facteur.life.pose).toBe('walk');
    wait(sim, 6);
    expect(facteur.life.activity).toBe('flaner');
    expect(facteur.body).toMatchObject({ x: 18.5, y: 20 });
  });
});

describe('effets de dialogue: amitié, argent, objets pour chacun, refus expliqués', () => {
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
              { type: 'change_bond', villager: CHEF, points: 30 },
            ],
            next: null,
          },
          {
            id: 'rendre',
            text: 'Je te rends tes pommes.',
            when: [],
            effects: [],
            next: 'reprise',
          },
          {
            id: 'facher',
            text: 'Ton train est en retard.',
            when: [],
            effects: [{ type: 'change_bond', villager: CHEF, points: -500 }],
            next: null,
          },
        ],
      },
      reprise: {
        kind: 'effects',
        effects: [
          { type: 'take_item', item: 'pomme', count: 1, to: 'duo' },
          { type: 'give_money', amount: 100, to: 'duo' },
        ],
        next: 'merci',
        otherwise: 'manque',
      },
      merci: { kind: 'line', speaker: CHEF, text: 'Merci !', emote: null, next: null },
      manque: { kind: 'line', speaker: CHEF, text: 'Il en manque une.', emote: null, next: null },
    },
  };
  const content = contentWith((files) => {
    files[`lieux/${PLACE}/dialogues/echange-factice.json`] = dialogue;
  });

  function choose(sim: Sim, player: PlayerIndex, option: string): Sim['events'] {
    if (sim.world.players[player].talk === null)
      expect(startTalk(contextOf(sim), player, CHEF)).toBe(true);
    return act(sim, player, { type: 'talk_choose', option });
  }

  it('paiement refusé faute d’argent, puis payé: une pomme à chacun et des points d’amitié', () => {
    const sim = newSim(content);
    sim.world.players[0].money = 200;
    const refused = choose(sim, 0, 'payer');
    expect(refused).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-enough-money',
      target: CHEF,
    });
    // Le choix reste ouvert, marqué d'avance pour l'interface.
    const option = talkView(sim.content, sim.world, 0)?.options.find((o) => o.id === 'payer');
    expect(option?.blocked).toBe('not-enough-money');
    sim.world.players[0].money = 300;
    choose(sim, 0, 'payer');
    expect(sim.world.players[0].money).toBe(50);
    expect(countHeld(sim.world.players[0], 'pomme')).toBe(1);
    expect(countHeld(sim.world.players[1], 'pomme')).toBe(1);
    const bond = sim.world.progress.bonds[bondKey(CHEF, 0)] ?? 0;
    expect(bond).toBeGreaterThanOrEqual(30);
    // Une perte ne descend pas sous zéro (on clôt d'abord la page de la buvette, défaut D2).
    act(sim, 0, { type: 'talk_close' });
    choose(sim, 0, 'facher');
    expect(sim.world.progress.bonds[bondKey(CHEF, 0)]).toBe(0);
  });

  it('poches de l’autre pleines: refus nommé; objet manquant: le bloc d’effets part sur `otherwise`', () => {
    const sim = newSim(content);
    sim.world.players[0].money = 1000;
    const other = sim.world.players[1];
    other.toolbar.fill({ item: 'buche', count: 5 });
    if (other.bag !== null) other.bag.slots.fill({ item: 'buche', count: 5 });
    expect(choose(sim, 0, 'payer')).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'other-pockets-full',
      target: CHEF,
    });
    expect(sim.world.players[0].money).toBe(1000);
    act(sim, 0, { type: 'talk_close' });
    // L'un tient une pomme, l'autre non: rien n'est repris ni payé, l'habitant le dit.
    giveItem(contextOf(sim), 0, 'pomme', 1);
    const events = choose(sim, 0, 'rendre');
    expect(events.some((e) => e.type === 'refused' && e.reason === 'other-missing-item')).toBe(
      true,
    );
    expect(sim.world.players[0].talk?.node).toBe('manque');
    expect(countHeld(sim.world.players[0], 'pomme')).toBe(1);
    expect(sim.world.players[0].money).toBe(1000);
  });

  it('validateur: amitié avec un habitant inconnu', () => {
    const problems = problemsWith((files) => {
      files[`lieux/${PLACE}/dialogues/echange-factice.json`] = {
        ...dialogue,
        nodes: {
          ...dialogue.nodes,
          merci: {
            kind: 'effects',
            effects: [{ type: 'change_bond', villager: 'personne', points: 5 }],
            next: null,
          },
        },
      };
    });
    expect(problems.some((p) => p.includes('habitant inconnu « personne »'))).toBe(true);
  });
});

describe('gestes des scènes à deux rôles', () => {
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

  it('tenir et se tenir ensemble, puis appuyer ensemble: l’hôte suit chaque geste', () => {
    const sim = startScene(withScene('gestes', beats), 'gestes');
    moveTo(sim, 1, 'guichet');
    // Le levier tenu seul ne suffit pas: l'autre n'est pas au quai.
    let events = wait(sim, 1.5, holding(0));
    expect(events).toContainEqual({
      type: 'scene_gesture',
      scene: 'gestes',
      part: 0,
      player: 0,
      state: 'start',
    });
    expect(sim.world.common.story?.scene?.beat).toBe(0);
    expect(JSON.stringify(sim.world.common).length).toBeLessThan(BUDGET_BYTES.common);
    const view = sceneView(sim.world, sim.content, 0);
    expect(view?.beat).toMatchObject({ kind: 'await', together: 0.5 });
    if (view?.beat.kind !== 'await') throw new Error('attente');
    expect(view.beat.hints[0]?.gesture).toMatchObject({ type: 'hold', progress: 1, down: true });
    // L'autre arrive au quai pendant que le levier est tenu: le temps passe.
    moveTo(sim, 1, 'quai');
    events = wait(sim, 0.7, holding(0));
    expect(events.filter((e) => e.type === 'scene_gesture' && e.state === 'done')).toHaveLength(2);
    expect(sim.world.common.story?.scene?.beat).toBe(1);
    // Appuis à une seconde d'écart: le premier expire.
    wait(sim, 0.1, holding(0));
    events = wait(sim, 1, holding());
    expect(events).toContainEqual(expect.objectContaining({ state: 'expired', player: 0 }));
    wait(sim, 0.1, holding(1));
    expect(sim.world.common.story?.scene?.beat).toBe(1);
    // Ensemble: la scène va au bout.
    wait(sim, 0.5, holding());
    wait(sim, 0.1, holding(0, 1));
    wait(sim, 0.5, holding());
    expect(sim.world.common.story?.scene ?? null).toBeNull();
  });

  it('validateur: un geste se confie à un rôle, et une partie sans condition demande un geste', () => {
    const problems = problemsWith((files) => {
      files[`lieux/${PLACE}/scenes/fautive.json`] = scene('fautive', [
        {
          do: 'await',
          parts: [
            { role: 'any', hint: 'Appuie.', done: [], gesture: { type: 'press' } },
            { role: 'b', hint: 'Rien.', done: [] },
          ],
        },
      ]);
    });
    expect(problems.some((p) => p.includes('un geste se confie à un rôle'))).toBe(true);
    expect(problems.some((p) => p.includes('partie sans condition ni geste'))).toBe(true);
  });
});

describe('départ en train par un effet', () => {
  const ending = {
    id: 'a-suivre',
    title: 'À suivre',
    lines: ['La suite arrive bientôt, [[chère|cher]] voyageur.'],
  };

  it('vers un lieu à venir: écran de fin de chapitre, fermé par chacun', () => {
    const content = withScene('depart', [
      { do: 'effects', effects: [{ type: 'travel_to', place: 'lieu-a-venir', ending }] },
      { do: 'wait', seconds: 0.5 },
    ]);
    const sim = startScene(content, 'depart');
    wait(sim, 0.4);
    // La scène n'est pas finie: le départ attend.
    expect(sim.world.common.story?.departure?.to).toBe('lieu-a-venir');
    const events = wait(sim, 0.4 + STORY.departureDelaySeconds);
    expect(events).toContainEqual({ type: 'chapter_ended', place: PLACE, ending: 'a-suivre' });
    expect(sim.world.common.place).toBe(PLACE);
    expect(JSON.stringify(sim.world.common).length).toBeLessThan(BUDGET_BYTES.common);
    expect(chapterEndView(sim.world, sim.content, 0)).toMatchObject({
      title: 'À suivre',
      closed: false,
    });
    expect(chapterEndView(sim.world, sim.content, 0)?.lines[0]).toMatch(/voyageur\.$/);
    act(sim, 0, { type: 'chapter_end_close' });
    expect(chapterEndView(sim.world, sim.content, 0)?.closed).toBe(true);
    act(sim, 1, { type: 'chapter_end_close' });
    expect(chapterEndView(sim.world, sim.content, 1)).toBeNull();
  });

  it('vers un lieu du jeu: les deux partent, sans quai ni ligne', () => {
    const content = withScene('depart', [
      { do: 'effects', effects: [{ type: 'travel_to', place: 'essai-halte' }] },
    ]);
    const sim = startScene(content, 'depart');
    const events = wait(sim, STORY.departureDelaySeconds + 0.2);
    expect(events).toContainEqual({ type: 'train_departed', from: PLACE, to: 'essai-halte' });
    expect(sim.world.common).toMatchObject({ place: 'essai-halte', phase: 'travel' });
  });

  it('validateur: un lieu absent sans écran de fin', () => {
    const problems = problemsWith((files) => {
      files[`lieux/${PLACE}/scenes/perdue.json`] = scene('perdue', [
        { do: 'effects', effects: [{ type: 'travel_to', place: 'nulle-part' }] },
      ]);
    });
    expect(problems.some((p) => p.includes('« nulle-part » absent du jeu'))).toBe(true);
  });
});

describe('objets d’histoire et histoires en plusieurs suites', () => {
  it('un objet d’histoire ne se jette pas et ne se vend pas', () => {
    const content = contentWith((files) => {
      for (const file of plan(TEMPLATE_DIR, 'objet', 'lettre-factice', null))
        files[file.path] = { ...file.value, family: 'treasure', food: null, stack: 1, story: true };
      const shop = files[`lieux/${PLACE}/commerces/buvette-de-la-gare.json`] as { buys: Json[] };
      shop.buys.push({ item: 'lettre-factice', price: 500 }, { family: 'treasure', price: 100 });
    });
    const sim = newSim(content);
    giveItem(contextOf(sim), 0, 'lettre-factice', 1);
    const events = act(sim, 0, { type: 'drop', from: { area: 'toolbar', index: 0 } });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'story-item' }),
    );
    expect(countHeld(sim.world.players[0], 'lettre-factice')).toBe(1);
    const shop = content.places[PLACE]?.shops['buvette-de-la-gare'];
    if (shop === undefined) throw new Error('commerce');
    expect(basePrice(content, shop, 'lettre-factice')).toBeNull();
  });

  it('saga: le carnet lit l’histoire et le numéro d’acte; deux suites au même acte sont refusées', () => {
    const files =
      (act: number): ((all: Record<string, Json>) => void) =>
      (all) => {
        for (const id of ['acte-un', 'acte-deux'])
          for (const file of plan(TEMPLATE_DIR, 'quete', id, PLACE))
            all[file.path] = {
              ...file.value,
              saga: { id: 'histoire', title: 'Histoire', act: id === 'acte-un' ? 1 : act },
            };
      };
    const sim = newSim(contentWith(files(2)));
    wait(sim, 0.3);
    const sagas = journal(sim.world, sim.content, 0)
      .filter((entry) => entry.saga !== undefined)
      .map((entry) => [entry.quest, entry.saga?.act]);
    expect(sagas).toEqual(
      expect.arrayContaining([
        ['acte-un', 1],
        ['acte-deux', 2],
      ]),
    );
    expect(problemsWith(files(1)).some((p) => p.includes('acte 1 de « histoire » déjà tenu'))).toBe(
      true,
    );
  });
});
