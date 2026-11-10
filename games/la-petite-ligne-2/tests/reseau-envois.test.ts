// Envois de l'hôte (lot L1): garde de taille sur l'état au pire, progression par différences et
// par morceaux, bascule de lieu des deux côtés, reprise de la liaison.
import * as v from 'valibot';
import { afterAll, describe, expect, it } from 'vitest';
import type { Stack } from '../src/etat/joueur';
import { WorldSchema } from '../src/etat/monde';
import { BUDGET_BYTES } from '../src/reseau/canaux';
import { createGuest } from '../src/reseau/invite';
import { createHost, type PlaceSwitch } from '../src/reseau/hote';
import {
  cloneProgress,
  createProgressAssembler,
  PROGRESS_PART_BUDGET_BYTES,
  progressParts,
} from '../src/reseau/progression';
import { NET_SETTINGS } from '../src/reseau/reglages';
import { byteLength, currentPlace } from '../src/reseau/tranches';
import { idleInput } from '../src/simulation/noyau/entrees';
import { createPlaceState } from '../src/simulation/noyau/monde';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { MEMBERS, gameContent, newSim } from './aides';
import { createVirtualLink, memoryLog, type Conditions } from './aides-reseau';

const content = gameContent();
const SDK_LIMIT = 64 * 1024;

/** Le pire que les règles du jalon 1 permettent (même recette que `tailles.test.ts`, plus large en mémoire). */
function worstCase(): Sim {
  const sim = newSim(content);
  const full: Stack = { item: 'hache-forgee', count: 1, wear: 120 };
  for (const player of sim.world.players) {
    player.toolbar = player.toolbar.map(() => ({ ...full }));
    player.bag = {
      id: 'malle-a-bretelles',
      slots: Array.from({ length: 20 }, () => ({ ...full })),
    };
    player.talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'question' };
    player.gesture = { clip: 'reach-up', target: 'pommier', until: 999_999, long: false };
  }
  const place = currentPlace(sim.world);
  for (let i = 0; i < 80; i++)
    place.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 12.345, y: 23.456 });
  for (let i = 0; i < 200; i++) {
    place.placed.push({ id: `pose-${String(i)}`, type: 'banc', x: 12.5, y: 23.5, rotation: 1 });
    place.objects[`pose-${String(i)}`] = { sit: [0, 1] };
  }
  const progress = sim.world.progress;
  // Bien au-delà du budget d'une tranche entière (300 faits): le découpage doit tenir quand même.
  for (let i = 0; i < 600; i++)
    progress.memory[`essai-gare.sujet-${String(i)}.detail`] = {
      v: `valeur-${String(i)}`,
      by: 'duo',
      day: 999,
    };
  for (let i = 0; i < 60; i++) progress.bonds[`habitant-${String(i)}`] = 9999;
  for (let i = 0; i < 40; i++)
    progress.quests[`suite-de-quetes-${String(i)}`] = {
      chapter: 'chapitre-final',
      step: 'derniere-etape',
      done: true,
    };
  for (let i = 0; i < 8; i++)
    progress.collections[`collection-${String(i)}`] = Array.from(
      { length: 40 },
      (_, n) => `entree-${String(n)}`,
    );
  return sim;
}

function pair(sim: Sim, conditions: Conditions, advance?: Parameters<typeof createHost>[4]) {
  const clock = { now: 0 };
  const link = createVirtualLink(conditions, 11, () => clock.now);
  const log = memoryLog();
  const host = createHost(sim, link.host, log, 0, advance);
  const guest = createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
  host.sendAll();
  return {
    host,
    guest,
    log,
    link,
    run(steps: number, each?: () => void): void {
      for (let i = 0; i < steps; i++) {
        clock.now += 1000 / 30;
        link.deliver(clock.now);
        host.step(idleInput(0));
        guest.step(idleInput(i + 1));
        link.deliver(clock.now);
        each?.();
      }
    },
  };
}

let MEASURED: Record<string, number> = {};

describe('garde de taille', () => {
  afterAll(() => {
    process.stdout.write(
      `plus gros messages envoyés au pire (octets): ${JSON.stringify(MEASURED)}\n`,
    );
  });

  it('chaque message réellement envoyé tient son budget sur l’état au pire, et l’invité le reçoit entier', () => {
    const sim = worstCase();
    const progressBytes = byteLength(sim.world.progress);
    // L'état au pire dépasse ce qu'une tranche entière pourrait porter: seul le découpage le fait passer.
    expect(progressBytes).toBeGreaterThan(BUDGET_BYTES.progress);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
    const { host, guest, log } = pair(sim, { latencyMs: 20, jitterMs: 5, lossPercent: 0 });
    // Une écriture de mémoire après le départ: elle part en différence, pas en tranche entière.
    sim.world.progress.memory['essai-gare.nouveau.fait'] = { v: true, by: 0, day: 3 };
    sim.revisions.progress += 1;
    for (let i = 0; i < 20; i++) host.step(idleInput(0));
    expect(log.entries.filter((e) => e.level === 'error')).toEqual([]);
    const largest = host.stats().largest;
    for (const [channel, bytes] of Object.entries(largest)) {
      const budget =
        channel === 'progressPart'
          ? PROGRESS_PART_BUDGET_BYTES
          : BUDGET_BYTES[channel as keyof typeof BUDGET_BYTES];
      expect(bytes, channel).toBeLessThanOrEqual(budget);
      expect(budget, channel).toBeLessThanOrEqual(SDK_LIMIT / 2);
    }
    MEASURED = { ...largest, progressEntiere: progressBytes };
    guest.dispose();
    host.dispose();
  });

  it('assemble l’état au pire chez l’invité, identique à l’hôte', () => {
    const sim = worstCase();
    const duo = pair(sim, { latencyMs: 20, jitterMs: 5, lossPercent: 5 });
    duo.run(20);
    sim.world.progress.memory['essai-gare.nouveau.fait'] = { v: 2, by: 1, day: 4 };
    Reflect.deleteProperty(sim.world.progress.bonds, 'habitant-3');
    sim.revisions.progress += 1;
    duo.run(30);
    expect(duo.guest.world()?.progress).toEqual(sim.world.progress);
    expect(duo.guest.world()?.places['essai-gare']?.placed).toHaveLength(200);
    expect(duo.log.entries.filter((e) => e.level === 'error')).toEqual([]);
  });
});

describe('progression par différences et par morceaux', () => {
  it('une petite écriture part en un petit morceau, rattaché à la révision précédente', () => {
    const before = worstCase().world.progress;
    const after = cloneProgress(before);
    after.bonds['habitant-1'] = 3;
    const parts = progressParts(before, after, 5, 4, 100, NET_SETTINGS.progress.partBytes);
    expect(parts).toHaveLength(1);
    expect(parts[0]?.base).toBe(4);
    expect(byteLength(parts[0])).toBeLessThan(300);
    const full = progressParts(null, before, 4, 3, 90, NET_SETTINGS.progress.partBytes);
    expect(full.length).toBeGreaterThan(1);
    for (const part of full)
      expect(byteLength(part)).toBeLessThanOrEqual(PROGRESS_PART_BUDGET_BYTES);
    const guest = createProgressAssembler();
    let done = null;
    for (const part of full) done = guest.receive(part);
    expect(done).toEqual(before);
    for (const part of parts) done = guest.receive(part);
    expect(done).toEqual(after);
  });

  it('une différence orpheline attend la prochaine révision complète', () => {
    const base = worstCase().world.progress;
    const next = cloneProgress(base);
    next.opened.push('essai-halte');
    const guest = createProgressAssembler();
    const delta = progressParts(base, next, 2, 1, 10, NET_SETTINGS.progress.partBytes);
    for (const part of delta) expect(guest.receive(part)).toBeNull();
    expect(guest.current()).toBeNull();
    let done = null;
    for (const part of progressParts(null, next, 3, 2, 11, NET_SETTINGS.progress.partBytes))
      done = guest.receive(part);
    expect(done?.opened).toEqual(['essai-gare', 'essai-halte']);
  });
});

describe('bascule de lieu', () => {
  it('les deux côtés basculent ensemble, sans rien de l’ancien lieu dans le nouveau', () => {
    const sim = newSim(content);
    const halte = content.places['essai-halte'];
    if (halte === undefined) throw new Error('lieu essai-halte absent');
    let switchAt = -1;
    const duo = pair(
      sim,
      { latencyMs: 80, jitterMs: 20, lossPercent: 5 },
      {
        advance(s, inputs, intents) {
          step(s, inputs, intents);
          if (s.world.tick !== switchAt) return;
          // Ce que fera le système « voyage » (L2): nouveau lieu, voyage en cours.
          s.world.places['essai-halte'] = createPlaceState(content, halte);
          s.world.common.place = 'essai-halte';
          s.world.common.phase = 'travel';
          s.revisions.common += 1;
          s.revisions.place += 1;
        },
      },
    );
    const hostSwitches: PlaceSwitch[] = [];
    const guestSwitches: { from: string; to: string }[] = [];
    duo.host.onPlaceSwitch((c) => hostSwitches.push(c));
    duo.guest.onPlaceSwitch((c) => guestSwitches.push(c));
    duo.run(30);
    expect(duo.guest.placeStatus()).toEqual({ kind: 'settled', place: 'essai-gare' });
    switchAt = sim.world.tick + 1;
    const seen = new Set<string>();
    duo.run(60, () => {
      const w = duo.guest.render(0, 0);
      if (w === null) return;
      const id = w.common.place;
      // Toujours un état cohérent: le lieu courant, et lui seul, avec ses propres habitants.
      expect(Object.keys(w.places)).toEqual([id]);
      const order = content.places[id]?.villagers.map((d) => d.id) ?? [];
      expect(Object.keys(w.places[id]?.villagers ?? {})).toEqual(order);
      seen.add(`${id}:${duo.guest.placeStatus().kind}`);
    });
    expect(hostSwitches).toEqual([{ from: 'essai-gare', to: 'essai-halte', tick: switchAt }]);
    expect(guestSwitches).toEqual([{ from: 'essai-gare', to: 'essai-halte' }]);
    expect(duo.guest.placeStatus()).toEqual({ kind: 'settled', place: 'essai-halte' });
    // Le lieu change d'une image à l'autre: jamais d'image avec le nouveau lieu incomplet.
    expect([...seen].filter((s) => s.startsWith('essai-halte'))).toEqual(['essai-halte:settled']);
    expect(seen.has('essai-gare:settled')).toBe(true);
    const villagers = duo.guest.world()?.places['essai-halte']?.villagers;
    expect(villagers).toEqual(sim.world.places['essai-halte']?.villagers);
  });
});

describe('reprise de la liaison', () => {
  it('après une coupure, l’hôte renvoie tout et l’invité rattrape, progression comprise', () => {
    const sim = newSim(content);
    const duo = pair(sim, { latencyMs: 20, jitterMs: 5, lossPercent: 0 });
    duo.run(20);
    duo.link.cut(true);
    sim.world.progress.bonds['cheffe-de-gare'] = 4;
    sim.revisions.progress += 1;
    sim.world.players[1].money = 77;
    sim.revisions.players += 1;
    duo.run(20);
    duo.link.cut(false);
    expect(duo.guest.world()?.progress.bonds['cheffe-de-gare']).toBeUndefined();
    duo.host.resume();
    duo.guest.resume();
    duo.run(10);
    expect(duo.guest.world()?.progress).toEqual(sim.world.progress);
    expect(duo.guest.world()?.players[1].money).toBe(77);
  });
});
