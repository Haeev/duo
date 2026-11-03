// R18 (patch 0.12.2, retours du 3 novembre): « l'étal vend quand on n'est pas là, sans rien
// rapporter ». Un dimanche entier joué pas à pas, de 7 h 58 à 13 h 05, en suivant le compte exact
// de chaque objet du duo (sacs, coffre, râtelier, sol, étal): un objet ne quitte le duo que vendu,
// et chaque vente rapporte. Les deux joueurs garnissent l'étal (p2 est le personnage de l'invité,
// dont l'hôte joue les intentions), on sert, on laisse l'étal seul, on sauvegarde et on reprend,
// un client refuse le prix, puis l'étal ferme et dit combien d'objets rentrent et où.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent } from '../src/etat/actions';
import { behindStall, sellerSpot, stallPose } from '../src/etat/marche';
import type { CharacterId, WorldEvent } from '../src/etat/types';
import type { Content } from '../src/donnees/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { type Sim, character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { morning } from '../src/simulation/horloge';
import { step } from '../src/simulation/pas';
import { addToBag } from '../src/simulation/sac';
import { contentAndMap, newSim } from './aides';

const HOUR = 60;
const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const GOODS = ['radish', 'egg', 'lettuce', 'carrot', 'blackberry'] as const;
/** Loin de l'étal, sur la place (comme `economie-012.test.ts`). */
const AWAY: Record<CharacterId, { x: number; y: number }> = {
  p1: { x: 20.5, y: 26.5 },
  p2: { x: 20.5, y: 27.5 },
};

/** Le contenu du jeu, sauf le prix fort que personne n'accepte: chaque client servi au prix fort refuse. */
function refusingContent(): Content {
  const { content } = contentAndMap();
  const m = content.market;
  if (m === null) throw new Error('marché absent du contenu');
  return {
    ...content,
    market: { ...m, levels: { ...m.levels, strong: { ...m.levels.strong, accept: 0 } } },
  };
}

/** Dimanche (jour 2) à 7 h 58, personnages créés, l'étal posé, les deux sacs garnis. */
function sundayMorning(content: Content, seed: number): Sim {
  const sim = newSim(seed, content);
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
  morning(sim);
  const { world } = sim;
  world.phase = 'day';
  world.weather = 'sunny';
  world.flags.push('market_open');
  world.goodsSeen = [...GOODS];
  for (const c of world.characters) {
    c.status = 'active';
    c.menu = null;
    c.dialogue = null;
  }
  addToBag(sim, character(sim, 'p1'), 'radish', 'ordinary', 6);
  addToBag(sim, character(sim, 'p1'), 'egg', 'ordinary', 4);
  addToBag(sim, character(sim, 'p2'), 'lettuce', 'ordinary', 4);
  addToBag(sim, character(sim, 'p2'), 'carrot', 'ordinary', 5);
  addToBag(sim, character(sim, 'p2'), 'blackberry', 'fine', 3);
  world.clock.minutes = 7 * HOUR + 58;
  return sim;
}

/** Combien de chaque objet suivi le duo possède, où qu'il soit. */
function holdings(sim: Sim): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(GOODS.map((g) => [g, 0]));
  const add = (item: string, n: number): void => {
    if (item in out) out[item] = (out[item] ?? 0) + n;
  };
  for (const c of sim.world.characters) for (const s of c.bag) if (s !== null) add(s.item, s.count);
  for (const s of sim.world.cellar) add(s.item, s.count);
  for (const s of sim.world.rack) add(s.item, s.count);
  for (const g of sim.world.groundItems) add(g.item, g.count);
  for (const s of sim.world.market?.stall ?? []) add(s.item, s.count);
  return out;
}

function onStall(sim: Sim): number {
  return (sim.world.market?.stall ?? []).reduce((n, s) => n + s.count, 0);
}

interface Ledger {
  sold: number;
  earned: number;
  refusals: number;
  /** Clients arrivés à l'étal pendant qu'aucun joueur n'était derrière. */
  unattended: number;
  errors: string[];
}

/**
 * Joue jusqu'à `until` (minutes). `seller`: le joueur derrière l'étal, qui sert le premier client
 * qui attend; `null`: personne derrière l'étal. Vérifie à chaque pas que ce qui disparaît du duo
 * est exactement ce qui a été vendu, et que la bourse monte du prix de ces ventes.
 */
function playUntil(
  sim: Sim,
  until: number,
  seller: CharacterId | null,
  ledger: Ledger,
): WorldEvent[] {
  const pose = stallPose(sim.content, sim.map);
  if (pose === null) throw new Error('étal sans place');
  for (const id of ['p1', 'p2'] as const)
    placeCharacter(sim, character(sim, id), id === seller ? sellerSpot(pose) : AWAY[id]);
  if (seller !== null)
    expect(behindStall(sim.content, sim.map, character(sim, seller).pos)).toBe(true);
  const all: WorldEvent[] = [];
  for (let i = 0; i < 200_000 && sim.world.clock.minutes < until; i++) {
    for (const c of sim.world.characters) c.lastInputTick = sim.world.tick;
    const waiting = sim.world.market?.buyers.find((b) => b.status === 'waiting');
    const intents: AuthoredIntent[] =
      seller !== null && waiting !== undefined
        ? [{ by: seller, intent: { type: 'market_serve', villager: waiting.villager } }]
        : [];
    const before = holdings(sim);
    const purse = sim.world.purse;
    step(sim, { controls: {}, intents });
    all.push(...sim.events);
    const after = holdings(sim);
    const sold: Record<string, number> = {};
    let amount = 0;
    for (const e of sim.events) {
      if (e.type === 'market_sale') {
        for (const it of e.items) sold[it.item] = (sold[it.item] ?? 0) + it.count;
        const units = e.items.reduce((n, it) => n + it.count, 0);
        if (e.amount < units)
          ledger.errors.push(`vente de ${String(units)} objets pour ${String(e.amount)} aubrins`);
        amount += e.amount;
        ledger.sold += units;
        ledger.earned += e.amount;
      }
      if (e.type === 'money') amount += e.amount;
      if (e.type === 'market_refused') ledger.refusals += 1;
      if (e.type === 'market_buyer_arrived' && seller === null) ledger.unattended += 1;
    }
    for (const item of GOODS) {
      const gone = (before[item] ?? 0) - (after[item] ?? 0);
      if (gone !== (sold[item] ?? 0))
        ledger.errors.push(
          `${item} à ${sim.world.clock.minutes.toFixed(1)} min: ${String(gone)} partis, ${String(sold[item] ?? 0)} vendus`,
        );
    }
    if (sim.world.purse - purse !== amount)
      ledger.errors.push(
        `bourse à ${sim.world.clock.minutes.toFixed(1)} min: +${String(sim.world.purse - purse)} pour ${String(amount)}`,
      );
  }
  expect(sim.world.clock.minutes).toBeGreaterThanOrEqual(until);
  return all;
}

describe('R18: l’étal du dimanche, objet par objet, de l’ouverture à la fermeture', () => {
  it.each([3, 11])(
    'graine %i: rien ne quitte le duo sans être payé; à 13 h, le reste rentre au coffre et le message le dit',
    (seed) => {
      const content = refusingContent();
      let sim = sundayMorning(content, seed);
      const ledger: Ledger = { sold: 0, earned: 0, refusals: 0, unattended: 0, errors: [] };
      const start = holdings(sim);

      // 8 h: l'étal ouvre; les deux joueurs le garnissent (p2: le personnage de l'invité).
      playUntil(sim, 8 * HOUR, null, ledger);
      const pose = stallPose(sim.content, sim.map);
      if (pose === null) throw new Error('étal sans place');
      placeCharacter(sim, character(sim, 'p1'), sellerSpot(pose));
      placeCharacter(sim, character(sim, 'p2'), {
        x: pose.centre.x + pose.front.x * 0.9,
        y: pose.centre.y + pose.front.y * 0.9,
      });
      step(sim, {
        controls: {},
        intents: [
          {
            by: 'p1',
            intent: { type: 'stall_deposit', item: 'radish', quality: 'ordinary', count: 6 },
          },
          {
            by: 'p1',
            intent: { type: 'stall_deposit', item: 'egg', quality: 'ordinary', count: 4 },
          },
          {
            by: 'p2',
            intent: { type: 'stall_deposit', item: 'lettuce', quality: 'ordinary', count: 4 },
          },
          {
            by: 'p2',
            intent: { type: 'stall_deposit', item: 'blackberry', quality: 'fine', count: 3 },
          },
        ],
      });
      expect(holdings(sim)).toEqual(start);
      expect(onStall(sim)).toBe(17);
      expect(sim.world.market?.day).toBe(sim.world.clock.day);
      expect(sim.world.market?.buyers.length).toBeGreaterThanOrEqual(3);

      // 8 h à 9 h 30: p1 sert au prix juste.
      playUntil(sim, 9 * HOUR + 30, 'p1', ledger);
      // 9 h 30 à 11 h: personne derrière l'étal; les clients arrivent, attendent et repartent.
      const unattendedStall = onStall(sim);
      const purseAlone = sim.world.purse;
      playUntil(sim, 11 * HOUR, null, ledger);
      expect(onStall(sim)).toBe(unattendedStall);
      expect(sim.world.purse).toBe(purseAlone);

      // 11 h: sauvegarde et reprise, rien ne bouge.
      const before = holdings(sim);
      const stall = structuredClone(sim.world.market?.stall);
      const snap = snapshotOf(sim);
      sim = restoreWorld(content, sim.map, structuredClone(snap.data), snap.dataSchema, [A, B]);
      expect(holdings(sim)).toEqual(before);
      expect(sim.world.market?.stall).toEqual(stall);

      // 11 h à 12 h 30: l'invité sert, au prix fort (chaque client refuse et prend un article au prix doux).
      placeCharacter(sim, character(sim, 'p2'), sellerSpot(pose));
      step(sim, {
        controls: {},
        intents: [{ by: 'p2', intent: { type: 'market_level', level: 'strong' } }],
      });
      playUntil(sim, 12 * HOUR + 30, 'p2', ledger);
      // 12 h 30 à 13 h 05: personne; à 13 h, l'étal ferme.
      const left = onStall(sim);
      const events = playUntil(sim, 13 * HOUR + 5, null, ledger);

      expect(ledger.errors).toEqual([]);
      expect(ledger.sold).toBeGreaterThan(0);
      expect(ledger.earned).toBeGreaterThanOrEqual(ledger.sold);
      expect(ledger.unattended).toBeGreaterThan(0);
      expect(sim.world.market?.stall).toEqual([]);
      // Bilan du matin: ce qui manque au duo, c'est exactement ce qui a été vendu.
      const end = holdings(sim);
      const missing = GOODS.reduce((n, g) => n + (start[g] ?? 0) - (end[g] ?? 0), 0);
      expect(missing).toBe(ledger.sold);
      // La fermeture: le reste rentre, le message dit combien et où, chez les deux.
      expect(events.filter((e) => e.type === 'market_closed')).toEqual([
        { type: 'market_closed', returned: left },
      ]);
      expect(left).toBeGreaterThan(0);
      for (const c of sim.world.characters) {
        const n = c.notifications.find((x) => x.key?.startsWith('market_closed'));
        expect(n?.text).toBe(
          left === 1
            ? "L'étal ferme à 13 h : 1 objet rangé au coffre de la maisonnette."
            : `L'étal ferme à 13 h : ${String(left)} objets rangés au coffre de la maisonnette.`,
        );
      }
      if (ledger.refusals === 0)
        throw new Error('aucun refus joué: le cas du prix refusé n’est pas couvert');
    },
  );

  it('coffre plein: le reste se pose au pied du coffre, et le message le dit', () => {
    const { content } = contentAndMap();
    const sim = sundayMorning(content, 3);
    const ledger: Ledger = { sold: 0, earned: 0, refusals: 0, unattended: 0, errors: [] };
    playUntil(sim, 8 * HOUR, null, ledger);
    const pose = stallPose(sim.content, sim.map);
    if (pose === null) throw new Error('étal sans place');
    placeCharacter(sim, character(sim, 'p1'), sellerSpot(pose));
    step(sim, {
      controls: {},
      intents: [
        {
          by: 'p1',
          intent: { type: 'stall_deposit', item: 'radish', quality: 'ordinary', count: 6 },
        },
      ],
    });
    // Le coffre se remplit de planches jusqu'à la dernière case.
    for (let i = 0; i < 400; i++)
      sim.world.cellar.push({ item: 'plank', quality: 'ordinary', count: 1 });
    const ground = sim.world.groundItems
      .filter((g) => g.item === 'radish')
      .reduce((n, g) => n + g.count, 0);
    const start = holdings(sim);
    playUntil(sim, 13 * HOUR + 1, null, ledger);
    expect(ledger.errors).toEqual([]);
    expect(holdings(sim)).toEqual(start);
    expect(
      sim.world.groundItems.filter((g) => g.item === 'radish').reduce((n, g) => n + g.count, 0),
    ).toBe(ground + 6);
    for (const c of sim.world.characters) {
      expect(c.notifications.find((x) => x.key?.startsWith('market_closed'))?.text).toBe(
        "L'étal ferme à 13 h : 6 objets rapportés à la maisonnette, dont 6 au pied du coffre (plus de place dedans).",
      );
    }
  });
});
