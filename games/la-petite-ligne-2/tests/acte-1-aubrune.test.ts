// Prologue « Terminus » et acte 1 d'Aubrune (« Logement fourni »): les données se chargent, les
// pages tiennent dans le bandeau, les bonjours ne se répètent pas d'une conversation à l'autre, et
// la suite se joue de bout en bout par la simulation, du compartiment à la réponse de Firmin.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { DialogueDef } from '../src/donnees/schemas/dialogue';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { giveItem } from '../src/simulation/sac/actions';
import { sceneView } from '../src/simulation/scenes/lecture';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;

/** Tirets demi-cadratin et cadratin, interdits partout (écrits par leur code: le fichier n'en contient aucun). */
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const PROLOGUE = 'train-de-nuit';
const AUBRUNE = 'aubrune';
const VILLAGERS = [
  'firmin',
  'odette',
  'basile',
  'achille',
  'solange',
  'mado',
  'ambroise',
  'honorine',
  'marthe',
  'jeanne',
];

/** Le jeu commence dans le train de nuit, à 21 h 30 (branchement prévu de `reglages.json`). */
function prologueContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: PROLOGUE, minute: 1290 };
  });
}

/** Une partie posée directement à Aubrune, à 10 h (pour les contrôles du quotidien). */
function aubruneContent(): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
  });
}

function newGame(): Sim {
  return newSim(prologueContent());
}

function point(sim: Sim, name: string): { x: number; y: number } {
  const at = sim.content.places[sim.world.common.place]?.map.points[name];
  if (at === undefined) throw new Error(`point ${name}`);
  return at;
}

function moveTo(sim: Sim, player: PlayerIndex, name: string): void {
  const at = point(sim, name);
  sim.world.players[player].body.x = at.x + (player === 0 ? -0.4 : 0.4);
  sim.world.players[player].body.y = at.y;
}

function both(sim: Sim, name: string): void {
  moveTo(sim, 0, name);
  moveTo(sim, 1, name);
}

/** Pose un joueur à côté d'un habitant (là où sa vie l'a mené). */
function nextTo(sim: Sim, player: PlayerIndex, villager: string): void {
  const v = sim.world.places[sim.world.common.place]?.villagers[villager];
  if (v === undefined) throw new Error(`habitant ${villager}`);
  sim.world.players[player].body.x = v.body.x + 0.8;
  sim.world.players[player].body.y = v.body.y;
}

/** Parle à un habitant et suit le dialogue, en prenant l'option donnée à chaque choix. */
function talk(sim: Sim, player: PlayerIndex, villager: string, option?: string): string[] {
  nextTo(sim, player, villager);
  expect(startTalk(contextOf(sim), player, villager), `parler à ${villager}`).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const talkState = sim.world.players[player].talk;
    if (talkState === null) break;
    seen.push(`${talkState.dialogue}#${talkState.node}`);
    // Le temps de lire: les étapes se vérifient tous les quelques pas.
    wait(sim, 0.25);
    const view = talkView(sim.content, sim.world, player);
    if ((view?.options.length ?? 0) > 0)
      act(sim, player, { type: 'talk_choose', option: option ?? '' });
    else act(sim, player, { type: 'talk_next' });
  }
  if (sim.world.players[player].talk !== null) act(sim, player, { type: 'talk_close' });
  wait(sim, 0.3);
  return seen;
}

/** Lit les répliques de la scène en cours jusqu'à sa fin (les attentes se font à côté). */
function playScene(sim: Sim, guard = 40): void {
  for (let i = 0; i < guard && sim.world.common.story?.scene; i++) {
    for (const p of [0, 1] as const) {
      const view = sceneView(sim.world, sim.content, p);
      if (view?.beat.kind === 'say' && view.beat.mine) act(sim, p, { type: 'scene_next' });
    }
    wait(sim, 1);
  }
  expect(sim.world.common.story?.scene ?? null).toBeNull();
}

function passed(sim: Sim, quest: string): readonly string[] {
  return sim.world.progress.quests[quest]?.passed ?? [];
}

function setNeed(sim: Sim, need: 'hunger' | 'sleep' | 'hygiene', value: number): void {
  for (const p of [0, 1] as const) sim.world.players[p].needs[need] = value;
}

function dialoguesOf(content: Content, place: string): readonly DialogueDef[] {
  return content.places[place]?.dialogues ?? [];
}

describe('écriture du prologue et de l’acte 1', () => {
  const content = prologueContent();

  it('chaque page tient dans le bandeau: 150 caractères au plus, ni tiret long', () => {
    const pages: string[] = [];
    for (const place of [PROLOGUE, AUBRUNE]) {
      for (const d of dialoguesOf(content, place))
        for (const node of Object.values(d.nodes)) {
          if (node.kind === 'line') pages.push(node.text);
          if (node.kind === 'choice') pages.push(...node.options.map((o) => o.text));
        }
      for (const s of Object.values(content.places[place]?.scenes ?? {}))
        for (const beat of s.beats) if (beat.do === 'say') pages.push(beat.text);
      for (const q of Object.values(content.places[place]?.quests ?? {}))
        for (const ch of q.chapters) for (const st of ch.steps) pages.push(st.objective);
    }
    expect(pages.length).toBeGreaterThan(250);
    const tooLong = pages.filter(
      (t) => t.replace(/\[\[(duo:)?([^|\]]*)\|([^\]]*)\]\]/g, '$2').length > 150,
    );
    expect(tooLong).toEqual([]);
    expect(pages.filter((t) => LONG_DASHES.test(t))).toEqual([]);
  });

  it('chaque habitant a 6 bonjours distincts, 4 heures, une remarque d’hygiène et 2 souvenirs', () => {
    const all = dialoguesOf(content, AUBRUNE);
    for (const v of VILLAGERS) {
      const daily = all.find((d) => d.id === `${v}-quotidien`);
      if (daily === undefined) throw new Error(v);
      const greetings = Object.entries(daily.nodes)
        .filter(([id]) => /^b\d$/.test(id))
        .map(([, n]) => (n.kind === 'line' ? n.text : ''));
      expect(new Set(greetings).size, v).toBe(6);
      expect(all.some((d) => d.id === `${v}-hygiene`)).toBe(true);
      expect(all.filter((d) => d.id.startsWith(`${v}-souvenir-`)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('le bonjour change à chaque conversation, sur douze jours de suite', () => {
    const sim = newSim(aubruneContent());
    wait(sim, 0.5);
    playScene(sim);
    for (const v of ['honorine', 'marthe', 'mado']) {
      const said: string[] = [];
      for (let day = 0; day < 12; day++) {
        const pages = talk(sim, (day % 2) as PlayerIndex, v);
        const greeting = pages.find((p) => p.startsWith(`${v}-quotidien#b`));
        if (greeting !== undefined) said.push(greeting);
      }
      expect(said.length, v).toBe(12);
      for (let i = 1; i < said.length; i++) expect(said[i], v).not.toBe(said[i - 1]);
      expect(new Set(said).size, v).toBe(6);
    }
  });

  it('un joueur sale n’entend que la remarque d’hygiène de l’habitant', () => {
    const sim = newSim(aubruneContent());
    wait(sim, 0.5);
    playScene(sim);
    sim.world.players[0].needs.hygiene = 10;
    wait(sim, 0.2);
    expect(talk(sim, 0, 'solange')[0]).toBe('solange-hygiene#odeur');
  });

  it('le prologue et l’acte 1 se jouent de bout en bout', () => {
    const sim = newGame();
    wait(sim, 0.5);
    expect(sim.world.common.place).toBe(PROLOGUE);
    // Le compartiment, puis les papiers (l'éditeur s'ouvre au nœud « photo »), chacun son tour.
    playScene(sim);
    const papers = talk(sim, 0, 'controleur');
    expect(papers).toContain('controleur-papiers#photo');
    talk(sim, 1, 'controleur');
    expect(passed(sim, 'terminus')).toEqual(['papiers']);
    // Le chariot, le sandwich, la faim.
    setNeed(sim, 'hunger', 60);
    expect(talk(sim, 0, 'controleur', 'sandwich')).toContain('controleur-chariot#servi');
    expect(passed(sim, 'terminus')).toContain('chariot');
    act(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 0 } });
    sim.world.players[0].needs.hunger = Math.max(sim.world.players[0].needs.hunger, 90);
    wait(sim, 0.5);
    expect(passed(sim, 'terminus')).toContain('manger');
    // Le tunnel, la nuit sur les banquettes (le saut de nuit est le lot des besoins: simulé ici).
    playScene(sim);
    setNeed(sim, 'sleep', 85);
    wait(sim, 0.5);
    expect(passed(sim, 'terminus')).toContain('dormir');
    playScene(sim);
    // Les deux devant la porte: l'étape finit le prologue, dont l'effet `travel_to` fait partir
    // le train vers Aubrune, sans quai ni horaire (le trajet prend ses heures d'un coup).
    if (sim.world.common.place === PROLOGUE) both(sim, 'porte');
    wait(sim, 0.5);
    expect(sim.world.progress.quests.terminus?.done).toBe(true);
    const nightDay = sim.world.common.day;
    for (
      let i = 0;
      i < 40 && (sim.world.common.place !== AUBRUNE || sim.world.common.phase !== 'day');
      i++
    ) {
      for (const p of [0, 1] as const) act(sim, p, { type: 'place_loaded', place: AUBRUNE });
      wait(sim, 1);
    }
    // Train de nuit: on arrive toujours le lendemain à 8 h (« Il est 8 h », dit Firmin).
    expect(sim.world.minutes).toBeGreaterThanOrEqual(8 * 60);
    expect(sim.world.minutes).toBeLessThan(8 * 60 + 2);
    expect(sim.world.common.day).toBe(nightDay + 1);
    expect(sim.world.common.place).toBe(AUBRUNE);
    wait(sim, 0.5);

    // Firmin en pantoufles, la lettre, la maison.
    playScene(sim);
    expect(passed(sim, 'le-train-de-5h12')).toEqual(['quai']);
    const letter = talk(sim, 0, 'firmin', 'rends');
    expect(letter).toContain('firmin-lettre#fin');
    both(sim, 'hd');
    wait(sim, 0.5);
    playScene(sim);
    // La pension, la pompe, le souper, la nuit.
    talk(sim, 1, 'odette');
    setNeed(sim, 'hygiene', 60);
    wait(sim, 0.5);
    expect(talk(sim, 0, 'odette', 'merci')).toContain('odette-souper#fin');
    setNeed(sim, 'sleep', 100);
    wait(sim, 0.5);
    expect(passed(sim, 'le-train-de-5h12')).toEqual([
      'quai',
      'lettre',
      'maison',
      'pension',
      'pompe',
      'souper',
      'nuit-pension',
    ]);
    // Basile, les ronces, les chênes, les besaces.
    talk(sim, 0, 'basile', 'merci');
    talk(sim, 1, 'basile', 'merci');
    giveItem(contextOf(sim), 1, 'mures', 2);
    talk(sim, 0, 'solange', 'merci');
    talk(sim, 1, 'solange', 'merci');
    // Avec la besace (4 cases de plus), six bûches tiennent dans le sac.
    expect(giveItem(contextOf(sim), 0, 'buche', 6)).toBe(6);
    talk(sim, 0, 'basile');
    wait(sim, 0.5);
    expect(passed(sim, 'le-train-de-5h12')).toEqual(
      expect.arrayContaining(['outils', 'debroussailler', 'abattre', 'besaces']),
    );
    // Le toit, à deux, avec les huit planches sciées par Basile.
    wait(sim, 3);
    nextTo(sim, 1, 'basile');
    talk(sim, 0, 'basile');
    wait(sim, 0.5);
    expect(passed(sim, 'le-train-de-5h12')).toContain('toit');
    both(sim, 'hd');
    playScene(sim);
    // Le potager, les poules, les ventes.
    expect(talk(sim, 0, 'odette', 'prendre')).toContain('odette-graines#fin');
    wait(sim, 0.5);
    both(sim, 'jd');
    wait(sim, 0.5);
    expect(passed(sim, 'le-train-de-5h12')).toContain('potager');
    talk(sim, 0, 'odette', 'oui');
    talk(sim, 0, 'odette', 'vendre');
    const money = sim.world.players[0].money;
    talk(sim, 0, 'achille', 'vendre');
    expect(sim.world.players[0].money - money).toBe(300);
    wait(sim, 0.5);
    expect(passed(sim, 'le-train-de-5h12')).toContain('vente-achille');
    // La première nuit: 5 h 12 sonne (déclencheur de monde), puis Firmin au matin.
    both(sim, 'hd');
    sim.world.minutes = 312;
    wait(sim, 0.5);
    expect(sim.world.common.story?.scene?.id).toBe('la-sonnerie-de-5h12');
    playScene(sim);
    expect(passed(sim, 'le-train-de-5h12')).toContain('premiere-nuit');
    sim.world.minutes = 8 * 60;
    expect(talk(sim, 1, 'jeanne', 'tenu')).toContain('jeanne-heure#caramel');
    expect(talk(sim, 0, 'firmin', 'lueur')).toContain('firmin-matin#fin');
    wait(sim, 0.5);
    expect(sim.world.progress.quests['le-train-de-5h12']?.done).toBe(true);
    expect(sim.world.progress.memory['aubrune.acte1.fini']?.v).toBe(true);
    // Les habitants s'en souviennent.
    const memories = [talk(sim, 0, 'basile')[0], talk(sim, 0, 'basile')[0]].sort();
    expect(memories).toEqual(['basile-souvenir-ronces#souvenir', 'basile-souvenir-toit#souvenir']);
    // Dits une fois chacun, puis retour au quotidien.
    expect(talk(sim, 0, 'basile')[0]).toMatch(/^basile-quotidien#b\d$/);
  });
});
