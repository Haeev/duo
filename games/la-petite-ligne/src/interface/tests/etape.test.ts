// Tour 8, interface de la suite après le jour 15: écran d'étape chez les deux joueurs (choix
// identiques, différents, jour 15 et jour 43), saison sous la date, brume au lever, quête de la
// semaine au carnet et au HUD, somme annoncée de la commande générée, train de chaque samedi.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../../etat/actions';
import { seasonCard } from '../../etat/semaine';
import type { CharacterId } from '../../etat/types';
import { decodeSave, restoreWorld } from '../../sauvegarde/sauvegarde';
import type { Sim } from '../../simulation/contexte';
import { payOrder } from '../../simulation/economie';
import { finishStage } from '../../simulation/fin';
import { step } from '../../simulation/pas';
import {
  clockModel,
  letterModels,
  nextObjective,
  orderFullAmount,
  orderLines,
  orderQuest,
  orderQuestTitle,
  questModels,
  screenOf,
} from '../modele';
import { stageModel, stageOrdersDetail } from '../modele-etape';
import { NBSP, NNBSP } from '../typographie';
import { contentAndMap, uiContext } from './aides';

const plain = (s: string): string =>
  s.split(NBSP).join(' ').split(NNBSP).join(' ').split('’').join("'");
const HOUR = 60;

function load(file: string): Sim {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../tests/donnees/sauvegardes/${file}`, import.meta.url)),
      'utf8',
    ),
  ) as { dataSchema: number; data: unknown };
  const { content, map } = contentAndMap();
  return restoreWorld(content, map, decodeSave(structuredClone(raw.data)), raw.dataSchema, [
    { id: 'membre-a', name: 'Camille', color: '#5CE1E6' },
    { id: 'membre-b', name: 'Sacha', color: '#8D6CFF' },
  ]);
}

/** La fin de la démo (format 5): phase `ended`, étape `demo`, aucun choix. */
const day15 = (): Sim => load('format-5-fin-de-la-demo.json');
/** L'été (format 5, jour 25 à midi): commande générée du samedi 29 en cours. */
const day25 = (): Sim => load('format-5-ete-jour-25.json');

/** L'écran du samedi 43 posé sur la partie d'été (l'arrivée réelle au jour 43 est testée par `tests/suite-etapes.test.ts`, T8-05). */
function day43(): Sim {
  const sim = day25();
  const w = sim.world;
  w.clock.day = 43;
  w.clock.minutes = 16 * HOUR + 5;
  w.orderHistory.push(
    { number: 4, day: 29, linesDone: 4, linesTotal: 4, complete: true, amount: 1200 },
    { number: 5, day: 36, linesDone: 5, linesTotal: 5, complete: true, amount: 1300 },
    { number: 6, day: 43, linesDone: 4, linesTotal: 5, complete: false, amount: 900 },
  );
  w.orderTotals = { orders: 6, linesDone: 25, linesTotal: 27, amount: w.orderTotals.amount + 3400 };
  finishStage(sim, 'summer_end');
  return sim;
}

function send(sim: Sim, by: CharacterId, intent: Intent): string[] {
  step(sim, { controls: {}, intents: [{ by, intent }] });
  return sim.events.map((e) => e.type);
}

const choose = (choice: 'stay' | 'finish' | null): Intent => ({ type: 'stage_choice', choice });

function both(sim: Sim): {
  p1: NonNullable<ReturnType<typeof stageModel>>;
  p2: NonNullable<ReturnType<typeof stageModel>>;
} {
  const p1 = stageModel(sim.world, uiContext('p1'));
  const p2 = stageModel(sim.world, uiContext('p2'));
  if (p1 === null || p2 === null) throw new Error("écran d'étape absent");
  return { p1, p2 };
}

describe("écran d'étape du jour 15 chez les deux joueurs", () => {
  it('ouvre l’écran avec les textes de la section 1.2, « Rester » possible, compteurs de toutes les commandes', () => {
    const sim = day15();
    expect(
      screenOf(sim.world, 'p1', { titleDone: true, sessionFinished: false, creationHold: false }),
    ).toBe('ended');
    const { p1, p2 } = both(sim);
    for (const m of [p1, p2]) {
      expect(plain(m.ticket)).toBe('Samedi 15, 16 h · le train est reparti');
      expect(plain(m.title)).toBe("Deux semaines à la Halte d'Aubrune");
      expect(plain(m.subtitle)).toBe("La démo s'arrête ici. La Halte, elle, continue.");
      expect(plain(m.text)).toBe(
        "Restez pour l'été : désormais, le temps, la lisière et la commande du samedi changent d'eux-mêmes.",
      );
      expect(m.canStay).toBe(true);
      expect(m.next).toBeNull();
      expect(m.days).toBe(15);
      expect([m.linesDone, m.linesTotal]).toEqual([9, 9]);
      expect(plain(m.detail)).toBe('samedi 8 : 4 sur 4 · samedi 15 : 5 sur 5');
      expect(plain(m.after)).toBe(
        '« Rester à la Halte » reprend la partie ce samedi à 16 h, chez les deux. « Finir la séance » la garde telle quelle : elle vous proposera de rester la prochaine fois.',
      );
      expect(m.message.kind).toBe('help');
      expect([m.self.chip, m.other.chip]).toEqual(['Pas encore', 'Pas encore']);
    }
    expect([p1.self.name, p1.other.name]).toEqual(['Camille', 'Sacha']);
    expect([p2.self.name, p2.other.name]).toEqual(['Sacha', 'Camille']);
    expect(plain(p1.message.text)).toBe(
      'Choisis sur ton ordinateur, Sacha sur le sien : rien ne se passe tant que vos deux choix diffèrent.',
    );
    expect(plain(p1.countersLabel)).toBe(
      'Journées vécues : 15. Commandes : 9 lignes sur 9. Meubles posés : 3',
    );
  });

  it('un seul choix: chacun voit « Veut rester » sur la bonne carte; l’un attend, l’autre lit ce que son partenaire veut', () => {
    const sim = day15();
    send(sim, 'p1', choose('stay'));
    expect(sim.world.phase).toBe('ended');
    const { p1, p2 } = both(sim);
    expect([p1.self.chip, p1.other.chip]).toEqual(['Veut rester', 'Pas encore']);
    expect([p2.self.chip, p2.other.chip]).toEqual(['Pas encore', 'Veut rester']);
    expect(p1.message).toEqual({ kind: 'waiting', text: 'En attente de Sacha…' });
    expect(p2.message.kind).toBe('partner');
    if (p2.message.kind !== 'partner') return;
    expect(p2.message.strong).toBe('Camille veut rester.');
    expect(p2.message.text).toBe('Si tu restes aussi, la partie reprend chez les deux.');
  });

  it('choix différents: rien ne se passe, les deux voient le désaccord, et l’on peut changer d’avis', () => {
    const sim = day15();
    send(sim, 'p1', choose('finish'));
    const events = send(sim, 'p2', choose('stay'));
    expect(events).not.toContain('session_finish');
    expect(events).not.toContain('stage_continue');
    expect(sim.world.phase).toBe('ended');
    const { p1, p2 } = both(sim);
    expect([p1.self.chip, p1.other.chip]).toEqual(['Veut finir', 'Veut rester']);
    expect([p2.self.chip, p2.other.chip]).toEqual(['Veut rester', 'Veut finir']);
    for (const [m, partner] of [
      [p1, 'Sacha veut rester.'],
      [p2, 'Camille veut finir la séance.'],
    ] as const) {
      expect(m.message.kind).toBe('partner');
      if (m.message.kind !== 'partner') continue;
      expect(m.message.strong).toBe(partner);
      expect(plain(m.message.text)).toBe(
        'Vos choix diffèrent : parlez-en, tu peux encore changer le tien.',
      );
    }
    // Camille change d'avis: d'accord pour rester, la journée reprend chez les deux.
    const after = send(sim, 'p1', choose('stay'));
    expect(after).toContain('stage_continue');
    expect(sim.world.phase).toBe('day');
    expect(stageModel(sim.world, uiContext('p1'))).toBeNull();
    expect(stageModel(sim.world, uiContext('p2'))).toBeNull();
    expect(
      screenOf(sim.world, 'p1', { titleDone: true, sessionFinished: false, creationHold: false }),
    ).toBeNull();
    for (const c of sim.world.characters)
      expect(c.notifications.at(-1)?.text).toBe(
        'La Halte continue. Prochain train: samedi 22, 10 h.',
      );
  });

  it('« Finir » des deux: l’écran reste et dit l’accord chez les deux, la séance se termine', () => {
    const sim = day15();
    send(sim, 'p2', choose('finish'));
    const p1Before = stageModel(sim.world, uiContext('p1'));
    expect(p1Before?.message.kind).toBe('partner');
    if (p1Before?.message.kind === 'partner')
      expect(plain(p1Before.message.text)).toBe(
        'Si tu choisis aussi « Finir la séance », la séance se termine.',
      );
    const events = send(sim, 'p1', choose('finish'));
    expect(events).toContain('session_finish');
    expect(sim.world.phase).toBe('ended');
    const { p1, p2 } = both(sim);
    for (const m of [p1, p2]) {
      expect(m.message.kind).toBe('done');
      expect(plain(m.message.text)).toBe(
        'Vous avez choisi « Finir la séance » sur les deux ordinateurs.',
      );
      expect([m.self.chip, m.other.chip]).toEqual(['Veut finir', 'Veut finir']);
    }
  });

  it('les deux « Rester » au même pas: le premier accord s’applique, une seule reprise', () => {
    const sim = day15();
    send(sim, 'p1', choose('stay'));
    step(sim, {
      controls: {},
      intents: [
        { by: 'p2', intent: choose('stay') },
        { by: 'p1', intent: choose('stay') },
      ],
    });
    expect(sim.events.filter((e) => e.type === 'stage_continue')).toHaveLength(1);
    expect(sim.world.phase).toBe('day');
  });
});

describe("écran d'étape du jour 43 (tour 9: « Rester » pour l'automne)", () => {
  it('« Rester » chez les deux, avec le texte réécrit de l’automne; le choix s’enregistre', () => {
    const sim = day43();
    const { p1, p2 } = both(sim);
    for (const m of [p1, p2]) {
      expect(m.stage).toBe('summer_end');
      expect(plain(m.ticket)).toBe('Samedi 43, 16 h · le train est reparti');
      expect(plain(m.title)).toBe("Six semaines à la Halte d'Aubrune");
      expect(m.canStay).toBe(true);
      expect(m.next).toBeNull();
      expect(m.days).toBe(43);
      expect([m.linesDone, m.linesTotal]).toEqual([25, 27]);
      expect(plain(m.detail)).toBe('6 commandes, dont 4 complètes');
    }
    send(sim, 'p1', choose('stay'));
    expect(sim.world.stages.choice.p1).toBe('stay');
    expect(both(sim).p1.self.choice).toBe('stay');
  });

  it('résumé des commandes: toutes complètes, une seule, aucune; nombre seul si l’historique ne les couvre plus', () => {
    const ctx = uiContext();
    const order = (
      day: number,
      complete: boolean,
    ): { day: number; linesDone: number; linesTotal: number; complete: boolean } => ({
      day,
      linesDone: complete ? 4 : 2,
      linesTotal: 4,
      complete,
    });
    expect(stageOrdersDetail(ctx, [order(8, true)], 1)).toBe('');
    expect(
      plain(stageOrdersDetail(ctx, [order(8, true), order(15, false), order(22, true)], 3)),
    ).toBe('samedi 8 : 4 sur 4 · samedi 15 : 2 sur 4 · samedi 22 : 4 sur 4');
    const four = [8, 15, 22, 29];
    expect(
      plain(
        stageOrdersDetail(
          ctx,
          four.map((d) => order(d, true)),
          4,
        ),
      ),
    ).toBe('4 commandes, toutes complètes');
    expect(
      plain(
        stageOrdersDetail(
          ctx,
          four.map((d) => order(d, d === 8)),
          4,
        ),
      ),
    ).toBe('4 commandes, dont une complète');
    expect(
      plain(
        stageOrdersDetail(
          ctx,
          four.map((d) => order(d, false)),
          4,
        ),
      ),
    ).toBe('4 commandes parties');
    expect(
      plain(
        stageOrdersDetail(
          ctx,
          four.map((d) => order(d, true)),
          9,
        ),
      ),
    ).toBe('9 commandes parties');
  });
});

describe('saison, météo et quête de la semaine', () => {
  it('le HUD dit la saison sous la date; la brume au lever se dit jusqu’à 10 h 30', () => {
    const sim = day25();
    const ctx = uiContext();
    const w = sim.world;
    expect(clockModel(w, ctx).season).toBe('Été · jour 4');
    expect(clockModel(day15().world, ctx).season).toBe('Printemps · jour 15');
    w.morningMist = true;
    w.weather = 'sunny';
    w.clock.minutes = 7 * HOUR;
    expect(clockModel(w, ctx).weather).toBe('Soleil, brume au lever');
    w.clock.minutes = 10 * HOUR + 30;
    expect(clockModel(w, ctx).weather).toBe('Soleil');
  });

  it('carte de saison le premier matin de l’été et de l’automne seulement', () => {
    const sim = day25();
    const w = sim.world;
    expect(seasonCard(w, sim.content)).toBeNull();
    w.clock.day = 22;
    expect(seasonCard(w, sim.content)?.title).toBe("Premier jour de l'été");
    expect(seasonCard(w, sim.content)?.lines).toHaveLength(3);
    w.clock.day = 43;
    expect(seasonCard(w, sim.content)?.title).toBe("Premier jour de l'automne");
  });

  it('la quête de la semaine porte le jour de son train, ses lignes à cocher, au carnet et au HUD, chez les deux', () => {
    const sim = day25();
    for (const me of ['p1', 'p2'] as const) {
      const ctx = uiContext(me);
      expect(orderQuest(ctx, sim.world)?.id).toBe('weekly_order');
      expect(orderQuestTitle(ctx, sim.world)).toBe('La commande du samedi 29');
      const quest = questModels(sim.world, ctx).find((q) => q.id === 'weekly_order');
      expect(quest?.title).toBe('La commande du samedi 29');
      expect(plain(quest?.text ?? '')).toMatch(
        /^Déposer dans la caisse du quai avant samedi 29 à 16 h : 26 radis, 5 omelettes, 2 truites, 4 laitues\.$/,
      );
      expect(quest?.lines.map((l) => [l.icon, plain(l.text), l.done])).toEqual(
        orderLines(sim.world, ctx).map((l) => [
          l.icon,
          `${l.name} ${Math.min(l.inCrate, l.need)} sur ${l.need}`,
          l.done,
        ]),
      );
      expect(quest?.progress).toMatch(/sur 4$/);
      expect(JSON.stringify(questModels(sim.world, ctx))).not.toMatch(/\{[a-zA-Z]+\}/);
    }
    // À la veille du train, la commande passe devant au HUD.
    sim.world.clock.day = 28;
    expect(nextObjective(sim.world, uiContext())?.title).toBe('La commande du samedi 29');
  });

  it('la sauvegarde du jour 15, reprise par « Rester », montre la commande du samedi 22 avec ses lignes', () => {
    const sim = day15();
    send(sim, 'p1', choose('stay'));
    send(sim, 'p2', choose('stay'));
    const ctx = uiContext();
    const quest = questModels(sim.world, ctx).find((q) => q.id === 'weekly_order');
    expect(quest?.title).toBe('La commande du samedi 22');
    expect(quest?.lines).toHaveLength(4);
  });

  it('la lettre de la semaine est datée et remplie dans le courrier', () => {
    const sim = day25();
    const letters = letterModels(sim.world, uiContext());
    // L'identifiant d'instance porte le jour du train: la lettre du samedi 29 part le samedi 22.
    const order = letters.find((l) => l.id === 'coop_order_generated@29');
    // Lettre écrite par la version du tour 8 (sauvegarde de référence du format 5): son titre d'alors.
    expect(order?.title).toBe('La commande du samedi 29');
    expect(order?.day).toBe('Samedi 22');
    expect(letters.find((l) => l.id === 'coop_recap_generated@22')?.title).toBe(
      'La commande du samedi 22 est partie',
    );
    expect(JSON.stringify(letters)).not.toMatch(/\{[a-zA-Z]+\}/);
  });

  it('la somme annoncée d’une commande générée complète est celle que paie le train', () => {
    const sim = day25();
    const ctx = uiContext();
    const w = sim.world;
    w.crate = orderLines(w, ctx).map((l) => ({
      item: l.item,
      quality: 'ordinary' as const,
      count: l.need,
    }));
    const announced = orderFullAmount(ctx, w);
    payOrder(sim);
    expect(w.orderResult?.complete).toBe(true);
    expect(announced).toBe(w.orderResult?.amount);
  });

  it('le HUD annonce le train de chaque samedi, trains générés compris', () => {
    const sim = day25();
    const w = sim.world;
    w.clock.day = 29;
    w.clock.minutes = 9 * HOUR + 30;
    w.train.phase = 'away';
    expect(plain(clockModel(w, uiContext()).train ?? '')).toBe('Arrivée du train à 10 h');
    w.clock.day = 28;
    expect(clockModel(w, uiContext()).train).toBeNull();
  });
});
