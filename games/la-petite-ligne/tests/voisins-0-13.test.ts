// 0.13, lot H1 (`docs/jeux/jeu-1/v0-13-habitants.md`, sections 3, 4 et 9.1): plannings et
// découverte des habitudes. Observation (HB-04, HB-05), réplique révélatrice (HB-06), écriteau
// (HB-07), variante au carnet (HB-08), « maintenant » (HB-09), rattrapage (HB-10), habitude
// possible ou disparue (décision du manager), migration au format 14, même carnet chez les deux.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import { ContentError } from '../src/donnees/lecteur';
import type { Content } from '../src/donnees/types';
import type { ControlFrame } from '../src/etat/actions';
import type { GameMap } from '../src/etat/carte';
import { habitKnown, momentOf } from '../src/etat/planning';
import type { Character, WorldState } from '../src/etat/types';
import { readDiscovery } from '../src/etat/types-voisins';
import { habitAt, habitViews, likelyWhereabouts } from '../src/etat/voisins';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { createSession, type GameAction } from '../src/session';
import { evaluateAll, NO_CONTEXT } from '../src/simulation/conditions';
import { DATA_SCHEMA, SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import { type Sim, character } from '../src/simulation/contexte';
import { dialogueNext, pickDialogue, talkTo } from '../src/simulation/dialogues';
import { placeVillagers, updateVillagers } from '../src/simulation/habitants';
import { readSign, revealUse } from '../src/simulation/voisins';
import { contentAndMap, newSim, SEED, withPace } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

interface RawVillager {
  id: string;
  schedule: { habit?: string }[];
  habits?: unknown[];
}

/**
 * Le contenu du jeu, Firmin muni de deux habitudes d'essai (ses entrées existantes, données de la
 * démo inchangées): la cloche du quai (une rumeur de Basile) et chez lui (un écriteau).
 */
function firminContent(): Content {
  const files = structuredClone(CONTENT_FILES);
  const raw = files.habitants as { villagers: RawVillager[] };
  const firmin = raw.villagers.find((v) => v.id === 'firmin');
  if (firmin === undefined) throw new Error('Firmin absent');
  const [, , , home, quay, evening] = firmin.schedule;
  if (home === undefined || quay === undefined || evening === undefined)
    throw new Error('planning de Firmin changé');
  home.habit = 'home';
  quay.habit = 'quay';
  evening.habit = 'home';
  firmin.habits = [
    {
      id: 'quay',
      kind: 'routine',
      label: 'Tous les jours, à la cloche du quai, de 8 h à 18 h',
      reveals: [{ by: 'basile', text: 'Firmin ne quitte pas sa cloche de 8 h à 6 h du soir.' }],
    },
    {
      id: 'home',
      kind: 'home',
      label: 'Chez lui avant 8 h et après 18 h',
      reveals: [{ sign: 'firmin_sign', text: 'Le chef de halte rentre à 18 h.' }],
    },
  ];
  return withPace(loadContent(files), 'vif');
}

/** Un jour en cours (dimanche 2 à 10 h, beau temps), les deux joueurs dehors, Firmin à sa cloche. */
function daySim(content: Content, day = 2, minutes = 10 * 60): Sim {
  const sim = newSim(SEED, content);
  const w = sim.world;
  w.phase = 'day';
  w.clock.day = day;
  w.clock.minutes = minutes;
  w.weather = 'sunny';
  for (const c of w.characters) {
    c.created = true;
    c.status = 'active';
    c.inside = null;
    c.pos = { x: 5, y: 60 };
  }
  placeVillagers(sim);
  return sim;
}

/** Basile déjà rencontré, sans quête ni rencontre à dire: il ne reste que son quotidien. */
function onlyDaily(sim: Sim, villager: string): void {
  for (const d of Object.values(sim.content.dialogues)) {
    if (d.villager !== villager || d.kind === 'daily') continue;
    sim.world.dialoguesDone.push(`${d.id}@p1`, `${d.id}@p2`);
  }
}

/** Fait tourner les habitants (plannings, observation) pendant `seconds` secondes de simulation. */
function run(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    sim.world.tick += 1;
    updateVillagers(sim, SIM_DT);
  }
}

function besideFirmin(sim: Sim, c: Character, meters: number): void {
  const v = sim.world.villagers.find((x) => x.id === 'firmin');
  if (v === undefined) throw new Error('Firmin absent');
  c.pos = { x: v.pos.x + meters, y: v.pos.y };
}

describe('contenu de la 0.13', () => {
  it('lit habitants-0-13.json par-dessus habitants.json, ses habitudes, ses répliques et ses anniversaires', () => {
    const { content } = contentAndMap();
    expect(content.villagers).toHaveLength(21);
    expect(content.villagers.slice(0, 6).map((v) => v.id)).toEqual([
      'firmin',
      'odette',
      'basile',
      'jeanne',
      'achille',
      'solange',
    ]);
    const habits = content.villagers.reduce((n, v) => n + v.habits.length, 0);
    expect(habits).toBeGreaterThanOrEqual(188);
    // Chaque réplique révélatrice est une réplique du quotidien de qui la dit.
    for (const v of content.villagers) {
      for (const h of v.habits) {
        for (const r of h.reveals) {
          if (r.kind !== 'line') continue;
          const said = Object.values(content.dialogues).find(
            (d) => d.villager === r.by && d.lines[0]?.text === r.text,
          );
          expect(
            said?.reveals?.some((x) => x.villager === v.id && x.habit === h.id),
            `${v.id}.${h.id}`,
          ).toBe(true);
        }
      }
    }
    expect(Object.keys(content.villageCalendar.birthdays)).toHaveLength(21);
    expect(content.villageCalendar.birthdays.firmin).toEqual({ season: 'autumn', day: 6 });
  });

  it("refuse une entrée d'une habitude inconnue et un anniversaire un samedi", () => {
    const broken = structuredClone(CONTENT_FILES);
    const raw = broken.habitants as { villagers: (RawVillager & { birthday?: unknown })[] };
    const firmin = raw.villagers[0];
    if (firmin?.schedule[4] === undefined) throw new Error('planning de Firmin changé');
    firmin.schedule[4].habit = 'nowhere';
    expect(() => loadContent(broken)).toThrow(/habitude inconnue « nowhere »/);
    const saturday = structuredClone(CONTENT_FILES);
    const first = (saturday.habitants as { villagers: { birthday?: unknown }[] }).villagers[0];
    if (first === undefined) throw new Error('aucun habitant');
    first.birthday = { season: 'spring', day: 8 };
    expect(() => loadContent(saturday)).toThrow(ContentError);
  });
});

describe('observation (section 4.3)', () => {
  it('HB-04: immobile à 8 m de Firmin à sa cloche, 2 s réelles, le carnet commun l’écrit, vu par Camille, chez les deux', () => {
    const sim = daySim(firminContent());
    besideFirmin(sim, character(sim, 'p1'), 8);
    run(sim, 1.5);
    expect(habitKnown(sim.world, 'firmin', 'quay')).toBe(false);
    run(sim, 1);
    expect(sim.world.habits.known.firmin).toEqual(['quay']);
    for (const id of ['p1', 'p2'] as const) {
      const last = character(sim, id).notifications.at(-1);
      expect(last?.key).toBe('habit_found');
      expect(last?.text).toContain('vu par Camille');
    }
    expect(sim.world.habits.log).toEqual(['firmin:quay:2:seen:p1']);
    expect(readDiscovery(sim.world.habits.log[0] ?? '')).toEqual({
      villager: 'firmin',
      habit: 'quay',
      day: 2,
      source: 'seen',
      by: 'p1',
    });
  });

  it('HB-05: à 12 m, ou à 8 m de l’autre côté d’une façade, rien ne s’écrit', () => {
    const far = daySim(firminContent());
    besideFirmin(far, character(far, 'p1'), 12);
    run(far, 4);
    expect(habitKnown(far.world, 'firmin', 'quay')).toBe(false);
    const behind = daySim(firminContent());
    const c = character(behind, 'p1');
    besideFirmin(behind, c, 8);
    c.inside = Object.keys(behind.map.buildings)[0] ?? null;
    expect(c.inside).not.toBeNull();
    run(behind, 4);
    expect(habitKnown(behind.world, 'firmin', 'quay')).toBe(false);
  });

  it('les deux ensemble: une seule écriture, « vu ensemble »', () => {
    const sim = daySim(firminContent());
    besideFirmin(sim, character(sim, 'p1'), 6);
    besideFirmin(sim, character(sim, 'p2'), -6);
    run(sim, 3);
    expect(sim.world.habits.known.firmin).toEqual(['quay']);
    expect(sim.world.habits.log).toHaveLength(1);
    expect(character(sim, 'p2').notifications.at(-1)?.key).toBe('habit_found_together');
  });
});

describe('répliques, écriteaux, rattrapage (sections 4.4 et 4.8)', () => {
  it('HB-06: la rumeur de Basile passe avant ses répliques ordinaires; entendue, elle écrit l’habitude et redevient ordinaire', () => {
    const sim = daySim(firminContent(), 3);
    onlyDaily(sim, 'basile');
    // Basile a d'autres rumeurs (Mado, Inès...): celles-là sont déjà au carnet.
    for (const v of sim.content.villagers)
      if (v.id !== 'firmin') sim.world.habits.known[v.id] = v.habits.map((h) => h.id);
    const ordinary = Object.values(sim.content.dialogues).find(
      (d) => d.villager === 'basile' && d.kind === 'daily' && d.reveals === undefined,
    );
    expect(ordinary).toBeDefined();
    const rumour = Object.values(sim.content.dialogues).find(
      (d) => d.villager === 'basile' && d.reveals?.some((r) => r.villager === 'firmin'),
    );
    expect(rumour).toBeDefined();
    expect(pickDialogue(sim, 'basile', 'p1')?.id).toBe(rumour?.id);
    const c = character(sim, 'p1');
    expect(talkTo(sim, c, 'basile')).toBe(true);
    for (let i = 0; i < 5 && c.dialogue !== null; i++) dialogueNext(sim, c);
    expect(habitKnown(sim.world, 'firmin', 'quay')).toBe(true);
    expect(c.notifications.at(-1)?.key).toBe('habit_heard');
    expect(character(sim, 'p2').notifications.at(-1)?.key).toBe('habit_heard_other');
    if (rumour === undefined) return;
    expect(revealUse(sim, rumour)).toBe('none');
  });

  it("HB-07: lire l'écriteau écrit les habitudes qu'il cite", () => {
    const { map } = contentAndMap();
    const content = firminContent();
    const sim = daySim(content);
    const withSign: GameMap = { ...map, points: { ...map.points, firmin_sign: { x: 20, y: 20 } } };
    const signed: Sim = { ...sim, map: withSign };
    const c = character(signed, 'p1');
    c.pos = { x: 21, y: 20 };
    expect(readSign(signed, c)).toBe(true);
    expect(signed.events.some((e) => e.type === 'sign_read' && e.sign === 'firmin_sign')).toBe(
      true,
    );
    expect(signed.world.habits.known.firmin).toEqual(['home']);
    expect(c.notifications.at(-1)?.key).toBe('habit_read');
  });

  it('HB-10: une habitude restée inconnue 10 jours (habitant rencontré) se dit avant tout le quotidien', () => {
    const sim = daySim(firminContent(), 3);
    onlyDaily(sim, 'basile');
    sim.world.habits.pending.firmin = { quay: [10, 2] };
    const rumour = pickDialogue(sim, 'basile', 'p1');
    expect(rumour?.reveals).toEqual([{ villager: 'firmin', habit: 'quay' }]);
    if (rumour === null) return;
    expect(revealUse(sim, rumour)).toBe('overdue');
  });

  it('les jours où elle tient sans être connue se comptent, une fois par jour, après la rencontre (HB-08)', () => {
    const sim = daySim(firminContent());
    const firmin = sim.world.villagers.find((v) => v.id === 'firmin');
    if (firmin === undefined) throw new Error('Firmin absent');
    run(sim, 1);
    expect(sim.world.habits.pending.firmin).toBeUndefined();
    firmin.met = true;
    run(sim, 1);
    expect(sim.world.habits.pending.firmin?.quay).toEqual([1, 2]);
    run(sim, 1);
    expect(sim.world.habits.pending.firmin?.quay).toEqual([1, 2]);
    expect(
      habitViews(sim.content, sim.world, 'firmin').find((h) => h.def.id === 'quay'),
    ).toMatchObject({ known: false, shown: true, daysPossible: 1 });
  });

  it('une révélation ne se dit que si son habitude est possible (Lucie revenue) et se tait quand elle disparaît (Berthe)', () => {
    const { content } = contentAndMap();
    const sim = daySim(content, 30);
    const about = (villager: string, habit: string): ReturnType<typeof revealUse>[] =>
      Object.values(content.dialogues)
        .filter((d) => d.reveals?.some((r) => r.villager === villager && r.habit === habit))
        .map((d) => revealUse(sim, d));
    expect(about('lucie', 'sorting')).not.toHaveLength(0);
    expect(new Set(about('lucie', 'sorting'))).toEqual(new Set(['hidden']));
    sim.world.flags.push('lucie_back');
    expect(new Set(about('lucie', 'sorting'))).toEqual(new Set(['fresh']));
    expect(new Set(about('berthe', 'watch_train'))).toEqual(new Set(['fresh']));
    sim.world.flags.push('mouture_settled');
    expect(new Set(about('berthe', 'watch_train'))).toEqual(new Set(['hidden']));
  });
});

describe('« maintenant: sans doute à… » (section 4.7)', () => {
  it('HB-09: sur 100 instants tirés, 21 habitants, carnet à moitié rempli, jamais un lieu qui n’est pas au carnet; le planning lu sans la simulation est celui de la simulation', () => {
    const { content } = contentAndMap();
    const sim = daySim(content, 30);
    sim.world.flags.push('lucie_back');
    for (const v of content.villagers)
      sim.world.habits.known[v.id] = v.habits.filter((_, i) => i % 2 === 0).map((h) => h.id);
    let seed = 12345;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    let likely = 0;
    for (let i = 0; i < 100; i++) {
      sim.world.clock.day = 16 + next(84);
      sim.world.clock.minutes = 6 * 60 + next(18 * 60);
      sim.world.weather = (['sunny', 'cloudy', 'rain'] as const)[next(3)] ?? 'sunny';
      for (const v of content.villagers) {
        const now = likelyWhereabouts(content, sim.world, v.id);
        if (now.kind === 'likely') {
          likely += 1;
          expect(habitKnown(sim.world, v.id, now.habit.id)).toBe(true);
          expect(v.schedule.some((e) => e.habit === now.habit.id && e.point === now.point)).toBe(
            true,
          );
        }
        const bySim = v.schedule.find((e) => {
          const m = sim.world.clock.minutes;
          return m >= e.from && m < e.to && evaluateAll(sim, e.when, NO_CONTEXT);
        });
        expect(
          habitAt(content, sim.world, v.id, momentOf(sim.world)),
          `${v.id} jour ${String(sim.world.clock.day)}`,
        ).toBe(bySim?.habit ?? null);
      }
    }
    expect(likely).toBeGreaterThan(100);
  });
});

describe('sauvegarde (format 14, sections 0 et 6.5)', () => {
  it.each([
    ['format-13-ete-jour-25.json', 13],
    ['format-12-ete-jour-25.json', 12],
  ])(
    "%s se charge: liens de départ par quête finie, habitudes d'office, et se relit au format en cours",
    (name, schema) => {
      const { content, map } = contentAndMap();
      const file = fileURLToPath(new URL(`./donnees/sauvegardes/${name}`, import.meta.url));
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { data: unknown };
      const old = raw.data as WorldState;
      expect('habits' in old).toBe(false);
      const sim = restoreWorld(content, map, decodeSave(structuredClone(raw.data)), schema, [A, B]);
      const done = (villager: string): number =>
        old.quests.filter(
          (q) =>
            q.status === 'done' && content.quests.find((d) => d.id === q.id)?.giver === villager,
        ).length;
      expect(done('firmin')).toBeGreaterThan(0);
      expect(sim.world.bonds.firmin).toBe(Math.min(250, 60 * done('firmin')));
      expect(sim.world.habits.known).toEqual(content.settings.habits.knownInEarlierSaves);
      expect(sim.world.habits.log).toEqual([]);
      const snap = snapshotOf(sim);
      expect(snap.dataSchema).toBe(DATA_SCHEMA);
      const again = restoreWorld(
        content,
        map,
        decodeSave(structuredClone(snap.data)),
        snap.dataSchema,
        [A, B],
      );
      expect(again.world.habits).toEqual(sim.world.habits);
      expect(again.world.bonds).toEqual(sim.world.bonds);
    },
  );
});

describe('réseau: même carnet chez les deux machines', () => {
  it("l'hôte voit, l'invité reçoit la même habitude et la même notification", async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const { map } = contentAndMap();
      const content = firminContent();
      const clock = { now: 0 };
      const host = createSession({ duo: duo.hostGame, content, map, now: () => clock.now });
      const guest = createSession({ duo: duo.guestGame, content, map, now: () => clock.now });
      let seq = 0;
      const idle = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
      const tick = async (): Promise<void> => {
        host.step(idle());
        guest.step(idle());
        clock.now += SIM_DT * 1000;
        host.beforeFrame(1);
        guest.beforeFrame(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
      };
      for (let i = 0; i < 20; i++) await tick();
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      const w = sim.world;
      w.phase = 'day';
      w.clock.day = 2;
      w.clock.minutes = 10 * 60;
      w.clock.running = false;
      w.scene = null;
      for (const c of w.characters) {
        c.created = true;
        c.status = 'active';
        c.inside = null;
        c.pos = { x: 5, y: 60 };
      }
      placeVillagers(sim);
      const guestId = guest.view.localCharacter();
      besideFirmin(sim, character(sim, guestId), 7);
      for (let i = 0; i < 4 * SIM_HZ; i++) await tick();
      expect(w.habits.known.firmin).toEqual(['quay']);
      const seen = guest.view.world();
      expect(seen.habits.known.firmin).toEqual(['quay']);
      const mine = seen.characters.find((c) => c.id === guestId)?.notifications.at(-1);
      expect(mine?.key).toBe('habit_found');
      expect(mine?.text).toBe(character(sim, guestId).notifications.at(-1)?.text);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
