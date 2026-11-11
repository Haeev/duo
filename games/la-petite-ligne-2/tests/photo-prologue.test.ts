// La photo du prologue: l'apparence d'un joueur reste cachée (silhouette) jusqu'à l'effet
// `reveal_look` des données; une réplique peut ouvrir un écran (`opens`), ici l'éditeur de
// personnage. Révélation, rechargement avant et après, migration des parties de la version 1,
// gabarit (un dialogue factice qui ouvre l'éditeur et révèle, sans une ligne de code).
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import type { Look } from '../src/donnees/schemas/personnage';
import { DATA_SCHEMA } from '../src/etat/monde';
import { outfitsModel } from '../src/interface/carnet/tenues';
import { createDialogueScreens } from '../src/interface/ecrans-dialogue';
import { defaultPlayerLook, resolveLook, silhouetteLook } from '../src/rendu/personnages/apparence';
import { readSave } from '../src/sauvegarde/format';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { startTalk, talkView, type TalkView } from '../src/simulation/dialogues/conversation';
import type { Intent } from '../src/simulation/noyau/entrees';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { lookRevealed, lookRevealedKey } from '../src/simulation/regles/apparence';
import { validateContent } from '../src/donnees/valider';
import { gameDataFiles, MEMBERS, SEED } from './aides';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { put } from './aides-noyau';
import { referenceSave } from './aides-sauvegarde';

type Json = Record<string, unknown>;

const content = loadContent(gameDataFiles());
const PLACE = content.settings.start.place;

/** Le dialogue du lieu de départ dont une réplique ouvre l'éditeur, trouvé dans les données. */
function photoDialogue(): { villager: string; node: string } {
  for (const dialogue of content.places[PLACE]?.dialogues ?? [])
    for (const [node, def] of Object.entries(dialogue.nodes))
      if (def.kind === 'line' && def.opens === 'character-editor')
        return { villager: dialogue.villager, node };
  throw new Error('aucune réplique du lieu de départ n’ouvre l’éditeur');
}

function newGame(): Sim {
  const sim = createSim(content, createWorld(content, SEED, MEMBERS));
  wait(sim, 0.5);
  return sim;
}

/** Le look de départ d'un joueur, tel que l'éditeur le valide sans rien changer. */
function starterLook(player: 0 | 1): Look {
  return defaultPlayerLook(
    player,
    'f',
    content.settings.start.shapes,
    '#c0563c',
    content.catalogue,
  );
}

/** Lit le dialogue jusqu'à la réplique qui ouvre l'éditeur (comme la touche Espace). */
function talkUntilPhoto(sim: Sim, player: 0 | 1): TalkView {
  const { villager, node } = photoDialogue();
  expect(startTalk(contextOf(sim), player, villager)).toBe(true);
  for (let i = 0; i < 8 && sim.world.players[player].talk?.node !== node; i++)
    act(sim, player, { type: 'talk_next' });
  const view = talkView(content, sim.world, player);
  if (view === null) throw new Error('dialogue fermé avant la photo');
  return view;
}

function reload(sim: Sim): ReturnType<typeof restoreWorld> {
  const snapshot = snapshotOf(sim.world, content);
  return restoreWorld(
    content,
    { dataSchema: snapshot.dataSchema, data: JSON.parse(JSON.stringify(snapshot.data)) },
    MEMBERS,
  );
}

describe('révélation à la photo', () => {
  it('une partie neuve commence sans visage: les deux joueurs sont cachés, sans apparence', () => {
    const sim = newGame();
    for (const p of [0, 1] as const) {
      expect(lookRevealed(sim.world, p)).toBe(false);
      expect(sim.world.players[p].look).toBeNull();
    }
    expect(outfitsModel(sim.world, 0).revealed).toBe(false);
  });

  it('là où aucune photo n’attend (lieu d’essai), on arrive avec son visage', () => {
    const elsewhere = contentWith(() => undefined);
    const world = createWorld(elsewhere, SEED, MEMBERS);
    expect(world.common.place).not.toBe(PLACE);
    expect([lookRevealed(world, 0), lookRevealed(world, 1)]).toEqual([true, true]);
  });

  it('la réplique de la photo déclare l’éditeur; valider compose, révèle ce joueur seul et fait avancer', () => {
    const sim = newGame();
    const view = talkUntilPhoto(sim, 0);
    expect(view.opens).toBe('character-editor');
    // Rien n'est révélé tant que la réplique n'est pas passée (l'éditeur est ouvert chez le joueur).
    expect(lookRevealed(sim.world, 0)).toBe(false);
    const look = starterLook(0);
    act(sim, 0, { type: 'set_look', name: 'Ada', look, gender: 'f' }, { type: 'talk_next' });
    expect(lookRevealed(sim.world, 0)).toBe(true);
    expect(sim.world.players[0].look).toEqual(look);
    expect(lookRevealed(sim.world, 1)).toBe(false);
    // Le dialogue a avancé jusqu'à la réplique suivante, il ne s'est pas fermé.
    expect(sim.world.players[0].talk).not.toBeNull();
    expect(talkView(content, sim.world, 0)?.opens).toBeNull();
    expect(sim.revisions.progress).toBeGreaterThan(0);
  });

  it('fermer l’écran sans rien composer révèle quand même: apparence par défaut', () => {
    const sim = newGame();
    talkUntilPhoto(sim, 1);
    act(sim, 1, { type: 'talk_next' });
    expect(lookRevealed(sim.world, 1)).toBe(true);
    expect(sim.world.players[1].look).toBeNull();
    // Le look par défaut que le rendu montre alors est complet (tête, haut, bas, chaussures).
    const slots = starterLook(1).pieces.map((piece) => piece.slot);
    expect(slots).toEqual(expect.arrayContaining(['head', 'shoes']));
  });

  it('chacun le sien, en même temps: deux dialogues, deux éditeurs, deux révélations', () => {
    const sim = newGame();
    talkUntilPhoto(sim, 0);
    talkUntilPhoto(sim, 1);
    expect(talkView(content, sim.world, 0)?.opens).toBe('character-editor');
    expect(talkView(content, sim.world, 1)?.opens).toBe('character-editor');
    act(sim, 1, { type: 'talk_next' });
    expect([lookRevealed(sim.world, 0), lookRevealed(sim.world, 1)]).toEqual([false, true]);
    act(sim, 0, { type: 'talk_next' });
    expect([lookRevealed(sim.world, 0), lookRevealed(sim.world, 1)]).toEqual([true, true]);
  });

  it('la silhouette est la même pour les deux, sans cheveux ni coiffe', () => {
    const look = silhouetteLook(content.settings.start.shapes, content.catalogue);
    const slots = look.pieces.map((piece) => piece.slot);
    expect(slots).toContain('head');
    for (const slot of ['hair', 'hat', 'glasses', 'accessory']) expect(slots).not.toContain(slot);
    const resolved = resolveLook(look, content.catalogue, content.morphologies);
    expect(resolved.pieces.length).toBeGreaterThan(2);
  });

  it('le filet de la quête: à la fin du prologue, qui n’a pas fait sa photo est révélé aussi', () => {
    const sim = newGame();
    const quest = Object.values(content.places[PLACE]?.quests ?? {}).find((q) => q.kind === 'main');
    const steps = quest?.chapters.flatMap((c) => c.steps) ?? [];
    const last = steps.at(-1);
    if (quest === undefined || last === undefined) throw new Error('quête du prologue absente');
    expect(last.onDone).toContainEqual({ type: 'reveal_look', to: 'duo' });
    // Dernière étape franchie par les deux (ici: se retrouver au point de l'étape): tous révélés.
    sim.world.progress.quests[quest.id] = {
      chapter: quest.chapters.at(-1)?.id ?? '',
      step: last.id,
      done: false,
      passed: steps.slice(0, -1).map((s) => s.id),
    };
    const target = last.target;
    const at =
      target !== null && 'point' in target
        ? content.places[PLACE]?.map.points[target.point]
        : undefined;
    if (at === undefined) throw new Error('point de la dernière étape absent');
    put(sim, 0, at.x - 0.3, at.y, 0);
    put(sim, 1, at.x + 0.3, at.y, 0);
    for (let i = 0; i < 20 && !lookRevealed(sim.world, 0); i++) wait(sim, 0.5);
    expect([lookRevealed(sim.world, 0), lookRevealed(sim.world, 1)]).toEqual([true, true]);
  });
});

describe('rechargement', () => {
  it('avant la photo: on retrouve sa silhouette', () => {
    const sim = newGame();
    const restored = reload(sim);
    if (!restored.ok) throw new Error(restored.reason);
    for (const p of [0, 1] as const) expect(lookRevealed(restored.world, p)).toBe(false);
  });

  it('après la photo de l’un: lui retrouve son personnage, l’autre sa silhouette', () => {
    const sim = newGame();
    talkUntilPhoto(sim, 0);
    const look = starterLook(0);
    act(sim, 0, { type: 'set_look', name: 'Ada', look, gender: 'f' }, { type: 'talk_next' });
    const restored = reload(sim);
    if (!restored.ok) throw new Error(restored.reason);
    expect(lookRevealed(restored.world, 0)).toBe(true);
    expect(restored.world.players[0].look).toEqual(look);
    expect(lookRevealed(restored.world, 1)).toBe(false);
  });
});

describe('dialogue de la photo entamé puis interrompu', () => {
  /** Nombre d'exemplaires de chaque objet dans la barre d'un joueur. */
  const held = (sim: Sim, player: 0 | 1): number =>
    sim.world.players[player].toolbar.reduce((sum, stack) => sum + (stack?.count ?? 0), 0);
  /** Lit jusqu'au bout (comme la touche Espace); renvoie les nœuds traversés. */
  function readToEnd(sim: Sim, player: 0 | 1): string[] {
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const talk = sim.world.players[player].talk;
      if (talk === null) break;
      seen.push(talk.node);
      act(sim, player, { type: 'talk_next' });
    }
    return seen;
  }

  it('fermé avant la photo (touche Retour): il reprend où il s’était arrêté, la photo reste à faire', () => {
    const sim = newGame();
    const { villager, node } = photoDialogue();
    expect(startTalk(contextOf(sim), 0, villager)).toBe(true);
    const first = sim.world.players[0].talk?.node;
    act(sim, 0, { type: 'talk_close' });
    expect(sim.world.players[0].talk).toBeNull();
    expect(lookRevealed(sim.world, 0)).toBe(false);
    expect(startTalk(contextOf(sim), 0, villager)).toBe(true);
    expect(sim.world.players[0].talk?.node).toBe(first);
    const seen = readToEnd(sim, 0);
    expect(seen).toContain(node);
    expect(lookRevealed(sim.world, 0)).toBe(true);
  });

  it('partie quittée l’éditeur ouvert puis reprise: la réplique de la photo revient, rien n’est donné deux fois', () => {
    const sim = newGame();
    const { villager, node } = photoDialogue();
    talkUntilPhoto(sim, 0);
    const restored = reload(sim);
    if (!restored.ok) throw new Error(restored.reason);
    const again = createSim(content, restored.world);
    expect(again.world.players[0].talk).toBeNull();
    expect(lookRevealed(again.world, 0)).toBe(false);
    expect(startTalk(contextOf(again), 0, villager)).toBe(true);
    expect(again.world.players[0].talk?.node).toBe(node);
    expect(talkView(content, again.world, 0)?.opens).toBe('character-editor');
    const before = held(again, 0);
    readToEnd(again, 0);
    expect(lookRevealed(again.world, 0)).toBe(true);
    const gained = held(again, 0) - before;
    // Allé au bout: il ne se rejoue plus, et ce qu'il donne n'est donné qu'une fois.
    expect(startTalk(contextOf(again), 0, villager)).toBe(true);
    expect(again.world.players[0].talk?.node).not.toBe(node);
    readToEnd(again, 0);
    expect(held(again, 0) - before).toBe(gained);
  });

  it('l’étape de quête qui attend la fin du dialogue n’est plus bloquée par une fermeture', () => {
    const sim = newGame();
    const { villager } = photoDialogue();
    const quest = Object.values(content.places[PLACE]?.quests ?? {}).find((q) => q.kind === 'main');
    if (quest === undefined) throw new Error('quête du prologue absente');
    // La scène d'ouverture se lit d'abord (les répliques passent au délai): la quête attend sa fin.
    for (let i = 0; i < 40 && (sim.world.common.story?.scene ?? null) !== null; i++) wait(sim, 3);
    const step = sim.world.progress.quests[quest.id]?.step;
    for (const p of [0, 1] as const) {
      expect(startTalk(contextOf(sim), p, villager)).toBe(true);
      act(sim, p, { type: 'talk_close' });
    }
    wait(sim, 0.5);
    expect(sim.world.progress.quests[quest.id]?.step).toBe(step);
    expect(startTalk(contextOf(sim), 0, villager)).toBe(true);
    // Chaque réplique reste un instant à l'écran (un joueur lit): l'étape qui attend la dernière
    // est franchie pendant qu'elle est affichée.
    for (let i = 0; i < 12 && sim.world.progress.quests[quest.id]?.step === step; i++) {
      act(sim, 0, { type: 'talk_next' });
      wait(sim, 0.5);
    }
    expect(sim.world.progress.quests[quest.id]?.step).not.toBe(step);
  });
});

describe('migration des parties de la version 1', () => {
  it('la version courante est la 2: l’apparence se révèle par un fait', () => {
    expect(DATA_SCHEMA).toBe(2);
  });

  it('une partie commencée avant la photo reste révélée, personnages et reste intacts', () => {
    const v1 = referenceSave(1);
    const data = v1.data as {
      players: { look: unknown; gender: unknown; money: number }[];
      progress: { memory: Json };
    };
    const composed: Look = starterLook(0);
    data.players[0] = {
      ...data.players[0],
      look: composed,
      gender: 'f',
    } as (typeof data.players)[0];
    expect(data.progress.memory[lookRevealedKey(0)]).toBeUndefined();
    const before = JSON.stringify(v1.data);
    const read = readSave(v1);
    if (!read.ok) throw new Error(read.reason);
    expect(read.from).toBe(1);
    expect(read.world.schema).toBe(2);
    for (const p of [0, 1] as const) expect(lookRevealed(read.world, p)).toBe(true);
    expect(read.world.players[0].look).toEqual(composed);
    expect(read.world.players[0].money).toBe(data.players[0].money);
    // Les faits d'avant sont gardés, et la migration ne touche pas à ce qu'on lui donne.
    for (const key of Object.keys(data.progress.memory))
      expect(read.world.progress.memory[key]).toBeDefined();
    expect(JSON.stringify(v1.data)).toBe(before);
  });

  it('une sauvegarde de la version 1 sans mémoire lisible est refusée proprement', () => {
    const read = readSave({ dataSchema: 1, data: { common: {}, progress: {} } });
    expect(read).toMatchObject({ ok: false, kind: 'damaged' });
  });

  it('une partie de la version 2 n’est pas révélée d’office', () => {
    const sim = newGame();
    const restored = reload(sim);
    expect(restored.ok && lookRevealed(restored.world, 0)).toBe(false);
  });
});

describe('écran ouvert par une réplique (interface)', () => {
  function harness(view: () => TalkView | null): {
    sent: Intent[];
    screens: ReturnType<typeof createDialogueScreens>;
    state: { open: boolean; opened: number };
  } {
    const sent: Intent[] = [];
    const state = { open: false, opened: 0 };
    const screens = createDialogueScreens(
      {
        'character-editor': {
          open: () => {
            state.open = true;
            state.opened += 1;
            return true;
          },
          isOpen: () => state.open,
        },
      },
      view,
      (intent) => sent.push(intent),
    );
    return { sent, screens, state };
  }
  const page = (node: string, opens: TalkView['opens']): TalkView => ({
    villager: 'quelqu-un',
    node,
    speaker: 'quelqu-un',
    text: 'Ne bouge plus.',
    emote: null,
    options: [],
    opens,
  });

  it('la touche de suite ouvre l’écran au lieu d’avancer; sa fermeture envoie talk_next, une fois', () => {
    let view: TalkView | null = page('photo', 'character-editor');
    const { sent, screens, state } = harness(() => view);
    screens.send({ type: 'talk_next' });
    expect(state.opened).toBe(1);
    expect(sent).toEqual([]);
    screens.frame();
    expect(sent).toEqual([]);
    state.open = false;
    screens.frame();
    screens.frame();
    expect(sent).toEqual([{ type: 'talk_next' }]);
    // La réplique suivante n'ouvre rien: elle avance comme les autres.
    view = page('clic', null);
    screens.send({ type: 'talk_next' });
    expect(sent).toHaveLength(2);
    expect(state.opened).toBe(1);
  });

  it('les autres intentions passent, et un dialogue fermé pendant l’écran n’avance pas', () => {
    let view: TalkView | null = page('photo', 'character-editor');
    const { sent, screens, state } = harness(() => view);
    screens.send({ type: 'talk_close' });
    expect(sent).toEqual([{ type: 'talk_close' }]);
    screens.send({ type: 'talk_next' });
    view = null;
    state.open = false;
    screens.frame();
    expect(sent).toEqual([{ type: 'talk_close' }]);
  });
});

describe('gabarit: une réplique qui ouvre l’éditeur et révèle, ajoutée par les seules données', () => {
  function withPhotoBooth(): Content {
    return contentWith((files) => {
      files['lieux/essai-gare/dialogues/photomaton-factice.json'] = {
        schema: 1,
        id: 'photomaton-factice',
        villager: 'cheffe-de-gare',
        priority: 90,
        when: [],
        once: 'player',
        start: 'pose',
        nodes: {
          pose: {
            kind: 'line',
            speaker: 'cheffe-de-gare',
            text: 'Une photo pour le registre ?',
            emote: 'question',
            opens: 'character-editor',
            next: 'revele',
          },
          revele: { kind: 'effects', effects: [{ type: 'reveal_look' }], next: null },
        },
      };
    });
  }

  it('se charge, passe le validateur, ouvre l’écran et révèle le joueur qui parle', () => {
    const edited = withPhotoBooth();
    expect(validateContent(edited)).toEqual([]);
    const sim = createSim(edited, createWorld(edited, SEED, MEMBERS));
    expect(startTalk(contextOf(sim), 1, 'cheffe-de-gare')).toBe(true);
    expect(talkView(edited, sim.world, 1)?.opens).toBe('character-editor');
    act(sim, 1, { type: 'talk_next' });
    expect(lookRevealed(sim.world, 1)).toBe(true);
    expect(lookRevealed(sim.world, 0)).toBe(false);
    expect(sim.world.players[1].talk).toBeNull();
  });

  it('un écran inconnu est refusé au chargement', () => {
    expect(() =>
      contentWith((files) => {
        const dialogue = files['lieux/train-de-nuit/dialogues/controleur-papiers.json'] as {
          nodes: Record<string, Json>;
        };
        for (const node of Object.values(dialogue.nodes))
          if (node.opens !== undefined) node.opens = 'ecran-inconnu';
      }),
    ).toThrow();
  });
});
