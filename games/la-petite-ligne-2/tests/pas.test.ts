// Le pas de simulation du socle: vide de règles, mais déterministe, horodaté et conforme au schéma d'état.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { WorldSchema } from '../src/etat/monde';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import { idleInput, IntentSchema } from '../src/simulation/noyau/entrees';
import { GameEventSchema } from '../src/simulation/noyau/evenements';
import { fingerprint, step } from '../src/simulation/noyau/pas';
import { SYSTEMS } from '../src/simulation/noyau/systemes';
import { gameContent, MEMBERS, newSim } from './aides';

const content = gameContent();

function run(sim: ReturnType<typeof newSim>, steps: number): void {
  for (let i = 0; i < steps; i++) step(sim, [idleInput(i), idleInput(i)], []);
}

describe('pas de simulation vide', () => {
  it('part d’un monde conforme au schéma, les deux joueurs à la descente du train', () => {
    const sim = newSim(content);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
    expect(sim.world.common.place).toBe('essai-gare');
    expect(sim.world.players.map((p) => p.member)).toEqual(['membre-a', 'membre-b']);
    expect(sim.world.players[0].toolbar).toHaveLength(5);
    expect(sim.world.players[0].bag).toBeNull();
    expect(sim.world.places['essai-gare']?.objects.pommier).toEqual({
      gather: { left: 3, refillAt: null },
    });
    expect(sim.world.places['essai-gare']?.objects.pompe).toEqual({});
  });

  it('avance le pas et l’heure: une heure de jeu en 125 secondes', () => {
    const sim = newSim(content);
    const before = sim.world.minutes;
    run(sim, 125 * SIM_HZ);
    expect(sim.world.tick).toBe(125 * SIM_HZ);
    expect(sim.world.minutes - before).toBeCloseTo(60, 6);
    expect(sim.events).toEqual([]);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
  });

  it('change de jour à l’aube et marque la tranche « commun »', () => {
    const sim = newSim(content);
    sim.world.minutes = content.settings.clock.dayStart - 0.01;
    const revision = sim.revisions.common;
    run(sim, SIM_HZ);
    expect(sim.world.common.day).toBe(2);
    expect(sim.revisions.common).toBe(revision + 1);
  });

  it('passe minuit sans sortir de la journée', () => {
    const sim = newSim(content);
    sim.world.minutes = 1439.99;
    run(sim, SIM_HZ);
    expect(sim.world.minutes).toBeLessThan(1);
    expect(sim.world.common.day).toBe(1);
  });

  it('est déterministe: même graine et mêmes entrées, même empreinte', () => {
    const a = newSim(content);
    const b = newSim(content);
    run(a, 300);
    run(b, 300);
    expect(fingerprint(a.world)).toBe(fingerprint(b.world));
    expect(fingerprint(newSim(content, 8).world)).not.toBe(fingerprint(newSim(content, 7).world));
  });

  it('branche un système par lot, chacun sous son nom de dossier', () => {
    expect(SYSTEMS.map((s) => s.id)).toEqual([
      'voyage',
      'briques',
      'sac',
      'commerces',
      'besoins',
      'dialogues',
      'outils',
      'cultures',
      'habitants',
      'quetes',
      'scenes',
      'cuisine',
    ]);
  });
});

describe('unions extensibles', () => {
  it('acceptent une intention de chaque lot et refusent un type inconnu', () => {
    const intents = [
      { type: 'act' },
      { type: 'select_slot', slot: null },
      { type: 'use_brick', target: 'pommier', brick: 'gather' },
      { type: 'store_put', target: 'pose-3', from: { area: 'bag', index: 2 } },
      { type: 'board', to: 'essai-halte' },
      { type: 'place_loaded', place: 'essai-halte' },
      { type: 'eat', from: { area: 'toolbar', index: 0 } },
      { type: 'move_stack', from: { area: 'toolbar', index: 0 }, to: { area: 'bag', index: 3 } },
      { type: 'talk_choose', option: 'oui' },
    ];
    for (const intent of intents)
      expect(v.safeParse(IntentSchema, intent).success, JSON.stringify(intent)).toBe(true);
    expect(v.safeParse(IntentSchema, { type: 'tricher' }).success).toBe(false);
    expect(v.safeParse(IntentSchema, { type: 'act', extra: 1 }).success).toBe(false);
  });

  it('acceptent un événement de chaque lot', () => {
    const events = [
      { type: 'gesture_started', player: 0, clip: 'pickup', target: 'pommier' },
      { type: 'refused', player: 1, reason: 'poches-pleines', target: null },
      { type: 'brick_used', player: 0, target: 'banc', brick: 'sit' },
      { type: 'train_departed', from: 'essai-gare', to: 'essai-halte' },
      { type: 'need_tier', player: 0, need: 'hunger', state: 'low' },
      { type: 'pockets_full', player: 1, item: 'pomme' },
      { type: 'talk_started', player: 0, villager: 'cheffe-de-gare', dialogue: 'accueil' },
    ];
    for (const event of events)
      expect(v.safeParse(GameEventSchema, event).success, JSON.stringify(event)).toBe(true);
  });
});

describe('sauvegarde', () => {
  it('se relit à l’identique après un passage en JSON', () => {
    const sim = newSim(content);
    run(sim, 90);
    const snapshot = snapshotOf(sim.world);
    expect(snapshot.label).toBe('Jour 1, 10 h 01');
    const loaded = {
      dataSchema: snapshot.dataSchema,
      data: JSON.parse(JSON.stringify(snapshot.data)) as unknown,
    };
    const restored = restoreWorld(content, loaded, [MEMBERS[1], MEMBERS[0]]);
    expect(restored.ok && fingerprint(restored.world)).toBe(fingerprint(sim.world));
  });

  it('dit pourquoi elle refuse: autre format, état abîmé, autre duo', () => {
    const data = JSON.parse(JSON.stringify(newSim(content).world)) as Record<string, unknown>;
    expect(restoreWorld(content, { dataSchema: 15, data }, MEMBERS)).toMatchObject({
      ok: false,
      reason: 'format 15, plus récent que 1',
    });
    expect(
      restoreWorld(content, { dataSchema: 1, data: { ...data, minutes: 'midi' } }, MEMBERS),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/^minutes/) as unknown });
    expect(
      restoreWorld(content, { dataSchema: 1, data }, [
        { id: 'autre', name: 'Zoé' },
        { id: 'encore', name: 'Léo' },
      ]),
    ).toMatchObject({ ok: false, reason: 'sauvegarde d’un autre duo' });
  });
});
