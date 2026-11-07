// Service (chantier a), en quelques secondes et sans réseau: une commande prise à la caisse, un
// café crème (moudre, extraire, mousser) et un croissant jusqu'au passe, le client à sa table,
// puis la plonge; le thé, un carton, deux achats. Le pas de l'hôte (`stepWorld`), entrées écrites à la main.
import { createRandom, v } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { WorldSchema, type PlayerIndex, type World } from '../src/etat/monde';
import {
  applyPurchase,
  collectTicket,
  deliverCarton,
  finishConsumption,
  installEquipment,
  presentOrder,
} from '../src/service';
import type { Intent, StepInput, Target } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld, heldObject, objectOnSlot } from '../src/simulation/monde';
import { stepWorld } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);

function rig(): {
  world: World;
  events: GameEvent[];
  steps: (n: number, held?: PlayerIndex | null, intents?: Intent[], by?: PlayerIndex) => void;
  act: (player: PlayerIndex, target: Target, holdSeconds?: number) => void;
  drop: (player: PlayerIndex, target: Target) => void;
  sim: () => SimContext;
  at: (player: PlayerIndex, x: number, z: number) => void;
} {
  const world = createWorld(content, ['a', 'b']);
  const events: GameEvent[] = [];
  const random = createRandom(7);
  const input = (actHeld: boolean): StepInput => ({
    seq: 0,
    moveX: 0,
    moveZ: 0,
    fast: false,
    yawDeg: 180,
    pitchDeg: 0,
    actHeld,
  });
  const steps = (
    n: number,
    held: PlayerIndex | null = null,
    intents: Intent[] = [],
    by: PlayerIndex = 0,
  ): void => {
    for (let i = 0; i < n; i++) {
      const queued = i === 0 ? intents.map((intent) => ({ player: by, intent })) : [];
      stepWorld(content, world, [input(held === 0), input(held === 1)], queued, DT, random, (e) =>
        events.push(e),
      );
    }
  };
  return {
    world,
    events,
    steps,
    act(player, target, holdSeconds = 0) {
      const n = Math.max(1, Math.round(holdSeconds / DT));
      steps(n, holdSeconds > 0 ? player : null, [{ type: 'act', target }], player);
      steps(1);
    },
    drop(player, target) {
      steps(1, null, [{ type: 'drop', target }], player);
    },
    sim: () => ({
      world,
      content,
      dt: DT,
      random,
      inputs: [input(false), input(false)],
      emit: (e) => events.push(e),
    }),
    at(player, x, z) {
      world.players[player].x = x;
      world.players[player].z = z;
    },
  };
}

const station = (furniture: string): Target => ({ kind: 'station', furniture });
const slot = (furniture: string, id: string): Target => ({ kind: 'slot', furniture, slot: id });

describe('Deux Tabliers, service', () => {
  it('commande, café crème et croissant jusqu’au client, puis la plonge', () => {
    const r = rig();
    r.steps(1);
    const s = r.world.service;
    expect(s.installed).toBe(true);
    expect(r.world.furniture.some((f) => f.id === 'groupe-1')).toBe(true);
    const cups = s.clean.tasse;

    // Un client à la caisse; l'hôte prend la commande (maintien 2,5 s + 0,4 s), puis le ticket.
    expect(presentOrder(r.sim(), 'client-1', [{ recipe: 'creme' }, { recipe: 'croissant' }])).toBe(
      true,
    );
    r.at(0, 10.4, 8.3);
    r.act(0, station('station-6'), 3);
    expect(s.tickets).toHaveLength(1);
    expect(s.receipts[0]?.amount).toBeCloseTo(3.6);
    r.at(0, 8.4, 8.3);
    r.act(0, station('rail-1'));
    expect(s.tickets[0]?.taker).toBe(0);

    // Une tasse propre, sous le groupe; une dose au moulin; extraction arrêtée à 12,8 s.
    r.at(0, 9.6, 7.95);
    r.act(0, station('pile-tasses-1'));
    expect(s.clean.tasse).toBe(cups - 1);
    r.at(0, 9.0, 8.3);
    r.drop(0, slot('groupe-1', 'bec'));
    r.at(0, 9.8, 8.3);
    r.act(0, station('station-5'), 2.6);
    expect(s.doses).toBe(1);
    r.at(0, 9.0, 8.3);
    r.act(0, station('groupe-1'));
    expect(s.processes).toHaveLength(1);
    r.steps(Math.round(12.8 / DT));
    r.act(0, station('groupe-1'));
    expect(
      r.events.some((e) => e.type === 'service-extraction-stop' && e.quality === 'parfait'),
    ).toBe(true);
    const cup = objectOnSlot(r.world, 'groupe-1', 'bec');
    expect(cup?.type).toBe('tasse-cafe');

    // Le lait: relâché vers 60 °C, « Parfait »; la tasse devient un café crème.
    if (cup === undefined) throw new Error('tasse absente');
    r.act(0, { kind: 'object', id: cup.id });
    r.drop(0, slot('buse-1', 'bec'));
    r.act(0, station('buse-1'), 4.8);
    expect(r.events.some((e) => e.type === 'service-steam-stop' && e.quality === 'parfait')).toBe(
      true,
    );
    expect(cup.type).toBe('creme');
    r.act(0, { kind: 'object', id: cup.id });
    r.at(0, 8.4, 8.3);
    r.drop(0, slot('station-3', 'p1'));

    // L'invité: une assiette (le prochain article attend une assiette), la cloche, le passe.
    r.at(1, 9.6, 7.95);
    r.act(1, station('pile-tasses-1'));
    const plate = heldObject(r.world, 1);
    expect(plate?.type).toBe('assiette');
    r.at(1, 8.6, 7.95);
    r.drop(1, slot('vitrine-1', 'assiette'));
    r.act(1, station('vitrine-1'), 1.6);
    expect(plate?.type).toBe('croissant');
    if (plate === undefined) throw new Error('assiette absente');
    r.act(1, { kind: 'object', id: plate.id });
    r.at(1, 8.4, 8.3);
    r.drop(1, slot('station-3', 'p2'));
    r.steps(1);
    expect(s.tickets[0]?.status).toBe('ready');

    // Le client prend son plateau et s'assoit au guéridon 1 (une place est prise par une tasse
    // sale: le croissant se mange au comptoir, son assiette part à la plonge).
    const ticket = s.tickets[0]?.id ?? -1;
    const got = collectTicket(r.sim(), ticket, 'table-1');
    expect(got?.qualities[0]).toBe('parfait');
    expect(got?.objects).toHaveLength(1);
    expect(s.dirtyBacklog.assiette).toBe(1);
    finishConsumption(r.sim(), got?.objects ?? []);
    expect(objectOnSlot(r.world, 'table-1', 'b')?.type).toBe('tasse-sale');

    // La plonge: Agir tenu lave pièce après pièce (1,5 s chacune), la vaisselle revient propre.
    const before = s.clean.assiette;
    r.at(0, 7.55, 7.95);
    r.act(0, station('station-1'), 1.6);
    expect(s.clean.assiette).toBe(before + 1);
    expect(s.dirtyBacklog.assiette).toBe(0);
    expect(r.events.filter((e) => e.type === 'refused')).toEqual([]);
    // Le monde passe tel quel par la sauvegarde et le réseau (schéma du monde).
    expect(v.safeParse(WorldSchema, JSON.parse(JSON.stringify(r.world))).success).toBe(true);
  });

  it('thé, carton rangé, moulin à dose acheté, lave-vaisselle', () => {
    const r = rig();
    r.steps(1);
    const s = r.world.service;

    // Thé noir: la bouilloire chauffe, l'eau versée à 95 °C donne « Parfait ».
    r.at(0, 9.6, 7.95);
    r.act(0, station('pile-tasses-1'));
    r.at(0, 8.2, 7.95);
    r.drop(0, slot('bouilloire-1', 'tasse'));
    r.act(0, station('bouilloire-1'));
    r.steps(448);
    r.act(0, station('bouilloire-1'));
    expect(r.events.some((e) => e.type === 'service-tea-poured' && e.quality === 'parfait')).toBe(
      true,
    );
    expect(objectOnSlot(r.world, 'bouilloire-1', 'tasse')?.type).toBe('the-noir');

    // Un carton de chocolat livré sur la palette, porté au pied de l'étagère et rangé.
    const cacao = s.stock.cacao ?? 0;
    expect(deliverCarton(r.sim(), 'cacao')).toBe(true);
    const carton = objectOnSlot(r.world, 'palette-1', 's1');
    if (carton === undefined) throw new Error('carton absent');
    r.at(0, 8.9, 2.95);
    r.act(0, { kind: 'object', id: carton.id });
    r.at(0, 8.6, 4.6);
    r.drop(0, slot('furniture-1', 'pied'));
    r.act(0, station('furniture-1'));
    expect(s.stock.cacao).toBe(cacao + 1000);
    expect(r.world.objects.some((o) => o.id === carton.id)).toBe(false);

    // Le moulin à dose remplace le moulin: un clic, deux doses.
    expect(applyPurchase(r.sim(), 'moulin-dose')).toBe(true);
    expect(r.world.furniture.find((f) => f.id === 'station-5')?.type).toBe('moulin-dose');
    r.at(0, 9.8, 8.3);
    r.act(0, station('station-5'));
    expect(s.doses).toBe(2);

    // Lave-vaisselle: la tasse sale du guéridon chargée, le cycle de 45 s, la tasse propre.
    expect(installEquipment(content, r.world, 'lave-vaisselle')).toBe(true);
    const dirty = objectOnSlot(r.world, 'table-1', 'a');
    if (dirty === undefined) throw new Error('tasse sale absente');
    r.at(0, 4.8, 11.7);
    r.act(0, { kind: 'object', id: dirty.id });
    r.at(0, 9.15, 8.2);
    r.drop(0, slot('lave-vaisselle-1', 'panier'));
    r.act(0, station('lave-vaisselle-1'));
    r.act(0, station('lave-vaisselle-1'));
    const clean = s.clean.tasse;
    r.steps(Math.round(45 / DT));
    r.act(0, station('lave-vaisselle-1'));
    expect(s.clean.tasse).toBe(clean + 1);
    expect(r.events.filter((e) => e.type === 'refused')).toEqual([]);
  });
});
