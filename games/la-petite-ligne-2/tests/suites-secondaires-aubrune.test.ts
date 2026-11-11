// Suites secondaires d'Aubrune (cahier 6.4, `ecriture-suites-secondaires.md`): chacune s'ouvre à
// son étape de l'histoire principale et se joue de bout en bout par la simulation (dialogues,
// remises d'objets, scènes à deux rôles et leurs gestes, guets de nuit, récompenses).
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { equipBag, giveItem } from '../src/simulation/sac/actions';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const MAIN = ['le-train-de-5h12', 'la-minute-d-ecart', 'ceux-qui-partent'] as const;
const ACT_3 = 'ceux-qui-partent';
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

/** Chaque suite, et l'étape de l'acte 3 qui l'ouvre (`null`: la fin de l'acte 2). */
const SUITES: Record<string, string | null> = {
  'les-lettres-en-retard': 'registre',
  'la-guerre-de-la-soupe': 'repas',
  'la-baronne': null,
  'le-fantome-du-moulin': 'registre-plein',
  'la-fanfare-de-la-halte': 'matin',
  'la-robe-et-la-cloche': 'marthe-sonne',
};

function aubruneContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
  });
}

function stepsOf(sim: Sim, quest: string): string[] {
  const line = sim.content.places[AUBRUNE]?.quests[quest];
  if (line === undefined) throw new Error(`suite ${quest}`);
  return line.chapters.flatMap((c) => c.steps.map((s) => s.id));
}

function finish(sim: Sim, quest: string): void {
  const line = sim.content.places[AUBRUNE]?.quests[quest];
  const last = line?.chapters[line.chapters.length - 1];
  sim.world.progress.quests[quest] = {
    chapter: last?.id ?? '',
    step: last?.steps[last.steps.length - 1]?.id ?? '',
    done: true,
    passed: stepsOf(sim, quest),
  };
}

function moveTo(sim: Sim, player: PlayerIndex, name: string): void {
  const at = sim.content.places[AUBRUNE]?.map.points[name];
  if (at === undefined) throw new Error(`point ${name}`);
  sim.world.players[player].body.x = at.x + (player === 0 ? -0.4 : 0.4);
  sim.world.players[player].body.y = at.y;
}

function both(sim: Sim, name: string): void {
  moveTo(sim, 0, name);
  moveTo(sim, 1, name);
}

/** Aubrune avec l'histoire principale tenue pour finie: tout le monde est là, tout est ouvert. */
function aubrune(only: string | null): Sim {
  const sim = newSim(aubruneContent());
  wait(sim, 0.5);
  for (const quest of MAIN) finish(sim, quest);
  for (const quest of Object.keys(SUITES)) if (quest !== only) finish(sim, quest);
  if (sim.world.common.story) sim.world.common.story.scene = null;
  const facts = ['acte1.fini', 'acte2.train', 'acte2.fini', 'acte3.train2', 'halte.pendule'];
  for (let n = 1; n <= 11; n++) facts.push(`verrou.v${n}`);
  for (const key of [...facts, 'verrou.v2b'])
    remember(contextOf(sim), `aubrune.${key}`, true, 'duo');
  for (const p of [0, 1] as const) {
    expect(equipBag(contextOf(sim), p, 'besace')).toBe(true);
    sim.world.players[p].needs.hygiene = 100;
    sim.world.players[p].needs.sleep = 60;
  }
  both(sim, 'quai');
  sim.world.minutes = 600;
  wait(sim, 1);
  return sim;
}

function nextTo(sim: Sim, player: PlayerIndex, villager: string): void {
  const v = sim.world.places[AUBRUNE]?.villagers[villager];
  if (v === undefined) throw new Error(`habitant ${villager}`);
  sim.world.players[player].body.x = v.body.x + 0.8;
  sim.world.players[player].body.y = v.body.y;
}

/** Parle à un habitant et suit le dialogue, en prenant l'option donnée (sinon la première visible). */
function talk(sim: Sim, player: PlayerIndex, villager: string, option?: string): string[] {
  nextTo(sim, player, villager);
  expect(startTalk(contextOf(sim), player, villager), `parler à ${villager}`).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 16; i++) {
    const talkState = sim.world.players[player].talk;
    if (talkState === null) break;
    seen.push(`${talkState.dialogue}#${talkState.node}`);
    wait(sim, 0.25);
    const view = talkView(sim.content, sim.world, player);
    const options = view?.options ?? [];
    if (options.length > 0) {
      const pick = options.find((o) => o.id === option) ?? options[0];
      act(sim, player, { type: 'talk_choose', option: pick?.id ?? '' });
    } else act(sim, player, { type: 'talk_next' });
  }
  if (sim.world.players[player].talk !== null) act(sim, player, { type: 'talk_close' });
  wait(sim, 0.3);
  return seen;
}

function holding(...players: PlayerIndex[]): [StepInput, StepInput] {
  return [
    { ...idleInput(0), act: players.includes(0) },
    { ...idleInput(0), act: players.includes(1) },
  ];
}

/**
 * Joue la scène en cours: chaque rôle va où son attente l'envoie, tient ou appuie quand un geste
 * est demandé (ceux qui tiennent d'abord, puis l'appui de l'autre), et lit ses répliques.
 */
function playScene(sim: Sim, id: string): void {
  expect(sim.world.common.story?.scene?.id, `scène ${id}`).toBe(id);
  const def = sim.content.places[AUBRUNE]?.scenes[id];
  for (let i = 0; i < 400 && sim.world.common.story?.scene?.id === id; i++) {
    const run = sim.world.common.story.scene;
    const beat = def?.beats[run.beat];
    if (beat?.do === 'await') {
      const holders: PlayerIndex[] = [];
      const pressers: PlayerIndex[] = [];
      let seconds = 0;
      for (const part of beat.parts) {
        const who: PlayerIndex = part.role === 'b' ? (run.roleA === 0 ? 1 : 0) : run.roleA;
        for (const c of part.done) if (c.type === 'reach') moveTo(sim, who, c.point);
        if (part.gesture?.type === 'press') pressers.push(who);
        else if (part.gesture !== undefined) {
          if (part.gesture.type === 'stand') moveTo(sim, who, part.gesture.point);
          else holders.push(who);
          seconds = Math.max(seconds, part.gesture.seconds);
        }
      }
      if (holders.length + pressers.length > 0) {
        wait(sim, 0.2);
        if (holders.length > 0) wait(sim, seconds + 0.3, holding(...holders));
        wait(sim, 0.15, holding(...holders, ...pressers));
        wait(sim, 0.15, holding(...holders));
      }
    }
    for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
    wait(sim, 0.25);
  }
  expect(sim.world.common.story?.scene?.id ?? null, `fin de ${id}`).not.toBe(id);
  wait(sim, 0.5);
}

function passed(sim: Sim, quest: string): readonly string[] {
  return sim.world.progress.quests[quest]?.passed ?? [];
}

/** Vide les poches d'un joueur, puis lui donne ces objets (ce qu'il aurait récolté, pêché ou cuisiné). */
function carry(sim: Sim, player: PlayerIndex, items: Record<string, number>): void {
  const state = sim.world.players[player];
  state.toolbar.fill(null);
  state.bag?.slots.fill(null);
  for (const [item, count] of Object.entries(items))
    expect(giveItem(contextOf(sim), player, item, count), item).toBe(count);
}

function held(sim: Sim, player: PlayerIndex, item: string): boolean {
  const state = sim.world.players[player];
  return [...state.toolbar, ...(state.bag?.slots ?? [])].some((s) => s?.item === item);
}

/** Distance d'un habitant à un point de la carte (m). */
function distance(sim: Sim, villager: string, point: string): number {
  const body = sim.world.places[AUBRUNE]?.villagers[villager]?.body;
  const at = sim.content.places[AUBRUNE]?.map.points[point];
  if (body === undefined || at === undefined) throw new Error(`${villager}, ${point}`);
  return Math.hypot(body.x - at.x, body.y - at.y);
}

function fact(sim: Sim, key: string): unknown {
  return sim.world.progress.memory[key]?.v;
}

/** Une nuit de sommeil, puis le matin (le saut de nuit est le lot des besoins: simulé ici). */
function nightThenMorning(sim: Sim, minute = 540): void {
  for (const p of [0, 1] as const) sim.world.players[p].needs.sleep = 100;
  wait(sim, 0.5);
  sim.world.minutes = minute;
  wait(sim, 0.5);
}

describe('écriture des suites secondaires d’Aubrune', () => {
  it('chaque page tient dans le bandeau, chaque étape a son repère, chaque suite a 4 étapes au moins', () => {
    const place = aubruneContent().places[AUBRUNE];
    if (place === undefined) throw new Error(AUBRUNE);
    const pages: string[] = [];
    for (const id of Object.keys(SUITES)) {
      const quest = place.quests[id];
      expect(quest?.kind, id).toBe('side');
      const steps = quest?.chapters.flatMap((c) => c.steps) ?? [];
      expect(steps.length, id).toBeGreaterThanOrEqual(4);
      for (const step of steps) {
        pages.push(step.objective);
        expect(step.target, `${id}, ${step.id}`).not.toBeNull();
      }
    }
    expect(pages.filter((t) => t.length > 150)).toEqual([]);
    expect(pages.filter((t) => LONG_DASHES.test(t))).toEqual([]);
  });

  it('chaque suite attend son étape de l’histoire principale, puis s’ouvre sans rien lui demander', () => {
    const sim = newSim(aubruneContent());
    wait(sim, 0.5);
    if (sim.world.common.story) sim.world.common.story.scene = null;
    finish(sim, MAIN[0]);
    wait(sim, 1);
    for (const quest of Object.keys(SUITES))
      expect(sim.world.progress.quests[quest], quest).toBeUndefined();
    // Aucune étape de l'histoire principale ne cite une suite secondaire.
    const place = sim.content.places[AUBRUNE];
    for (const quest of MAIN)
      for (const side of Object.keys(SUITES))
        expect(JSON.stringify(place?.quests[quest]).includes(`"${side}"`), quest).toBe(false);
    for (const [quest, trigger] of Object.entries(SUITES)) {
      const requires = place?.quests[quest]?.requires ?? [];
      expect(requires, quest).toEqual([
        trigger === null
          ? { type: 'quest_step', quest: MAIN[1] }
          : { type: 'quest_step', quest: ACT_3, step: trigger },
      ]);
      expect(trigger === null || stepsOf(sim, ACT_3).includes(trigger), quest).toBe(true);
    }
    // Leurs dialogues passent toujours après ceux de l'histoire principale (priorité 60 et plus):
    // un habitant qui a les deux à dire commence par l'histoire principale.
    const prefixes = ['lettres', 'soupe', 'baronne', 'fantome', 'fanfare', 'robe'];
    const side = (place?.dialogues ?? []).filter((d) =>
      prefixes.some((p) => JSON.stringify(d.when).includes(`"aubrune.${p}.`)),
    );
    expect(side.length).toBeGreaterThanOrEqual(80);
    expect(side.filter((d) => d.priority >= 60).map((d) => d.id)).toEqual([]);
  });

  it('« Les lettres en retard »: la consigne, six lettres rendues, la clé de la draisine', () => {
    const Q = 'les-lettres-en-retard';
    const sim = aubrune(Q);
    expect(sim.world.progress.quests[Q]?.done).toBe(false);

    // La consigne: Lucie, le franc de garde de Firmin, le sac sorti à deux (gestes tenus ensemble).
    expect(talk(sim, 0, 'lucie', 'ouvrir')).toContain('lucie-consigne#fin');
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-consigne#n1');
    carry(sim, 0, { 'vieille-piece': 1 });
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-consigne-merci#a1');
    expect(held(sim, 0, 'vieille-piece')).toBe(false);
    both(sim, 'gr2');
    wait(sim, 0.5);
    playScene(sim, 'le-sac-postal');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('six-lettres');

    // Six lettres: cinq fils menés en parallèle, à partager entre les deux joueurs.
    expect(talk(sim, 0, 'basile', 'jamais')).toContain('basile-lettre#fin');
    expect(talk(sim, 1, 'odette', 'repondre')).toContain('odette-lettre#fin');
    expect(talk(sim, 1, 'marthe')).toContain('marthe-dette#fin');
    carry(sim, 1, { mures: 4 });
    expect(talk(sim, 1, 'honorine')[0]).toBe('honorine-interets-merci#a1');
    expect(talk(sim, 1, 'marthe')).toContain('marthe-recu#fin');
    expect(talk(sim, 0, 'colette', 'four')).toContain('colette-recette#fin');
    carry(sim, 0, { oeuf: 2 });
    expect(talk(sim, 0, 'colette')[0]).toBe('colette-oeufs-merci#a1');
    expect(held(sim, 0, 'livre-de-cuisine')).toBe(true);
    // La part de tarte: une par joueur, une seule fois.
    expect(talk(sim, 0, 'colette')[0]).toBe('colette-tarte#n1');
    expect(talk(sim, 1, 'colette')[0]).toBe('colette-tarte#n1');
    expect(held(sim, 0, 'tarte-aux-pommes') && held(sim, 1, 'tarte-aux-pommes')).toBe(true);
    expect(talk(sim, 0, 'colette')[0]).not.toBe('colette-tarte#n1');
    expect(talk(sim, 0, 'firmin', 'poster')).toContain('firmin-mutation#fin');
    expect(talk(sim, 1, 'achille', 'promesse')).toContain('achille-noel#fin');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('la-sixieme');

    // La sixième: remise en mains propres, puis la draisine pompée à deux; Firmin accourt.
    expect(talk(sim, 0, 'lucie', 'nous')).toContain('lucie-sixieme#fin');
    nextTo(sim, 1, 'lucie');
    wait(sim, 0.5);
    playScene(sim, 'la-sixieme-lettre');
    expect(fact(sim, 'aubrune.draisine.cle')).toBe(true);
    const money = sim.world.players.map((p) => p.money);
    both(sim, 'n2');
    wait(sim, 0.5);
    playScene(sim, 'la-draisine');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    expect(passed(sim, Q)).toHaveLength(stepsOf(sim, Q).length);
    expect(sim.world.players.map((p, i) => p.money - (money[i] ?? 0))).toEqual([1200, 1200]);
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-souvenir-draisine#souvenir');
  });

  it('« La guerre de la soupe »: deux marmites, le guet de nuit, la soupe à quatre mains', () => {
    const Q = 'la-guerre-de-la-soupe';
    const sim = aubrune(Q);

    // Deux marmites: le défi, puis une paire de bras par cuisinière (potager, pêche).
    expect(talk(sim, 0, 'odette', 'colette')).toContain('odette-vexee#fin');
    expect(talk(sim, 1, 'colette', 'meres')).toContain('colette-defi#fin');
    carry(sim, 0, { radis: 4 });
    expect(talk(sim, 0, 'odette')[0]).toBe('odette-radis-merci#a1');
    carry(sim, 1, { truite: 1 });
    expect(talk(sim, 1, 'colette')[0]).toBe('colette-truite-merci#a1');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('le-sel');

    // Le sel: au matin les deux soupes sont salées; la nuit suivante, une marmite par joueur.
    nightThenMorning(sim);
    expect(talk(sim, 0, 'odette')).toContain('odette-sel#fin');
    expect(talk(sim, 1, 'colette')).toContain('colette-sel#fin');
    sim.world.minutes = 1295;
    wait(sim, 90);
    expect(distance(sim, 'honorine', 'pl')).toBeLessThan(3);
    expect(talk(sim, 0, 'honorine')[0]).toBe('honorine-etoiles#n1');
    sim.world.minutes = 1352;
    wait(sim, 1);
    playScene(sim, 'la-main-dans-le-sel');
    expect(fact(sim, 'aubrune.soupe.coupable')).toBe(true);
    expect(sim.world.progress.quests[Q]?.chapter).toBe('quatre-mains');

    // Quatre mains: le cahier, les légumes de Margot (un panier par joueur), une soupe par cuisinière.
    nightThenMorning(sim);
    expect(talk(sim, 0, 'honorine', 'sel')).toContain('honorine-sel#fin');
    expect(talk(sim, 0, 'margot')).toContain('margot-legumes#fin');
    expect(talk(sim, 1, 'margot')).toContain('margot-legumes#fin');
    for (const item of ['carotte', 'poireau', 'pomme-de-terre'])
      expect(held(sim, 0, item) && held(sim, 1, item), item).toBe(true);
    expect(talk(sim, 0, 'margot')).toContain('margot-legumes#a1');
    carry(sim, 0, { 'soupe-de-legumes': 1 });
    expect(talk(sim, 0, 'colette')[0]).toBe('colette-soupe-merci#a1');
    carry(sim, 1, { 'soupe-de-legumes': 1 });
    expect(talk(sim, 1, 'odette')[0]).toBe('odette-soupe-merci#a1');
    const money = sim.world.players.map((p) => p.money);
    sim.world.minutes = 700;
    both(sim, 'pl');
    wait(sim, 1);
    playScene(sim, 'la-soupe-a-quatre-mains');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    expect(passed(sim, Q)).toHaveLength(stepsOf(sim, Q).length);
    expect(sim.world.players.map((p, i) => p.money - (money[i] ?? 0))).toEqual([800, 800]);
    expect(held(sim, 0, 'soupe-de-legumes') && held(sim, 1, 'soupe-de-legumes')).toBe(true);
    expect(talk(sim, 0, 'honorine')[0]).toBe('honorine-souvenir-sel#souvenir');
  });

  it('« La Baronne »: l’heure, l’appât, la touche à deux, la décision', () => {
    const Q = 'la-baronne';
    const sim = aubrune(Q);
    expect(talk(sim, 0, 'achille', 'aider')).toContain('achille-baronne#fin');
    expect(talk(sim, 0, 'jeanne', 'pari')).toContain('jeanne-baronne#fin');
    expect(talk(sim, 1, 'colette')).toContain('colette-baronne#fin');
    carry(sim, 0, { goujon: 2 });
    expect(talk(sim, 0, 'achille')[0]).toBe('achille-goujons-merci#a1');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('la-touche');

    // Le soir, Achille quitte le bourg pour la fosse; la touche se joue à deux (canne, épuisette).
    sim.world.minutes = 1085;
    wait(sim, 110);
    expect(distance(sim, 'achille', 'i2')).toBeLessThan(3);
    sim.world.minutes = 1150;
    both(sim, 'i2');
    wait(sim, 1);
    playScene(sim, 'la-baronne-mord');
    expect(fact(sim, 'aubrune.baronne.sortie')).toBe(true);

    // La décision à deux: en parler d'abord ne tranche rien; une seule voix attend l'autre; deux
    // avis invitent à se mettre d'accord; le même choix des deux la prend.
    expect(talk(sim, 0, 'achille', 'attendre')).not.toContain('achille-decision#fin');
    expect(talk(sim, 1, 'achille', 'friture')).toContain('achille-decision#une-voix');
    expect(talk(sim, 0, 'achille', 'relacher')).toContain('achille-decision#desaccord');
    expect(passed(sim, Q)).not.toContain('decision');
    expect(fact(sim, 'aubrune.baronne.sort')).toBeUndefined();
    expect(talk(sim, 0, 'achille', 'friture')).toContain('achille-decision#fin');
    expect(fact(sim, 'aubrune.baronne.sort')).toBe('friture');
    expect(talk(sim, 0, 'colette')[0]).toBe('colette-epilogue#a1');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    for (const p of [0, 1] as const) {
      expect(talk(sim, p, 'achille')[0]).toBe('achille-canne-fine#n1');
      expect(held(sim, p, 'canne-fine')).toBe(true);
    }
  });

  it('« La Baronne »: relâchée, Colette raconte l’autre fin', () => {
    const Q = 'la-baronne';
    const sim = aubrune(Q);
    const state = sim.world.progress.quests[Q];
    if (state === undefined) throw new Error(Q);
    state.passed = ['legende', 'heure', 'appat', 'goujons', 'affut'];
    state.chapter = 'la-touche';
    state.step = 'decision';
    remember(contextOf(sim), 'aubrune.baronne.legende', 'fait', 'duo');
    remember(contextOf(sim), 'aubrune.baronne.decision', 'ouvert', 'duo');
    wait(sim, 0.5);
    expect(talk(sim, 0, 'achille', 'relacher')).not.toContain('achille-decision#fin');
    expect(talk(sim, 1, 'achille', 'relacher')).toContain('achille-decision#fin');
    expect(talk(sim, 1, 'colette')[0]).toBe('colette-epilogue#n1');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
  });

  it('« Le fantôme du moulin »: deux nuits de guet, les pas blancs, Barnabé la tête haute', () => {
    const Q = 'le-fantome-du-moulin';
    const sim = aubrune(Q);
    expect(talk(sim, 0, 'berthe', 'fantome')).toContain('berthe-fantome#fin');
    expect(talk(sim, 0, 'leon')).toContain('leon-geant#fin');
    expect(talk(sim, 1, 'jeanne')).toContain('jeanne-geant#fin');
    carry(sim, 0, { mures: 4 });
    expect(talk(sim, 0, 'leon')[0]).toBe('leon-mures-merci#a1');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('deux-nuits');

    // Première nuit: on se tait ensemble, Berthe éternue, le géant file.
    sim.world.minutes = 1385;
    both(sim, 'mc');
    wait(sim, 1);
    playScene(sim, 'le-geant-pale');
    nightThenMorning(sim);
    moveTo(sim, 0, 'gr6');
    wait(sim, 0.5);
    playScene(sim, 'les-pas-blancs');
    expect(talk(sim, 0, 'mado', 'barnabe')).toContain('mado-pas-blancs#fin');

    // Seconde nuit: une personne à la porte, l'autre au portillon.
    sim.world.minutes = 1385;
    both(sim, 'mc');
    wait(sim, 1);
    playScene(sim, 'la-main-dans-la-pate');
    expect(fact(sim, 'aubrune.fantome.demasque')).toBe(true);

    // La tête haute: Achille prend l'apprenti, Barnabé entre par devant.
    nightThenMorning(sim);
    expect(talk(sim, 1, 'achille', 'prends')).toContain('achille-apprenti#fin');
    expect(talk(sim, 0, 'barnabe', 'quatre')).toContain('barnabe-tablier#fin');
    playScene(sim, 'la-tete-haute');
    expect(talk(sim, 0, 'berthe')).toContain('berthe-brioche#fin');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    expect(talk(sim, 1, 'berthe')[0]).toBe('berthe-brioche#n1');
    expect(held(sim, 0, 'farine') && held(sim, 1, 'farine')).toBe(true);
    // Barnabé pétrit désormais au fournil avant l'aube.
    sim.world.minutes = 305;
    wait(sim, 140);
    expect(distance(sim, 'barnabe', 'gr4')).toBeLessThan(3);
  });

  it('« La fanfare de la halte »: trois instruments, la répétition, le trac, le concert', () => {
    const Q = 'la-fanfare-de-la-halte';
    const sim = aubrune(Q);
    expect(talk(sim, 0, 'armand', 'diriger')).toContain('armand-fanfare#fin');
    expect(talk(sim, 0, 'barnabe')).toContain('barnabe-bugle#fin');
    carry(sim, 1, { pierre: 3 });
    expect(talk(sim, 1, 'mado')[0]).toBe('mado-caisse-merci#a1');
    sim.world.minutes = 600;
    both(sim, 'i2');
    wait(sim, 1);
    playScene(sim, 'le-trombone-du-bief');
    carry(sim, 0, { 'vieille-piece': 2 });
    expect(talk(sim, 0, 'solange')[0]).toBe('solange-boutons-merci#a1');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('la-repetition');

    sim.world.minutes = 600;
    both(sim, 'gr5');
    wait(sim, 1);
    playScene(sim, 'la-repetition-de-la-fanfare');
    nightThenMorning(sim);
    expect(sim.world.progress.quests[Q]?.chapter).toBe('le-trac');

    // Le trac: Solange sait où il est; on le retrouve au lavoir, puis le concert face au train.
    expect(talk(sim, 0, 'solange', 'ou')).toContain('solange-chef-disparu#fin');
    moveTo(sim, 0, 'lv');
    wait(sim, 0.5);
    playScene(sim, 'le-chef-des-grenouilles');
    const money = sim.world.players.map((p) => p.money);
    both(sim, 'quai');
    wait(sim, 1);
    playScene(sim, 'le-concert-du-quai');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    expect(fact(sim, 'aubrune.train.en-gare')).toBe(false);
    expect(sim.world.players.map((p, i) => p.money - (money[i] ?? 0))).toEqual([1000, 1000]);
  });

  it('« La robe et la cloche »: le constat de nuit, le clocher, la coulée', () => {
    const Q = 'la-robe-et-la-cloche';
    const sim = aubrune(Q);
    expect(talk(sim, 0, 'marthe', 'vent')).toContain('marthe-felee#fin');
    expect(talk(sim, 0, 'honorine')).toContain('honorine-cloche#fin');
    expect(talk(sim, 0, 'marthe')).toContain('marthe-robe#fin');
    sim.world.minutes = 1330;
    both(sim, 'pv');
    wait(sim, 1);
    playScene(sim, 'la-felee-sonne');
    expect(sim.world.progress.quests[Q]?.chapter).toBe('le-clocher');

    // Le clocher: le coffre se lève à deux; la ficelle mène à Jeanne.
    nightThenMorning(sim);
    both(sim, 'pv');
    wait(sim, 0.5);
    playScene(sim, 'la-robe-dans-le-clocher');
    expect(talk(sim, 1, 'jeanne', 'combien')).toContain('jeanne-ficelle#fin');
    expect(talk(sim, 0, 'marthe')).toContain('marthe-mot#fin');
    expect(talk(sim, 1, 'honorine')).toContain('honorine-mot#fin');

    // La coulée: quatre bûches pour Mado, puis soufflet et louche devant les deux sœurs.
    carry(sim, 0, { buche: 4 });
    expect(talk(sim, 0, 'mado')[0]).toBe('mado-coulee-merci#a1');
    sim.world.minutes = 600;
    both(sim, 'gr6');
    wait(sim, 1);
    playScene(sim, 'la-coulee');
    expect(sim.world.progress.quests[Q]?.done).toBe(true);
    expect(fact(sim, 'aubrune.cloche.refondue')).toBe(true);
    for (const p of [0, 1] as const) {
      expect(talk(sim, p, 'jeanne')[0]).toBe('jeanne-pari-gagne#n1');
      expect(held(sim, p, 'fossile-coquille')).toBe(true);
    }
  });
});
