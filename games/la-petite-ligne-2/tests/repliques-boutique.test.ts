// Répliques de boutique lues dans la fiche du commerce, condition « au moins tant d'argent »,
// rachat et commerce conditionnés par un fait d'histoire: un commerce factice, tests courts.
import { describe, expect, it } from 'vitest';
import type { Condition } from '../src/donnees/schemas/regles';
import { aimOf } from '../src/simulation/briques/visee';
import {
  isAvailable,
  offerFor,
  shopDef,
  shopSays,
  shopSaysRefusal,
} from '../src/simulation/commerces/prix';
import type { Sim } from '../src/simulation/noyau/pas';
import { evaluate } from '../src/simulation/regles/conditions';
import { addItem } from '../src/simulation/sac/inventaire';
import { put } from './aides-noyau';
import { act, contentWith } from './aides-l3';
import { gameContent, newSim } from './aides';

type Json = Record<string, unknown>;
const OPEN = 'essai-gare.factice.tenu';
const TRUFFLE = 'essai-gare.factice.confiance';

/** Une échoppe factice: répliques écrites, bûches rachetées une fois la confiance gagnée. */
function content(shop: Json = {}): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    files['lieux/essai-gare/commerces/factice.json'] = {
      schema: 1,
      id: 'factice',
      name: 'Échoppe factice',
      keeper: 'cheffe-de-gare',
      hours: { from: 0, to: 1440 },
      sells: [{ item: 'planche', price: 150, dailyStock: null }],
      buys: [
        { item: 'pomme', price: 60 },
        { item: 'buche', price: 100, unlock: { type: 'remembered', key: TRUFFLE } },
      ],
      refusal: 'Ça, non.',
      lines: {
        bought: 'Bon choix, la planche.',
        sold: 'Elles sont belles, tes pommes.',
        noMoney: 'Reviens avec de quoi payer.',
      },
      ...shop,
    };
  });
}

function atCounter(c: ReturnType<typeof contentWith>): Sim {
  const sim = newSim(c);
  sim.world.minutes = 600;
  put(sim, 0, 20, 17.3, 0);
  return sim;
}

const refusals = (events: Sim['events']): string[] =>
  events.flatMap((e) => (e.type === 'refused' ? [e.reason] : []));

describe('répliques de boutique', () => {
  it('se lisent dans la fiche pour l’achat, la vente, le refus et l’argent qui manque', () => {
    const sim = atCounter(content());
    const shop = shopDef(sim, 'factice');
    if (shop === null) throw new Error('commerce factice absent');
    expect(shopSays(shop, 'bought')).toBe('Bon choix, la planche.');
    expect(shopSays(shop, 'sold')).toBe('Elles sont belles, tes pommes.');
    // Les deux refus qui ont une réplique sont ceux que la simulation émet (`refused`).
    sim.world.players[0].money = 0;
    const [poor] = refusals(
      act(sim, 0, { type: 'shop_buy', shop: 'factice', item: 'planche', count: 1, chest: false }),
    );
    expect(poor).toBe('not-enough-money');
    expect(shopSaysRefusal(shop, poor ?? '')).toBe('Reviens avec de quoi payer.');
    addItem(sim.content, sim.world.players[0], 'planche', 1);
    const [unwanted] = refusals(
      act(sim, 0, { type: 'shop_sell', shop: 'factice', item: 'planche', count: 1 }),
    );
    expect(unwanted).toBe('not-wanted');
    expect(shopSaysRefusal(shop, unwanted ?? '')).toBe('Ça, non.');
    expect(shopSaysRefusal(shop, 'pockets-full')).toBeNull();
    // Un commerce sans répliques (ceux du jeu aujourd'hui) laisse l'écran dire son texte commun.
    const plain = shopDef(newSim(gameContent()), 'buvette-de-la-gare');
    expect(plain === null ? 'absent' : shopSays(plain, 'bought')).toBeNull();
  });

  it('condition `money_at_least`: la bourse de celui qui agit, ou de l’un des deux', () => {
    const sim = atCounter(content());
    const c: Condition = { type: 'money_at_least', amount: 500 };
    sim.world.players[0].money = 499;
    sim.world.players[1].money = 500;
    const ctx = { world: sim.world, content: sim.content };
    expect(evaluate({ ...ctx, actor: 0 }, c)).toBe(false);
    expect(evaluate({ ...ctx, actor: 1 }, c)).toBe(true);
    expect(evaluate({ ...ctx, actor: null }, c)).toBe(true);
    // Utilisable dans les données: une option de dialogue qui ne paraît qu'avec la somme.
    expect(() =>
      contentWith((files) => {
        const d = files['lieux/essai-gare/dialogues/accueil.json'] as { when: Condition[] };
        d.when = [...d.when, c];
      }),
    ).not.toThrow();
  });

  it('rachat conditionné: il ne veut des bûches qu’une fois le fait retenu', () => {
    const sim = atCounter(content());
    const shop = shopDef(sim, 'factice');
    if (shop === null) throw new Error('commerce factice absent');
    addItem(sim.content, sim.world.players[0], 'buche', 2);
    expect(offerFor(sim, shop, 'buche', 0)).toBeNull();
    const sell = { type: 'shop_sell', shop: 'factice', item: 'buche', count: 1 } as const;
    expect(refusals(act(sim, 0, sell))).toEqual(['not-wanted']);
    sim.world.progress.memory[TRUFFLE] = { v: true, by: 'duo', day: 1 };
    expect(offerFor(sim, shop, 'buche', 0)?.unit).toBe(100);
    expect(act(sim, 0, sell)).toContainEqual(
      expect.objectContaining({ type: 'shop_sold', item: 'buche', cents: 100 }),
    );
  });

  it('commerce conditionné: fermé tant que l’histoire ne l’a pas ouvert, comptoir compris', () => {
    const when = [{ type: 'remembered', key: OPEN }];
    const sim = atCounter(
      contentWith((files) => {
        const shop = files['lieux/essai-gare/commerces/buvette-de-la-gare.json'];
        if (shop === undefined) throw new Error('buvette absente');
        shop.when = when;
      }),
    );
    const shop = shopDef(sim, 'buvette-de-la-gare');
    if (shop === null) throw new Error('buvette absente');
    const item = shop.sells[0]?.item ?? '';
    sim.world.players[0].money = 100000;
    const buy = { type: 'shop_buy', shop: shop.id, item, count: 1, chest: false } as const;
    expect(isAvailable(sim, shop)).toBe(false);
    expect(refusals(act(sim, 0, buy))).toEqual(['shop-closed']);
    // Devant le comptoir (brique `shop`): la touche d'action dit « fermé ».
    put(sim, 0, 23, 16.2, -Math.PI / 2);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'comptoir-buvette', refusal: 'shop-closed' });
    sim.world.progress.memory[OPEN] = { v: true, by: 'duo', day: 1 };
    expect(aimOf(sim, 0)).toMatchObject({ id: 'comptoir-buvette', refusal: null });
    expect(refusals(act(sim, 0, buy))).toEqual([]);
  });

  it('données livrées: le café de la Halte ne commerce qu’après l’arrivée de Colette', () => {
    const game = gameContent();
    const sim = newSim(game);
    sim.world.common.place = 'aubrune';
    const cafe = shopDef(sim, 'cafe-de-la-halte');
    if (cafe === null) throw new Error('café absent');
    expect(isAvailable(sim, cafe)).toBe(false);
    sim.world.progress.memory['aubrune.acte2.train'] = { v: true, by: 'duo', day: 5 };
    expect(isAvailable(sim, cafe)).toBe(true);
  });
});
