// Commande de l'invité devinée par l'hôte quand elle manque au pas (revue de robustesse du tour 2,
// risque C): le déplacement se devine, pas Espace tenu, qui pourrait lancer un geste de trop.
// Seule exception: tenir la poutre déjà portée, qu'un pas relâché ferait tomber.
import type { NetChannel } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import type { ControlFrame, Intent } from '../src/etat/actions';
import type { Vec2, WorldEvent } from '../src/etat/types';
import { createHost, type HostChannels } from '../src/reseau/hote';
import { CHANNEL, type GuestInput } from '../src/reseau/schemas';
import { SIM_HZ } from '../src/simulation/constantes';
import { character, type Sim } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { createRobot, newSim, play } from './aides';

function silent<T>(id: number): NetChannel<T> {
  return { id, send: () => undefined, onMessage: () => () => undefined };
}

interface HostBench {
  sim: Sim;
  /** Remet un message de l'invité à l'hôte (le réseau, sans délai). */
  deliver(frames: ControlFrame[], intents?: Intent[]): void;
  /** Un pas de l'hôte (son joueur immobile, Espace tenu si `hostHeld`); renvoie les événements du pas. */
  step(hostHeld?: boolean): readonly WorldEvent[];
}

/** Jour 1, scène finie, le robot arrêté; l'invité joue `p2`. */
function hostAtDay(): HostBench {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  let listener: ((message: GuestInput) => void) | null = null;
  const input: NetChannel<GuestInput> = {
    id: CHANNEL.guestInput,
    send: () => undefined,
    onMessage(l) {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const channels: HostChannels = { input, world: silent(CHANNEL.world), fast: silent(CHANNEL.fast), events: silent(CHANNEL.events) };
  const host = createHost(sim, channels, 'p1', 'p2');
  return {
    sim,
    deliver(frames, intents = []) {
      listener?.({ frames, intents });
    },
    step(hostHeld = false) {
      return host.step({ seq: 0, moveX: 0, moveY: 0, actHeld: hostHeld });
    },
  };
}

/** Sacha (l'invité) à l'ouest de la rangée y = 29 du potager, face à l'est, houe en main. */
function sachaAtGarden(bench: HostBench): void {
  const { sim } = bench;
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, 'p1'), counter);
  const c = character(sim, 'p2');
  placeCharacter(sim, c, { x: 7.5, y: 29.5 });
  c.facing = 0;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  const slot = c.bag.findIndex((s) => s?.item === 'hoe');
  if (slot < 0) throw new Error('houe absente');
  c.selected = slot;
  for (const g of sim.world.garden) {
    g.soil = 'grass';
    g.crop = null;
  }
  bench.step();
}

/**
 * Sacha bêche, longe la rangée Espace tenu, relâche Espace au pas `release` et continue de marcher.
 * `late`: les commandes du relâchement et les suivantes manquent pendant ce nombre de pas, puis
 * arrivent d'un coup. Renvoie les cases bêchées.
 */
function tillAlongRow(release: number, late: number): string[] {
  const bench = hostAtDay();
  sachaAtGarden(bench);
  const total = SIM_HZ * 3;
  const frame = (seq: number): ControlFrame => ({ seq, moveX: seq === 1 ? 0 : 1, moveY: 0, actHeld: seq < release });
  const events: WorldEvent[] = [];
  const held: ControlFrame[] = [];
  for (let seq = 1; seq <= total; seq++) {
    const f = frame(seq);
    if (late > 0 && seq >= release && seq < release + late) held.push(f);
    else {
      if (held.length > 0) bench.deliver(held.splice(0, held.length));
      bench.deliver([f], seq === 1 ? [{ type: 'act' }] : []);
    }
    events.push(...bench.step());
  }
  return events.flatMap((e) => (e.type === 'tilled' && e.by === 'p2' ? [`${e.cell.cx},${e.cell.cy}`] : []));
}

describe("hôte: commande de l'invité devinée quand elle manque", () => {
  it('Espace relâché, commande en retard: aucun geste de plus que sans retard', () => {
    const extra: string[] = [];
    for (let release = 4; release <= 60; release += 2) {
      const onTime = tillAlongRow(release, 0);
      for (const late of [1, 3, 6]) {
        const delayed = tillAlongRow(release, late);
        if (delayed.length > onTime.length) extra.push(`relâché au pas ${release}, ${late} en retard: ${delayed.join(' ')} au lieu de ${onTime.join(' ')}`);
      }
    }
    expect(extra).toEqual([]);
  });

  it("la poutre portée à deux ne tombe pas quand une commande de l'invité manque", () => {
    const bench = hostAtDay();
    const { sim } = bench;
    const beam = sim.world.beam;
    if (beam === null) throw new Error('poutre absente');
    const side = (dx: number): Vec2 => ({ x: beam.pos.x + dx, y: beam.pos.y });
    placeCharacter(sim, character(sim, 'p1'), side(-1));
    placeCharacter(sim, character(sim, 'p2'), side(1));
    for (const id of ['p1', 'p2'] as const) character(sim, id).action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
    const events: WorldEvent[] = [];
    // Les deux tiennent Espace; les commandes 10 à 12 de l'invité manquent, puis arrivent d'un coup.
    const held: ControlFrame[] = [];
    for (let seq = 1; seq <= SIM_HZ; seq++) {
      const f: ControlFrame = { seq, moveX: 0, moveY: 0, actHeld: true };
      if (seq >= 10 && seq <= 12) held.push(f);
      else {
        if (held.length > 0) bench.deliver(held.splice(0, held.length));
        bench.deliver([f]);
      }
      events.push(...bench.step(true));
      if (seq === 5) expect(beam.carried).toBe(true);
    }
    expect(beam.carried).toBe(true);
    expect(events.filter((e) => e.type === 'beam_dropped')).toEqual([]);
  });
});
