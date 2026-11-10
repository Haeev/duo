// État du lieu par différences et par morceaux (mission M3): tailles au pire d'Aubrune, ordre et
// idempotence, système factice transmis sans code, débit d'une minute chargée.
import type { Net, NetChannel } from '@duo/sdk';
import * as v from 'valibot';
import { afterAll, describe, expect, it } from 'vitest';
import { PLACE_BRICK_OBJECTS_MAX } from '../src/donnees/schemas/lieu';
import { PlaceSlowSchema } from '../src/etat/lieu';
import { BUDGET_BYTES } from '../src/reseau/canaux';
import { createPlaceAssembler, PLACE_PART_BUDGET_BYTES } from '../src/reseau/etat-lieu';
import { createGuest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { cloneDoc, createKeyedAssembler, keyedParts, type KeyedPart } from '../src/reseau/par-cles';
import { NET_SETTINGS } from '../src/reseau/reglages';
import { byteLength, currentPlace, fastMessage, sliceMessage } from '../src/reseau/tranches';
import { idleInput } from '../src/simulation/noyau/entrees';
import type { Sim } from '../src/simulation/noyau/pas';
import { gameContent, MEMBERS, newSim } from './aides';
import { createVirtualLink, fakeAdvance, memoryLog } from './aides-reseau';

const content = gameContent();
const PART_BYTES = NET_SETTINGS.place.partBytes;

/** Le pire d'un grand lieu (même recette que `grands-lieux.test.ts`), habitants avec leur vie. */
function aubruneWorst(): Sim {
  const sim = newSim(content);
  const place = currentPlace(sim.world);
  for (let i = 0; i < PLACE_BRICK_OBJECTS_MAX; i++)
    place.objects[`cueillette-du-verger-${String(i)}`] =
      i % 40 === 0
        ? { store: Array.from({ length: 40 }, () => ({ item: 'planche', count: 99 })) }
        : { gather: { left: 3, refillAt: 1_234_567 } };
  for (let i = 0; i < 80; i++)
    place.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 287.123, y: 199.456 });
  for (let i = 0; i < 200; i++)
    place.placed.push({ id: `pose-${String(i)}`, type: 'banc', x: 312.5, y: 203.5, rotation: 1 });
  place.nextPlacedId = 200;
  place.nextGroundId = 80;
  for (let i = 0; i < 32; i++)
    place.villagers[`habitant-${String(i)}`] = {
      met: [true, true],
      talkingWith: null,
      life: {
        presence: 'here',
        entry: 3,
        activity: 'balayer-le-perron',
        pose: 'stand',
        gesture: 'balayer',
        seat: null,
        emote: null,
        emoteUntil: 0,
        gaze: null,
      },
      body: { x: 319.123456789, y: 207.98765432, facing: -3.14159265358, speed: 2.718281828 },
    };
  place.shops = {};
  for (let i = 0; i < 6; i++)
    place.shops[`commerce-${String(i)}`] = {
      day: 12,
      spent: 4_500,
      sold: Object.fromEntries(
        Array.from({ length: 20 }, (_, n) => [`article-${String(n)}`, [10, 3]]),
      ),
    };
  return sim;
}

function head(
  rev: number,
  baseRev: number,
): {
  target: string;
  rev: number;
  baseRev: number;
  tick: number;
} {
  return { target: 'essai-gare', rev, baseRev, tick: rev };
}

describe('état du lieu par morceaux', () => {
  it('au pire d’Aubrune, chaque morceau tient son budget et l’invité reconstruit l’état exact', () => {
    const sim = aubruneWorst();
    const state = sliceMessage(sim.world, 'place').place;
    expect(byteLength(state)).toBeGreaterThan(BUDGET_BYTES.place);
    const { parts, full } = keyedParts(null, state, head(0, -1), PART_BYTES);
    expect(full).toBe(true);
    for (const part of parts) expect(byteLength(part)).toBeLessThanOrEqual(PLACE_PART_BUDGET_BYTES);
    const assembler = createPlaceAssembler();
    let done = null;
    for (const part of parts)
      done = assembler.receive(JSON.parse(JSON.stringify(part)) as KeyedPart);
    expect(done?.state).toEqual(state);
    process.stdout.write(
      `lieu au pire d’Aubrune: ${String(byteLength(state))} octets en ${String(parts.length)} morceaux (plus gros ${String(Math.max(...parts.map(byteLength)))})\n`,
    );
  });

  it('n’envoie que les entités modifiées, dans l’ordre de la liste, et s’applique une seule fois', () => {
    const sim = aubruneWorst();
    const before = cloneDoc(sliceMessage(sim.world, 'place').place);
    const place = currentPlace(sim.world);
    const gather = place.objects['cueillette-du-verger-1'];
    if (gather?.gather !== undefined) gather.gather.left = 2;
    place.ground.shift();
    place.ground.push({ id: 80, stack: { item: 'planche', count: 1 }, x: 1, y: 2 });
    place.nextGroundId = 81;
    Reflect.deleteProperty(place.villagers, 'habitant-4');
    const after = sliceMessage(sim.world, 'place').place;
    const diff = keyedParts(before, after, head(1, 0), PART_BYTES);
    expect(diff.full).toBe(false);
    expect(diff.parts).toHaveLength(1);
    expect(diff.parts[0]?.ops.map((op) => `${op[0]}:${op[2]}:${String(op.length)}`)).toEqual([
      'objects:cueillette-du-verger-1:4',
      'ground:80:4',
      'ground:0:3',
      'nextGroundId::4',
      'villagers:habitant-4:3',
    ]);
    expect(byteLength(diff.parts[0])).toBeLessThan(600);

    const assembler = createPlaceAssembler();
    for (const part of keyedParts(null, before, head(0, -1), PART_BYTES).parts)
      assembler.receive(part);
    const [part] = diff.parts;
    if (part === undefined) throw new Error('morceau absent');
    expect(assembler.receive(part)?.state).toEqual(after);
    // Le même morceau reçu deux fois ne change rien (idempotent).
    expect(assembler.receive(part)).toBeNull();
    expect(assembler.current()?.state).toEqual(after);
  });

  it('une liste réordonnée part complète; une différence orpheline attend la complète', () => {
    const sim = aubruneWorst();
    const before = cloneDoc(sliceMessage(sim.world, 'place').place);
    currentPlace(sim.world).placed.reverse();
    const after = sliceMessage(sim.world, 'place').place;
    expect(keyedParts(before, after, head(1, 0), PART_BYTES).full).toBe(true);

    const assembler = createPlaceAssembler();
    const orphan = keyedParts(before, after, head(5, 4), PART_BYTES);
    // Une différence (forcée) sans sa révision de départ: ignorée.
    const small = keyedParts(before, { ...before, nextPlacedId: 999 }, head(5, 4), PART_BYTES);
    expect(small.full).toBe(false);
    for (const part of small.parts) expect(assembler.receive(part)).toBeNull();
    for (const part of orphan.parts) assembler.receive(part);
    expect(assembler.current()?.state).toEqual(after);
  });

  it('un système factice qui ajoute son état par lieu est transmis sans rien coder de plus', () => {
    // Le système déclare son champ dans le schéma du lieu (ici un schéma étendu) et l'écrit: c'est tout.
    const FakeSchema = v.strictObject({
      ...PlaceSlowSchema.entries,
      ruches: v.exactOptional(
        v.record(v.string(), v.strictObject({ miel: v.number(), essaim: v.boolean() })),
      ),
      lanternes: v.exactOptional(v.array(v.strictObject({ id: v.string(), allumee: v.boolean() }))),
      brume: v.exactOptional(v.number()),
    });
    const base = sliceMessage(newSim(content).world, 'place').place;
    const one = {
      ...base,
      ruches: { 'ruche-du-verger': { miel: 3, essaim: false } },
      lanternes: [{ id: 'lanterne-a', allumee: false }],
      brume: 0.5,
    };
    const two = {
      ...one,
      ruches: { ...one.ruches, 'ruche-du-moulin': { miel: 0, essaim: true } },
      lanternes: [{ id: 'lanterne-a', allumee: true }],
    };
    const assembler = createKeyedAssembler(FakeSchema);
    for (const part of keyedParts(null, one, head(0, -1), PART_BYTES).parts)
      assembler.receive(part);
    expect(assembler.current()?.state).toEqual(one);
    const diff = keyedParts(one, two, head(1, 0), PART_BYTES);
    expect(diff.parts[0]?.ops).toEqual([
      ['ruches', 'd', 'ruche-du-moulin', { miel: 0, essaim: true }],
      ['lanternes', 'l', 'lanterne-a', { id: 'lanterne-a', allumee: true }],
    ]);
    for (const part of diff.parts) assembler.receive(part);
    expect(assembler.current()?.state).toEqual(two);
    // Champ retiré: il disparaît aussi chez l'invité.
    const three: Partial<typeof two> = { ...two };
    delete three.brume;
    for (const part of keyedParts(two, three, head(2, 1), PART_BYTES).parts)
      assembler.receive(part);
    expect(assembler.current()?.state).toEqual(three);
  });
});

/** `Net` qui compte les octets envoyés par canal. */
function counting(net: Net, sent: Record<number, number>): Net {
  return {
    ...net,
    channel(id, options) {
      const inner = net.channel(id, options);
      const wrapped: NetChannel<v.InferOutput<typeof options.schema>> = {
        id: inner.id,
        send(message) {
          sent[id] = (sent[id] ?? 0) + byteLength(message);
          inner.send(message);
        },
        onMessage: (listener) => inner.onMessage(listener),
      };
      return wrapped;
    },
  };
}

let DEBIT: Record<string, string> = {};

describe('débit d’une minute chargée au pire d’Aubrune', () => {
  afterAll(() => {
    process.stdout.write(`débit (Ko/s): ${JSON.stringify(DEBIT)}\n`);
  });

  it('reste sous 30 Ko par seconde, l’invité à l’identique de l’hôte', () => {
    const sim = aubruneWorst();
    const clock = { now: 0 };
    const link = createVirtualLink(
      { latencyMs: 80, jitterMs: 20, lossPercent: 2 },
      7,
      () => clock.now,
    );
    const sent: Record<number, number> = {};
    const log = memoryLog();
    const host = createHost(sim, counting(link.host, sent), log, 0, { advance: busyAdvance });
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now: () => clock.now });
    host.sendAll();
    const TICKS = 30 * 60;
    for (let i = 0; i < TICKS; i++) {
      clock.now += 1000 / 30;
      link.deliver(clock.now);
      host.step(idleInput(i));
      guest.step(idleInput(i + 1));
    }
    clock.now += 2000;
    link.deliver(clock.now);
    expect(log.entries.filter((e) => e.level === 'error')).toEqual([]);
    const id = sim.world.common.place;
    expect(guest.world()?.places[id]?.objects).toEqual(currentPlace(sim.world).objects);
    expect(guest.world()?.places[id]?.ground).toEqual(currentPlace(sim.world).ground);
    expect(guest.world()?.places[id]?.shops).toEqual(currentPlace(sim.world).shops);
    const perSecond = (bytes: number): number => bytes / 1024 / 60;
    const total = Object.values(sent).reduce((a, b) => a + b, 0);
    const place = sent[5] ?? 0;
    // Le canal rapide au pire d'un grand lieu: 32 habitants en marche, coordonnées au centième
    // comme les envoie `fastMessage`, 30 fois par seconde (le lieu d'essai n'en a que quelques-uns).
    const fastWorst = {
      ...fastMessage(sim.world, content, 123_456),
      villagers: Array.from({ length: 32 }, (): [number, number, number, number] => [
        319.12, 207.99, -3.14, 2.72,
      ]),
    };
    const fastWorstPerSecond = (byteLength(fastWorst) * 30) / 1024;
    const worstTotal = perSecond(total - (sent[2] ?? 0)) + fastWorstPerSecond;
    const rows: [string, string][] = Object.entries(sent).map(([channel, bytes]) => [
      `canal ${channel}`,
      perSecond(bytes).toFixed(2),
    ]);
    rows.push(['total', perSecond(total).toFixed(2)]);
    rows.push(['canal 2 avec 32 habitants', fastWorstPerSecond.toFixed(2)]);
    rows.push(['total avec 32 habitants', worstTotal.toFixed(2)]);
    DEBIT = Object.fromEntries(rows);
    expect(perSecond(place)).toBeLessThan(30);
    expect(worstTotal).toBeLessThan(45);
  });
});

/**
 * Une minute chargée: deux cueillettes par seconde, un objet au sol posé et le plus ancien rangé
 * chaque seconde, une vente par seconde, la vie de 8 habitants qui change chaque seconde, et à
 * la 30e seconde le réassort de tous les meubles d'un coup (l'aube: la plus grosse différence).
 */
function busyAdvance(...args: Parameters<typeof fakeAdvance>): void {
  const [sim] = args;
  fakeAdvance(...args);
  const tick = sim.world.tick;
  const place = currentPlace(sim.world);
  let touched = false;
  if (tick % 15 === 0) {
    const object = place.objects[`cueillette-du-verger-${String(1 + ((tick / 15) % 399))}`];
    if (object?.gather !== undefined) object.gather.left = (object.gather.left + 1) % 4;
    touched = true;
  }
  if (tick % 30 === 0) {
    place.ground.shift();
    place.ground.push({
      id: place.nextGroundId,
      stack: { item: 'planche', count: 1 + (tick % 9) },
      x: 100.25,
      y: 80.5,
    });
    place.nextGroundId += 1;
    const shop = place.shops?.[`commerce-${String((tick / 30) % 6)}`];
    if (shop !== undefined) shop.spent += 120;
    for (let n = 0; n < 8; n++) {
      const life = place.villagers[`habitant-${String((tick / 30 + n * 4) % 32)}`]?.life;
      if (life !== undefined) {
        life.gaze = life.gaze === null ? 0 : null;
        life.emote = life.emote === null ? 'note' : null;
        life.emoteUntil = tick + 45;
      }
    }
    touched = true;
  }
  if (tick === 900) {
    for (const object of Object.values(place.objects))
      if (object.gather !== undefined) object.gather = { left: 3, refillAt: null };
    touched = true;
  }
  if (touched) sim.revisions.place += 1;
}
