// L'économie de la 0.12 (lot L-économie, critères CA-E1 à CA-E5 de `v0-12-conception.md`):
// prix d'Odette selon l'offre et l'oubli à l'aube, ardoise du jour, marché du dimanche (rien ne
// sort sans personne derrière l'étal, deux ventes dans le même pas à deux), plis de Lucie.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent } from '../src/etat/actions';
import { grocerTotal, grocerUnitPrices } from '../src/etat/epicerie';
import { buyerSpot, sellerSpot, stallPose } from '../src/etat/marche';
import type { CharacterId, MarketBuyer } from '../src/etat/types';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { grocerDawn, postArdoise, recordGrocerSale } from '../src/simulation/epicerie';
import { morning } from '../src/simulation/horloge';
import { marketClock, serveBuyer, stallMove } from '../src/simulation/marche';
import { mailClock, takeMail } from '../src/simulation/plis';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag, countInStacks } from '../src/simulation/sac';
import { newSim } from './aides';
import { villagerBlockers } from '../src/simulation/deplacement';
import { bodyCollides, findPath } from '../src/simulation/grille';
import { unitDraw } from '../src/etat/tirage';

const HOUR = 60;

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée (comme `regles.test.ts`). */
function started(seed?: number): Sim {
  const sim = newSim(seed);
  step(sim, {
    controls: {},
    intents: [
      { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
      { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
    ],
  });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent:
        scene.choices.length > 0
          ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' }
          : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  return sim;
}

describe('comptoir d’Odette (section 2.2)', () => {
  it('CA-E1: 20 radis de base 7 le même jour rapportent 90; le lendemain, le premier vaut 4', () => {
    const sim = started();
    const { content, world } = sim;
    world.clock.day = 16; // printemps (radis x 1,0), après la démo
    expect(content.items.radish?.sellPrice).toBe(7);
    expect(grocerTotal(content, world, 'radish', 'ordinary', 20)).toBe(90);
    expect(grocerTotal(content, world, 'radish', 'ordinary', 10)).toBe(51);
    recordGrocerSale(sim, 'radish', 20);
    grocerDawn(sim);
    expect(world.grocerSupply.radish).toBe(10);
    expect(grocerUnitPrices(content, world, 'radish', 'ordinary', 1)).toEqual([4]);
    // La démo (avant `pricesFromDay`) garde le prix du tour 9.
    world.clock.day = 3;
    expect(grocerTotal(content, world, 'radish', 'ordinary', 20)).toBe(112);
  });

  it('plafond du jour à 400 aubrins; l’ardoise vaut prix et demi, 10 unités au plus', () => {
    const sim = started();
    const { content, world } = sim;
    expect(content.settings.economy.grocer.dailyCap).toBe(400);
    world.clock.day = 16;
    world.ardoise = { day: 16, item: 'carrot', sold: 0 };
    const base = (content.items.carrot?.sellPrice ?? 0) * 0.8 * 1.1; // printemps: carotte x 1,1
    const prices = grocerUnitPrices(content, world, 'carrot', 'ordinary', 12);
    // x 1,5 sur l’ardoise pour les 10 premières; l’offre baisse à chaque unité (saturation 15).
    expect(prices[0]).toBe(Math.round(base * 1.5));
    expect(prices[9]).toBe(Math.round(base * 1.5 * (1 - (0.4 * 9) / 15)));
    expect(prices[10]).toBe(Math.round(base * (1 - (0.4 * 10) / 15)));
  });

  it('CA-E2: l’ardoise ne montre jamais un article jamais eu, ni le même deux jours de suite (20 graines, jours 16 à 64)', () => {
    // Le duo gagne des articles au fil des jours (tirage par la graine); l’ardoise se pose chaque matin.
    const goods = [
      'radish',
      'lettuce',
      'carrot',
      'egg',
      'blackberry',
      'hazelnut',
      'cep',
      'elderberry',
      'dandelion',
      'trout',
      'plank',
    ];
    for (let seed = 1; seed <= 20; seed++) {
      const sim = started(seed * 7919);
      const { world } = sim;
      world.flags.push('grocer_buys');
      for (const c of world.characters) c.bag = c.bag.map(() => null);
      world.cellar = [];
      world.crate = [];
      world.goodsSeen = [];
      let prev: { day: number; item: string } | null = null;
      for (let day = 16; day <= 64; day++) {
        world.clock.day = day;
        world.clock.minutes = 7 * HOUR;
        const next = goods[Math.floor(unitDraw(seed, 'sonde', day) * goods.length)];
        if (next !== undefined && unitDraw(seed, 'gagne', day) < 0.3) world.goodsSeen.push(next);
        postArdoise(sim);
        const a = world.ardoise;
        if (a?.day !== day) continue;
        expect(world.goodsSeen, `graine ${String(seed)}, jour ${String(day)}`).toContain(a.item);
        if (prev !== null && prev.day === day - 1)
          expect(a.item, `graine ${String(seed)}, jour ${String(day)}`).not.toBe(prev.item);
        prev = { day, item: a.item };
      }
    }
  });

  it('l’ardoise se pose à 7 h parmi les articles déjà eus, jamais celui de la veille', () => {
    const sim = started();
    const { world } = sim;
    world.flags.push('grocer_buys');
    world.goodsSeen = ['carrot', 'radish'];
    world.clock.day = 16;
    world.clock.minutes = 7 * HOUR;
    postArdoise(sim);
    const first = world.ardoise?.item ?? '';
    // Déjà eus: ceux de la liste, et ce que le duo a en main (planches du cellier...).
    expect(world.goodsSeen).toContain(first);
    expect(world.ardoise?.day).toBe(16);
    world.clock.day = 17;
    postArdoise(sim);
    expect(world.ardoise?.day).toBe(17);
    expect(world.ardoise?.item).not.toBe(first);
  });
});

/** Dimanche (jour 2), 8 h, l’étal posé et garni: 4 radis et 2 œufs. */
function marketMorning(): Sim {
  const sim = started();
  morning(sim);
  const { world } = sim;
  for (const c of world.characters) c.status = 'active';
  world.phase = 'day';
  world.flags.push('market_open');
  world.goodsSeen = ['radish', 'egg', 'blackberry', 'lettuce', 'carrot'];
  const pose = stallPose(sim.content, sim.map);
  if (pose === null) throw new Error('étal sans place');
  const p1 = character(sim, 'p1');
  placeCharacter(sim, p1, sellerSpot(pose));
  addToBag(sim, p1, 'radish', 'ordinary', 4);
  addToBag(sim, p1, 'egg', 'ordinary', 2);
  stallMove(sim, p1, 'radish', 'ordinary', 4, true);
  stallMove(sim, p1, 'egg', 'ordinary', 2, true);
  world.clock.minutes = 8 * HOUR;
  marketClock(sim, 8 * HOUR - 1, 8 * HOUR);
  return sim;
}

function waitingBuyer(villager: string, spot: number, list: MarketBuyer['list']): MarketBuyer {
  return {
    villager,
    at: 8 * HOUR,
    list,
    status: 'waiting',
    spot,
    since: 8 * HOUR,
    returned: false,
  };
}

describe('marché du dimanche (section 2.3)', () => {
  it('l’étal se garnit depuis le sac, au plus 4 cases', () => {
    const sim = marketMorning();
    expect(sim.world.market?.stall.map((s) => [s.item, s.count])).toEqual([
      ['radish', 4],
      ['egg', 2],
    ]);
    expect(sim.world.market?.day).toBe(2);
    expect(sim.world.market?.level).toBe('fair');
    // Compteurs des quêtes du marché (README des données, section 3.1).
    expect(sim.world.counters.duo.stall_kind).toBe(2);
    expect(sim.world.counters.duo['stall_given:radish']).toBe(4);
    expect(sim.world.counters.duo.stall_given).toBe(6);
  });

  it('CA-E3: sans joueur derrière l’étal, rien ne sort et aucun aubrin n’entre; à 13 h, le reste va au cellier', () => {
    const sim = marketMorning();
    const { world } = sim;
    const market = world.market;
    if (market === null) throw new Error('marché absent');
    const p1 = character(sim, 'p1');
    const p2 = character(sim, 'p2');
    placeCharacter(sim, p1, { x: 20.5, y: 26.5 });
    placeCharacter(sim, p2, { x: 20.5, y: 27.5 });
    market.buyers = [waitingBuyer('basile', 0, [{ item: 'radish', count: 2 }])];
    const purse = world.purse;
    expect(serveBuyer(sim, p1, 'basile')).toBe(false);
    // Il attend 30 minutes, repart, revient une fois, puis rentre.
    marketClock(sim, 8 * HOUR, 8 * HOUR + 31);
    expect(market.buyers[0]?.status).toBe('coming');
    marketClock(sim, 8 * HOUR + 31, 9 * HOUR + 12);
    expect(market.buyers[0]?.status).toBe('walking');
    const pose = stallPose(sim.content, sim.map);
    const basile = world.villagers.find((v) => v.id === 'basile');
    if (pose === null || basile === undefined) throw new Error('étal ou Basile absent');
    Object.assign(basile.pos, buyerSpot(pose, 0));
    marketClock(sim, 9 * HOUR + 12, 9 * HOUR + 13);
    expect(market.buyers[0]?.status).toBe('waiting');
    marketClock(sim, 9 * HOUR + 13, 9 * HOUR + 45);
    expect(market.buyers[0]?.status).toBe('gone');
    expect(world.purse).toBe(purse);
    expect(market.stall.map((s) => s.count)).toEqual([4, 2]);
    const cellarRadish = countInStacks(world.cellar, 'radish');
    marketClock(sim, 13 * HOUR - 1, 13 * HOUR);
    expect(market.stall).toEqual([]);
    expect(countInStacks(world.cellar, 'radish')).toBe(cellarRadish + 4);
    expect(world.purse).toBe(purse);
  });

  it('CA-E4: deux joueurs servent deux habitants en même temps, deux ventes dans le même pas', () => {
    const sim = marketMorning();
    const { world } = sim;
    const market = world.market;
    const pose = stallPose(sim.content, sim.map);
    if (market === null || pose === null) throw new Error('marché absent');
    market.level = 'soft';
    const seller = sellerSpot(pose);
    placeCharacter(sim, character(sim, 'p1'), {
      x: seller.x + pose.along.x * 0.4,
      y: seller.y + pose.along.y * 0.4,
    });
    placeCharacter(sim, character(sim, 'p2'), {
      x: seller.x - pose.along.x * 0.4,
      y: seller.y - pose.along.y * 0.4,
    });
    market.buyers = [
      waitingBuyer('basile', 0, [{ item: 'radish', count: 2 }]),
      waitingBuyer('achille', 1, [{ item: 'egg', count: 2 }]),
    ];
    const purse = world.purse;
    step(sim, {
      controls: {},
      intents: [
        { by: 'p1', intent: { type: 'market_serve', villager: 'basile' } },
        { by: 'p2', intent: { type: 'market_serve', villager: 'achille' } },
      ],
    });
    const sales = sim.events.flatMap((e) =>
      e.type === 'market_sale' ? [[e.by, e.villager, e.amount]] : [],
    );
    expect(world.counters.duo.market_served).toBe(2);
    expect(world.counters.duo.market_served_together).toBe(1);
    expect(sales).toEqual([
      ['p1', 'basile', 14],
      ['p2', 'achille', 16],
    ]);
    expect(world.purse).toBe(purse + 30);
    expect(market.stall.map((s) => [s.item, s.count])).toEqual([['radish', 2]]);
  });
});

describe('place de l’étal', () => {
  it('l’étal, les deux places de la file et celle du vendeur sont libres et atteignables depuis la place', () => {
    const sim = started();
    const pose = stallPose(sim.content, sim.map);
    const square = sim.map.points.village_square;
    if (pose === null || square === undefined) throw new Error('étal ou place absents');
    const blockers = villagerBlockers(sim, 'basile');
    for (const at of [buyerSpot(pose, 0), buyerSpot(pose, 1), sellerSpot(pose)]) {
      expect(bodyCollides(blockers, at.x, at.y), JSON.stringify(at)).toBe(false);
      expect(findPath(blockers, square, at), JSON.stringify(at)).not.toBeNull();
    }
  });
});

describe('plis de Lucie (section 2.4)', () => {
  it('CA-E5: un pli non livré à 18 h ne paie rien et revient le lendemain', () => {
    const sim = started();
    const { world } = sim;
    world.flags.push('mail_round_open');
    world.clock.day = 17; // un lundi
    world.clock.minutes = 8 * HOUR;
    mailClock(sim, 8 * HOUR - 1, 8 * HOUR);
    const mail = world.mail;
    if (mail === null) throw new Error('sacoche absente');
    const count = mail.items.length;
    expect(count).toBeGreaterThanOrEqual(2);
    const p1 = character(sim, 'p1');
    const bench = sim.map.points.quay_bench;
    if (bench === undefined) throw new Error('banc du quai absent');
    placeCharacter(sim, p1, bench);
    takeMail(sim, p1);
    const carried = countInBag(p1, 'mail_letter') + countInBag(p1, 'mail_parcel');
    expect(carried).toBe(count);
    const purse = world.purse;
    world.clock.minutes = 18 * HOUR;
    mailClock(sim, 18 * HOUR - 1, 18 * HOUR);
    expect(world.purse).toBe(purse);
    expect(countInBag(p1, 'mail_letter') + countInBag(p1, 'mail_parcel')).toBe(0);
    expect(mail.carryOver).toBe(count);
    world.clock.day = 18;
    world.clock.minutes = 8 * HOUR;
    mailClock(sim, 8 * HOUR - 1, 8 * HOUR);
    expect(world.mail?.items.length).toBeGreaterThanOrEqual(count);
  });
});
