// Actes 2 et 3 d'Aubrune (« La minute d'écart », « Ceux qui partent »): les deux suites se jouent
// de bout en bout par la simulation, les zones du plan s'ouvrent à l'acte prévu, les arrivants
// descendent du train, et chaque page tient dans le bandeau.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { villagerView } from '../src/simulation/habitants/lecture';
import { zoneViews } from '../src/simulation/lieux/zones';
import type { Sim } from '../src/simulation/noyau/pas';
import { remember } from '../src/simulation/regles/memoire';
import { equipBag, giveItem } from '../src/simulation/sac/actions';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const ACT_1 = 'le-train-de-5h12';
const ACT_2 = 'la-minute-d-ecart';
const ACT_3 = 'ceux-qui-partent';
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

function aubruneContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
  });
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

/** Joue la scène en cours: chaque rôle va où son attente l'envoie, chacun lit ses répliques. */
function playScene(sim: Sim, id: string): void {
  expect(sim.world.common.story?.scene?.id, `scène ${id}`).toBe(id);
  const def = sim.content.places[AUBRUNE]?.scenes[id];
  for (let i = 0; i < 400 && sim.world.common.story?.scene; i++) {
    const run = sim.world.common.story.scene;
    const beat = def?.beats[run.beat];
    if (beat?.do === 'await')
      for (const part of beat.parts) {
        const who: PlayerIndex = part.role === 'b' ? (run.roleA === 0 ? 1 : 0) : run.roleA;
        for (const c of part.done) if (c.type === 'reach') moveTo(sim, who, c.point);
      }
    for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
    wait(sim, 0.25);
  }
  expect(sim.world.common.story?.scene ?? null).toBeNull();
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

function fact(sim: Sim, key: string): unknown {
  return sim.world.progress.memory[key]?.v;
}

function openZones(sim: Sim): string[] {
  return zoneViews(sim)
    .filter((z) => z.open)
    .map((z) => z.id)
    .sort();
}

function visible(sim: Sim, villager: string): boolean {
  return villagerView(sim, villager)?.visible === true;
}

/** Une nuit de sommeil, puis le matin (le saut de nuit est le lot des besoins: simulé ici). */
function nightThenMorning(sim: Sim, minute = 540): void {
  for (const p of [0, 1] as const) sim.world.players[p].needs.sleep = 100;
  wait(sim, 0.5);
  sim.world.minutes = minute;
}

/** Aubrune après l'acte 1: la première suite est finie, besaces au dos, propres et reposés. */
function afterActOne(): Sim {
  const sim = newSim(aubruneContent());
  wait(sim, 0.5);
  const line = sim.content.places[AUBRUNE]?.quests[ACT_1];
  const steps = line?.chapters.flatMap((c) => c.steps.map((s) => s.id)) ?? [];
  sim.world.progress.quests[ACT_1] = {
    chapter: 'logement-fourni',
    step: 'reponse',
    done: true,
    passed: steps,
  };
  if (sim.world.common.story) sim.world.common.story.scene = null;
  remember(contextOf(sim), 'aubrune.acte1.fini', true, 'duo');
  for (const p of [0, 1] as const) {
    expect(equipBag(contextOf(sim), p, 'besace')).toBe(true);
    sim.world.players[p].needs.hygiene = 100;
    sim.world.players[p].needs.sleep = 60;
  }
  both(sim, 'quai');
  wait(sim, 0.5);
  return sim;
}

describe('écriture des actes 2 et 3 d’Aubrune', () => {
  it('chaque page tient dans le bandeau et chaque étape nomme un lieu ou un habitant', () => {
    const place = aubruneContent().places[AUBRUNE];
    if (place === undefined) throw new Error(AUBRUNE);
    const pages: string[] = [];
    for (const d of place.dialogues)
      for (const node of Object.values(d.nodes)) {
        if (node.kind === 'line') pages.push(node.text);
        if (node.kind === 'choice') pages.push(...node.options.map((o) => o.text));
      }
    for (const s of Object.values(place.scenes))
      for (const beat of s.beats) {
        if (beat.do === 'say') pages.push(beat.text);
        if (beat.do === 'await') pages.push(...beat.parts.map((part) => part.hint));
      }
    for (const quest of [ACT_2, ACT_3])
      for (const chapter of place.quests[quest]?.chapters ?? [])
        for (const step of chapter.steps) {
          pages.push(step.objective);
          expect(step.target, `${quest}, ${step.id}`).not.toBeNull();
        }
    expect(pages.length).toBeGreaterThan(800);
    expect(pages.filter((t) => t.length > 150)).toEqual([]);
    expect(pages.filter((t) => LONG_DASHES.test(t))).toEqual([]);
  });

  it('l’acte 2 se joue de bout en bout: règlement, signal, pendule, commande, premier train', () => {
    const sim = afterActOne();
    expect(sim.world.progress.quests[ACT_2]?.done).toBe(false);
    expect(openZones(sim)).toEqual(['b']);
    expect(visible(sim, 'lucie')).toBe(false);

    // Le règlement: Firmin, la cuisine (six bûches à Basile), l'article 7.
    expect(talk(sim, 0, 'firmin', 'signe')).toContain('firmin-occupation#fin');
    carry(sim, 0, { buche: 6 });
    talk(sim, 0, 'basile');
    playScene(sim, 'le-reglement-retrouve');
    expect(talk(sim, 1, 'firmin', 'sonnerie')).toContain('firmin-reglement#fin');
    expect(passed(sim, ACT_2)).toEqual(['occupation', 'cuisine', 'article-7']);
    expect(openZones(sim)).toContain('v');

    // La voie: la tranchée, le wagon, les frênes, la hache forgée, le bras, les leviers.
    moveTo(sim, 0, 'tw2');
    wait(sim, 0.5);
    moveTo(sim, 0, 'tw3');
    wait(sim, 0.5);
    playScene(sim, 'le-wagon-oublie');
    expect(talk(sim, 1, 'jeanne', 'vent')[0]).toBe('jeanne-wagon#n1');
    talk(sim, 0, 'mado', 'tope');
    carry(sim, 0, { hache: 1, pierre: 3, buche: 2 });
    expect(talk(sim, 0, 'mado')[0]).toBe('mado-forge#a1');
    expect(held(sim, 0, 'hache-forgee')).toBe(true);
    expect(held(sim, 0, 'hache')).toBe(false);
    // L'autre moitié fait reforger la sienne, avec les mêmes matériaux.
    carry(sim, 1, { hache: 1, pierre: 3, buche: 2 });
    expect(talk(sim, 1, 'mado')).toContain('mado-hache-moitie#n1');
    expect(held(sim, 1, 'hache-forgee')).toBe(true);
    moveTo(sim, 0, 'tw3');
    wait(sim, 0.5);
    expect(fact(sim, 'aubrune.verrou.v2b')).toBe(true);
    moveTo(sim, 0, 'po');
    wait(sim, 0.5);
    playScene(sim, 'le-semaphore-manchot');
    carry(sim, 0, { buche: 4 });
    talk(sim, 0, 'mado');
    both(sim, 'po');
    wait(sim, 0.5);
    playScene(sim, 'les-leviers');
    expect(passed(sim, ACT_2)).toContain('leviers');
    expect(fact(sim, 'aubrune.halte.signal')).toBe(true);

    // La pendule: deux versions, Odette, l'œuf d'Honorine porté à Marthe, la confidence, les aveux.
    talk(sim, 0, 'firmin', 'montre');
    talk(sim, 0, 'ambroise', 'vraiment');
    talk(sim, 0, 'firmin', 'qui');
    talk(sim, 0, 'odette', 'ment');
    expect(talk(sim, 0, 'honorine')).not.toContain('honorine-oeuf#fin');
    carry(sim, 0, { 'oeuf-au-plat': 1 });
    expect(talk(sim, 0, 'honorine', 'tiens')).toContain('honorine-oeuf#fin');
    expect(talk(sim, 0, 'marthe')[0]).toBe('marthe-oeuf#a1');
    expect(held(sim, 0, 'oeuf-au-plat')).toBe(false);
    expect(talk(sim, 0, 'honorine', 'emile')).toContain('honorine-confidence#fin');
    talk(sim, 0, 'ambroise', 'ordre');
    talk(sim, 1, 'firmin', 'regard');
    expect(passed(sim, ACT_2)).toEqual(expect.arrayContaining(['aveu-ambroise', 'aveu-firmin']));

    // La pêche et la commande: une canne par joueur, Achille à la fosse du bief.
    expect(talk(sim, 0, 'achille')).toContain('achille-lecon#fin');
    expect(talk(sim, 1, 'achille')).toContain('achille-lecon#fin');
    expect(held(sim, 0, 'canne') && held(sim, 1, 'canne')).toBe(true);
    expect(openZones(sim)).toEqual(['b', 'r', 'v']);
    sim.world.minutes = 600;
    // Au saule débité, Achille quitte le fournil pour la fosse du bief (une centaine de mètres).
    moveTo(sim, 0, 'bw2');
    wait(sim, 100);
    sim.world.minutes = 600;
    const fosse = sim.content.places[AUBRUNE]?.map.points.i2;
    const achille = sim.world.places[AUBRUNE]?.villagers.achille?.body;
    expect(
      Math.hypot((achille?.x ?? 0) - (fosse?.x ?? 0), (achille?.y ?? 0) - (fosse?.y ?? 0)),
    ).toBeLessThan(3);
    carry(sim, 0, { goujon: 2 });
    talk(sim, 0, 'achille');
    carry(sim, 0, { radis: 6, oeuf: 4, goujon: 3, buche: 5 });
    expect(talk(sim, 0, 'firmin')[0]).toBe('firmin-commande#n1');
    expect(sim.world.progress.quests[ACT_2]?.chapter).toBe('le-premier-train');

    // Le premier train: la pendule repart, trois voyageurs descendent, la lettre de Rosalie.
    talk(sim, 0, 'firmin', 'cafe');
    nightThenMorning(sim);
    wait(sim, 30);
    both(sim, 'quai-e');
    wait(sim, 0.5);
    playScene(sim, 'la-pendule-repart');
    for (const v of ['rosalie', 'lucie', 'colette', 'armand'])
      expect(visible(sim, v), v).toBe(true);
    const money = sim.world.players[0].money;
    expect(talk(sim, 0, 'rosalie', 'nuit')).toContain('rosalie-lettre#fin');
    playScene(sim, 'la-deuxieme-lettre');
    expect(sim.world.players[0].money - money).toBe(2400);
    expect(sim.world.players[0].bag?.id).toBe('sac-de-toile');
    talk(sim, 1, 'rosalie', 'emile');
    expect(sim.world.players[1].bag?.id).toBe('sac-de-toile');
    expect(talk(sim, 0, 'firmin', 'cave')).toContain('firmin-farce#fin');
    wait(sim, 0.5);
    expect(sim.world.progress.quests[ACT_2]?.done).toBe(true);
    expect(sim.world.progress.quests[ACT_3]?.done).toBe(false);
    // Rosalie repart; les trois du train se présentent, une fois.
    wait(sim, 60);
    expect(visible(sim, 'rosalie')).toBe(false);
    expect(talk(sim, 0, 'colette')[0]).toBe('colette-arrivee#n1');
    expect(talk(sim, 0, 'colette')[0]).toMatch(/^colette-quotidien#b\d$/);
    // Les habitants s'en souviennent.
    expect(talk(sim, 0, 'mado')[0]).toBe('mado-souvenir-signal#souvenir');
  });

  it('l’acte 3 se joue de bout en bout: cave, photo, vingt âmes, lanterne, 5 h 12, départ', () => {
    const sim = afterActOne();
    // L'acte 2 est tenu pour fait: ses verrous, sa pendule, ses trois arrivants.
    const line = sim.content.places[AUBRUNE]?.quests[ACT_2];
    sim.world.progress.quests[ACT_2] = {
      chapter: 'le-premier-train',
      step: 'farce',
      done: true,
      passed: line?.chapters.flatMap((c) => c.steps.map((s) => s.id)) ?? [],
    };
    for (const key of [
      'verrou.v1',
      'verrou.v2',
      'verrou.v2b',
      'verrou.v11',
      'acte2.train',
      'acte2.fini',
    ])
      remember(contextOf(sim), `aubrune.${key}`, true, 'duo');
    remember(contextOf(sim), 'aubrune.acte2.occupation', 'fait', 'duo');
    sim.world.minutes = 600;
    wait(sim, 1);
    expect(sim.world.progress.quests[ACT_3]?.done).toBe(false);
    expect(openZones(sim)).toEqual(['b', 'r', 'v']);

    // La cave: Basile, la coupe (verrous de la Côte), la trappe à deux, le registre.
    expect(talk(sim, 0, 'basile', 'mots')).toContain('basile-chambre#fin');
    expect(openZones(sim)).toContain('c');
    carry(sim, 0, { buche: 4 });
    carry(sim, 1, { buche: 8 });
    talk(sim, 1, 'basile');
    both(sim, 'hd');
    wait(sim, 0.5);
    playScene(sim, 'la-trappe');
    expect(talk(sim, 0, 'firmin', 'vu')).toContain('firmin-registre#fin');
    expect(sim.world.progress.quests[ACT_3]?.chapter).toBe('la-lueur');

    // La lueur: un appareil par joueur, la pose longue de 5 h 12, le tirage, la clé de la grille.
    wait(sim, 30);
    talk(sim, 0, 'lucie');
    talk(sim, 1, 'lucie');
    expect(held(sim, 0, 'appareil-photo') && held(sim, 1, 'appareil-photo')).toBe(true);
    both(sim, 'pn-s');
    sim.world.minutes = 312;
    wait(sim, 0.5);
    playScene(sim, 'la-pose-longue');
    sim.world.minutes = 540;
    wait(sim, 30);
    expect(talk(sim, 0, 'lucie', 'fenetres')).toContain('lucie-photo#fin');
    playScene(sim, 'des-fenetres');
    expect(talk(sim, 0, 'firmin', 'pourquoi')).toContain('firmin-photo#fin');
    expect(openZones(sim)).toContain('t');

    // Vingt âmes: le deuxième train, le gué, le moulin, Léon et Jeanne, le registre plein.
    talk(sim, 0, 'firmin', 'pile');
    nightThenMorning(sim);
    both(sim, 'quai');
    wait(sim, 0.5);
    playScene(sim, 'le-train-des-cinq');
    for (const v of ['paulin', 'margot', 'leon', 'berthe', 'barnabe'])
      expect(visible(sim, v), v).toBe(true);
    wait(sim, 60);
    carry(sim, 0, { pierre: 6 });
    expect(talk(sim, 0, 'paulin')[0]).toBe('paulin-gue#a1');
    talk(sim, 0, 'berthe');
    moveTo(sim, 0, 'v1');
    wait(sim, 0.5);
    carry(sim, 0, {});
    carry(sim, 1, {});
    talk(sim, 0, 'berthe');
    talk(sim, 1, 'berthe');
    expect(held(sim, 0, 'farine') && held(sim, 1, 'farine')).toBe(true);
    talk(sim, 0, 'leon', 'rien');
    talk(sim, 0, 'jeanne', 'parie');
    playScene(sim, 'midi-moins-dix');
    expect(talk(sim, 0, 'firmin')).toContain('firmin-vingt#fin');
    expect(openZones(sim)).toEqual(['b', 'c', 'f', 'm', 'r', 't', 'v']);

    // La coutume: le lumignon, la dalle, le pot-au-feu dos à dos, le train d'Honorine.
    talk(sim, 0, 'marthe', 'crois');
    moveTo(sim, 0, 'ci');
    wait(sim, 0.5);
    playScene(sim, 'la-dalle-des-lacombe');
    talk(sim, 0, 'marthe');
    talk(sim, 0, 'honorine', 'oeuf');
    carry(sim, 0, { 'pot-au-feu': 1 });
    talk(sim, 0, 'colette');
    playScene(sim, 'dos-a-dos');
    expect(talk(sim, 0, 'honorine', 'gens')).toContain('honorine-train#fin');
    expect(sim.world.progress.quests[ACT_3]?.chapter).toBe('la-halte-de-nuit');

    // La halte de nuit: Jeanne et le tunnel, le verre serti, la cloche, la barrière, la répétition.
    sim.world.minutes = 600;
    talk(sim, 0, 'jeanne', 'peur');
    for (const point of ['te1', 'te2']) {
      moveTo(sim, 0, point);
      wait(sim, 0.5);
    }
    playScene(sim, 'la-guerite');
    moveTo(sim, 0, 'tu1');
    wait(sim, 0.5);
    both(sim, 'tu3');
    wait(sim, 0.5);
    playScene(sim, 'la-cachette-d-emile');
    expect(fact(sim, 'aubrune.lanterne.verre')).toBe(true);
    moveTo(sim, 0, 'bv');
    wait(sim, 0.5);
    playScene(sim, 'vu-d-en-haut');
    talk(sim, 0, 'mado', 'belle');
    talk(sim, 1, 'ambroise', 'trop');
    talk(sim, 1, 'marthe', 'sonner');
    talk(sim, 1, 'odette', 'premiere');
    both(sim, 'pn-s');
    wait(sim, 0.5);
    playScene(sim, 'la-repetition');
    expect(sim.world.progress.quests[ACT_3]?.chapter).toBe('cinq-heures-douze');

    // 5 h 12: l'autorail crème, le Contrôleur descend puis repart, la lanterne reste allumée.
    both(sim, 'pn-s');
    sim.world.minutes = 312;
    wait(sim, 0.5);
    playScene(sim, 'l-autorail-creme');
    expect(fact(sim, 'aubrune.lanterne.allumee')).toBe(true);
    expect(fact(sim, 'aubrune.autorail.en-gare')).toBe(false);
    expect(passed(sim, ACT_3)).toContain('veillee');
    sim.world.minutes = 480;
    wait(sim, 30);
    expect(visible(sim, 'anatole')).toBe(false);
    expect(talk(sim, 0, 'firmin', 'toi')).toContain('firmin-apres#fin');
    playScene(sim, 'la-veillee-du-premier-train');
    expect(fact(sim, 'aubrune.acte3.fini')).toBe(true);
    sim.world.minutes = 600;
    wait(sim, 30);
    expect(talk(sim, 0, 'lucie', 'hier')).toContain('lucie-lettre#fin');
    // Le sac à dos de Solange, un par joueur, puis le départ quand on veut: quai, 5 h 12, à deux.
    talk(sim, 0, 'solange');
    talk(sim, 1, 'solange');
    expect(sim.world.players[0].bag?.id).toBe('sac-a-dos');
    expect(sim.world.players[1].bag?.id).toBe('sac-a-dos');
    expect(sim.world.progress.quests[ACT_3]?.done).toBe(false);
    both(sim, 'quai');
    sim.world.minutes = 312;
    wait(sim, 0.5);
    playScene(sim, 'en-voiture');
    expect(sim.world.progress.quests[ACT_3]?.done).toBe(true);
    expect(fact(sim, 'aubrune.depart.fait')).toBe(true);
  });
});
