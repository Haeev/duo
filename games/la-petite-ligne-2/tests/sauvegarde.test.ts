// Sauvegarde et reprise: format versionné, migrations, refus polis, règle de l'invité, déclencheur,
// tailles et durées au pire, et un aller-retour complet par le faux hôte du SDK.
import { createMemoryStore, startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { DATA_SCHEMA, WorldSchema } from '../src/etat/monde';
import { createSaveTrigger, wantsSave } from '../src/sauvegarde/declencheur';
import { MIGRATIONS, readSave, STAGE_FLOOR, type MigrationTable } from '../src/sauvegarde/format';
import { labelOf, restoreWorld, snapshotOf, summaryOf } from '../src/sauvegarde/sauvegarde';
import { createSession } from '../src/session';
import { idleInput } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { fingerprint } from '../src/simulation/noyau/pas';
import { gameContent, MEMBERS } from './aides';
import { livedWorld, referenceSave, worstWorld } from './aides-sauvegarde';

const content = gameContent();
const SAVE_BUDGET = 512 * 1024;

function viaJson(world: unknown): unknown {
  return JSON.parse(JSON.stringify(world));
}

describe('format et migrations', () => {
  it('range une sauvegarde de référence par version, relue par la lecture courante', () => {
    for (let version = STAGE_FLOOR; version <= DATA_SCHEMA; version++) {
      const read = readSave(referenceSave(version));
      expect(read.ok, `sauvegarde-v${version}.json`).toBe(true);
      if (version < DATA_SCHEMA)
        expect(MIGRATIONS[version], `migration ${version} vers ${version + 1}`).toBeTypeOf(
          'function',
        );
    }
  });

  it('reprend la référence courante: position, sac, argent, besoins, quêtes, faits, lieux', () => {
    const ref = referenceSave(DATA_SCHEMA);
    const restored = restoreWorld(content, ref, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const { world } = restored;
    expect(world.players[0].money).toBe(4250);
    expect(world.players[0].toolbar[0]).toEqual({ item: 'buche', count: 3 });
    expect(world.players[0].needs.sleep).toBe(55.5);
    expect(world.players[1].body).toEqual({ x: 4.5, y: 6.25, facing: 1.5, speed: 0 });
    expect(world.progress.quests.arrivee?.step).toBe('quai');
    expect(world.progress.memory['essai-gare.pomme.cueillie']?.v).toBe(true);
    expect(world.common).toMatchObject({ place: 'essai-halte', day: 3, chest: 1500 });
    expect(world.places['essai-gare']?.leftOn).toBe(3);
    expect(world.places['essai-halte']?.leftOn).toBeNull();
    expect(world.minutes).toBe(14 * 60 + 5);
  });

  it('enchaîne les migrations dans l’ordre, et refuse proprement quand une manque ou plante', () => {
    const one = (d: unknown): unknown => ({ ...(d as object), a: 1 });
    const seen: unknown[] = [];
    const spy: MigrationTable = {
      1: one,
      2: (d) => {
        const out = { ...(d as object), b: 2 };
        seen.push(out);
        return out;
      },
    };
    // La version 3 fictive n'a pas le schéma du monde: la chaîne passe, c'est le schéma qui refuse.
    const chained = readSave({ dataSchema: 1, data: {} }, spy, 3, 1);
    expect(seen).toEqual([{ a: 1, b: 2 }]);
    expect(chained).toMatchObject({ ok: false, kind: 'damaged' });
    expect(readSave({ dataSchema: 1, data: {} }, { 1: one }, 3, 1)).toMatchObject({
      ok: false,
      kind: 'damaged',
      reason: 'migration 2 vers 3 absente',
    });
    const boom: MigrationTable = {
      1: () => {
        throw new Error('boum');
      },
    };
    expect(readSave({ dataSchema: 1, data: {} }, boom, 2, 1)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('boum') as unknown,
    });
  });

  it('refuse une étape antérieure et un format plus récent, avec un message clair', () => {
    expect(readSave({ dataSchema: 1, data: {} }, {}, 3, 2)).toMatchObject({
      ok: false,
      kind: 'older-stage',
    });
    const older = restoreWorld(
      content,
      { dataSchema: 0, data: viaJson(livedWorld(content)) },
      MEMBERS,
    );
    expect(older.ok).toBe(false);
    const newer = restoreWorld(
      content,
      { dataSchema: DATA_SCHEMA + 1, data: viaJson(livedWorld(content)) },
      MEMBERS,
    );
    expect(newer).toMatchObject({ ok: false, notice: { kind: 'refused' } });
    if (!newer.ok) expect(newer.notice.message).toMatch(/version plus récente/);
  });
});

describe('tolérance', () => {
  it('refuse sans planter un fichier abîmé ou tronqué', () => {
    const good = JSON.stringify(livedWorld(content));
    const damaged: unknown[] = [
      null,
      undefined,
      42,
      'texte',
      [],
      {},
      JSON.parse(good.replace('"day":3', '"day":"trois"')),
      { ...(JSON.parse(good) as object), places: null },
      { ...(JSON.parse(good) as Record<string, unknown>), extra: 1 },
    ];
    for (const data of damaged) {
      const result = restoreWorld(content, { dataSchema: DATA_SCHEMA, data }, MEMBERS);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.notice.message).toMatch(/abîmée|plus récente|étape/);
    }
    // Tronqué au milieu: le JSON ne se relit pas (couche plateforme); ici, ce qu'on en a pu lire est refusé.
    expect(() => {
      JSON.parse(good.slice(0, good.length / 2));
    }).toThrow();
    const truncated: unknown = null;
    expect(restoreWorld(content, { dataSchema: DATA_SCHEMA, data: truncated }, MEMBERS).ok).toBe(
      false,
    );
    expect(
      restoreWorld(content, { dataSchema: Number.NaN, data: JSON.parse(good) }, MEMBERS).ok,
    ).toBe(false);
  });

  it('refuse un lieu courant que le jeu ne connaît plus', () => {
    const world = viaJson(livedWorld(content)) as ReturnType<typeof livedWorld>;
    world.common.place = 'lieu-disparu';
    const result = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: world }, MEMBERS);
    expect(result).toMatchObject({ ok: false, reason: 'lieu inconnu: lieu-disparu' });
  });
});

describe('reprise', () => {
  it('relit à l’identique, joueurs dans n’importe quel rôle', () => {
    const world = livedWorld(content);
    const snapshot = snapshotOf(world, content);
    const loaded = { dataSchema: snapshot.dataSchema, data: viaJson(snapshot.data) };
    const swapped = restoreWorld(content, loaded, [MEMBERS[1], MEMBERS[0]]);
    expect(swapped.ok && fingerprint(swapped.world)).toBe(fingerprint(world));
    expect(swapped.ok && swapped.notice).toBeNull();
  });

  it('invité différent: il prend la place du personnage absent, apparence à refaire', () => {
    const world = livedWorld(content);
    world.players[1].look = { shape: 'adult-medium', skin: 1, pieces: [] };
    world.players[1].gender = 'f';
    const loaded = { dataSchema: DATA_SCHEMA, data: viaJson(world) };
    const result = restoreWorld(content, loaded, [MEMBERS[0], { id: 'membre-c', name: 'Cléo' }]);
    if (!result.ok) throw new Error(result.reason);
    const taken = result.world.players[1];
    expect(taken).toMatchObject({ member: 'membre-c', name: 'Cléo', look: null, gender: null });
    expect(taken.money).toBe(120);
    expect(taken.body).toEqual({ x: 4.5, y: 6.25, facing: 1.5, speed: 0 });
    expect(result.world.players[0].member).toBe('membre-a');
    expect(result.notice).toEqual({
      kind: 'info',
      message: expect.stringContaining('Cléo prend la place de Bob') as unknown,
    });
    expect(
      restoreWorld(content, loaded, [
        { id: 'x', name: 'X' },
        { id: 'y', name: 'Y' },
      ]).ok,
    ).toBe(false);
  });

  it('un voyage interrompu se termine ou s’annule, gestes et dialogues oubliés', () => {
    const world = livedWorld(content);
    world.common.phase = 'travel';
    world.common.travel = {
      to: 'essai-halte',
      boarded: [true, true],
      loaded: [true, false],
      since: 5,
    };
    world.players[0].gesture = { clip: 'reach-up', target: null, until: 9e9, long: false };
    world.players[1].talk = { villager: 'cheffe-de-gare', dialogue: 'accueil', node: 'question' };
    const result = restoreWorld(
      content,
      { dataSchema: DATA_SCHEMA, data: viaJson(world) },
      MEMBERS,
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.world.common).toMatchObject({ phase: 'day', travel: null });
    expect(result.world.players[0].gesture).toBeNull();
    expect(result.world.players[1].talk).toBeNull();
    expect(result.world.minutes).toBeGreaterThan(14 * 60 + 5);
  });
});

describe('résumé du salon', () => {
  it('dit lieu, jour, heure et personnages en 40 caractères au plus', () => {
    const world = livedWorld(content);
    // Trop long avec les prénoms: ils sautent d'abord.
    expect(snapshotOf(world, content).label).toBe("Halte d'essai, jour 3, 14 h 05");
    expect(labelOf({ ...summaryOf(world, content), place: 'Aubrune' })).toBe(
      'Aubrune, jour 3, 14 h 05 (Ada et Bob)',
    );
    const tight = labelOf({ ...summaryOf(world, content), players: ['Alexandrine', 'Bartholomé'] });
    expect(tight.length).toBeLessThanOrEqual(40);
    expect(tight).toContain('jour 3, 14 h 05');
    const long = labelOf({
      place: 'Un lieu au nom vraiment très long pour un petit train',
      day: 128,
      hours: 9,
      minutes: 5,
      players: ['A', 'B'],
    });
    expect(long.length).toBeLessThanOrEqual(40);
    expect(long).toContain('jour 128, 9 h 05');
    expect(snapshotOf(world).label).toBe('Jour 3, 14 h 05');
  });
});

describe('déclencheur', () => {
  const dawn: GameEvent = { type: 'day_started', day: 2, slept: false };
  const arrived: GameEvent = { type: 'train_arrived', place: 'essai-halte' };

  function harness(statuses: ('ok' | 'write-error')[] = []) {
    const writes: string[] = [];
    const warnings: string[] = [];
    const deferred: (() => void)[] = [];
    const releases: (() => void)[] = [];
    const trigger = createSaveTrigger({
      target: {
        write: (moment) => {
          writes.push(moment);
          const status = statuses.shift() ?? 'ok';
          return new Promise((resolve) => {
            releases.push(() => {
              resolve(status);
            });
          });
        },
      },
      snapshot: () => snapshotOf(livedWorld(content), content),
      warn: (message) => warnings.push(message),
      defer: (run) => deferred.push(run),
    });
    return { trigger, writes, warnings, deferred, releases };
  }

  it('écrit à l’aube et à chaque arrivée, hors du pas, une écriture à la fois', async () => {
    expect(wantsSave(dawn) && wantsSave(arrived)).toBe(true);
    // Au coucher (cahier 4.11): se mettre au lit, pas s'asseoir.
    expect(wantsSave({ type: 'brick_used', player: 0, target: 'lit', brick: 'sleep' })).toBe(true);
    expect(wantsSave({ type: 'brick_used', player: 0, target: 'banc', brick: 'sit' })).toBe(false);
    const h = harness();
    h.trigger.notify([{ type: 'unstuck', player: 0 }]);
    expect(h.deferred).toHaveLength(0);
    h.trigger.notify([dawn, arrived]);
    expect(h.writes).toEqual([]);
    h.deferred.shift()?.();
    expect(h.writes).toEqual(['auto']);
    // Une demande pendant l'écriture attend la fin, puis repart une seule fois.
    h.trigger.notify([arrived]);
    h.deferred.shift()?.();
    expect(h.writes).toHaveLength(1);
    h.releases.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.writes).toHaveLength(2);
    h.releases.shift()?.();
    await h.trigger.idle();
    expect(h.warnings).toEqual([]);
  });

  it('un échec d’écriture est journalisé sans bloquer la suite', async () => {
    const h = harness(['write-error']);
    h.trigger.notify([dawn]);
    h.deferred.shift()?.();
    h.releases.shift()?.();
    await h.trigger.idle();
    expect(h.warnings).toHaveLength(1);
    h.trigger.notify([dawn]);
    h.deferred.shift()?.();
    expect(h.writes).toEqual(['auto', 'auto']);
    const manual = h.trigger.saveNow();
    h.releases.shift()?.();
    h.releases.shift()?.();
    expect(await manual).toBe('ok');
    h.trigger.dispose();
    expect(await h.trigger.saveNow()).toBe('refused');
  });
});

describe('au pire', () => {
  it('reste sous le budget de 512 Ko, s’écrit et se relit vite', () => {
    const world = worstWorld(content, 8);
    expect(Object.keys(world.places)).toHaveLength(10);
    expect(WorldSchema.entries.places).toBeDefined();
    const t0 = performance.now();
    const text = JSON.stringify(snapshotOf(world, content).data);
    const tWrite = performance.now() - t0;
    const bytes = new TextEncoder().encode(text).byteLength;
    const t1 = performance.now();
    const read = readSave({ dataSchema: DATA_SCHEMA, data: JSON.parse(text) });
    const tRead = performance.now() - t1;
    expect(read.ok).toBe(true);
    process.stdout.write(
      `sauvegarde au pire (10 lieux): ${bytes} octets, écriture ${tWrite.toFixed(1)} ms, lecture ${tRead.toFixed(1)} ms\n`,
    );
    expect(bytes).toBeLessThanOrEqual(SAVE_BUDGET);
    // Garde-fou large (machines lentes, CI): la mesure réelle est bien en dessous.
    expect(tWrite).toBeLessThan(250);
    expect(tRead).toBeLessThan(500);
    const typical = new TextEncoder().encode(JSON.stringify(livedWorld(content))).byteLength;
    expect(typical).toBeLessThan(8 * 1024);
  });
});

async function waitForSave<T>(read: () => Promise<T | null>): Promise<T | null> {
  for (let i = 0; i < 100; i++) {
    const found = await read();
    if (found !== null) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  return null;
}

describe('aller-retour par le faux hôte du SDK', () => {
  it('sauvegarde à l’aube et sur demande, puis hôte et invité retrouvent la partie', async () => {
    const store = createMemoryStore();
    const first = await startLocalDuo<GameAction>({ manifest, seed: 5, store });
    const kept = { fingerprint: '' };
    try {
      await first.start();
      const host = createSession({ duo: first.hostGame, content });
      expect(host.notice).toBeNull();
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans simulation');
      sim.world.minutes = 359.99;
      sim.world.players[0].money = 777;
      sim.world.progress.quests.arrivee = { chapter: 'prologue', step: 'quai', done: false };
      sim.revisions.players += 1;
      for (let i = 1; i <= 3; i++) host.step(idleInput(i));
      expect(sim.world.common.day).toBe(2);
      // L'écriture de l'aube part après le pas, pas dedans.
      expect(await store.read(manifest.id, 1)).toBeNull();
      // Attente bornée plutôt qu'un délai fixe: sous la charge de la suite complète, l'écriture
      // asynchrone dépasse parfois 20 ms.
      const dawnSave = await waitForSave(() => store.read(manifest.id, 1));
      expect(dawnSave).not.toBeNull();
      expect(dawnSave?.moment).toBe('auto');
      expect(dawnSave?.label).toMatch(/^Gare d'essai, jour 2, 6 h 0\d/);
      sim.world.players[0].money = 900;
      expect(await host.saveNow()).toBe('ok');
      expect((await store.read(manifest.id, 1))?.moment).toBe('manual');
      kept.fingerprint = fingerprint(sim.world);
      host.dispose();
    } finally {
      first.dispose();
    }
    const second = await startLocalDuo<GameAction>({ manifest, seed: 99, store });
    try {
      await second.start();
      const host = createSession({ duo: second.hostGame, content });
      const guest = createSession({ duo: second.guestGame, content });
      expect(host.notice).toBeNull();
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans simulation');
      expect(sim.world.players[0].money).toBe(900);
      expect(sim.world.common.day).toBe(2);
      expect(fingerprint(sim.world)).toBe(kept.fingerprint);
      for (let i = 1; i <= 30; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      const seen = guest.view.world();
      expect(seen?.players[0].money).toBe(900);
      expect(seen?.common.day).toBe(2);
      expect(seen?.progress.quests.arrivee?.step).toBe('quai');
      expect(await guest.saveNow()).toBe('refused');
      host.dispose();
      guest.dispose();
    } finally {
      second.dispose();
    }
  });
});
