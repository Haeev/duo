// 0.12 (lot L-quêtes, `v0-12-conception.md`, section 5): la trame « Le marché d'Aubrune » et les neuf
// coups de main, joués de bout en bout depuis une partie déjà avancée (référence du jour 25). Les
// compteurs tenus par le marché, la basse-cour, la chèvre et les plis (lots parallèles) sont posés
// à la main, comme le feront ces systèmes; tout le reste passe par les vraies règles: conversations,
// dons, choix payants, charges portées à deux, scènes, rester à un point.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import type { CharacterId } from '../src/etat/types';
import { notebookQuests } from '../src/interface/modele';
import { uiContext } from '../src/interface/tests/aides';
import { decodeSave, restoreWorld } from '../src/sauvegarde/sauvegarde';
import { evaluate, NO_CONTEXT } from '../src/simulation/conditions';
import { SIM_HZ } from '../src/simulation/constantes';
import { type Sim, bump, character } from '../src/simulation/contexte';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { dialogueChoice, dialogueNext, giveToVillager, talkTo } from '../src/simulation/dialogues';
import { findPath } from '../src/simulation/grille';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag } from '../src/simulation/sac';
import { parseCondition } from '../src/donnees/contenu';
import { Reader } from '../src/donnees/lecteur';
import { contentAndMap } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const MAIN = ['market_stall', 'market_first', 'achille_oven', 'solange_garland', 'goat_talus'];
const SIDE = ['coq_arrive', 'first_brood', 'jeanne_shuttlecock', 'achille_eggs', 'lucie_round', 'market_crates', 'market_rush', 'firmin_goat_rope', 'odette_cheese'];
/** Du quai vers la rue, par le passage pavé de 2 m (x 43-44) plutôt qu'entre les buissons. */
const QUAY_EXIT = [{ x: 43.5, y: 18.5 }, { x: 43.5, y: 22 }];
/** Du quai vers la maisonnette, par le bout ouest du quai puis le chemin. */
const QUAY_WEST = [{ x: 22, y: 17 }, { x: 18, y: 19 }];
const IDLE: { controls: Partial<Record<CharacterId, ControlFrame>>; intents: [] } = { controls: {}, intents: [] };

/** La partie de référence du jour 25 (mardi d'été, midi), reprise telle que la trouverait la 0.12. */
function summerDay25(): Sim {
  const { content, map } = contentAndMap();
  const file = fileURLToPath(new URL('./donnees/sauvegardes/format-8-ete-jour-25.json', import.meta.url));
  const ref = JSON.parse(readFileSync(file, 'utf8')) as { dataSchema: number; data: unknown };
  return restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
}

function run(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) step(sim, IDLE);
}

function status(sim: Sim, id: string): string {
  return sim.world.quests.find((q) => q.id === id)?.status ?? 'absente';
}

function stepId(sim: Sim, id: string): string | undefined {
  const state = sim.world.quests.find((q) => q.id === id);
  return state === undefined ? undefined : sim.content.quests.find((q) => q.id === id)?.steps[state.step]?.id;
}

/** Une nuit passe (le compteur `nights` que pose l'aube), sans faire tourner la nuit entière. */
function night(sim: Sim): void {
  bump(sim, 'nights', null);
  run(sim, 0.1);
}

/** Un joueur parle à l'habitant (rendu visible), choisit `choice` s'il est donné, et va au bout. */
function talk(sim: Sim, who: CharacterId, villager: string, choice: string | null = null): void {
  const v = sim.world.villagers.find((x) => x.id === villager);
  if (v === undefined) throw new Error(`habitant absent: ${villager}`);
  v.visible = true;
  const c = character(sim, who);
  expect(talkTo(sim, c, villager)).toBe(true);
  if (choice !== null) dialogueChoice(sim, c, choice);
  for (let i = 0; i < 20 && c.dialogue !== null; i++) dialogueNext(sim, c);
  run(sim, 0.1);
}

/** Les deux joueurs lisent la scène à deux en cours jusqu'au bout. */
function readScene(sim: Sim): void {
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    dialogueNext(sim, character(sim, 'p1'));
    dialogueNext(sim, character(sim, 'p2'));
  }
  run(sim, 0.1);
}

/** Les deux joueurs au point (à 1 m de part et d'autre), le temps que la scène parte ou que l'étape se fasse. */
function bothAt(sim: Sim, pointId: string, seconds: number): void {
  const at = sim.map.points[pointId];
  if (at === undefined) throw new Error(`point absent: ${pointId}`);
  placeCharacter(sim, character(sim, 'p1'), { x: at.x - 0.6, y: at.y });
  placeCharacter(sim, character(sim, 'p2'), { x: at.x + 0.6, y: at.y });
  run(sim, seconds);
}

/**
 * La charge en cours, portée à deux jusqu'à sa destination (chemin de la grille, comme `portages.test.ts`).
 * Les porteurs se placent l'un devant l'autre dans le sens de la marche; coincés dans un passage étroit,
 * ils posent la charge et la reprennent dans le sens du chemin, comme le feraient des joueurs.
 */
function carryLoad(sim: Sim, via: { x: number; y: number }[] = []): void {
  const p1 = character(sim, 'p1');
  const p2 = character(sim, 'p2');
  const legs = [...via];
  let stuck = 0;
  for (let i = 0; i < SIM_HZ * 300 && sim.world.beam !== null; i++) {
    const load = sim.world.beam;
    // Points de passage choisis comme des joueurs (le plus court chemin d'un point frôle les buissons).
    while (legs[0] !== undefined && Math.hypot(legs[0].x - load.pos.x, legs[0].y - load.pos.y) < 0.6) legs.shift();
    const target = legs[0] ?? load.to;
    const next = findPath(refreshBlockers(sim), load.pos, target)?.[0] ?? target;
    const d = Math.max(1e-6, Math.hypot(next.x - load.pos.x, next.y - load.pos.y));
    const ux = (next.x - load.pos.x) / d;
    const uy = (next.y - load.pos.y) / d;
    if (!load.carried) {
      placeCharacter(sim, p1, { x: load.pos.x + ux * 0.7, y: load.pos.y + uy * 0.7 });
      placeCharacter(sim, p2, { x: load.pos.x - ux * 0.7, y: load.pos.y - uy * 0.7 });
    }
    // Coincée une demi-seconde: on pose (un pas sans tenir), puis on reprend dans le sens du chemin.
    const release = stuck >= SIM_HZ / 2;
    const before = { x: load.pos.x, y: load.pos.y };
    const frame: ControlFrame = { seq: i + 1, moveX: release ? 0 : ux, moveY: release ? 0 : uy, actHeld: !release };
    step(sim, { controls: { p1: frame, p2: frame }, intents: [] });
    // Relue après le pas (posée, elle a disparu): l'appel évite le rétrécissement de type d'avant le pas.
    const after = loadOf(sim)?.pos ?? { x: Infinity, y: Infinity };
    stuck = release || Math.hypot(after.x - before.x, after.y - before.y) > 1e-4 ? 0 : stuck + 1;
  }
  expect(sim.world.beam).toBeNull();
  run(sim, 0.5);
}

/** La charge en cours, relue dans l'état. */
function loadOf(sim: Sim): Sim['world']['beam'] {
  return sim.world.beam;
}

function setClock(sim: Sim, day: number, hhmm: string): void {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  sim.world.clock.day = day;
  sim.world.clock.minutes = h * 60 + m;
  run(sim, 0.1);
}

describe('0.12: la trame « Le marché d\'Aubrune » et ses coups de main', () => {
  it('les cinq principales et les neuf secondaires sont au carnet, séparées, sans identifiant brut ni « sous »', () => {
    const { content } = contentAndMap();
    for (const id of MAIN) expect(content.quests.find((q) => q.id === id)?.kind, id).toBe('main');
    for (const id of SIDE) expect(content.quests.find((q) => q.id === id)?.kind, id).toBe('side');
    const ids = new Set([...MAIN, ...SIDE]);
    const texts: string[] = [];
    for (const q of content.quests.filter((x) => ids.has(x.id))) texts.push(q.title, q.completionText, ...q.steps.map((s) => s.objective));
    const dialogues = Object.values(content.dialogues).filter((d) => d.when.some((c) => 'quest' in c && ids.has(c.quest)) || d.id === 'market_first_scene');
    expect(dialogues.length).toBeGreaterThanOrEqual(10);
    for (const d of dialogues) texts.push(...d.lines.map((l) => l.text), ...d.choices.flatMap((ch) => [ch.text, ...ch.reply.map((r) => r.text), ...ch.replyWrong.map((r) => r.text)]));
    for (const id of ['odette_market_letter', 'firmin_goat_letter']) texts.push(content.letters[id]?.text ?? '');
    for (const text of texts) {
      expect(text, text).not.toMatch(/\b[a-z]+_[a-z_]+\b|\{|\}/);
      expect(text, text).not.toMatch(/\bsous?\b/);
      expect(text, text).not.toMatch(/[\u2013\u2014]/);
    }

    // Le carnet range la trame sous « À la Halte » et les coups de main à part.
    const sim = summerDay25();
    for (const id of [...MAIN, ...SIDE]) sim.world.quests.push({ id, status: 'active', step: 0, checklist: [], baselines: {}, startedDay: 25 });
    const groups = notebookQuests(sim.world, uiContext());
    for (const id of MAIN) expect(groups.main.map((q) => q.id), id).toContain(id);
    for (const id of SIDE) expect(groups.side.map((q) => q.id), id).toContain(id);
  });

  it('condition générique sur compteur: `counter` lit la clé nommée, depuis le début de l\'étape par défaut', () => {
    const sim = summerDay25();
    const cond = parseCondition(new Reader('test', '', { type: 'counter', key: 'market_served', count: 2 }), 'game_start');
    expect(cond).toMatchObject({ type: 'counter', key: 'market_served', count: 2 });
    expect(evaluate(sim, cond, NO_CONTEXT)).toBe(false);
    bump(sim, 'market_served', 'p1', 2);
    expect(evaluate(sim, cond, NO_CONTEXT)).toBe(true);
  });

  it('jouée de bout en bout depuis le jour 25: chaque quête se finit, chaque récompense est versée une fois', () => {
    const sim = summerDay25();
    run(sim, 0.2);
    // La lettre d'Odette arrive dès la reprise (jour 25 au moins 3), la trame démarre.
    expect(sim.world.letters.some((l) => l.id === 'odette_market_letter')).toBe(true);
    expect(status(sim, 'market_stall')).toBe('active');
    const purse = (): number => sim.world.purse;
    let expected = purse();
    const paid = (amount: number): void => {
      expected += amount;
      expect(purse()).toBe(expected);
    };

    // 1. L'étal: parler à Odette, matériaux à Basile, l'étal porté à deux de l'établi à la place.
    talk(sim, 'p1', 'odette');
    expect(stepId(sim, 'market_stall')).toBe('build');
    const p1 = character(sim, 'p1');
    addToBag(sim, p1, 'plank', 'ordinary', 8);
    addToBag(sim, p1, 'nail', 'ordinary', 4);
    giveToVillager(sim, p1, 'basile', 'plank', 8);
    giveToVillager(sim, p1, 'basile', 'nail', 4);
    run(sim, 0.2);
    expect(stepId(sim, 'market_stall')).toBe('carry');
    expect(sim.world.beam?.item).toBe('market_stall');
    carryLoad(sim);
    expect(status(sim, 'market_stall')).toBe('done');
    expect(sim.world.flags).toContain('market_open');
    paid(50);

    // 2. Le premier marché: trois sortes sur l'étal, quatre habitants servis (compteurs du marché), scène à deux.
    expect(status(sim, 'market_first')).toBe('active');
    bump(sim, 'stall_kind', 'p1', 3);
    run(sim, 0.1);
    bump(sim, 'market_served', 'p2', 4);
    run(sim, 0.1);
    expect(status(sim, 'market_first')).toBe('done');
    expect(sim.world.scene?.dialogue).toBe('market_first_scene');
    readScene(sim);
    paid(80);

    // Coups de main ouverts par l'étal et le marché.
    expect(status(sim, 'market_crates')).toBe('active');
    bump(sim, 'crafted:craft_crate', 'p1', 4);
    run(sim, 0.1);
    bump(sim, 'stall_given:crate', 'p1', 4);
    run(sim, 0.1);
    expect(status(sim, 'market_crates')).toBe('done');
    expect(sim.world.flags).toContain('stall_six_slots');
    paid(30);

    // 3. La voûte: Achille, commande payée à Firmin (refusée sans la somme), caisse du samedi, scène au fournil.
    expect(status(sim, 'achille_oven')).toBe('active');
    talk(sim, 'p2', 'achille');
    expect(stepId(sim, 'achille_oven')).toBe('order');
    const saved = purse();
    sim.world.purse = 30;
    talk(sim, 'p1', 'firmin', 'order');
    expect(stepId(sim, 'achille_oven')).toBe('order');
    expect(purse()).toBe(30);
    sim.world.purse = saved;
    talk(sim, 'p1', 'firmin', 'order');
    expect(stepId(sim, 'achille_oven')).toBe('unload');
    paid(-40);
    // La caisse n'est pas au quai le jour même: elle attend le train de samedi (jour 29), une nuit au moins après.
    expect(sim.world.beam).toBeNull();
    night(sim);
    setClock(sim, 29, '10:30');
    expect(sim.world.beam?.item).toBe('brick_crate');
    carryLoad(sim, QUAY_EXIT);
    expect(stepId(sim, 'achille_oven')).toBe('repair');
    bothAt(sim, 'bakery_window', 0.5);
    expect(sim.world.scene?.dialogue).toBe('achille_oven_scene');
    readScene(sim);
    expect(status(sim, 'achille_oven')).toBe('done');
    paid(120);

    // 4. Les fanions: Solange, trois coupons achetés, une nuit de couture, puis un joueur au pied de chaque lampadaire.
    expect(status(sim, 'solange_garland')).toBe('active');
    talk(sim, 'p2', 'solange');
    const p2 = character(sim, 'p2');
    addToBag(sim, p2, 'cloth_coupon', 'ordinary', 3);
    talk(sim, 'p2', 'solange', 'give:cloth_coupon:3');
    expect(countInBag(p2, 'cloth_coupon')).toBe(0);
    expect(stepId(sim, 'solange_garland')).toBe('sew');
    night(sim);
    talk(sim, 'p2', 'solange');
    expect(countInBag(p2, 'garland')).toBe(1);
    // Seul, au pied d'un lampadaire, rien ne se fait: l'autre bout est à 13 m.
    const west = sim.map.points.garland_west;
    const east = sim.map.points.garland_east;
    if (west === undefined || east === undefined) throw new Error('points des fanions absents');
    placeCharacter(sim, p1, west);
    placeCharacter(sim, p2, { x: 20, y: 30 });
    run(sim, 4);
    expect(stepId(sim, 'solange_garland')).toBe('hang');
    placeCharacter(sim, p2, east);
    run(sim, 4);
    expect(status(sim, 'solange_garland')).toBe('done');
    expect(countInBag(p2, 'garland')).toBe(0);
    paid(60);

    // 5. La chèvre: lettre de Firmin, chevrerie (drapeau du chantier), chevrette payée, caisse portée à deux.
    expect(status(sim, 'goat_talus')).toBe('active');
    expect(sim.world.letters.some((l) => l.id === 'firmin_goat_letter')).toBe(true);
    talk(sim, 'p1', 'firmin');
    sim.world.flags.push('goat_shed_built');
    run(sim, 0.1);
    expect(stepId(sim, 'goat_talus')).toBe('order');
    sim.world.purse += 250;
    expected += 250;
    talk(sim, 'p1', 'firmin', 'buy');
    paid(-250);
    night(sim);
    // Toujours samedi 29 après le train: la caisse de la chevrette attend au quai.
    setClock(sim, 29, '11:00');
    expect(sim.world.beam?.item).toBe('goat_crate');
    carryLoad(sim, QUAY_WEST);
    expect(sim.world.flags).toContain('goat_arrived');
    bump(sim, 'animal_named:goat', 'p2');
    run(sim, 0.1);
    bump(sim, 'milked', 'p1');
    run(sim, 0.1);
    expect(status(sim, 'goat_talus')).toBe('done');
    paid(100);

    // Le coup de feu (démarré le samedi), la corde courte, le fromage (après deux traites).
    expect(status(sim, 'market_rush')).toBe('active');
    bump(sim, 'market_served_together', 'p1');
    run(sim, 0.1);
    paid(60);
    bump(sim, 'goat_grazed_spot', 'p1', 3);
    run(sim, 0.1);
    expect(status(sim, 'firmin_goat_rope')).toBe('done');
    paid(40);
    expect(status(sim, 'odette_cheese')).toBe('absente');
    bump(sim, 'milked', 'p1');
    run(sim, 0.1);
    addToBag(sim, p1, 'fresh_cheese', 'ordinary', 2);
    talk(sim, 'p1', 'odette', 'give:fresh_cheese:2');
    expect(status(sim, 'odette_cheese')).toBe('done');
    paid(70);

    // Le coq (démarré avec le premier marché, mardi): sa cage est descendue au train de samedi, sur le quai.
    expect(status(sim, 'coq_arrive')).toBe('active');
    expect(stepId(sim, 'coq_arrive')).toBe('train');
    const crate = sim.world.groundItems.find((g) => g.item === 'rooster_crate');
    expect(crate).toBeDefined();
    // Ramassé: la pile au sol passe dans le sac (le geste « Prendre » de la démo).
    sim.world.groundItems = sim.world.groundItems.filter((g) => g !== crate);
    addToBag(sim, p1, 'rooster_crate', 'ordinary', 1);
    run(sim, 0.1);
    expect(stepId(sim, 'coq_arrive')).toBe('coop');
    const coop = sim.map.points.chicken_coop;
    if (coop === undefined) throw new Error('poulailler absent');
    placeCharacter(sim, p1, coop);
    run(sim, 2.5);
    expect(sim.world.flags).toContain('rooster_arrived');
    expect(countInBag(p1, 'rooster_crate')).toBe(0);
    bump(sim, 'animal_named:rooster', 'p1');
    run(sim, 0.1);
    expect(status(sim, 'coq_arrive')).toBe('done');
    expect(sim.world.flags).toContain('brood_enabled');

    // La couvée (compteurs de la basse-cour), puis les deux au poulailler.
    expect(status(sim, 'first_brood')).toBe('active');
    bump(sim, 'brood_started', 'p1');
    run(sim, 0.1);
    bump(sim, 'brood_hatched', null);
    bothAt(sim, 'chicken_coop', 3.5);
    expect(status(sim, 'first_brood')).toBe('done');
    paid(40);

    // Le volant de Jeanne: quatre plumes données, puis la scène à deux sur la place.
    expect(status(sim, 'jeanne_shuttlecock')).toBe('active');
    addToBag(sim, p2, 'hen_feather', 'ordinary', 4);
    talk(sim, 'p2', 'jeanne', 'give:hen_feather:4');
    expect(stepId(sim, 'jeanne_shuttlecock')).toBe('play');
    bothAt(sim, 'village_square', 0.5);
    expect(sim.world.scene?.dialogue).toBe('jeanne_shuttlecock_scene');
    readScene(sim);
    expect(status(sim, 'jeanne_shuttlecock')).toBe('done');
    paid(30);

    // La tournée de Lucie: démarrée samedi matin (8 h à midi), la sacoche et trois plis (compteur des plis).
    expect(status(sim, 'lucie_round')).toBe('active');
    addToBag(sim, p2, 'mail_letter', 'ordinary', 1);
    run(sim, 0.1);
    bump(sim, 'mail_delivered', 'p2', 3);
    run(sim, 0.1);
    expect(status(sim, 'lucie_round')).toBe('done');
    paid(50);

    // Douze œufs pour Achille (démarrée un jeudi, après la voûte).
    setClock(sim, 34, '09:00');
    expect(status(sim, 'achille_eggs')).toBe('active');
    addToBag(sim, p1, 'egg', 'ordinary', 12);
    talk(sim, 'p1', 'achille', 'give:egg:12');
    expect(status(sim, 'achille_eggs')).toBe('done');

    // Toutes faites, aucune reprise de récompense.
    for (const id of [...MAIN, ...SIDE]) expect(status(sim, id), id).toBe('done');
    expect(sim.world.flags.filter((f) => f === 'market_open')).toHaveLength(1);
  });

  it('les douze œufs: sans œufs, la quête se retire dimanche 6 h sans reproche, et revient le jeudi suivant', () => {
    const sim = summerDay25();
    sim.world.quests.push({ id: 'achille_oven', status: 'done', step: 4, checklist: [], baselines: {}, startedDay: 25 });
    setClock(sim, 27, '09:00');
    expect(status(sim, 'achille_eggs')).toBe('active');
    setClock(sim, 30, '05:59');
    expect(status(sim, 'achille_eggs')).toBe('active');
    const purse = sim.world.purse;
    sim.world.clock.minutes = 6 * 60;
    run(sim, 0.1);
    expect(status(sim, 'achille_eggs')).toBe('absente');
    expect(sim.world.purse).toBe(purse);
    expect(character(sim, 'p1').notifications.some((n) => n.text.includes('Une autre fois'))).toBe(true);
    setClock(sim, 34, '09:00');
    expect(status(sim, 'achille_eggs')).toBe('active');
  });

  it('un samedi manqué ne bloque rien: la caisse de briques attend au quai jusqu\'à ce qu\'on la porte', () => {
    const sim = summerDay25();
    sim.world.quests.push({ id: 'achille_oven', status: 'active', step: 2, checklist: [], baselines: { 'duo:nights': sim.world.counters.duo.nights ?? 0 }, startedDay: 25 });
    night(sim);
    setClock(sim, 29, '10:30');
    expect(sim.world.beam?.item).toBe('brick_crate');
    // Personne ne vient: le lendemain, puis le surlendemain, elle est toujours là.
    setClock(sim, 30, '12:00');
    setClock(sim, 31, '12:00');
    expect(sim.world.beam?.item).toBe('brick_crate');
    carryLoad(sim, QUAY_EXIT);
    expect(stepId(sim, 'achille_oven')).toBe('repair');
  });
});
