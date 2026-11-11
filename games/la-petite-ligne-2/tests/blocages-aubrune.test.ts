// Blocages de l'histoire d'Aubrune trouvés par le client en séance sur la 0.22.0 (11 novembre):
// les ronces de la maison s'arrachent au printemps et ne reviennent pas, une sauvegarde déjà à
// l'étape se finit, l'invité les voit partir; les outils de Basile, sac plein, ne tombent jamais
// au sol et reviennent à qui les a manqués.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { DATA_SCHEMA } from '../src/etat/monde';
import { createGuest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { aimOf } from '../src/simulation/briques/visee';
import { startTalk, talkView } from '../src/simulation/dialogues/conversation';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { idleInput } from '../src/simulation/noyau/entrees';
import { bodyCollides } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { countHeld } from '../src/simulation/regles/conditions';
import { remember } from '../src/simulation/regles/memoire';
import { faceObject, holdFromToolbar, strikeUntilHarvested } from './aides-geste';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { createVirtualLink, memoryLog } from './aides-reseau';
import { visit } from './aides-visite';
import { MEMBERS, newSim } from './aides';

const QUEST = 'le-train-de-5h12';
const BRAMBLES = ['ronces-maison-1', 'ronces-maison-2'] as const;
const BEFORE_BRAMBLES = [
  'quai',
  'lettre',
  'maison',
  'pension',
  'pompe',
  'souper',
  'nuit-pension',
  'outils',
];

/** Une partie posée à Aubrune au jour 1 (printemps), 10 h. */
const content: Content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
  settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
});

/** Partie à Aubrune, scène d'arrivée passée, rencontres faites, l'histoire arrêtée à `passed`. */
function aubrune(passed: readonly string[], step: string): Sim {
  const sim = newSim(content);
  wait(sim, 0.5);
  for (let i = 0; i < 40 && sim.world.common.story?.scene; i++) {
    for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
    wait(sim, 1);
  }
  const state = sim.world.progress.quests[QUEST];
  if (state === undefined) throw new Error('suite absente');
  state.passed = [...passed];
  state.step = step;
  return sim;
}

function place(sim: Sim): NonNullable<Sim['world']['places'][string]> {
  const state = sim.world.places[sim.world.common.place];
  if (state === undefined) throw new Error('lieu absent');
  return state;
}

function passed(sim: Sim): readonly string[] {
  return sim.world.progress.quests[QUEST]?.passed ?? [];
}

function blocked(sim: Sim, id: string): boolean {
  const o = sim.content.places.aubrune?.map.objects.find((x) => x.id === id);
  const b = currentBlockers(sim.content, sim.world);
  if (o === undefined || b === null) throw new Error(id);
  return bodyCollides(b, o.x, o.y, 0.1);
}

/** Le vrai geste: devant les ronces, bêche en main, Espace jusqu'à ce qu'elles partent. */
function uproot(sim: Sim, player: PlayerIndex, id: string): number {
  faceObject(sim, player, id);
  expect(aimOf(sim, player)).toMatchObject({ id, verb: 'Arracher', refusal: null });
  return strikeUntilHarvested(sim, player, id);
}

describe('ronces de la maison', () => {
  it('au printemps, la bêche les arrache, elles ne bloquent plus, l’étape passe et rien ne repousse', () => {
    const sim = aubrune(BEFORE_BRAMBLES, 'debroussailler');
    expect(calendarOf(sim.content, sim.world.common.day).season).toBe('spring');
    // Mains nues: la bulle dit qu'il faut la bêche.
    faceObject(sim, 0, 'ronces-maison-1');
    sim.world.players[0].toolbar[0] = { item: 'beche', count: 1 };
    sim.world.players[0].selected = 1;
    expect(aimOf(sim, 0)?.refusal).toBe('needs-spade');
    holdFromToolbar(sim, 0, 'beche');
    for (const id of BRAMBLES) {
      expect(blocked(sim, id), `${id} bloque avant`).toBe(true);
      expect(uproot(sim, 0, id)).toBe(3);
      expect(blocked(sim, id), `${id} ne bloque plus`).toBe(false);
    }
    wait(sim, 0.5);
    expect(passed(sim)).toContain('debroussailler');
    // Rien dans le sac (pas de mûres), et un mois plus tard elles ne sont pas revenues.
    expect(countHeld(sim.world.players[0], 'mures')).toBe(0);
    sim.world.common.day += 30;
    wait(sim, 0.2);
    expect(place(sim).objects['ronces-maison-1']?.harvest?.back ?? 0).toBeGreaterThan(
      sim.world.common.day,
    );
    expect(blocked(sim, 'ronces-maison-1')).toBe(false);
  });

  it('une sauvegarde de la 0.22.0 arrêtée à l’étape se recharge et se franchit', () => {
    // Même format (aucune migration): l'état des deux objets est celui d'avant, intact.
    const old = aubrune(BEFORE_BRAMBLES, 'debroussailler');
    for (const id of BRAMBLES) place(old).objects[id] = { harvest: { work: 0, back: null } };
    old.world.players[0].toolbar[0] = { item: 'beche', count: 1 };
    const saved = JSON.parse(JSON.stringify(snapshotOf(old.world, content).data)) as unknown;
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const sim = createSim(content, restored.world);
    holdFromToolbar(sim, 0, 'beche');
    for (const id of BRAMBLES) uproot(sim, 0, id);
    wait(sim, 0.5);
    expect(passed(sim)).toContain('debroussailler');
  });

  it('l’invité voit les ronces partir (état du lieu transmis)', () => {
    const sim = aubrune(BEFORE_BRAMBLES, 'debroussailler');
    const clock = { now: 0 };
    const link = createVirtualLink(
      { latencyMs: 20, jitterMs: 5, lossPercent: 0 },
      3,
      () => clock.now,
    );
    const host = createHost(sim, link.host, memoryLog(), 0);
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
    host.sendAll();
    const tick = (steps: number): void => {
      for (let i = 0; i < steps; i++) {
        clock.now += 1000 / 30;
        link.deliver(clock.now);
        host.step(idleInput(0));
        guest.step(idleInput(i));
        link.deliver(clock.now);
      }
    };
    tick(30);
    for (const id of BRAMBLES) place(sim).objects[id] = { harvest: { work: 0, back: 1_000_000 } };
    sim.revisions.place += 1;
    tick(30);
    const after = guest.world();
    if (after === null) throw new Error('invité sans état');
    for (const id of BRAMBLES) {
      expect(after.places.aubrune?.objects[id]?.harvest?.back).toBe(1_000_000);
      const o = content.places.aubrune?.map.objects.find((x) => x.id === id);
      const b = currentBlockers(content, after);
      if (o === undefined || b === null) throw new Error(id);
      // La prédiction de l'invité lit les mêmes obstacles: il passe là où étaient les ronces.
      expect(bodyCollides(b, o.x, o.y, 0.1)).toBe(false);
    }
    guest.dispose();
  });
});

/** Suit un dialogue avec un habitant en prenant `option` à chaque choix; rend les nœuds vus. */
function talk(sim: Sim, player: PlayerIndex, villager: string, option: string): string[] {
  visit(sim, player, villager);
  expect(startTalk(contextOf(sim), player, villager)).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    const t = sim.world.players[player].talk;
    if (t === null) break;
    seen.push(`${t.dialogue}#${t.node}`);
    const view = talkView(sim.content, sim.world, player);
    if ((view?.options.length ?? 0) > 0) act(sim, player, { type: 'talk_choose', option });
    else act(sim, player, { type: 'talk_next' });
    wait(sim, 0.3);
  }
  if (sim.world.players[player].talk !== null) act(sim, player, { type: 'talk_close' });
  wait(sim, 0.3);
  return seen;
}

function fillPockets(sim: Sim, player: PlayerIndex): void {
  const me = sim.world.players[player];
  me.toolbar.fill({ item: 'pierre', count: 1 });
  if (me.bag !== null) me.bag.slots.fill({ item: 'pierre', count: 1 });
}

function emptyPockets(sim: Sim, player: PlayerIndex): void {
  const me = sim.world.players[player];
  me.toolbar.fill(null);
  if (me.bag !== null) me.bag.slots.fill(null);
}

function groundItems(sim: Sim): string[] {
  return place(sim).ground.map((g) => g.stack.item);
}

describe('outils de Basile', () => {
  it('sac plein: Basile garde les outils et le dit; vidé, il les donne; rien au sol', () => {
    const sim = aubrune(BEFORE_BRAMBLES.slice(0, -1), 'outils');
    remember(contextOf(sim), 'aubrune.acte1.outils', 'ouvert', 'duo');
    fillPockets(sim, 0);
    const full = talk(sim, 0, 'basile', 'merci');
    expect(full).toContain('basile-outils#don-sans-place');
    const said = sim.content.places.aubrune?.villagers.find((v) => v.id === 'basile');
    expect(said?.pocketsFull).toBeDefined();
    expect(countHeld(sim.world.players[0], 'hache')).toBe(0);
    expect(groundItems(sim)).toEqual([]);
    expect(passed(sim)).not.toContain('outils');
    emptyPockets(sim, 0);
    const given = talk(sim, 0, 'basile', 'merci');
    expect(given).toContain('basile-outils#fin');
    expect(countHeld(sim.world.players[0], 'hache')).toBe(1);
    expect(countHeld(sim.world.players[0], 'beche')).toBe(1);
    expect(groundItems(sim)).toEqual([]);
    wait(sim, 0.5);
    expect(passed(sim)).toContain('outils');
    // L'autre joueur a les siens aussi, après le passage de l'étape (0.22.0: jamais).
    talk(sim, 1, 'basile', 'merci');
    expect(countHeld(sim.world.players[1], 'hache')).toBe(1);
    expect(countHeld(sim.world.players[1], 'beche')).toBe(1);
  });

  it('partie existante: entendu sans rien recevoir, Basile les repropose une fois', () => {
    const sim = aubrune(BEFORE_BRAMBLES, 'debroussailler');
    // Ce qu'écrivait la 0.22.0 pour qui avait répondu « Je repasserai »: le dialogue fini.
    remember(contextOf(sim), 'aubrune.acte1.outils', 'fait', 'duo');
    for (const p of [0, 1] as const)
      remember(contextOf(sim), `dialogues.aubrune.basile-outils.j${String(p)}`, true, p);
    // Outils rangés dans un coffre: personne ne se les voit reproposer.
    const chest = Object.values(place(sim).objects).find((s) => s.store !== undefined);
    if (chest?.store === undefined) throw new Error('aucun rangement');
    chest.store[0] = { item: 'hache', count: 1 };
    chest.store[1] = { item: 'beche', count: 1 };
    expect(talk(sim, 0, 'basile', 'merci')[0]).not.toMatch(/^basile-outils/);
    chest.store.fill(null);
    // Le joueur 1 a les siens dans la barre: rien pour lui. Le joueur 0 n'a rien: Basile les garde
    // tant que son sac est plein, puis les donne.
    sim.world.players[1].toolbar[0] = { item: 'hache', count: 1 };
    sim.world.players[1].toolbar[1] = { item: 'beche', count: 1 };
    fillPockets(sim, 0);
    expect(talk(sim, 0, 'basile', 'merci')).toContain('basile-outils-encore#don-sans-place');
    expect(groundItems(sim)).toEqual([]);
    emptyPockets(sim, 0);
    expect(talk(sim, 0, 'basile', 'merci')).toContain('basile-outils-encore#fin');
    expect(countHeld(sim.world.players[0], 'beche')).toBe(1);
    expect(talk(sim, 0, 'basile', 'merci')[0]).not.toMatch(/^basile-outils/);
    expect(talk(sim, 1, 'basile', 'merci')[0]).not.toMatch(/^basile-outils/);
  });
});

describe('outils de Basile, étape encore ouverte', () => {
  it('les deux ont répondu « Je repasserai » (0.22.0): le rattrapage donne les outils et l’étape passe', () => {
    const sim = aubrune(BEFORE_BRAMBLES.slice(0, -1), 'outils');
    remember(contextOf(sim), 'aubrune.acte1.outils', 'ouvert', 'duo');
    for (const p of [0, 1] as const)
      remember(contextOf(sim), `dialogues.aubrune.basile-outils.j${String(p)}`, true, p);
    expect(talk(sim, 0, 'basile', 'merci')).toContain('basile-outils-encore#fin');
    wait(sim, 0.5);
    expect(passed(sim)).toContain('outils');
    expect(talk(sim, 1, 'basile', 'merci')).toContain('basile-outils-encore#fin');
    expect(countHeld(sim.world.players[1], 'hache')).toBe(1);
  });
});

describe('dons des étapes de quête', () => {
  it('poches pleines: l’étape attend, rien ne tombe au sol; de la place, et le don passe', () => {
    // Exemplaire factice: l'étape « abattre » donne trente planches (trois cases) au lieu de huit.
    const bigGift = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
      settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
      const quest = files['lieux/aubrune/quetes/le-train-de-5h12.json'] as {
        chapters: { steps: { id: string; onDone: { type: string; count?: number }[] }[] }[];
      };
      const step = quest.chapters[0]?.steps.find((s) => s.id === 'abattre');
      const gift = step?.onDone.find((e) => e.type === 'give_item');
      if (gift === undefined) throw new Error('don de « abattre » absent');
      gift.count = 30;
    });
    const sim = newSim(bigGift);
    wait(sim, 0.5);
    for (let i = 0; i < 40 && sim.world.common.story?.scene; i++) {
      for (const p of [0, 1] as const) act(sim, p, { type: 'scene_next' });
      wait(sim, 1);
    }
    const state = sim.world.progress.quests[QUEST];
    if (state === undefined) throw new Error('suite absente');
    state.passed = [...BEFORE_BRAMBLES, 'debroussailler', 'besaces'];
    state.step = 'abattre';
    remember(contextOf(sim), 'aubrune.acte1.abattre', 'ouvert', 'duo');
    fillPockets(sim, 0);
    const me = sim.world.players[0];
    me.toolbar[0] = { item: 'buche', count: 5 };
    me.toolbar[1] = { item: 'buche', count: 1 };
    visit(sim, 0, 'basile');
    expect(startTalk(contextOf(sim), 0, 'basile')).toBe(true);
    const events = wait(sim, 6);
    expect(passed(sim)).not.toContain('abattre');
    expect(countHeld(me, 'buche')).toBe(6);
    expect(groundItems(sim)).toEqual([]);
    // Le refus est redit toutes les 5 s, pas à chaque évaluation.
    const refusals = events.filter((e) => e.type === 'refused' && e.reason === 'pockets-full');
    expect(refusals.length).toBeGreaterThanOrEqual(1);
    expect(refusals.length).toBeLessThanOrEqual(2);
    // De la place faite, on revient parler à Basile: la remise et le don passent ensemble.
    for (let i = 2; i < me.toolbar.length; i++) me.toolbar[i] = null;
    if (me.talk !== null) act(sim, 0, { type: 'talk_close' });
    expect(startTalk(contextOf(sim), 0, 'basile')).toBe(true);
    wait(sim, 0.5);
    expect(passed(sim)).toContain('abattre');
    expect(countHeld(me, 'planche')).toBe(30);
    expect(countHeld(me, 'buche')).toBe(0);
    expect(groundItems(sim)).toEqual([]);
  });
});
