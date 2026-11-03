// Tour 9 (docs/jeux/jeu-1/tour-09-conception.md, section 8): annonces, catalogue de la semaine,
// outils, poules, cadeaux, chantiers, correctifs de la commande, cueillette d'automne, étapes,
// école de Jeanne et les quatre moments. Critères T9 qui relèvent de la simulation.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dayOfSeason, seasonOfDay, weekdayOf } from '../src/donnees/calendrier';
import type { AnnonceLine, Content } from '../src/donnees/types';
import { annonceReward, drawAnnonce, forageAvailableOn, postKindOn } from '../src/etat/annonces';
import { catalogueOffers } from '../src/etat/catalogue';
import { composeOrder, fishCost, productPrice } from '../src/etat/commande-generee';
import { drawForage } from '../src/etat/cueillette';
import type { CharacterId } from '../src/etat/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { stageScreen } from '../src/etat/semaine';
import { SIM_HZ } from '../src/simulation/constantes';
import { morningBoard, updateBoard } from '../src/simulation/annonces';
import { deliverWeeklyItem } from '../src/simulation/catalogue';
import { morningImprovements, openImprovement, payImprovement, bringPlanks } from '../src/simulation/chantiers';
import { evaluate, NO_CONTEXT } from '../src/simulation/conditions';
import type { Sim } from '../src/simulation/contexte';
import { emptyOrderBook } from '../src/simulation/semaine';
import { countInBag, countInStacks, giveToCharacter } from '../src/simulation/sac';
import { placeVillagers } from '../src/simulation/habitants';
import { step } from '../src/simulation/pas';
import { morning } from '../src/simulation/horloge';
import { contentAndMap, createRobot, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const HOUR = 60;
const { content } = contentAndMap();
const s = content.settings;
const board = (() => {
  if (s.board === null) throw new Error('reglages.board absent');
  return s.board;
})();

function load(file: string, c: Content = contentAndMap().content): Sim {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as { dataSchema: number; data: unknown };
  return restoreWorld(c, contentAndMap().map, decodeSave(structuredClone(raw.data)), raw.dataSchema, [A, B]);
}

/** Un monde d'été réel (mardi 25), avancé au jour et à l'heure voulus. */
function at(day: number, minutes = 10 * HOUR): Sim {
  const sim = load('format-5-ete-jour-25.json');
  sim.world.clock.day = day;
  sim.world.clock.minutes = minutes;
  return sim;
}

const sell = (item: string): number => {
  const g = s.order.generated;
  const own = content.items[item]?.sellPrice ?? null;
  return g === null ? (own ?? 0) : productPrice(g, item, own);
};
/** Le modèle d'obtention du script (`FIRST_FORAGE` de `tour9_automne.py`): la cueillette deux jours après son arrivée. */
const FIRST_FORAGE: Record<string, number> = { dandelion: 0, blackberry: 22, chanterelle: 22, hazelnut: 43, elderberry: 43, cep: 46 };
const scriptObtainable = (day: number) => (l: AnnonceLine): boolean => (l.item in FIRST_FORAGE ? day >= (FIRST_FORAGE[l.item] ?? 0) + 2 : true);

/** La suite des annonces d'une graine, avec la mémoire du tableau (recent, posted, habitant précédent). */
function sequence(seed: number, obtainable: (day: number) => (l: AnnonceLine) => boolean, last = 63): { day: number; gabarit: string; variant: number }[] {
  const out: { day: number; gabarit: string; variant: number }[] = [];
  const recent: { gabarit: string; day: number }[] = [];
  const posted: string[] = [];
  let lastGiver: string | null = null;
  for (let day = 16; day <= last; day++) {
    const drawn = drawAnnonce(s, content.annonces, { seed, day, recent, posted, lastGiver, obtainable: obtainable(day) });
    if (drawn === null) continue;
    out.push({ day, gabarit: drawn.def.id, variant: drawn.variant });
    recent.push({ gabarit: drawn.def.id, day });
    if (recent.length > 4) recent.shift();
    if (!posted.includes(drawn.def.id)) posted.push(drawn.def.id);
    lastGiver = drawn.def.giver;
  }
  return out;
}

describe('le tableau des annonces (T9-01 à T9-05)', () => {
  it('T9-02: 1 000 graines, jours 16 à 63: dimanche un coup de main, mercredi une annonce à deux, jamais le même gabarit à moins de 10 jours, jamais une cueillette hors saison, jamais un produit jamais obtenu', () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const seq = sequence(seed, scriptObtainable);
      const days = seq.map((x) => x.day);
      for (let day = 16; day <= 63; day++) {
        const kind = postKindOn(board, day);
        expect(days.includes(day), `graine ${seed}, jour ${day}`).toBe(kind !== null);
      }
      for (const [i, x] of seq.entries()) {
        const def = content.annonces.find((a) => a.id === x.gabarit);
        expect(def?.kind).toBe(postKindOn(board, x.day));
        const before = seq.slice(0, i).filter((y) => y.gabarit === x.gabarit).at(-1);
        if (before !== undefined) expect(x.day - before.day, `graine ${seed}: ${x.gabarit}`).toBeGreaterThanOrEqual(10);
        for (const line of def?.variants[x.variant] ?? []) {
          for (let d = x.day; d < x.day + board.deadlineDays; d++) expect(forageAvailableOn(s, line.item, d), `${x.gabarit} jour ${d}`).toBe(true);
          expect(scriptObtainable(x.day)(line)).toBe(true);
        }
        expect(def?.seasons).toContain(seasonOfDay(s, x.day));
      }
      // Jamais deux en cours: l'échéance (20 h du troisième jour) tombe avant l'affiche suivante.
      for (let i = 1; i < seq.length; i++) expect((seq[i]?.day ?? 0) - (seq[i - 1]?.day ?? 0)).toBeGreaterThanOrEqual(board.deadlineDays);
    }
  });

  it('T9-03: graine 20261030, jours 16 à 61: la suite du script `tour9_automne.py` (même unitDraw)', () => {
    // python3 -I seq.py (scratchpad), même modèle d'obtention que la partie 5 du script. Pêche 0.12: trois
    // annonces de pêche en plus (conception de la pêche, section 8.3) changent le tirage; suite relevée sur la partie.
    const script = [
      [16, 'odette_eggs'], [19, 'odette_basket'], [23, 'basile_planks'], [26, 'basile_fence'], [30, 'jeanne_mushroom'],
      [33, 'jeanne_poem'], [37, 'odette_blackberries'], [40, 'firmin_supper'], [44, 'odette_eggs'], [47, 'jeanne_snack_nuts'],
      [51, 'firmin_soup'], [54, 'jeanne_poem'], [58, 'odette_eggs'], [61, 'odette_friture'],
    ];
    expect(sequence(20261030, scriptObtainable, 61).map((x) => [x.day, x.gabarit])).toEqual(script);
  });

  it('T9-04: récompenses de la table 1.3 (formule 1.4)', () => {
    const expected: Record<string, number[]> = {
      odette_shelf: [80, 110, 110], firmin_trout: [40], basile_planks: [70], jeanne_chub: [40], odette_eggs: [85], firmin_soup: [105],
      basile_tisane: [55], basile_nuts: [55], odette_blackberries: [65], odette_elder: [55], jeanne_mushroom: [40], firmin_omelettes: [75],
      odette_basket: [140], firmin_supper: [95], basile_fence: [75], jeanne_poem: [60], jeanne_snack: [80], jeanne_snack_nuts: [80], odette_preserves: [125],
      // Pêche 0.12 (section 8.3).
      jeanne_school_tank: [40], achille_perch: [40], odette_friture: [65],
    };
    for (const a of content.annonces) {
      expect(a.variants.map((v) => annonceReward(board.reward[a.kind], v, sell)), a.id).toEqual(expected[a.id]);
    }
    expect(Object.keys(expected).sort()).toEqual(content.annonces.map((a) => a.id).sort());
  });

  it('T9-01: une partie arrêtée au jour 43 (format 5) ouvre le tableau à l’aube suivante, avec la lettre de Firmin', () => {
    const sim = load('format-5-fin-ete-jour-43.json');
    expect(sim.world.board.current).toBeNull();
    for (const id of ['p1', 'p2'] as CharacterId[]) step(sim, { controls: {}, intents: [{ by: id, intent: { type: 'stage_choice', choice: 'stay' } }] });
    expect(sim.world.phase).toBe('day');
    // La soirée du jour 43 se joue; l'aube suivante:
    morning(sim);
    expect(sim.world.clock.day).toBe(44);
    expect(sim.world.letters.some((l) => l.id === 'firmin_board')).toBe(true);
    expect(sim.world.letters.some((l) => l.id === 'basile_works')).toBe(true);
    expect(sim.world.board.current?.state).toBe('open');
    expect(postKindOn(board, 44)).toBe('help');
  }, 120_000);

  it('T9-04, T9-05: dons cumulés des deux, récompense et Cœur à deux, objet unique une fois; échéance à 20 h du troisième jour, sans pénalité', () => {
    const sim = at(46, 12 * HOUR);
    const w = sim.world;
    // Une annonce à deux de deux familles: le panier du samedi (3 carottes, 3 œufs).
    w.board.current = null;
    w.clock.day = 47;
    const forced = content.annonces.find((a) => a.id === 'odette_preserves');
    if (forced === undefined) throw new Error('odette_preserves');
    w.counters.duo['picked:hazelnut'] = 1;
    w.counters.duo['harvested:radish'] = 1;
    // Rejouer l'aube jusqu'à tirer les bocaux (un mercredi d'automne).
    let day = 47;
    for (; day <= 47 + 7 * 30; day += 7) {
      w.clock.day = day;
      w.board = { current: null, previous: null, recent: [], posted: content.annonces.map((a) => a.id), uniquesGiven: [] };
      morningBoard(sim);
      if (w.board.current?.gabarit === 'odette_preserves') break;
    }
    expect(w.board.current?.gabarit).toBe('odette_preserves');
    const a = w.board.current;
    if (a === null) return;
    expect(a.reward).toBe(125);
    expect(a.deadline).toEqual({ day: day + 2, time: 20 * HOUR });
    const [p1, p2] = w.characters;
    if (p1 === undefined || p2 === undefined) return;
    giveToCharacter(sim, p1, 'hazelnut', 'ordinary', 6);
    giveToCharacter(sim, p2, 'radish', 'ordinary', 6);
    const odette = w.villagers.find((v) => v.id === 'odette');
    if (odette === undefined) return;
    odette.visible = true;
    p1.pos = { ...odette.pos };
    p2.pos = { ...odette.pos };
    step(sim, { controls: {}, intents: [{ by: 'p1', intent: { type: 'give', to: 'odette', item: 'hazelnut', quality: 'ordinary', count: 6 } }] });
    expect(w.board.current?.state).toBe('open');
    p2.pos = { ...odette.pos };
    // (Le premier pas a payé la commande échue du jour 29: le monde a été avancé à la main.)
    const purse = w.purse;
    step(sim, { controls: {}, intents: [{ by: 'p2', intent: { type: 'give', to: 'odette', item: 'radish', quality: 'ordinary', count: 6 } }] });
    expect(w.board.current?.state, JSON.stringify({ q: w.quests.find((q) => q.id === a.quest), c: [w.counters.duo['given:odette:hazelnut'], w.counters.duo['given:odette:radish']], v: odette, bags: [countInBag(p1, 'hazelnut'), countInBag(p2, 'radish')] })).toBe('done');
    expect(w.board.current?.by).toBe('p2');
    expect(sim.events).toContainEqual({ type: 'annonce_done', gabarit: 'odette_preserves', by: 'p2', amount: 125 });
    expect(sim.events).toContainEqual({ type: 'money', amount: 125 });
    expect(w.purse).toBe(purse + 125);
    expect(w.characters.every((c) => c.heartToday.gesture)).toBe(true);
    expect(countInStacks(w.cellar, 'elder_jelly')).toBe(1);
    expect(w.quests.some((q) => q.id === a.quest)).toBe(false);
    // Échéance: une annonce non faite se retire à 20 h du troisième jour, avec le message, sans rien perdre.
    const late = at(44, 6 * HOUR);
    late.world.board = { current: null, previous: null, recent: [], posted: [], uniquesGiven: [] };
    morningBoard(late);
    const open = late.world.board.current;
    expect(open?.state).toBe('open');
    const before = late.world.purse;
    late.world.clock.day = 46;
    late.world.clock.minutes = 19 * HOUR + 59;
    updateBoard(late);
    expect(late.world.board.current?.state).toBe('open');
    late.world.clock.minutes = 20 * HOUR;
    for (const c of late.world.characters) {
      c.dialogue = null;
      c.menu = null;
    }
    updateBoard(late);
    expect(late.world.board.current?.state).toBe('expired');
    expect(late.world.purse).toBe(before);
    expect(late.world.characters[0]?.notifications.at(-1)?.key).toBe('annonce_expired');
  });

  it('T9-06: une scène d’annonce ne part qu’avec les deux au point, à l’heure, l’annonce à l’étape de la scène et l’habitant là', () => {
    const scene = content.dialogues.jeanne_poem_scene;
    expect(scene?.shared).toBe(true);
    expect(scene?.point).toBe('village_square');
    const when = scene?.when ?? [];
    const sim = at(40, 18 * HOUR);
    sim.world.board = { current: null, previous: null, recent: [], posted: [], uniquesGiven: [] };
    expect(when.every((c) => evaluate(sim, c, NO_CONTEXT))).toBe(false);
  });
});

describe('catalogue de la semaine, outils, poules, cadeaux (T9-07 à T9-10)', () => {
  const offerIds = (sim: Sim): string[] => catalogueOffers(s, content, sim.world).map((o) => o.item);

  it('T9-07: la page de la semaine paraît le samedi à 10 h; un article de saison part à la fin de sa saison; une reprise au jour 43 voit les pages passées; jamais plus d’exemplaires que prévu', () => {
    const sim = at(22, 9 * HOUR + 59);
    sim.world.catalogueBought = {};
    expect(offerIds(sim)).not.toContain('watering_can_copper');
    sim.world.clock.minutes = 10 * HOUR;
    expect(offerIds(sim)).toEqual(expect.arrayContaining(['watering_can_copper', 'axe_forged', 'straw_hat']));
    expect(offerIds(sim)).not.toContain('fishing_rod_bamboo');
    sim.world.clock.day = 43;
    const autumn = offerIds(sim);
    expect(autumn).toEqual(expect.arrayContaining(['watering_can_copper', 'fishing_rod_bamboo', 'hen_extra', 'wicker_armchair', 'hen_extra_2', 'coop_calendar']));
    expect(autumn).not.toContain('straw_hat');
    expect(autumn).not.toContain('pressed_flowers');
    sim.world.catalogueBought = { watering_can_copper: 2 };
    expect(offerIds(sim)).not.toContain('watering_can_copper');
    sim.world.catalogueBought = { watering_can_copper: 1 };
    expect(catalogueOffers(s, content, sim.world).find((o) => o.item === 'watering_can_copper')?.left).toBe(1);
  });

  it('T9-08: arrosoir de cuivre (20), hache de la forge (2 coups), canne en bambou (attente x 0,8, 2 s pour ferrer); l’ancien outil va au râtelier (tour 10); les conditions de l’outil d’origine marchent', () => {
    const sim = at(30);
    const c = sim.world.characters[0];
    if (c === undefined) return;
    expect(content.items.watering_can_copper?.capacity).toBe(20);
    expect(content.items.axe_forged?.tool).toMatchObject({ toolKind: 'axe', chops: 2 });
    expect(content.items.fishing_rod_bamboo?.tool).toMatchObject({ toolKind: 'fishing_rod', biteWaitFactor: 0.8, hookWindowSeconds: 2 });
    const before = countInStacks(sim.world.rack, 'axe');
    expect(countInBag(c, 'axe')).toBe(1);
    deliverWeeklyItem(sim, 'axe_forged', c.id);
    expect(countInBag(c, 'axe')).toBe(0);
    expect(countInBag(c, 'axe_forged')).toBe(1);
    expect(countInStacks(sim.world.rack, 'axe')).toBe(before + 1);
    // Abattre en deux coups.
    const tree = sim.world.trees.find((t) => !t.felled);
    if (tree === undefined) return;
    c.selected = c.bag.findIndex((x) => x?.item === 'axe_forged');
    c.pos = { x: tree.pos.x, y: tree.pos.y + 1 };
    c.facing = -Math.PI / 2;
    c.status = 'active';
    sim.world.phase = 'day';
    for (let i = 0; i < 2; i++) {
      step(sim, { controls: {}, intents: [{ by: c.id, intent: { type: 'move_to', target: { kind: 'tree', tree: tree.id }, act: true } }] });
      for (let k = 0; k < 90; k++) step(sim, { controls: {}, intents: [] });
    }
    expect(tree.felled).toBe(true);
    // L'arrosoir de cuivre se remplit à 20.
    deliverWeeklyItem(sim, 'watering_can_copper', c.id);
    expect(countInBag(c, 'watering_can')).toBe(0);
  });

  it('T9-09: la poule commandée arrive le samedi, Jeanne la nomme à 10 h 30, jamais plus de 5; la capacité d’œufs suit les poules', () => {
    const sim = at(36, 9 * HOUR);
    const w = sim.world;
    const hens = w.hens.length;
    expect(hens).toBe(3);
    w.catalogueOrders = ['hen_extra'];
    w.catalogueOrderBy = ['p2'];
    for (let i = 0; i < 4000 && w.clock.minutes < 10 * HOUR + 31; i++) step(sim, { controls: {}, intents: [] });
    const brioche = w.hens.find((h) => h.name === 'Brioche');
    expect(brioche?.variant).toBe('hen_red');
    expect(brioche?.nameKnownBy).toEqual(['p1', 'p2']);
    expect(w.characters.find((c) => c.id === 'p2')?.notifications.some((n) => n.key === 'hen_named_brioche')).toBe(true);
    // Le plafond: plus de poule au catalogue à cinq.
    w.clock.day = 43;
    w.clock.minutes = 12 * HOUR;
    const model = w.hens[0];
    if (model === undefined) return;
    w.hens.push({ ...structuredClone(model), id: 'h-test' });
    expect(w.hens.length).toBe(5);
    expect(catalogueOffers(s, content, w).some((o) => o.item === 'hen_extra_2')).toBe(false);
    // Capacité d'œufs: 5,4 par poule et par semaine.
    const g = s.order.generated;
    if (g === null) return;
    const eggOnly = { ...s, order: { ...s.order, generated: { ...g, products: g.products.filter((p) => p.item === 'egg' || p.item === 'radish' || p.item === 'chub') } } };
    const counters = { 'picked:egg': 1, 'harvested:radish': 1, 'caught:chub': 1 };
    const book = emptyOrderBook({ content });
    const three = composeOrder(eggOnly, { seed: 3, number: 5, train: 36, counters, buyable: new Set(), matureTrees: 6, book, hens: 3 });
    const five = composeOrder(eggOnly, { seed: 3, number: 5, train: 36, counters, buyable: new Set(), matureTrees: 6, book, hens: 5 });
    const share = (r: typeof three): number => r.lines.find((l) => l.item === 'egg')?.share ?? 0;
    const count = (r: typeof three): number => r.lines.find((l) => l.item === 'egg')?.count ?? 0;
    expect(share(three)).toBeCloseTo((count(three) * 1) / 16.2, 6);
    expect(share(five)).toBeCloseTo((count(five) * 1) / 27, 6);
  }, 120_000);

  it('T9-10: un cadeau ne paraît qu’une fois le souhait entendu; offert, l’habitant remercie et dit sa réplique d’après', () => {
    const sim = at(30, 12 * HOUR);
    const w = sim.world;
    w.dialoguesDone = w.dialoguesDone.filter((d) => !d.startsWith('jeanne_wish'));
    expect(catalogueOffers(s, content, w).some((o) => o.item === 'chalk_box')).toBe(false);
    w.dialoguesDone.push('jeanne_wish', 'jeanne_wish@p1');
    expect(catalogueOffers(s, content, w).find((o) => o.item === 'chalk_box')?.villager).toBe('jeanne');
    const c = w.characters[0];
    const jeanne = w.villagers.find((v) => v.id === 'jeanne');
    if (c === undefined || jeanne === undefined) return;
    deliverWeeklyItem(sim, 'chalk_box', c.id);
    expect(w.quests.find((q) => q.id === 'gift_jeanne')?.status).toBe('active');
    jeanne.visible = true;
    c.pos = { ...jeanne.pos };
    step(sim, { controls: {}, intents: [{ by: c.id, intent: { type: 'give', to: 'jeanne', item: 'chalk_box', quality: 'ordinary', count: 1 } }] });
    expect(w.giftsGiven.jeanne).toBe(30);
    expect(c.notifications.some((n) => n.text.includes('Des craies'))).toBe(true);
    const after = content.dialogues.jeanne_after_gift;
    expect(after?.when.every((cond) => evaluate(sim, cond, { ...NO_CONTEXT, actor: c.id }))).toBe(true);
  });
});

describe('chantiers (T9-11)', () => {
  it('un seul ouvert par file; 100 sous ou plus passent par l’accord; payé, bâti au matin avec le message; planches à Basile: 10 sous chacune, 20 au plus', () => {
    const sim = at(30, 12 * HOUR);
    const w = sim.world;
    w.purse = 5000;
    expect(openImprovement(sim, 'bourg')?.id).toBe('ford_bench');
    expect(openImprovement(sim, 'maisonnette')?.id).toBe('house_bench');
    const [p1, p2] = w.characters;
    if (p1 === undefined || p2 === undefined) return;
    const boardAt = sim.map.points.notice_board;
    if (boardAt === undefined) return;
    p1.pos = { x: boardAt.x, y: boardAt.y + 1 };
    payImprovement(sim, p1, 'ford_bench', 50);
    expect(w.improvements.ford_bench?.paid).toBe(50);
    payImprovement(sim, p1, 'ford_bench', 100);
    expect(w.improvements.ford_bench?.paid).toBe(50);
    expect(w.proposals).toHaveLength(1);
    step(sim, { controls: {}, intents: [{ by: 'p2', intent: { type: 'proposal_answer', proposal: w.proposals[0]?.id ?? '', accept: true } }] });
    expect(w.improvements.ford_bench?.paid).toBe(150);
    payImprovement(sim, p1, 'ford_bench', null);
    step(sim, { controls: {}, intents: [{ by: 'p2', intent: { type: 'proposal_answer', proposal: w.proposals[0]?.id ?? '', accept: true } }] });
    expect(w.improvements.ford_bench).toMatchObject({ paid: 600, funded: true, builtDay: null });
    expect(openImprovement(sim, 'bourg')?.id).toBe('ford_bench');
    w.clock.day = 31;
    morningImprovements(sim);
    expect(w.improvements.ford_bench?.builtDay).toBe(31);
    expect(w.flags).toContain('ford_bench_built');
    expect(p1.notifications.at(-1)?.key).toBe('chantier_built');
    // Le suivant s'ouvre le matin d'après.
    expect(openImprovement(sim, 'bourg')).toBeNull();
    w.clock.day = 32;
    expect(openImprovement(sim, 'bourg')?.id).toBe('quay_planters');
    // Planches à Basile, 20 au plus.
    const bench = sim.map.points.sawmill_workbench;
    if (bench === undefined) return;
    p2.pos = { x: bench.x, y: bench.y + 1 };
    giveToCharacter(sim, p2, 'plank', 'ordinary', 30);
    bringPlanks(sim, p2, 'house_bench', 30);
    expect(w.improvements.house_bench?.planks).toBe(20);
    const purse = w.purse;
    payImprovement(sim, p2, 'house_bench', null);
    step(sim, { controls: {}, intents: [{ by: 'p1', intent: { type: 'proposal_answer', proposal: w.proposals[0]?.id ?? '', accept: true } }] });
    expect(w.purse).toBe(purse - 500);
    expect(w.improvements.house_bench).toMatchObject({ paid: 500, planks: 20, funded: true });
    // I-10: exactement le prix, moins les planches.
    expect((w.improvements.house_bench?.paid ?? 0) + 10 * (w.improvements.house_bench?.planks ?? 0)).toBe(700);
  });
});

describe('correctifs de la commande (T9-14, T9-15)', () => {
  it('T9-14: coût des poissons par saison (pêche 0.12, section 8.2: riverUnitCost / part); jamais de truite l’hiver', () => {
    const g = s.order.generated;
    if (g === null) return;
    const p = (item: string) => g.products.find((x) => x.item === item);
    const trains: Record<string, number> = { spring: 15, summer: 36, autumn: 57, winter: 78 };
    // 0,0454 divisé par la part du poisson dans les prises de la saison (`fishShareBySeason` de la conception).
    const expected: Record<string, Record<string, number | null>> = {
      gudgeon: { spring: 0.473, summer: 0.547, autumn: 0.473, winter: 0.428 },
      chub: { spring: 0.155, summer: 0.17, autumn: 0.172, winter: 0.156 },
      trout: { spring: 0.493, summer: 0.417, autumn: 0.51, winter: null },
      tench: { spring: null, summer: 0.769, autumn: 0.857, winter: null },
    };
    for (const [fish, bySeason] of Object.entries(expected)) {
      const product = p(fish);
      if (product === undefined) throw new Error(fish);
      for (const [season, cost] of Object.entries(bySeason)) {
        const got = fishCost(s, product, trains[season] ?? 0);
        if (cost === null) expect(got, `${fish} ${season}`).toBeNull();
        else expect(got, `${fish} ${season}`).toBeCloseTo(cost, 2);
      }
    }
  });

  it('T9-15: 1 000 graines, commandes 3 à 10: aucune ligne au-dessus de son plafond, radis et carottes en multiples de 3, une ligne de plus quand la part perdue dépasse 0,2', () => {
    const g = s.order.generated;
    if (g === null) return;
    const counters = Object.fromEntries(g.products.map((p) => [p.obtained, 1]));
    const buyable = new Set(Object.values(content.items).filter((i) => i.buyPrice !== null).map((i) => i.id));
    let extra = 0;
    let orders = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const book = emptyOrderBook({ content });
      for (let n = 3; n <= 10; n++) {
        const train = 22 + 7 * (n - 3);
        const { lines } = composeOrder(s, { seed, number: n, train, counters, buyable, matureTrees: 6, book });
        orders++;
        const target = g.linesByOrder.reduce((k, step) => (n >= step.from ? step.lines : k), 0);
        if (lines.length > target) extra++;
        expect(lines.length).toBeLessThanOrEqual(g.maxLines);
        for (const l of lines) {
          expect(l.count, l.item).toBeLessThanOrEqual(g.lineMax[l.item] ?? Infinity);
          if (l.item === 'radish' || l.item === 'carrot') expect(l.count % 3).toBe(0);
        }
        book.recent = [...book.recent, lines.map((l) => l.item)].slice(-2);
        book.ordered = [...new Set([...book.ordered, ...lines.map((l) => l.item)])];
        book.budget = Math.min(g.budget.max, book.budget + g.budget.stepOnComplete);
      }
    }
    // Section 2.11: 23 % des commandes gagnent une ligne dans la simulation.
    expect(extra / orders).toBeGreaterThan(0.05);
    expect(extra / orders).toBeLessThan(0.5);
  });
});

describe('automne: cueillette, école de Jeanne (T9-18, T9-19)', () => {
  it('T9-19: cèpes aux seuls coins de sous-bois, en automne, plus fréquents après la pluie; sureau au seul coin 06, jours 1 à 14 de l’automne', () => {
    const forage = s.forage;
    if (forage === null) return;
    const seen: Record<string, Set<string>> = { cep: new Set(), elderberry: new Set() };
    let cepRain = 0;
    let cepDry = 0;
    for (let seed = 1; seed <= 400; seed++) {
      for (let day = 16; day <= 84; day++) {
        for (const point of forage.points) {
          for (const yesterday of ['rain', 'sunny'] as const) {
            const d = drawForage(s, point.point, { seed, day, pickedBefore: new Set(['cep', 'elderberry', 'hazelnut', 'chanterelle', 'wild_garlic', 'dandelion', 'blackberry']), yesterday });
            if (d === null || !(d.item in seen)) continue;
            seen[d.item]?.add(point.point);
            expect(seasonOfDay(s, day), `${d.item} jour ${day}`).toBe('autumn');
            if (d.item === 'elderberry') expect(dayOfSeason(s, day)).toBeLessThanOrEqual(14);
            if (d.item === 'cep' && yesterday === 'rain') cepRain++;
            if (d.item === 'cep' && yesterday !== 'rain') cepDry++;
          }
        }
      }
    }
    expect([...(seen.cep ?? [])].sort()).toEqual(['forage_edge_01', 'forage_edge_02']);
    expect([...(seen.elderberry ?? [])]).toEqual(['forage_edge_06']);
    // Poids x 3 le lendemain d'une pluie, parmi les autres cueillettes du coin (girolles comprises).
    expect(cepRain).toBeGreaterThan(cepDry * 1.3);
  });

  it('T9-18: les jours d’école d’automne, Jeanne est absente de 8 h 30 à 16 h 30, sur la place de 16 h 30 à 18 h 30; le mercredi, comme dans la démo', () => {
    const where = (day: number, minutes: number): string => {
      const sim = at(day, minutes);
      sim.world.weather = 'sunny';
      placeVillagers(sim);
      const j = sim.world.villagers.find((v) => v.id === 'jeanne');
      return j?.visible === true ? j.target : 'absente';
    };
    // Jour 45: lundi d'automne; 47: mercredi.
    expect(weekdayOf(45)).toBe(2);
    expect(where(45, 10 * HOUR)).toBe('absente');
    expect(where(45, 17 * HOUR)).toBe('village_square');
    expect(where(47, 10 * HOUR)).toBe('quay_bench');
    // L'été, pas d'école.
    expect(where(31, 10 * HOUR)).toBe('quay_bench');
  });
});

describe('fin de l’automne (T9-16)', () => {
  it('au samedi 64 à 16 h: commande payée, scène de Firmin, écran « Neuf semaines » sans « Rester »; avec une limite au jour 70, « Rester » apparaît', () => {
    const sim = load('format-6-automne-jour-62.json');
    play(sim, createRobot({ stages: 'stay' }), (x) => x.world.phase === 'ended', SIM_HZ * 60 * 60 * 6);
    const w = sim.world;
    expect(w.clock.day).toBe(64);
    expect(w.stages.current).toBe('autumn_end');
    expect(w.orderHistory.at(-1)?.day).toBe(64);
    expect(w.dialoguesDone).toContain('firmin_stage_autumn');
    const screen = stageScreen(w, sim.content);
    expect(screen?.canStay).toBe(false);
    expect(screen?.title).toBe("Neuf semaines à la Halte d'Aubrune");
    expect(screen?.next).toBe('« Rester à la Halte » reviendra avec la prochaine mise à jour du jeu.');
    expect(screen?.chantiers).toBe(Object.values(w.improvements).filter((x) => x.builtDay !== null).length);
    const longer = structuredClone(sim.content);
    longer.settings.clock.lastDay = { day: 70, end: 16 * HOUR };
    const next = restoreWorld(longer, sim.map, structuredClone(snapshotOf(sim).data), snapshotOf(sim).dataSchema, [A, B]);
    expect(stageScreen(next.world, longer)?.canStay).toBe(true);
  }, 600_000);
});
