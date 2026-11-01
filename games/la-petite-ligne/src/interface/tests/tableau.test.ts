// Tour 9, interface du tableau du quai et de l'établi de Basile: catalogue par rayons (seuls les
// articles parus), annonces (échéance, récompense, liste à cocher, tampon à la couleur de qui l'a
// remise), chantiers (versements par 50, 100 ou le reste, accord de l'autre à partir de 100 sous),
// commande à Basile (planches), courrier à titres, carnet borné, écran d'étape à quatre compteurs.
// Chaque modèle est lu chez les deux joueurs.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../../etat/actions';
import { onWeeklyCatalogue } from '../../etat/catalogue';
import type { CharacterId } from '../../etat/types';
import { decodeSave, restoreWorld } from '../../sauvegarde/sauvegarde';
import { improvementRemaining, openImprovement } from '../../simulation/chantiers';
import type { Sim } from '../../simulation/contexte';
import { step } from '../../simulation/pas';
import { letterModels, notebookQuests } from '../modele';
import { stageModel } from '../modele-etape';
import { proposalModels } from '../modele-panneaux';
import {
  annonceModel,
  basileModel,
  boardAnnonces,
  boardOpen,
  catalogueProducts,
  catalogueShelves,
  chantierRemaining,
  chantiersPage,
  openChantier,
} from '../modele-tableau';
import { NBSP, NNBSP } from '../typographie';
import { character, contentAndMap, started, uiContext } from './aides';

const plain = (s: string): string =>
  s.split(NBSP).join(' ').split(NNBSP).join(' ').split('’').join("'");
const HOUR = 60;
const PLAYERS: readonly CharacterId[] = ['p1', 'p2'];

function load(file: string): Sim {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../tests/donnees/sauvegardes/${file}`, import.meta.url)),
      'utf8',
    ),
  ) as {
    dataSchema: number;
    data: unknown;
  };
  const { content, map } = contentAndMap();
  return restoreWorld(content, map, decodeSave(structuredClone(raw.data)), raw.dataSchema, [
    { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
    { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
  ]);
}

/** L'été, mardi 25 à midi: le banc du gué bâti, les jardinières à 600 sur 700, une planche pour le banc du pignon. */
const summer25 = (): Sim => load('format-6-ete-jour-25.json');
/** L'automne, jeudi 62 à midi: tout est bâti, la commande du samedi 64 en cours. */
const autumn62 = (): Sim => load('format-6-automne-jour-62.json');

function send(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

/** Les deux joueurs devant le tableau du quai, le tableau ouvert. */
function bothAtBoard(sim: Sim): void {
  const board = sim.map.points.notice_board;
  if (board === undefined) throw new Error('point notice_board');
  for (const id of PLAYERS) {
    const c = character(sim, id);
    c.pos = { x: board.x + (id === 'p1' ? 0.8 : -0.8), y: board.y + 0.4 };
    c.prev = { ...c.pos };
    c.destination = null;
    send(sim, id, { type: 'menu', menu: 'catalogue' });
  }
}

describe('tableau du quai: onglets', () => {
  it("n'a ses onglets qu'à partir du jour 16 (lettre de Firmin)", () => {
    const sim = started();
    expect(boardOpen(sim.world, uiContext())).toBe(false);
    sim.world.clock.day = 16;
    expect(boardOpen(sim.world, uiContext())).toBe(true);
  });
});

describe('catalogue de la semaine par rayons', () => {
  it('ne montre que les articles parus, chez les deux joueurs', () => {
    const sim = started();
    for (const id of PLAYERS) {
      const items = catalogueProducts(sim.world, uiContext(id)).map((p) => p.item);
      // Jour 1: les articles d'avant le tour 9 seulement.
      expect(items).toContain('oil_lamp');
      expect(items).not.toContain('watering_can_copper');
      expect(items).not.toContain('chalk_box');
    }
    // Samedi 22, 10 h: la première page de l'été paraît (arrosoir, hache, chapeau), pas encore la deuxième.
    sim.world.clock.day = 22;
    sim.world.clock.minutes = 10 * HOUR;
    for (const id of PLAYERS) {
      const shelves = catalogueShelves(sim.world, uiContext(id));
      const byShelf = Object.fromEntries(
        shelves.map((s) => [s.shelf, s.products.map((p) => p.item)]),
      );
      expect(byShelf.tools).toEqual(['watering_can_copper', 'axe_forged']);
      expect(byShelf.house).toContain('straw_hat');
      expect(byShelf.hens).toBeUndefined();
      expect(byShelf.gifts).toBeUndefined();
      expect(shelves.map((s) => plain(s.title))).toEqual(['Outillage', 'Maison']);
    }
  });

  it('montre le cadeau « Pour Jeanne » une fois son souhait entendu', () => {
    const sim = started();
    sim.world.clock.day = 23;
    sim.world.dialoguesDone.push('jeanne_wish');
    const gift = catalogueProducts(sim.world, uiContext('p2')).find((p) => p.item === 'chalk_box');
    expect(gift?.shelf).toBe('gifts');
    expect(plain(gift?.name ?? '')).toBe('Pour Jeanne : boîte de craies');
  });

  it("compte les exemplaires: un outil commandé par l'un reste commandable par l'autre", () => {
    const sim = started();
    sim.world.clock.day = 23;
    sim.world.purse = 1000;
    sim.world.catalogueOrders.push('axe_forged');
    sim.world.catalogueBought.axe_forged = 1;
    const axe = catalogueProducts(sim.world, uiContext('p2')).find((p) => p.item === 'axe_forged');
    expect(axe).toMatchObject({ state: 'orderable', copies: 2, left: 1, ordered: 1 });
    sim.world.catalogueOrders.push('axe_forged');
    sim.world.catalogueBought.axe_forged = 2;
    expect(
      catalogueProducts(sim.world, uiContext('p1')).find((p) => p.item === 'axe_forged')?.state,
    ).toBe('ordered');
  });

  it('chaque article commandable est accepté par la simulation, du jour 16 au jour 64', () => {
    const sim = started();
    const { content } = contentAndMap();
    sim.world.purse = 5000;
    sim.world.dialoguesDone.push('jeanne_wish', 'odette_wish', 'basile_wish', 'firmin_wish');
    for (let day = 16; day <= 64; day++) {
      sim.world.clock.day = day;
      sim.world.clock.minutes = 11 * HOUR;
      for (const p of catalogueProducts(sim.world, uiContext())) {
        if (p.state === 'orderable')
          expect(
            onWeeklyCatalogue(content.settings, content, sim.world, p.item),
            `${p.item} jour ${String(day)}`,
          ).toBe(true);
      }
    }
  });
});

describe('annonces', () => {
  it("l'annonce en cours: texte rempli, échéance, récompense, liste à cocher, chez les deux", () => {
    const sim = summer25();
    // Une annonce de la vitrine d'Odette, comme si elle venait d'être épinglée ce mardi.
    sim.world.board.current = {
      gabarit: 'odette_shelf',
      variant: 0,
      quest: 'annonce_odette_shelf_1',
      posted: 23,
      deadline: { day: 25, time: 20 * HOUR },
      reward: 80,
      state: 'open',
      by: null,
      closedDay: null,
    };
    sim.world.quests.push({
      id: 'annonce_odette_shelf_1',
      status: 'active',
      step: 0,
      checklist: [],
      baselines: { 'duo:given:odette:radish': 4 },
      startedDay: 23,
    });
    sim.world.counters.duo['given:odette:radish'] = 6;
    for (const id of PLAYERS) {
      const a = boardAnnonces(sim.world, uiContext(id)).current;
      expect(plain(a?.title ?? '')).toBe("La vitrine d'Odette");
      expect(plain(a?.text ?? '')).toContain('Il me faudrait 6 radis, frais si possible.');
      expect(plain(a?.deadline ?? '')).toBe("jusqu'à mardi, 20 h");
      expect(plain(a?.reward ?? '')).toBe('Merci : 80 sous');
      expect(a?.lines).toHaveLength(1);
      expect(a?.lines[0]).toMatchObject({ item: 'radish', have: 2, need: 6, done: false });
      expect(plain(a?.help ?? '')).toBe("Parle à Odette pour donner ce qu'il faut.");
      expect(a?.stamp).toBeNull();
    }
  });

  it("le tampon « Fait » est à la couleur de qui l'a remise: l'autre chez l'un, soi chez l'autre", () => {
    const sim = summer25();
    // Les confitures d'Odette, faites par p2 (sauvegarde de référence).
    const done = sim.world.board.current;
    expect(done?.by).toBe('p2');
    if (done === null) return;
    const p1 = annonceModel(sim.world, uiContext('p1'), done);
    const p2 = annonceModel(sim.world, uiContext('p2'), done);
    expect(p1.by).toBe('other');
    expect(p2.by).toBe('self');
    expect(plain(p1.stamp ?? '')).toBe('Fait');
    expect(plain(p1.stampLabel ?? '')).toBe('Fait par Sacha');
    expect(p1.lines.every((l) => l.done)).toBe(true);
  });

  it('une annonce retirée dit que rien n’est perdu, et le carnet la grise', () => {
    const sim = summer25();
    const a = sim.world.board.current;
    if (a === null) throw new Error('annonce');
    a.state = 'expired';
    a.by = null;
    const m = annonceModel(sim.world, uiContext('p1'), a);
    expect(plain(m.stamp ?? '')).toBe('Retirée');
    expect(plain(m.help)).toBe('Odette a trouvé une autre solution. Rien de perdu.');
    const group = notebookQuests(sim.world, uiContext('p2')).annonces;
    expect(group.find((q) => q.title.includes('confitures'))?.withdrawn).toBe(true);
  });
});

describe('chantiers', () => {
  it('le chantier ouvert et le reste à payer sont ceux de la simulation', () => {
    for (const sim of [summer25(), autumn62(), started()]) {
      for (const day of [15, 16, 22, 25, 40, 62]) {
        sim.world.clock.day = day;
        for (const queue of ['bourg', 'maisonnette'] as const) {
          const mine = openChantier(sim.world, uiContext(), queue);
          const theirs = openImprovement(sim, queue);
          expect(mine?.id ?? null).toBe(theirs?.id ?? null);
          if (mine !== null)
            expect(chantierRemaining(sim.world, uiContext(), mine)).toBe(
              improvementRemaining(sim, mine),
            );
        }
      }
    }
  });

  it('propose de verser 50 sous ou le reste; le reste de 100 sous demande l’accord de l’autre', () => {
    const sim = summer25();
    for (const id of PLAYERS) {
      const page = chantiersPage(sim.world, uiContext(id));
      expect(page.open?.id).toBe('quay_planters');
      expect(plain(page.open?.progress ?? '')).toBe('Des jardinières au quai : 600 sur 700 sous');
      expect(page.open?.options.map((o) => [o.amount, o.sum, o.big])).toEqual([
        [50, 50, false],
        [null, 100, true],
      ]);
      expect(page.open?.options.map((o) => plain(o.label))).toEqual([
        'Verser 50 sous',
        'Verser le reste (100 sous)',
      ]);
      expect(page.built.map((b) => b.id)).toEqual(['ford_bench']);
      expect(plain(page.home)).toBe(
        "Chez vous : un banc au pignon, à commander à l'établi de Basile.",
      );
    }
  });

  it('un chantier plus cher propose 50, 100 et le reste', () => {
    const sim = summer25();
    const state = sim.world.improvements.quay_planters;
    if (state === undefined) throw new Error('chantier');
    state.paid = 200;
    const options = chantiersPage(sim.world, uiContext()).open?.options ?? [];
    expect(options.map((o) => o.amount)).toEqual([50, 100, null]);
    expect(options.map((o) => o.big)).toEqual([false, true, true]);
  });

  it("un versement de 100 sous passe par l'accord de l'autre, vu des deux côtés, puis paie le chantier", () => {
    const sim = summer25();
    sim.world.purse = 400;
    bothAtBoard(sim);
    send(sim, 'p1', { type: 'improvement_pay', improvement: 'quay_planters', amount: null });
    const proposal = sim.world.proposals.find((p) => p.purchase.source === 'improvement');
    expect(proposal?.by).toBe('p1');
    const p1 = chantiersPage(sim.world, uiContext('p1')).open;
    const p2 = chantiersPage(sim.world, uiContext('p2')).open;
    expect(p1).toMatchObject({ pending: 'mine', pendingAmount: 100, options: [] });
    expect(p2).toMatchObject({ pending: 'partner', pendingAmount: 100, options: [] });
    // La carte de proposition dit « verser », pas « acheter ».
    const model = proposalModels(sim.world, uiContext('p2'))[0];
    expect(model).toMatchObject({
      source: 'improvement',
      mine: false,
      price: 100,
      icon: 'ui-hammer',
    });
    expect(model?.itemText).toBe('des jardinières au quai');
    send(sim, 'p2', { type: 'proposal_answer', proposal: proposal?.id ?? '', accept: true });
    for (const id of PLAYERS) {
      const open = chantiersPage(sim.world, uiContext(id)).open;
      expect(open).toMatchObject({
        funded: true,
        pending: null,
        remaining: 0,
        percent: 100,
        options: [],
      });
    }
    expect(sim.world.purse).toBe(300);
  });

  it("un versement de 50 sous se fait sans attendre l'autre", () => {
    const sim = summer25();
    sim.world.purse = 400;
    bothAtBoard(sim);
    send(sim, 'p2', { type: 'improvement_pay', improvement: 'quay_planters', amount: 50 });
    expect(sim.world.proposals).toHaveLength(0);
    const open = chantiersPage(sim.world, uiContext('p1')).open;
    expect(open?.remaining).toBe(50);
    // Il reste 50 sous: seul « le reste » est proposé, sans accord.
    expect(open?.options.map((o) => [o.amount, o.big])).toEqual([[null, false]]);
  });

  it('tout bâti: plus de chantier ouvert, la liste des chantiers du bourg', () => {
    const page = chantiersPage(autumn62().world, uiContext('p2'));
    expect(page.open).toBeNull();
    expect(page.allBuilt).toBe(true);
    expect(page.built.map((b) => b.id)).toEqual([
      'path_lamp',
      'well_roof',
      'quay_planters',
      'ford_bench',
    ]);
    expect(plain(page.built[3]?.when ?? '')).toBe('Bâti dans la nuit du dimanche 16');
  });
});

describe('établi de Basile: chantiers de la maisonnette', () => {
  it('pas de commande avant le samedi 22', () => {
    const sim = started();
    sim.world.clock.day = 20;
    expect(basileModel(sim.world, uiContext())).toBeNull();
  });

  it('les planches apportées retirent 10 sous chacune, chez les deux', () => {
    const sim = summer25();
    const p1 = character(sim, 'p1');
    p1.bag[12] = { item: 'plank', quality: 'ordinary', count: 4 };
    const before = basileModel(sim.world, uiContext('p1'));
    expect(before?.chantier?.id).toBe('house_bench');
    expect(before?.bring).toBe(4);
    expect(plain(before?.priceLine ?? '')).toBe('Un banc au pignon : 690 sous');
    expect(plain(before?.planksLine ?? '')).toBe(
      'Apporter des planches : 1 sur 20 (10 sous de moins)',
    );
    const bench = sim.map.points.sawmill_workbench;
    if (bench === undefined) throw new Error('établi');
    p1.pos = { x: bench.x + 0.6, y: bench.y + 0.4 };
    p1.prev = { ...p1.pos };
    send(sim, 'p1', { type: 'menu', menu: 'workbench' });
    send(sim, 'p1', {
      type: 'improvement_planks',
      improvement: 'house_bench',
      count: before?.bring ?? 0,
    });
    for (const id of PLAYERS) {
      const after = basileModel(sim.world, uiContext(id));
      expect(plain(after?.priceLine ?? '')).toBe('Un banc au pignon : 650 sous');
      expect(after?.chantier?.options.map((o) => [o.amount, o.sum, o.big])).toEqual([
        [null, 650, true],
      ]);
    }
    expect(basileModel(sim.world, uiContext('p1'))?.bring).toBe(0);
  });

  it('tout bâti: Basile a fini', () => {
    const m = basileModel(autumn62().world, uiContext());
    expect(m?.chantier).toBeNull();
    expect(m?.allBuilt).toBe(true);
    expect(m?.built.map((b) => b.id)).toEqual(['door_canopy', 'house_bench']);
  });
});

describe('courrier à titres (section 5.2)', () => {
  it('la commande et le bilan d’un même samedi se distinguent par leur titre; le lecteur d’écran lit titre, expéditeur, jour, état', () => {
    const sim = autumn62();
    const recap = sim.world.letters.find((l) => l.id === 'coop_recap_generated@57');
    if (recap === undefined) throw new Error('lettre');
    recap.read = recap.read.filter((id) => id !== 'p1');
    const p1 = letterModels(sim.world, uiContext('p1'));
    const p2 = letterModels(sim.world, uiContext('p2'));
    const order = p1.find((l) => l.id === 'coop_order_generated@64');
    const bilan = p1.find((l) => l.id === 'coop_recap_generated@57');
    expect(plain(order?.title ?? '')).toBe('Commande pour samedi 64');
    expect(plain(bilan?.title ?? '')).toBe('Bilan du samedi 57');
    expect(plain(order?.meta ?? '')).toBe('La coopérative de la ligne · samedi 57');
    expect(plain(bilan?.label ?? '')).toBe(
      'Bilan du samedi 57, de La coopérative de la ligne, samedi 57, non lue',
    );
    expect(plain(p2.find((l) => l.id === 'coop_recap_generated@57')?.label ?? '')).toBe(
      'Bilan du samedi 57, de La coopérative de la ligne, samedi 57',
    );
    // La plus récente en haut.
    expect(p1[0]?.id).toBe('coop_order_generated@64');
  });
});

describe('carnet borné (section 5.3)', () => {
  it('garde les deux dernières commandes avec leur résultat, chez les deux', () => {
    for (const id of PLAYERS) {
      const groups = notebookQuests(autumn62().world, uiContext(id));
      const done = groups.main.filter((q) => q.done && q.id.startsWith('order:'));
      expect(done.map((q) => plain(q.title))).toEqual([
        'La commande du samedi 50',
        'La commande du samedi 57',
      ]);
      expect(plain(done[1]?.text ?? '')).toBe('5 lignes sur 5, 1333 sous');
      // Les commandes de la démo ne s'affichent plus.
      expect(groups.main.some((q) => q.id === 'saturday_order' || q.id === 'second_order')).toBe(
        false,
      );
      expect(groups.main.some((q) => q.id === 'weekly_order' && !q.done)).toBe(true);
    }
  });

  it('pendant la démo, les commandes faites restent celles de la démo', () => {
    const sim = load('format-6-fin-de-la-demo.json');
    const ids = notebookQuests(sim.world, uiContext())
      .main.filter((q) => q.done)
      .map((q) => q.id);
    expect(ids).toContain('saturday_order');
    expect(ids).toContain('second_order');
    expect(ids.some((x) => x.startsWith('order:'))).toBe(false);
  });

  it('range les annonces à part: au plus les deux dernières closes', () => {
    const groups = notebookQuests(autumn62().world, uiContext('p1'));
    expect(groups.annonces.map((q) => plain(q.title))).toEqual([
      "Le goûter d'automne",
      'Le pique-nique du jeudi',
    ]);
    expect(groups.side.some((q) => q.id.startsWith('annonce'))).toBe(false);
  });
});

describe("écran d'étape: quatrième compteur", () => {
  it('compte les chantiers bâtis, chez les deux', () => {
    const sim = autumn62();
    sim.world.phase = 'ended';
    sim.world.stages.current = 'autumn_end';
    for (const id of PLAYERS) {
      const m = stageModel(sim.world, uiContext(id));
      expect(m?.chantiers).toBe(6);
      expect(plain(m?.countersLabel ?? '')).toContain('Chantiers bâtis : 6');
      expect(plain(m?.title ?? '')).toBe("Neuf semaines à la Halte d'Aubrune");
      expect(m?.canStay).toBe(false);
    }
  });
});
