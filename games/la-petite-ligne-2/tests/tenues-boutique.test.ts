// Brique « vendre une tenue » (ligne `pieces` d'un commerce) et garde-robe propre à chaque joueur:
// une échoppe factice vend une pièce factice; achat, refus, « déjà à toi », port chez l'hôte et
// l'invité, sauvegarde et reprise, récompense donnée une fois. Plus les données d'Aubrune.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, type Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { Catalogue, Look, PieceDef } from '../src/donnees/schemas/personnage';
import { ProgressSchema, type ProgressState } from '../src/etat/progression';
import type { WorldState } from '../src/etat/monde';
import { shopModel } from '../src/interface/boutique/modele';
import { createProgressAssembler, progressParts } from '../src/reseau/progression';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { GameEventSchema } from '../src/simulation/noyau/evenements';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { applyEffect } from '../src/simulation/regles/effets';
import {
  hasPiece,
  isPieceOwned,
  pieceKey,
  WARDROBE,
  wardrobeOf,
} from '../src/simulation/regles/recompenses';
import { put, send } from './aides-noyau';
import { act, contextOf } from './aides-l3';
import { dataFiles, gameDataFiles, MEMBERS, newSim } from './aides';

type Json = Record<string, unknown>;
const PIECE = 'chapeau-factice';
const SHOP = 'echoppe-factice';
const PRICE = 900;

/** La gare d'essai, plus une pièce à gagner factice et une échoppe qui la vend (rien d'autre). */
function content(pieces: Json[] = [{ piece: PIECE, price: PRICE }]): Content {
  const files = dataFiles() as Record<string, Json>;
  const catalogue = files['commun/personnages/catalogue.json'] as unknown as Catalogue;
  const hat = catalogue.pieces.find((p) => p.slot === 'hat');
  if (hat === undefined) throw new Error('aucun chapeau au catalogue');
  const piece: PieceDef = {
    ...hat,
    id: PIECE,
    name: 'Chapeau factice',
    description: 'Un chapeau pour les tests.',
    tags: [WARDROBE.lockedTag],
  };
  files['commun/personnages/catalogue.json'] = {
    ...catalogue,
    pieces: [...catalogue.pieces, piece],
  };
  files[`lieux/essai-gare/commerces/${SHOP}.json`] = {
    schema: 1,
    id: SHOP,
    name: 'Échoppe factice',
    keeper: 'cheffe-de-gare',
    hours: { from: 0, to: 1440 },
    sells: [],
    pieces,
    buys: [],
  };
  return loadContent(files);
}

function atCounter(c: Content): Sim {
  const sim = newSim(c);
  sim.world.minutes = 600;
  put(sim, 0, 20, 17.3, 0);
  put(sim, 1, 19.4, 17.3, 0);
  return sim;
}

const buy = (sim: Sim, player: PlayerIndex): Sim['events'] =>
  act(sim, player, { type: 'shop_buy_piece', shop: SHOP, piece: PIECE });

const refusals = (events: Sim['events']): string[] =>
  events.flatMap((e) => (e.type === 'refused' ? [e.reason] : []));

function lookWith(sim: Sim, player: PlayerIndex): Look {
  const look = sim.world.players[player].look;
  const shape = look?.shape ?? sim.content.catalogue.shapes[0]?.id ?? '';
  return { shape, skin: look?.skin ?? 0, pieces: [{ slot: 'hat', id: PIECE, colors: [] }] };
}

describe('brique « vendre une tenue »', () => {
  const c = content();

  it('l’achat débite l’acheteur et met la pièce dans sa garde-robe, à lui seul', () => {
    const sim = atCounter(c);
    sim.world.players[0].money = 1000;
    sim.world.players[1].money = 1000;
    const events = buy(sim, 0);
    expect(refusals(events)).toEqual([]);
    expect(sim.world.players[0].money).toBe(1000 - PRICE);
    expect(sim.world.players[1].money).toBe(1000);
    expect(hasPiece(sim.world, PIECE, 0)).toBe(true);
    expect(hasPiece(sim.world, PIECE, 1)).toBe(false);
    expect(events).toContainEqual({
      type: 'shop_piece_bought',
      player: 0,
      shop: SHOP,
      piece: PIECE,
      cents: PRICE,
    });
    expect(events).toContainEqual({ type: 'reward_given', by: 0, kind: 'piece', id: PIECE });
    for (const event of events) expect(v.is(GameEventSchema, event)).toBe(true);
    // L'écran de boutique: « À toi » chez l'acheteur, en vente chez l'autre.
    const ui = { shop: SHOP, tab: 'buy' as const, focus: 0, quantity: 1, chest: false };
    const mine = shopModel(c, sim.world, 0, ui);
    expect(mine?.tiles.map((t) => [t.kind, t.item, t.name, t.state])).toEqual([
      ['piece', PIECE, 'Chapeau factice', 'owned'],
    ]);
    expect(mine?.detail).toMatchObject({ quantity: 0, total: PRICE, chest: 'never' });
    expect(mine?.tiles[0]?.description).toBe('Un chapeau pour les tests.');
    expect(shopModel(c, sim.world, 1, ui)?.tiles[0]?.state).toBe('ok');
  });

  it('refuse sans assez d’argent, sans rien débiter ni donner', () => {
    const sim = atCounter(c);
    sim.world.players[0].money = PRICE - 10;
    expect(refusals(buy(sim, 0))).toEqual(['not-enough-money']);
    expect(sim.world.players[0].money).toBe(PRICE - 10);
    expect(hasPiece(sim.world, PIECE, 0)).toBe(false);
    const ui = { shop: SHOP, tab: 'buy' as const, focus: 0, quantity: 1, chest: false };
    expect(shopModel(c, sim.world, 0, ui)?.tiles[0]?.state).toBe('too-expensive');
  });

  it('une pièce déjà à toi ne se rachète pas', () => {
    const sim = atCounter(c);
    sim.world.players[0].money = 5000;
    buy(sim, 0);
    expect(refusals(buy(sim, 0))).toEqual(['already-owned']);
    expect(sim.world.players[0].money).toBe(5000 - PRICE);
    // Une pièce gagnée par une récompense compte aussi.
    applyEffect(contextOf(sim), 1, { type: 'give_piece', piece: PIECE });
    sim.world.players[1].money = 5000;
    expect(refusals(buy(sim, 1))).toEqual(['already-owned']);
  });

  it('refuse une pièce que le commerce ne vend pas, ou trop loin', () => {
    const sim = atCounter(c);
    sim.world.players[0].money = 5000;
    expect(refusals(act(sim, 0, { type: 'shop_buy_piece', shop: SHOP, piece: 'hat-cap' }))).toEqual(
      ['not-sold'],
    );
    put(sim, 0, 2, 2, 0);
    expect(refusals(buy(sim, 0))).toEqual(['too-far']);
  });

  it('une récompense ne se donne qu’une fois par joueur, et `to: duo` la donne à chacun', () => {
    const sim = atCounter(c);
    const ctx = contextOf(sim);
    applyEffect(ctx, 0, { type: 'give_piece', piece: PIECE });
    applyEffect(ctx, 0, { type: 'give_piece', piece: PIECE });
    const given = (): unknown[] => sim.events.filter((e) => e.type === 'reward_given');
    expect(given()).toEqual([{ type: 'reward_given', by: 0, kind: 'piece', id: PIECE }]);
    applyEffect(ctx, 0, { type: 'give_piece', piece: PIECE, to: 'duo' });
    expect(given()).toHaveLength(2);
    expect(hasPiece(sim.world, PIECE, 1)).toBe(true);
  });

  it('se porte chez l’hôte et chez l’invité, et pas chez qui ne l’a pas', () => {
    const sim = atCounter(c);
    sim.world.players[1].money = 5000;
    // L'invité (joueur 1) achète: son intention passe par l'hôte, comme toute autre.
    buy(sim, 1);
    const refusedLook = send(sim, 0, { type: 'set_look', name: 'Ada', look: lookWith(sim, 0) });
    expect(refusedLook).toContainEqual(expect.objectContaining({ reason: 'piece-locked' }));
    send(sim, 1, { type: 'set_look', name: 'Bob', look: lookWith(sim, 1) });
    expect(sim.world.players[1].look?.pieces).toContainEqual(
      expect.objectContaining({ id: PIECE }),
    );
    // L'invité reçoit la progression par morceaux: sa garde-robe et son écran la voient.
    const assembler = createProgressAssembler();
    let received: ProgressState | null = null;
    for (const part of progressParts(null, sim.world.progress, 1, -1, 0, 1200))
      received = assembler.receive(part) ?? received;
    if (received === null) throw new Error('progression non reçue');
    expect(v.is(ProgressSchema, received)).toBe(true);
    const guestWorld: WorldState = { ...sim.world, progress: received };
    const piece = c.pieces[PIECE];
    if (piece === undefined) throw new Error('pièce factice absente');
    expect(isPieceOwned(guestWorld, piece, 1)).toBe(true);
    expect(isPieceOwned(guestWorld, piece, 0)).toBe(false);
    expect(wardrobeOf(c.catalogue, guestWorld, 1).pieces).toContainEqual(piece);
    expect(wardrobeOf(c.catalogue, guestWorld, 0).pieces).not.toContainEqual(piece);
  });

  it('tient dans la sauvegarde: reprise avec la pièce achetée et portée, sans migration', () => {
    const sim = atCounter(c);
    sim.world.players[0].money = 5000;
    buy(sim, 0);
    send(sim, 0, { type: 'set_look', name: 'Ada', look: lookWith(sim, 0) });
    const snap = snapshotOf(sim.world, c);
    const restored = restoreWorld(
      c,
      { dataSchema: snap.dataSchema, data: JSON.parse(JSON.stringify(snap.data)) as unknown },
      MEMBERS,
    );
    if (!restored.ok) throw new Error(restored.reason);
    const again = createSim(c, restored.world);
    expect(hasPiece(again.world, PIECE, 0)).toBe(true);
    expect(hasPiece(again.world, PIECE, 1)).toBe(false);
    expect(again.world.players[0].look?.pieces).toContainEqual(
      expect.objectContaining({ id: PIECE }),
    );
    put(again, 0, 20, 17.3, 0);
    again.world.minutes = 600;
    expect(refusals(buy(again, 0))).toEqual(['already-owned']);
  });

  it('une ancienne garde-robe commune (clé sans joueur) reste aux deux, sans migration', () => {
    const sim = atCounter(c);
    sim.world.progress.memory[pieceKey(PIECE)] = { v: true, by: 'duo', day: 1 };
    expect(hasPiece(sim.world, PIECE, 0)).toBe(true);
    expect(hasPiece(sim.world, PIECE, 1)).toBe(true);
  });

  it('refuse au chargement une pièce inconnue, en double ou déjà à tous', () => {
    const problems = (pieces: Json[]): string => {
      try {
        content(pieces);
      } catch (error) {
        if (error instanceof ContentError) return error.problems.join('\n');
        throw error;
      }
      return '';
    };
    expect(problems([{ piece: 'inconnue', price: 100 }])).toContain(
      'pièce de tenue vendue inconnue',
    );
    expect(
      problems([
        { piece: PIECE, price: 100 },
        { piece: PIECE, price: 200 },
      ]),
    ).toContain('pièce vendue en double');
    const free = c.catalogue.pieces.find((p) => p.slot === 'top' && p.tags.length === 0);
    if (free !== undefined)
      expect(problems([{ piece: free.id, price: 100 }])).toContain("sans l'étiquette");
  });
});

describe('garde-robe d’Aubrune (données)', () => {
  const game = loadContent(gameDataFiles());

  it('la mercerie de Solange vend ses six pièces aux prix du gabarit', () => {
    const shop = game.places.aubrune?.shops['mercerie-merigot'];
    expect(shop?.pieces?.map((l) => [l.piece, l.price])).toEqual([
      ['top-cardigan', 2800],
      ['bottom-corduroy', 2400],
      ['bottom-long-skirt', 2200],
      ['shoes-clogs', 1600],
      ['accessory-scarf', 1200],
      ['hat-cap', 900],
    ]);
  });

  it('les six récompenses sont données chacune par un cadeau de fin de suite, une fois par joueur', () => {
    const rewards = [
      'top-work-jacket',
      'bottom-overalls',
      'dress-sunday',
      'hat-straw',
      'accessory-neckerchief',
      'accessory-apron',
    ];
    const givers = new Map<string, string>();
    for (const dialogue of game.places.aubrune?.dialogues ?? [])
      for (const node of Object.values(dialogue.nodes))
        if (node.kind === 'effects')
          for (const effect of node.effects)
            if (effect.type === 'give_piece') {
              expect(dialogue.once, dialogue.id).toBe('player');
              givers.set(effect.piece, dialogue.villager);
            }
    expect([...givers.keys()].sort()).toEqual([...rewards].sort());
  });
});
