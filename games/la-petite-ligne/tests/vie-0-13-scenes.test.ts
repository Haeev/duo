// 0.13, mission « scènes de vie et arrivée du chat » (`docs/jeux/jeu-1/v0-13-habitants.md`,
// sections 7.2 et 7.4): une simulation courte par scène ajoutée (S01 saluts, S06 la soupe, S09 le
// portage à deux, S15 la course à vélo, S16 la météo de l'abbé, S18 l'anniversaire), puis l'histoire
// du chat (Margot, le nom choisi à deux, `cat_here`), sa trouvaille de la semaine et une partie déjà
// en cours qui le voit arriver.
import { describe, expect, it } from 'vitest';
import type { Intent } from '../src/etat/actions';
import type { CharacterId, VillagerState, WorldEvent } from '../src/etat/types';
import { arcDay, lifePlace, sceneBubbles, sceneHolds, shuttleLoad } from '../src/etat/vie';
import { bestTarget, updateAim } from '../src/simulation/agir';
import { catHabit, catName, updateCat } from '../src/simulation/chat';
import { SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { placeVillagers, updateVillagers } from '../src/simulation/habitants';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { newSim, SEED } from './aides';

/** Jour de la semaine de la partie: le jour 1 est un samedi. */
const SATURDAY = 22;
const MONDAY = 24;
const TUESDAY = 25;
const AUTUMN_1 = 43;

function daySim(day: number, minutes: number, seed = SEED): Sim {
  const sim = newSim(seed);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.weather = 'sunny';
  w.flags.push('lucie_back', 'achille_here', 'solange_here');
  for (const c of w.characters) {
    c.created = true;
    c.status = 'active';
    c.inside = null;
    c.pos = { x: 5, y: 60 };
    c.prev = { x: 5, y: 60 };
  }
  placeVillagers(sim);
  return sim;
}

/** Fait tourner habitants et chat `seconds` secondes; l'horloge avance au rythme du jeu si `clock`. */
function run(sim: Sim, seconds: number, clock = true, events: WorldEvent[] = []): WorldEvent[] {
  const perTick = 1 / (0.7 * SIM_HZ);
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    sim.world.tick += 1;
    if (clock) sim.world.clock.minutes += perTick;
    sim.events.length = 0;
    for (const v of sim.world.villagers) {
      v.prev.x = v.pos.x;
      v.prev.y = v.pos.y;
    }
    updateVillagers(sim, SIM_DT);
    updateCat(sim, SIM_DT);
    events.push(...sim.events);
  }
  return events;
}

/** Jusqu'à la minute `minutes` du jour, au rythme du jeu. */
function until(sim: Sim, minutes: number, events: WorldEvent[] = []): WorldEvent[] {
  return run(sim, Math.max(0, (minutes - sim.world.clock.minutes) * 0.7), true, events);
}

function villager(sim: Sim, id: string): VillagerState {
  const v = sim.world.villagers.find((x) => x.id === id);
  if (v === undefined) throw new Error(`habitant absent: ${id}`);
  return v;
}

/** L'habitant est arrivé à sa place de scène, arrêté. */
function atPlace(sim: Sim, id: string, scene: string): boolean {
  const v = villager(sim, id);
  const place = lifePlace(sim.content, v.target);
  return v.target.startsWith(`scene:${scene}:`) && place !== null && Math.hypot(v.pos.x - place.x, v.pos.y - place.y) < 0.05 && v.speed === 0;
}

function bubblesOf(sim: Sim, scene: string, minutes: number, span: number): Set<string> {
  const by = new Set<string>();
  const keep = sim.world.clock.minutes;
  for (let m = minutes; m < minutes + span; m += 0.5) {
    sim.world.clock.minutes = m;
    for (const b of sceneBubbles(sim.content, sim.world)) if (b.scene === scene) by.add(b.by);
  }
  sim.world.clock.minutes = keep;
  return by;
}

describe('scènes de vie de la 0.13 (mission scènes et chat)', () => {
  it('S01: le matin, des habitants qui se croisent se saluent par leur prénom, une fois par paire et par jour', () => {
    const sim = daySim(MONDAY, 6 * 60);
    const events = until(sim, 10 * 60);
    const greetings = events.filter((e): e is Extract<WorldEvent, { type: 'villager_greeting' }> => e.type === 'villager_greeting');
    expect(greetings.length).toBeGreaterThan(0);
    // Par paires: le salut de l'un, la réponse de l'autre, avec le prénom de l'autre.
    expect(greetings.length % 2).toBe(0);
    const pairs = new Set<string>();
    for (let i = 0; i < greetings.length; i += 2) {
      const a = greetings[i];
      const b = greetings[i + 1];
      if (a === undefined || b === undefined) throw new Error('salut sans réponse');
      expect(b.villager).toBe(a.other);
      expect(b.other).toBe(a.villager);
      const name = sim.content.villagers.find((d) => d.id === a.other)?.firstName ?? '?';
      expect(a.text).toContain(name);
      const pair = [a.villager, a.other].sort().join('+');
      expect(pairs.has(pair), pair).toBe(false);
      pairs.add(pair);
    }
    // Rien après 10 h; la même graine donne les mêmes saluts.
    expect(until(sim, 11 * 60).some((e) => e.type === 'villager_greeting')).toBe(false);
    const again = until(daySim(MONDAY, 6 * 60), 10 * 60).filter((e) => e.type === 'villager_greeting');
    expect(again).toEqual(greetings);
  });

  it('S06: la soupe sur trois jours, à partir du premier jour de pluie de l\'automne (au plus tard le 5)', () => {
    const sim = daySim(AUTUMN_1 + 1, 10 * 60);
    const w = sim.world;
    const arc = sim.content.village.scenes.find((s) => s.id === 'soup_dispute')?.arc;
    if (arc === undefined || arc === null) throw new Error('soupe absente');
    // Pluie le 2 de l'automne: la dispute ce jour-là, la bouderie le lendemain, la paix le surlendemain.
    w.weatherLog = [{ day: AUTUMN_1, weather: 'sunny', mist: false }];
    w.weather = 'rain';
    expect(arcDay(sim.content, w, arc, AUTUMN_1)).toBeNull();
    expect(arcDay(sim.content, w, arc, AUTUMN_1 + 1)).toBe(1);
    w.weatherLog.push({ day: AUTUMN_1 + 1, weather: 'rain', mist: false });
    w.clock.day = AUTUMN_1 + 3;
    w.weather = 'sunny';
    expect(arcDay(sim.content, w, arc, AUTUMN_1 + 3)).toBe(3);
    // Sans pluie, l'histoire commence le 5 de l'automne.
    w.weatherLog = [1, 2, 3, 4].map((d) => ({ day: AUTUMN_1 + d - 1, weather: 'sunny' as const, mist: false }));
    w.clock.day = AUTUMN_1 + 4;
    expect(arcDay(sim.content, w, arc, AUTUMN_1 + 4)).toBe(1);

    // Jour 1: à midi, Odette est montée au café dire à Colette ce qu'elle pense de sa soupe.
    const d1 = daySim(AUTUMN_1 + 4, 11 * 60 - 1);
    d1.world.weatherLog = [1, 2, 3, 4].map((d) => ({ day: AUTUMN_1 + d - 1, weather: 'sunny' as const, mist: false }));
    until(d1, 12 * 60 + 5);
    expect(atPlace(d1, 'odette', 'soup_dispute')).toBe(true);
    expect(atPlace(d1, 'colette', 'soup_dispute')).toBe(true);
    expect(bubblesOf(d1, 'soup_dispute', 12 * 60 + 5, 30)).toEqual(new Set(['odette', 'colette']));
    // Jour 2: Odette fait le tour par la rue Haute (chez Solange), Colette boude au comptoir.
    const d2 = daySim(AUTUMN_1 + 5, 10 * 60 - 1);
    d2.world.weatherLog = [1, 2, 3, 4, 5].map((d) => ({ day: AUTUMN_1 + d - 1, weather: 'sunny' as const, mist: false }));
    const start = { ...villager(d2, 'odette').pos };
    until(d2, 11 * 60);
    expect(atPlace(d2, 'odette', 'soup_sulk')).toBe(true);
    expect(Math.hypot(villager(d2, 'odette').pos.x - start.x, villager(d2, 'odette').pos.y - start.y)).toBeGreaterThan(30);
    // Jour 3: Colette porte sa soupe à la terrasse d'Odette, elles trinquent.
    const d3 = daySim(AUTUMN_1 + 6, 15 * 60 - 1);
    d3.world.weatherLog = [1, 2, 3, 4, 5, 6].map((d) => ({ day: AUTUMN_1 + d - 1, weather: 'sunny' as const, mist: false }));
    until(d3, 16 * 60 + 5);
    expect(atPlace(d3, 'colette', 'soup_peace')).toBe(true);
    expect(atPlace(d3, 'odette', 'soup_peace')).toBe(true);
    // Hors de ces trois jours, rien.
    const scenes = d3.content.village.scenes.filter((s) => s.id.startsWith('soup_'));
    const at = { day: AUTUMN_1 + 7, minutes: 12 * 60, weather: 'sunny' as const };
    expect(scenes.some((s) => sceneHolds(d3.content, d3.world, s, { ...at, minutes: s.from + 1 }))).toBe(false);
  });

  it('S09: le samedi au quai, après la pesée, Paulin et Barnabé portent les sacs à deux, face à face, chargés à l\'aller', () => {
    const sim = daySim(SATURDAY, 9 * 60 - 1);
    // De 9 h à 10 h, Paulin tient ses sacs à la pesée (S19) pendant que Barnabé descend de la coupe.
    until(sim, 9 * 60 + 30);
    expect(villager(sim, 'paulin').target).toBe('train_stop');
    until(sim, 10 * 60 + 20);
    const b = villager(sim, 'barnabe');
    const p = villager(sim, 'paulin');
    expect(b.target).toMatch(/^scene:carry_together:0:0:/);
    expect(p.target).toMatch(/^scene:carry_together:0:1:/);
    // Sur un aller-retour: ils restent à 1,3 m l'un de l'autre, et se font face en marchant.
    let loaded = 0;
    let walking = 0;
    for (let i = 0; i < 20 * SIM_HZ; i++) {
      run(sim, 1 / SIM_HZ);
      const gap = Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y);
      expect(gap).toBeLessThan(2.2);
      if (b.speed > 0 && p.speed > 0) {
        walking++;
        expect(Math.cos(b.facing - Math.atan2(p.pos.y - b.pos.y, p.pos.x - b.pos.x))).toBeGreaterThan(0.9);
      }
      if (shuttleLoad(sim.content, b.target)?.rank === 0) loaded++;
    }
    expect(walking).toBeGreaterThan(SIM_HZ);
    expect(loaded).toBeGreaterThan(0);
    // Mado et Firmin sur le quai à 10 h: le dos de Firmin.
    expect(bubblesOf(sim, 'quay_mado', 10 * 60 + 30, 20).size).toBe(2);
  });

  it('S15: lundi 8 h, Lucie et Nour partent ensemble des hameaux, vélo à la main, puis filent par la route de l\'est', () => {
    const sim = daySim(MONDAY, 7 * 60 + 55);
    until(sim, 8 * 60 + 4);
    for (const id of ['lucie', 'nour']) {
      expect(atPlace(sim, id, 'bike_race'), id).toBe(true);
      expect(villager(sim, id).activity).toBe('bike_stop');
    }
    // Une bulle toutes les dix minutes de jeu: une ou deux au départ, dites par elles deux.
    const said = bubblesOf(sim, 'bike_race', 8 * 60 + 4, 15);
    expect(said.size).toBeGreaterThan(0);
    for (const by of said) expect(['lucie', 'nour']).toContain(by);
    until(sim, 8 * 60 + 39);
    for (const id of ['lucie', 'nour']) expect(atPlace(sim, id, 'bike_race_go'), id).toBe(true);
    until(sim, 8 * 60 + 42);
    for (const id of ['lucie', 'nour']) expect(villager(sim, id).visible, id).toBe(false);
    // Le mardi, pas de course.
    const tuesday = daySim(TUESDAY, 7 * 60 + 55);
    until(tuesday, 8 * 60 + 5);
    expect(villager(tuesday, 'nour').target).not.toMatch(/^scene:bike_race/);
  });

  it('S16: le mardi vers 8 h 30, l\'abbé à vélo annonce la pluie à Mado devant la forge, puis part en tournée', () => {
    const sim = daySim(TUESDAY, 8 * 60 + 9);
    until(sim, 8 * 60 + 50);
    expect(atPlace(sim, 'martial', 'weather_shout')).toBe(true);
    const said = bubblesOf(sim, 'weather_shout', 8 * 60 + 40, 15);
    expect(said.size).toBeGreaterThan(0);
    for (const by of said) expect(['martial', 'mado']).toContain(by);
    until(sim, 9 * 60 + 24);
    expect(atPlace(sim, 'martial', 'weather_shout_go')).toBe(true);
    until(sim, 9 * 60 + 27);
    expect(villager(sim, 'martial').visible).toBe(false);
  });

  it('S18: le jour de son anniversaire, Lucie reçoit ses proches sur la place, en cercle', () => {
    const sim = daySim(18, 14 * 60 + 29);
    until(sim, 15 * 60 + 20);
    for (const id of ['lucie', 'solange', 'firmin', 'jeanne']) expect(atPlace(sim, id, 'birthday_lucie'), id).toBe(true);
    expect(bubblesOf(sim, 'birthday_lucie', 15 * 60, 29).size).toBeGreaterThanOrEqual(2);
    // Le lendemain, rien.
    const next = sim.content.village.scenes.find((s) => s.id === 'birthday_lucie');
    if (next === undefined) throw new Error('anniversaire absent');
    expect(sceneHolds(sim.content, sim.world, next, { day: 19, minutes: 15 * 60, weather: 'sunny' })).toBe(false);
  });
});

/** Minute tenue pendant les pas complets (le rythme du jeu ferait avancer l'horloge), `null`: libre. */
let hold: number | null = null;

/** Un pas complet; les deux joueurs restent présents. */
function tick(sim: Sim, intents: { by: CharacterId; intent: Intent }[] = []): WorldEvent[] {
  if (hold !== null) sim.world.clock.minutes = hold;
  for (const c of sim.world.characters) c.lastInputTick = sim.world.tick;
  step(sim, { controls: {}, intents });
  return [...sim.events];
}

/** Le matin suivant, la journée reprise par les deux joueurs. */
function nextDay(sim: Sim, minutes = 9 * 60): WorldEvent[] {
  sim.events.length = 0;
  morning(sim);
  const events = [...sim.events];
  const w = sim.world;
  w.phase = 'day';
  w.clock.minutes = minutes;
  for (const c of w.characters) c.status = 'active';
  return events;
}

/** Monde de jeu au jour `day`, scènes de départ marquées vues, horloge arrêtée. */
function storySim(day: number): Sim {
  const sim = daySim(day, 9 * 60);
  const w = sim.world;
  w.clock.running = false;
  for (let i = 0; i < 5; i++) {
    if (w.scene !== null) w.dialoguesDone.push(w.scene.dialogue);
    w.scene = null;
    for (const c of w.characters) c.status = 'active';
    tick(sim);
  }
  return sim;
}

/** Le chat de l'hôte (lu par une fonction: TypeScript garderait `null` après une remise à zéro). */
function catOf(sim: Sim): Sim['runtime']['cat'] {
  return sim.runtime.cat;
}

function questOf(sim: Sim, id: string): { status: string; step: number } | undefined {
  return sim.world.quests.find((q) => q.id === id);
}

describe('le chat du bourg (section 7.4)', () => {

  it('le caresser (geste 30): visé posé, il ronronne, Cœur une fois par jour; caressé à deux, il se roule; qui arrive vite le fait fuir', () => {
    const sim = storySim(30);
    const w = sim.world;
    w.flags.push('cat_here');
    w.decisions.cat_name = 'grisaille';
    hold = 8 * 60;
    // Le premier pas le fait sortir du panier (il était absent); comme après une reprise, il est à sa place.
    tick(sim);
    sim.runtime.cat = null;
    tick(sim);
    const cat = catOf(sim);
    if (cat === null) throw new Error('pas de chat');
    expect(cat.pose).toBe('sleep');
    const [p1, p2] = w.characters;
    if (p1 === undefined || p2 === undefined) throw new Error('joueurs absents');
    // À petits pas, tout près de lui: la visée propose de le caresser, par son nom.
    p1.pos = { x: cat.pos.x + 0.9, y: cat.pos.y };
    p1.prev = { ...p1.pos };
    p1.facing = Math.PI;
    p2.pos = { x: cat.pos.x - 0.9, y: cat.pos.y };
    p2.prev = { ...p2.pos };
    p2.facing = 0;
    updateAim(sim, p1);
    expect(p1.aim?.verb).toBe('decor');
    expect(p1.aim?.label).toBe('Caresser Grisaille');
    expect(bestTarget(sim, p1)?.target).toMatchObject({ kind: 'decor', gesture: 'cat_pet' });
    const heart = p1.needs.heart;
    const events = tick(sim, [{ by: 'p1', intent: { type: 'act' } }]);
    expect(events.find((e) => e.type === 'cat_pet')).toMatchObject({ by: 'p1' });
    expect(p1.needs.heart - heart).toBeGreaterThan(2);
    expect(cat.pose).toBe('idle');
    // Le second, juste après: il se roule sur le dos. La seconde caresse du jour ne donne plus de Cœur.
    tick(sim, [{ by: 'p2', intent: { type: 'act' } }]);
    expect(cat.pose).toBe('roll');
    for (let i = 0; i < 4 * SIM_HZ; i++) tick(sim);
    const again = p1.needs.heart;
    expect(tick(sim, [{ by: 'p1', intent: { type: 'act' } }]).some((e) => e.type === 'cat_pet')).toBe(true);
    expect(p1.needs.heart - again).toBeLessThan(1);
    // Qui arrive en courant le fait fuir: plus rien à caresser tant qu'il file.
    p2.pos = { x: cat.pos.x - 3, y: cat.pos.y };
    p2.prev = { ...p2.pos };
    for (let i = 0; i < SIM_HZ; i++) {
      p2.speed = 3;
      cat.pace.p2 = 3;
      p2.pos = { x: p2.pos.x + 3 / SIM_HZ, y: p2.pos.y };
      tick(sim);
      if (cat.mode === 'flee') break;
    }
    expect(cat.mode).toBe('flee');
    hold = null;
  });
  it('arrive par l\'histoire de Margot: deux nuits après « Le beurre à deux », le panier sur la place, le nom choisi à deux', () => {
    const sim = storySim(30);
    const w = sim.world;
    const cat = sim.content.village.cat;
    if (cat === null) throw new Error('pas de chat dans les données');
    // Pas de chat tant que l'histoire n'est pas venue.
    expect(catHabit(sim, cat)).toBeNull();
    w.quests.push({ id: 'margot_butter', status: 'done', step: 2, startedDay: 28 });
    tick(sim);
    expect(questOf(sim, 'cat_arrival')).toMatchObject({ status: 'active', step: 0 });
    nextDay(sim);
    tick(sim);
    expect(questOf(sim, 'cat_arrival')?.step).toBe(0);
    nextDay(sim);
    tick(sim);
    expect(questOf(sim, 'cat_arrival')?.step).toBe(1);
    // 10 h, les deux sur la place: Margot y attend avec son panier, la scène se lance.
    hold = 9 * 60 + 40;
    for (let i = 0; i < 120 * SIM_HZ && !atPlace(sim, 'margot', 'cat_basket'); i++) tick(sim);
    expect(atPlace(sim, 'margot', 'cat_basket')).toBe(true);
    hold = 10 * 60 + 5;
    const square = sim.map.points.village_square;
    if (square === undefined) throw new Error('place absente');
    for (const c of w.characters) {
      c.pos = { x: square.x, y: square.y + (c.id === 'p1' ? 0.5 : -0.5) };
      c.prev = { ...c.pos };
    }
    for (let i = 0; i < 5 && w.scene === null; i++) tick(sim);
    expect(w.scene?.dialogue).toBe('cat_basket_scene');
    w.dialoguesDone.push('cat_basket_scene');
    w.scene = null;
    for (const c of w.characters) c.status = 'active';
    tick(sim);
    tick(sim);
    // Le nom, à deux: la décision s'ouvre d'elle-même, les deux disent « Pompon ».
    expect(w.decisionsOpen.cat_name).toBeDefined();
    const vote = (by: CharacterId): { by: CharacterId; intent: Intent } => ({ by, intent: { type: 'decision_vote', decision: 'cat_name', option: 'pompon' } });
    tick(sim, [vote('p1'), vote('p2')]);
    for (let i = 0; i < 3 * SIM_HZ; i++) tick(sim);
    expect(w.decisions.cat_name).toBe('pompon');
    expect(questOf(sim, 'cat_arrival')?.status).toBe('done');
    expect(w.flags).toContain('cat_here');
    expect(catName(sim, cat)).toBe('Pompon');
    // Il sort du panier, près de Margot, et part de lui-même vers sa place du moment.
    const c0 = sim.runtime.cat;
    expect(c0).not.toBeNull();
    if (c0 === null || cat.arrival === null) return;
    expect(Math.hypot(c0.pos.x - cat.arrival.x, c0.pos.y - cat.arrival.y)).toBeLessThan(0.5);
    expect(c0.mode).toBe('walk');
    // Odette le dit (`odette_after_gift` ne dit plus « pas de chat »).
    const after = sim.content.dialogues.odette_after_gift;
    expect(after?.when.some((c) => c.type === 'not')).toBe(true);
    expect(sim.content.dialogues.odette_cat_here?.lines[0]).toMatchObject({ speaker: 'odette' });
    hold = null;
  });

  it('partie déjà en cours (sauvegarde après le jour 16, beurre jamais fait): il arrive quand même, une semaine plus tard', () => {
    const sim = storySim(40);
    const w = sim.world;
    w.quests.push({ id: 'lucie_return', status: 'done', step: 3, startedDay: 17 });
    tick(sim);
    expect(questOf(sim, 'cat_arrival')?.step).toBe(0);
    for (let d = 0; d < 6; d++) {
      nextDay(sim);
      tick(sim);
    }
    expect(questOf(sim, 'cat_arrival')?.step).toBe(0);
    nextDay(sim);
    tick(sim);
    expect(questOf(sim, 'cat_arrival')?.step).toBe(1);
  });

  it('sa trouvaille de la semaine: une par semaine, devant la maisonnette, au nom du chat', () => {
    const sim = storySim(30);
    const w = sim.world;
    w.flags.push('cat_here');
    w.decisions.cat_name = 'mistral';
    const door = sim.map.points.house_door;
    if (door === undefined) throw new Error('porte absente');
    const gifts: WorldEvent[] = [];
    let lying = 0;
    const texts: string[] = [];
    for (let d = 0; d < 21; d++) {
      const found = nextDay(sim).filter((e) => e.type === 'cat_gift');
      gifts.push(...found);
      // Ce matin-là, elle est par terre devant la porte (la nuit suivante, le rangement la met au cellier).
      if (found.length > 0) lying += w.groundItems.filter((g) => Math.hypot(g.pos.x - door.x, g.pos.y - door.y) < 1.5).length;
      if (found.length > 0) texts.push(...w.characters.flatMap((c) => c.notifications.map((n) => n.text)));
    }
    expect(gifts.length).toBe(3);
    const items = gifts.map((e) => (e.type === 'cat_gift' ? e.item : ''));
    expect(new Set(items)).toEqual(new Set(['jay_feather', 'cat_button']));
    expect(lying).toBe(3);
    expect(texts.filter((x) => x.startsWith('Mistral a laissé une plume de geai') || x.startsWith('Mistral a laissé un bouton de laiton')).length).toBeGreaterThan(0);
    // Sans chat, rien.
    const none = storySim(30);
    for (let d = 0; d < 8; d++) expect(nextDay(none).some((e) => e.type === 'cat_gift')).toBe(false);
  });
});
