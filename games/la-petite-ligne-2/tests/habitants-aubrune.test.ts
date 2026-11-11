// Vie quotidienne des habitants d'Aubrune (cahier 4.9, R41; `ecriture-habitants.md`): chacun a ses
// douze souvenirs atteignables, ses répliques selon l'heure et le temps, un secret, des goûts, et
// rien de tout cela ne passe devant une étape d'histoire.
import { describe, expect, it } from 'vitest';
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { DialogueDef, DialogueNode } from '../src/donnees/schemas/dialogue';
import type { VillagerDef } from '../src/donnees/schemas/habitant';
import type { Condition } from '../src/donnees/schemas/regles';
import { bondKey } from '../src/etat/progression';
import { startTalk } from '../src/simulation/dialogues/conversation';
import type { Sim } from '../src/simulation/noyau/pas';
import { evaluateAll } from '../src/simulation/regles/conditions';
import { remember } from '../src/simulation/regles/memoire';
import { giveItem } from '../src/simulation/sac/actions';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { visit } from './aides-visite';
import { newSim } from './aides';

type Json = Record<string, unknown>;

const AUBRUNE = 'aubrune';
const LONG_DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
/** Priorité la plus haute de la vie quotidienne (la première rencontre); les étapes commencent à 52. */
const LIFE_MAX = 50;
/** De passage: ils n'ont que les heures de leur arrêt. */
const VISITORS = ['rosalie', 'anatole'];

const content: Content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Json };
  settings.start = { ...settings.start, place: AUBRUNE, minute: 600 };
});

function place(): PlaceContent {
  const found = content.places[AUBRUNE];
  if (found === undefined) throw new Error('Aubrune absente');
  return found;
}

function villagerDef(id: string): VillagerDef | undefined {
  return place().villagers.find((v) => v.id === id);
}

function dialoguesOf(villager: string): DialogueDef[] {
  return place().dialogues.filter((d) => d.villager === villager);
}

function isLife(d: DialogueDef): boolean {
  return /-(souvenir|secret)-|-(quotidien|arrivee|arret)$|^martial-fanfare$/.test(d.id);
}

function daily(villager: string): DialogueDef {
  const found = dialoguesOf(villager).find((d) => d.priority === 0 && d.when.length === 0);
  if (found === undefined) throw new Error(`quotidien de ${villager}`);
  return found;
}

/** Parcourt une valeur de données et rend tous les objets qui ont ce `type`. */
function typed(value: unknown, type: string, out: Json[] = []): Json[] {
  if (Array.isArray(value)) for (const item of value) typed(item, type, out);
  else if (typeof value === 'object' && value !== null) {
    const object = value as Json;
    if (object.type === type) out.push(object);
    for (const item of Object.values(object)) typed(item, type, out);
  }
  return out;
}

function conditionKeys(conditions: readonly Condition[]): string[] {
  return typed(conditions, 'remembered').map((c) => String(c.key));
}

/** Les faits que les données d'Aubrune écrivent, et ceux que le moteur écrit de lui-même. */
function writable(): (key: string) => boolean {
  const p = place();
  const written = new Set<string>();
  for (const source of [p.dialogues, p.quests, p.scenes])
    for (const effect of typed(source, 'remember')) written.add(String(effect.key));
  for (const event of content.time.events[AUBRUNE] ?? [])
    for (const fact of event.activates.facts) written.add(fact.key);
  const villagers = p.villagers.map((v) => v.id).join('|');
  const once = p.dialogues.filter((d) => d.once === 'player').map((d) => d.id);
  const heard = p.dialogues.filter((d) => d.once === null && d.priority >= 10).map((d) => d.id);
  const rooms = Object.values(p.housings).flatMap((h) => h.rooms.map((r) => `${h.id}.${r.id}`));
  const engine = [
    new RegExp(`^habitants\\.(${villagers})\\.(cadeaux|adore)\\.j[01]$`),
    new RegExp(`^amitie\\.(${villagers})\\.coeur-[1-5]\\.j[01]$`),
    new RegExp(`^dialogues\\.${AUBRUNE}\\.(${once.join('|')})\\.j[01]$`),
    new RegExp(`^entendu\\.${AUBRUNE}\\.(${heard.join('|')})\\.j[01]$`),
    new RegExp(`^${AUBRUNE}\\.(${rooms.join('|')})$`),
    new RegExp(`^scenes\\.${AUBRUNE}\\.(${Object.keys(p.scenes).join('|')})$`),
  ];
  return (key) => written.has(key) || engine.some((pattern) => pattern.test(key));
}

function freshSim(): Sim {
  const sim = newSim(content);
  wait(sim, 0.5);
  if (sim.world.common.story) sim.world.common.story.scene = null;
  return sim;
}

/** Met le monde dans l'état que demandent ces conditions, comme le jeu le ferait (joueur 0 agit). */
function satisfy(sim: Sim, conditions: readonly Condition[]): void {
  const { world } = sim;
  for (const c of conditions) {
    switch (c.type) {
      case 'all':
        satisfy(sim, c.conditions);
        break;
      case 'any': {
        // La dernière branche: pour un fait par joueur, c'est celui de l'autre joueur.
        const last = c.conditions[c.conditions.length - 1];
        if (last !== undefined) satisfy(sim, [last]);
        break;
      }
      case 'remembered':
        world.progress.memory[c.key] = { v: c.equals ?? true, by: 'duo', day: world.common.day };
        break;
      case 'bond_at_least':
        world.progress.bonds[bondKey(c.villager, 0)] = c.points;
        break;
      case 'time_is':
        world.minutes = c.from;
        break;
      case 'weather_is':
        world.common.weather = c.weathers[0] as typeof world.common.weather;
        break;
      case 'need_at_least':
        world.players[0].needs[c.need] = c.value;
        break;
      case 'item_in_bag':
        giveItem(contextOf(sim), 0, c.item, c.count);
        break;
      // Rien à poser: un « pas encore » est vrai dans un monde neuf, le reste ne sert à aucun souvenir.
      case 'not':
      case 'decision_is':
      case 'money_at_least':
      case 'place_is':
      case 'season_is':
      case 'weekday_is':
        break;
    }
  }
}

/** Suit un dialogue sans joueur à l'écran: aiguillages évalués, faits retenus, textes rendus. */
function walk(sim: Sim, dialogue: DialogueDef): { nodes: string[]; texts: string[] } {
  const ctx = { world: sim.world, content: sim.content, actor: 0 as PlayerIndex };
  const nodes: string[] = [];
  const texts: string[] = [];
  let id: string | null = dialogue.start;
  for (let guard = 0; id !== null && guard < 32; guard++) {
    const node: DialogueNode | undefined = dialogue.nodes[id];
    if (node === undefined || node.kind === 'choice') break;
    if (node.kind === 'branch')
      id = node.cases.find((c) => evaluateAll(ctx, c.when))?.next ?? node.otherwise;
    else if (node.kind === 'effects') {
      for (const effect of node.effects)
        if (effect.type === 'remember') remember(contextOf(sim), effect.key, effect.value, 'duo');
      id = node.next;
    } else {
      nodes.push(id);
      texts.push(node.text);
      id = node.next;
    }
  }
  return { nodes, texts };
}

function talk(sim: Sim, player: PlayerIndex, villager: string): string[] {
  visit(sim, player, villager);
  expect(startTalk(contextOf(sim), player, villager), `parler à ${villager}`).toBe(true);
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const state = sim.world.players[player].talk;
    if (state === null) break;
    seen.push(`${state.dialogue}#${state.node}`);
    wait(sim, 0.25);
    act(sim, player, { type: 'talk_next' });
  }
  if (sim.world.players[player].talk !== null) act(sim, player, { type: 'talk_close' });
  wait(sim, 0.3);
  return seen;
}

const villagers = place()
  .villagers.map((v) => v.id)
  .sort();

describe("vie quotidienne des habitants d'Aubrune", () => {
  it('vingt et un habitants écrits, Martial Roques compris', () => {
    expect(villagers).toHaveLength(21);
    const martial = villagerDef('martial');
    expect(martial?.look?.pieces.length).toBeGreaterThan(4);
    expect(martial?.life?.arrives).toEqual([{ type: 'remembered', key: 'aubrune.acte3.fini' }]);
    const ids = dialoguesOf('martial').map((d) => d.id);
    for (const id of ['martial-arrivee', 'martial-fanfare', 'martial-quotidien', 'martial-hygiene'])
      expect(ids).toContain(id);
  });

  it('chacun a au moins 12 souvenirs atteignables, dont 4 sur ce que fait ta moitié', () => {
    const canBeWritten = writable();
    const sim = freshSim();
    const blank = JSON.stringify({
      memory: sim.world.progress.memory,
      bonds: sim.world.progress.bonds,
    });
    for (const v of villagers) {
      const memories = dialoguesOf(v).filter((d) => d.id.startsWith(`${v}-souvenir-`));
      let reachable = 0;
      let aboutTheOther = 0;
      for (const d of memories) {
        expect(d.priority, d.id).toBe(30);
        expect(d.once, d.id).toBe('player');
        expect(d.when.length, `${d.id}: un souvenir a une condition`).toBeGreaterThan(0);
        for (const key of conditionKeys(d.when))
          expect(canBeWritten(key), `${d.id}: fait ${key}`).toBe(true);
        // Le monde dans l'état demandé: la condition tient, et c'est bien ce souvenir qui parle.
        const saved = JSON.parse(blank) as Pick<Sim['world']['progress'], 'memory' | 'bonds'>;
        sim.world.progress.memory = saved.memory;
        sim.world.progress.bonds = saved.bonds;
        sim.world.players[0].needs.hygiene = 40;
        satisfy(sim, d.when);
        const ctx = { world: sim.world, content: sim.content, actor: 0 as PlayerIndex };
        expect(evaluateAll(ctx, d.when), `${d.id}: condition atteinte`).toBe(true);
        reachable += 1;
        expect(walk(sim, d).texts.length, `${d.id}: il dit quelque chose`).toBeGreaterThan(0);
        if ('moitie' in d.nodes || d.id.endsWith('-jaloux')) aboutTheOther += 1;
      }
      // Les deux fins de la Baronne s'excluent: une seule compte dans une partie.
      const exclusive =
        memories.filter((d) => /-(friture|relachee)$/.test(d.id)).length > 1 ? 1 : 0;
      expect(reachable - exclusive, `souvenirs de ${v}`).toBeGreaterThanOrEqual(12);
      expect(aboutTheOther, `souvenirs de ${v} sur l'autre joueur`).toBeGreaterThanOrEqual(4);
    }
  });

  it('le second des deux à venir entend la réplique sur sa moitié', () => {
    const sim = freshSim();
    for (const key of ['acte1.fini', 'acte2.train', 'acte2.fini', 'decor.cafe-ouvert'])
      remember(contextOf(sim), `aubrune.${key}`, true, 'duo');
    remember(contextOf(sim), 'habitants.lucie.cadeaux.j1', 1, 1);
    for (const p of [0, 1] as const) sim.world.players[p].needs.hygiene = 100;
    sim.world.minutes = 780;
    wait(sim, 1);
    const heard: [string[], string[]] = [[], []];
    for (const p of [0, 1] as const)
      for (let i = 0; i < 8 && !heard[p].some((n) => n.startsWith('lucie-quotidien')); i++)
        heard[p].push(...talk(sim, p, 'lucie'));
    expect(heard[0]).toContain('lucie-souvenir-cadeau#souvenir');
    expect(heard[1]).toContain('lucie-souvenir-cadeau#moitie');
    expect(heard[1]).not.toContain('lucie-souvenir-cadeau#souvenir');
  });

  it("chacun parle selon l'heure, le lieu de son planning et le temps qu'il fait", () => {
    const sim = freshSim();
    for (const v of villagers) {
      const dialogue = daily(v);
      const tour = `aubrune.tour.${v}`;
      const seen = new Set<string>();
      for (let hour = 0; hour < 24; hour++) {
        sim.world.minutes = hour * 60 + 20;
        sim.world.common.weather = 'clear';
        // Les faits d'une partie finie: gué refait, apprenti au fournil, trains réguliers.
        for (const key of ['verrou.v3', 'fantome.apprenti', 'acte2.fini', 'acte3.train2'])
          sim.world.progress.memory[`aubrune.${key}`] = { v: true, by: 'duo', day: 1 };
        const { nodes } = walk(sim, dialogue);
        expect(nodes.length, `${v} à ${String(hour)} h: bonjour puis moment`).toBe(2);
        seen.add(nodes[1] ?? '');
      }
      expect(seen.size, `moments de ${v}`).toBeGreaterThanOrEqual(VISITORS.includes(v) ? 1 : 3);
      // Pluie et brume: une conversation sur deux (les autres gardent l'heure).
      for (const [weather, node] of [
        ['rain', 'pluie'],
        ['mist', 'brume'],
      ] as const) {
        sim.world.common.weather = weather;
        sim.world.progress.memory[tour] = { v: 0, by: 'duo', day: 1 };
        expect(walk(sim, dialogue).nodes[1], `${v} sous ${weather}`).toBe(node);
        expect(walk(sim, dialogue).nodes[1], `${v} sous ${weather}, fois suivante`).not.toBe(node);
      }
    }
  });

  it('chacun a un secret confié par amitié, et des goûts', () => {
    const items = content.items;
    for (const v of villagers) {
      const secret = dialoguesOf(v).filter((d) =>
        typed(d.nodes, 'remember').some((e) => e.key === `aubrune.secret.${v}`),
      );
      expect(secret.length, `secret de ${v}`).toBeGreaterThanOrEqual(1);
      expect(
        dialoguesOf(v).some(
          (d) => d.id.includes('-secret-') && typed(d.when, 'bond_at_least').length > 0,
        ),
        `palier d'amitié de ${v}`,
      ).toBe(true);
      const gifts = villagerDef(v)?.life?.gifts;
      for (const list of [gifts?.loved, gifts?.liked, gifts?.disliked]) {
        expect(list?.length, `goûts de ${v}`).toBeGreaterThanOrEqual(1);
        for (const item of list ?? []) expect(item in items, `${v}: ${item}`).toBe(true);
      }
    }
  });

  it("aucun dialogue du quotidien ne passe devant une étape d'histoire", () => {
    const p = place();
    const byId = new Map(p.dialogues.map((d) => [d.id, d]));
    const steps = new Set(typed(p.quests, 'talked').map((c) => String(c.dialogue)));
    expect(steps.size).toBeGreaterThanOrEqual(80);
    for (const id of steps) {
      const d = byId.get(id);
      expect(d?.priority, `étape ${id}`).toBeGreaterThan(LIFE_MAX);
      expect(d !== undefined && isLife(d), `étape ${id}`).toBe(false);
    }
    const life = p.dialogues.filter(isLife);
    expect(life.length).toBeGreaterThan(300);
    for (const d of life) {
      expect(d.priority, d.id).toBeLessThanOrEqual(LIFE_MAX);
      for (const node of Object.values(d.nodes)) {
        if (node.kind !== 'line') continue;
        expect(node.text.length, `${d.id}: ${node.text}`).toBeLessThanOrEqual(150);
        expect(LONG_DASHES.test(node.text), d.id).toBe(false);
      }
    }
  });

  it('le train du samedi ramène Rosalie, et celui de 5 h 12 le Contrôleur', () => {
    const sim = freshSim();
    const fact = (key: string): unknown => sim.world.progress.memory[key]?.v;
    const present = (id: string): boolean =>
      sim.world.places[AUBRUNE]?.villagers[id]?.life?.presence !== 'away';
    remember(contextOf(sim), 'aubrune.acte2.fini', true, 'duo');
    remember(contextOf(sim), 'aubrune.train.en-gare', false, 'duo');
    sim.world.common.day = 6;
    sim.world.minutes = 610;
    wait(sim, 2);
    expect(fact('aubrune.train.en-gare')).toBe(true);
    expect(present('rosalie')).toBe(true);
    sim.world.minutes = 882;
    wait(sim, 2);
    expect(fact('aubrune.train.en-gare')).toBe(false);
    // Avant le premier départ, pas d'autorail régulier; après, chaque nuit.
    sim.world.minutes = 315;
    wait(sim, 2);
    expect(fact('aubrune.autorail.en-gare')).toBeUndefined();
    remember(contextOf(sim), 'aubrune.depart.fait', true, 'duo');
    for (const day of [7, 8]) {
      sim.world.common.day = day;
      sim.world.minutes = 315;
      wait(sim, 2);
      expect(fact('aubrune.autorail.en-gare')).toBe(true);
      expect(present('anatole')).toBe(true);
      sim.world.minutes = 347;
      wait(sim, 2);
      expect(fact('aubrune.autorail.en-gare')).toBe(false);
    }
  });
});
