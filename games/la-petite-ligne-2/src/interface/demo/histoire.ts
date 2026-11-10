/**
 * États de démonstration de l'histoire à l'écran (ancres de `demo/index.html`):
 * `#fin-de-chapitre`, `-attente` (tu as continué), `-autre` (l'autre a fini);
 * `#geste-tenir`, `#geste-point`, `#geste-ensemble`, `#geste-appuyer`, `#geste-rate`;
 * `#dialogue-bloque` (argent et objet), `#dialogue-bloque-autre` (poches de l'autre);
 * répliques de scène: `#scene-replique` (en écriture), `-finie`, `#scene-deux` (un joueur répond,
 * l'autre a lu), `#scene-attente` (tu as lu), `#scene-pour-toi`, `#scene-autre` (pour l'autre
 * seul), `#scene-fondu` (noir), `-replique` (réplique sur le noir), `#scene-pages` (page 2),
 * `#scene-gestes` (réplique sous la carte « Ensemble »);
 * `#carnet-quetes-histoire` (deux actes, vraies suites d'Aubrune), `-histoire-3` (trois actes).
 * Les fiches d'essai (scènes, dialogue) sont ajoutées au contenu par `histoireFiles`, sans toucher
 * aux données du jeu.
 */
import type { WorldState } from '../../etat/monde';
import type { StoryState } from '../../donnees/schemas/scene';
import { SIM_DT } from '../../simulation/noyau/constantes';
import type { GameEvent } from '../../simulation/noyau/evenements';

type Json = Record<string, unknown>;

const PLACE = 'essai-gare';
const CHEF = 'cheffe-de-gare';

const ROLES = { a: 'Au levier', b: 'Au quai' };

function scene(id: string, title: string, parts: Json[], together: number | null): Json {
  return {
    schema: 1,
    id,
    title,
    together: false,
    roles: ROLES,
    trigger: null,
    beats: [
      {
        do: 'await',
        parts,
        ...(together === null ? {} : { together }),
      },
    ],
  };
}

/** Fiches ajoutées au contenu de la démonstration. */
export function histoireFiles(): Record<string, Json> {
  const levier = scene(
    'demo-levier',
    'Le levier',
    [
      {
        role: 'a',
        hint: 'Tiens le levier pendant que l’autre se met au bout du quai.',
        done: [],
        gesture: { type: 'hold', seconds: 2 },
      },
      {
        role: 'b',
        hint: 'Reste au bout du quai, le temps que le levier tienne.',
        done: [],
        gesture: { type: 'stand', point: 'quai', radius: 2, seconds: 1.5 },
      },
    ],
    0.5,
  );
  const appuis = scene(
    'demo-appuis',
    'Les deux sonnettes',
    [
      {
        role: 'a',
        hint: 'Sonne le guichet en même temps que l’autre sonne le quai.',
        done: [],
        gesture: { type: 'press' },
      },
      {
        role: 'b',
        hint: 'Sonne le quai en même temps que l’autre sonne le guichet.',
        done: [],
        gesture: { type: 'press' },
      },
    ],
    0.6,
  );
  const fin = {
    schema: 1,
    id: 'demo-fin',
    title: 'Le dernier quai',
    together: false,
    roles: null,
    trigger: null,
    beats: [
      {
        do: 'effects',
        effects: [
          {
            type: 'travel_to',
            place: 'hautefonte',
            ending: {
              id: 'fin-aubrune',
              title: 'Chapitre 1 : Aubrune',
              lines: [
                'Le train de 5 h 12 est reparti sans bruit, comme on referme une porte.',
                'Sur le quai, il reste une odeur de pain chaud, deux valises et une lettre pas tout à fait lue.',
                'Demain, la ville.',
              ],
            },
          },
        ],
      },
    ],
  };
  const dialogue = {
    schema: 1,
    id: 'echange-demo',
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
            text: 'Prendre deux pommes, une pour chacun (2,50 €).',
            when: [],
            effects: [
              { type: 'take_money', amount: 250 },
              { type: 'give_item', item: 'pomme', count: 1, to: 'duo' },
            ],
            next: null,
          },
          {
            id: 'rendre',
            text: 'Rendre la pomme de l’autre fois.',
            when: [],
            effects: [{ type: 'take_item', item: 'pomme', count: 1, to: 'duo' }],
            next: null,
          },
          { id: 'causer', text: 'Parler du temps qu’il fait.', when: [], effects: [], next: null },
        ],
      },
    },
  };
  // Répliques: un habitant, un joueur qui lui répond, le récit pour un seul rôle, un fondu, une
  // réplique longue (deux pages) avec un accord au lecteur.
  const say = (who: string, to: string, text: string, extra: Json = {}): Json => ({
    do: 'say',
    who,
    text,
    emote: null,
    sound: null,
    to,
    seconds: null,
    ...extra,
  });
  const repliques = {
    schema: 1,
    id: 'demo-repliques',
    title: 'Firmin en pantoufles',
    together: false,
    roles: { a: 'Sur le banc', b: 'Sur le banc' },
    trigger: null,
    beats: [
      say(
        'firmin',
        'both',
        'Ho\u202f! Ho là\u202f! Personne n’est descendu ici depuis trente ans\u202f!',
        {
          emote: 'surprise',
          sound: 'Flap flap flap',
        },
      ),
      say('a', 'both', 'On a dormi sur le banc\u202f? Je ne me souviens de rien du tout.', {
        emote: 'question',
      }),
      say('narrator', 'a', 'Dans ta poche, pourtant, un billet poinçonné. Terminus, Aubrune.'),
      say('narrator', 'b', 'Dans ta poche, pourtant, un billet poinçonné. Terminus, Aubrune.'),
      { do: 'fade', to: 'black', seconds: 1.5 },
      say(
        'firmin',
        'both',
        'Te voilà [[réveillée|réveillé]], c’est déjà ça. Ça se garde longtemps, un billet. Bon. Il est 8 h et des poussières, et je n’aime pas les poussières. La pension est en haut de la rue, la pompe derrière la halle. Qu’est-ce que vous voulez\u202f?',
        { emote: 'joy' },
      ),
    ],
  };
  const levierSuite = scene(
    'demo-levier-suite',
    'Le levier',
    [
      {
        role: 'a',
        hint: 'Tiens le levier pendant que l’autre se met au bout du quai.',
        done: [],
        gesture: { type: 'hold', seconds: 2 },
      },
      {
        role: 'b',
        hint: 'Reste au bout du quai, le temps que le levier tienne.',
        done: [],
        gesture: { type: 'stand', point: 'quai', radius: 2, seconds: 1.5 },
      },
    ],
    0.5,
  );
  (levierSuite.beats as Json[]).push(
    say('cheffe-de-gare', 'both', 'Il a bougé\u202f! Trente ans que ce levier n’avait pas bougé.', {
      emote: 'surprise',
    }),
  );
  return {
    // Firmin est un habitant d'Aubrune: la scène y est rangée (le validateur le demande).
    [`lieux/aubrune/scenes/demo-repliques.json`]: repliques,
    [`lieux/${PLACE}/scenes/demo-levier-suite.json`]: levierSuite,
    [`lieux/${PLACE}/scenes/demo-levier.json`]: levier,
    [`lieux/${PLACE}/scenes/demo-appuis.json`]: appuis,
    [`lieux/${PLACE}/scenes/demo-fin.json`]: fin,
    [`lieux/${PLACE}/dialogues/echange-demo.json`]: dialogue,
  };
}

export interface HistoireSetup {
  /** La démonstration projette le monde à l'écran (point à atteindre). */
  readonly project: boolean;
  /** Événement à émettre une fois l'interface posée. */
  readonly event: GameEvent | null;
  /** Aucune bulle d'action: la scène a la main. */
  readonly noAim: boolean;
  /** Touches à jouer après la pose (ms depuis la pose). */
  readonly keys?: readonly { readonly at: number; readonly code: string }[];
  /** Changement d'état plus tard (ms depuis la pose), avec les événements à émettre. */
  readonly later?: { readonly at: number; readonly apply: () => readonly GameEvent[] };
}

/** Pose l'état de l'ancre; renvoie ce qu'il faut de plus (projection, événement). */
export function setupHistoire(state: string, world: WorldState): HistoireSetup {
  const me = world.players[0];
  const other = world.players[1];
  const story: StoryState = world.common.story ?? { tracked: [null, null], scene: null, queue: [] };
  world.common.story = story;
  world.tick = 4000;
  const seconds = (s: number): number => world.tick - Math.round(s / SIM_DT);

  if (state.startsWith('fin-de-chapitre')) {
    story.ending = {
      place: PLACE,
      id: 'fin-aubrune',
      closed: [state === 'fin-de-chapitre-attente', state === 'fin-de-chapitre-autre'],
    };
    return { project: false, event: null, noAim: false };
  }

  const run = (id: string, roleA: 0 | 1): NonNullable<StoryState['scene']> => ({
    id,
    place: PLACE,
    beat: 0,
    since: seconds(3),
    roleA,
    read: [true, true],
    parts: [false, false],
    camera: null,
    fade: 'clear',
  });
  const quai = { x: 20, y: 4 };

  // Répliques de scène (`demo-repliques`): temps choisi, lectures, fondu.
  const lines: Readonly<Record<string, { beat: number; read: [boolean, boolean]; black?: true }>> =
    {
      'scene-replique': { beat: 0, read: [false, false] },
      'scene-replique-finie': { beat: 0, read: [false, false] },
      'scene-deux': { beat: 1, read: [false, true] },
      'scene-attente': { beat: 0, read: [true, false] },
      'scene-pour-toi': { beat: 2, read: [false, false] },
      'scene-autre': { beat: 3, read: [false, false] },
      'scene-fondu': { beat: 4, read: [false, false], black: true },
      'scene-fondu-replique': { beat: 5, read: [false, false], black: true },
      'scene-pages': { beat: 5, read: [false, false] },
    };
  const line = lines[state];
  if (line !== undefined) {
    const r = { ...run('demo-repliques', 0), place: 'aubrune' };
    r.beat = line.beat;
    r.read = line.read;
    if (line.black === true) r.fade = 'black';
    story.scene = r;
    // Fin de l'écriture (Espace), et pour les pages: la page suivante, écrite d'un coup.
    const finished = state !== 'scene-replique' && state !== 'scene-fondu';
    const keys = finished ? [{ at: 700, code: 'Space' }] : [];
    if (state === 'scene-pages')
      keys.push({ at: 1100, code: 'Space' }, { at: 1400, code: 'Space' });
    return { project: false, event: null, noAim: true, keys };
  }
  if (state === 'scene-gestes') {
    // Les deux tiennent: le geste réussit, la réplique suivante arrive sous la carte « Ensemble ».
    const r = run('demo-levier-suite', 0);
    r.gestures = [
      { down: true, since: seconds(1.9) },
      { down: true, since: seconds(1.4) },
    ];
    story.scene = r;
    other.body.x = quai.x;
    other.body.y = quai.y;
    return {
      project: false,
      event: null,
      noAim: true,
      keys: [{ at: 900, code: 'Space' }],
      later: {
        at: 250,
        apply: () => {
          r.parts = [true, true];
          r.beat = 1;
          r.read = [false, false];
          delete r.gestures;
          return [0, 1].map((player) => ({
            type: 'scene_gesture' as const,
            scene: 'demo-levier-suite',
            part: player,
            player: player === 0 ? (0 as const) : (1 as const),
            state: 'done' as const,
          }));
        },
      },
    };
  }

  if (state === 'geste-tenir') {
    // Toi au levier: tu tiens la touche depuis 0,9 s sur 2 s; l'autre n'est pas encore au quai.
    const r = run('demo-levier', 0);
    r.gestures = [
      { down: true, since: seconds(0.9) },
      { down: false, since: null },
    ];
    story.scene = r;
    other.body.x = 24;
    other.body.y = 9;
  } else if (state === 'geste-point') {
    // Toi au quai, loin du point; l'autre tient le levier (1,2 s sur 2).
    const r = run('demo-levier', 1);
    r.gestures = [
      { down: true, since: seconds(1.2) },
      { down: false, since: null },
    ];
    story.scene = r;
    me.body.x = 12;
    me.body.y = 10;
    other.body.x = 18;
    other.body.y = 8;
    return { project: true, event: null, noAim: true };
  } else if (state === 'geste-ensemble') {
    const r = run('demo-levier', 0);
    r.gestures = [
      { down: true, since: seconds(1.7) },
      { down: true, since: seconds(1.3) },
    ];
    story.scene = r;
    other.body.x = quai.x;
    other.body.y = quai.y;
  } else if (state === 'geste-appuyer') {
    const r = run('demo-appuis', 0);
    r.gestures = [
      { down: false, since: seconds(0.2) },
      { down: false, since: null },
    ];
    r.parts = [true, false];
    story.scene = r;
  } else if (state === 'geste-rate') {
    const r = run('demo-levier', 0);
    r.gestures = [
      { down: false, since: null },
      { down: false, since: null },
    ];
    story.scene = r;
    return {
      project: false,
      noAim: true,
      event: { type: 'scene_gesture', scene: 'demo-levier', part: 1, player: 1, state: 'lost' },
    };
  } else if (state.startsWith('dialogue-bloque')) {
    me.talk = { villager: CHEF, dialogue: 'echange-demo', node: 'choix' };
    me.money = 100;
    if (state === 'dialogue-bloque-autre') {
      // Chez l'autre, toutes les cases sont prises: la pomme offerte à chacun ne tient pas.
      me.money = 5000;
      other.toolbar.forEach((_, i) => {
        other.toolbar[i] = { item: i % 2 === 0 ? 'hache' : 'pain', count: 1 };
      });
    }
  }
  return { project: false, event: null, noAim: state.startsWith('geste-') };
}
