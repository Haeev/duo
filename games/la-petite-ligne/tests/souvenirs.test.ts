// Souvenirs du duo (tour 7, conception section 2): ce que la simulation garde, borné, sauvegardé
// et migré. S-10 (une entrée par moment vu ensemble et par quête secrète finie, chez les deux,
// datée, avec sa vignette) sur une partie de robots de 42 jours; S-14 (moins de 1,5 Kio) sur
// cette partie et sur le pire cas d'une partie de 372 journées.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Content, MomentDef } from '../src/donnees/types';
import { memoriesBytes, seasonOf, yearOf } from '../src/etat/souvenirs';
import type { CharacterId, MemoriesState, MomentToday } from '../src/etat/types';
import { restoreWorld, SaveError, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { DATA_SCHEMA, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { newToday } from '../src/simulation/moments';
import { memoriesFromSave, recordMoment, recordSecret } from '../src/simulation/souvenirs';
import { createUiContext } from '../src/interface/contexte';
import { GENERIC_VIGNETTE, memoriesPageModel } from '../src/interface/modele-souvenirs';
import { loadUiTexts } from '../src/interface/textes';
import { contentAndMap, createRobot, newSim, play, SEED } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const SAVES = new URL('./donnees/sauvegardes/', import.meta.url);
const SPRITE = readFileSync(
  fileURLToPath(new URL('../ui-maquettes/icones.svg', import.meta.url)),
  'utf8',
);
const SYMBOLS = new Set([...SPRITE.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));

function momentOf(content: Content, id: string): MomentDef {
  const def = content.moments.find((m) => m.id === id);
  if (def === undefined) throw new Error(`moment ${id}`);
  return def;
}

function today(
  sim: Sim,
  id: string,
  origin: MomentToday['origin'],
  hintTo: CharacterId | null,
): MomentToday {
  return { ...newToday(sim, momentOf(sim.content, id), origin), hintTo };
}

function ui(content: Content, me: CharacterId): ReturnType<typeof createUiContext> {
  return createUiContext(content, contentAndMap().map, loadUiTexts(content), me, (code) => code);
}

describe('souvenirs: ce que la simulation garde', () => {
  it('une ligne par moment, quel que soit le nombre de passages; la première confidence est gardée', () => {
    const sim = newSim();
    sim.world.clock.day = 3;
    recordMoment(sim, momentOf(sim.content, 'fox'), today(sim, 'fox', 'ambient', 'p2'));
    sim.world.clock.day = 12;
    recordMoment(sim, momentOf(sim.content, 'fox'), today(sim, 'fox', 'ambient', 'p1'));
    sim.world.clock.day = 9;
    recordMoment(sim, momentOf(sim.content, 'glowworms'), today(sim, 'glowworms', 'ambient', 'p1'));
    sim.world.clock.day = 6;
    recordMoment(sim, momentOf(sim.content, 'heron'), today(sim, 'heron', 'quest', null));
    expect(sim.world.memories.moments).toEqual([
      { id: 'fox', first: 3, hintTo: 'p2', hintFrom: null, count: 2, last: 12 },
      { id: 'glowworms', first: 9, hintTo: 'p1', hintFrom: 'odette', count: 1, last: 9 },
      // Moment de quête: pas de confidence, l'habitant est celui qui a donné la quête.
      { id: 'heron', first: 6, hintTo: null, hintFrom: 'jeanne', count: 1, last: 6 },
    ]);
  });

  it('une quête à secret finie: informé, premier coup, variante; une seule fois', () => {
    const sim = newSim();
    sim.world.clock.day = 11;
    sim.world.secrets.entries.push({
      id: 'lucie_reply',
      quest: 'lucie_note',
      informed: 'p2',
      doer: 'p1',
      variant: 2,
      errors: 1,
      revealed: true,
      shared: true,
      nudged: false,
    });
    recordSecret(sim, 'lucie_note');
    recordSecret(sim, 'lucie_note');
    recordSecret(sim, 'hen_names');
    expect(sim.world.memories.secrets).toEqual([
      { quest: 'lucie_note', day: 11, informed: 'p2', firstTry: false, variant: 2 },
    ]);
  });
});

describe('souvenirs: partie de robots de 42 jours (S-10, S-14)', () => {
  let sim: Sim;

  beforeAll(() => {
    // La démo finit au jour 15; ses réglages, prolongés, laissent les robots vivre six semaines.
    const content = structuredClone(contentAndMap().content);
    content.settings.clock.lastDay.day = 42;
    sim = newSim(SEED, content);
    // Tour 8: la démo s'arrête sur l'écran d'étape du jour 15; les robots y choisissent « Rester à la Halte ».
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) => s.world.clock.day >= 42,
      SIM_HZ * 60 * 60 * 6,
    );
  }, 600_000);

  it('les robots arrivent au jour 42 en ayant vu des moments et fini les quêtes secrètes', () => {
    expect(sim.world.clock.day).toBe(42);
    expect(sim.world.memories.moments.length).toBeGreaterThanOrEqual(5);
    expect(sim.world.memories.secrets.map((s) => s.quest).sort()).toEqual([
      'hen_names',
      'lucie_note',
    ]);
  });

  it("chaque moment vu ensemble a sa ligne: première et dernière fois, nombre de passages (d'après l'historique)", () => {
    const seen = sim.world.moments.history.filter((h) => h.seen);
    const ids = [...new Set(seen.map((h) => h.id))].sort();
    expect(sim.world.memories.moments.map((m) => m.id).sort()).toEqual(ids);
    for (const m of sim.world.memories.moments) {
      const days = seen.filter((h) => h.id === m.id).map((h) => h.day);
      expect(m.count, m.id).toBe(days.length);
      expect(m.first, m.id).toBe(Math.min(...days));
      expect(m.last, m.id).toBe(Math.max(...days));
    }
    // Au moins un moment revu: la ligne ne grandit pas avec lui.
    expect(sim.world.memories.moments.some((m) => m.count > 1)).toBe(true);
  });

  it('chaque quête secrète finie a sa ligne, avec son informé et sa variante', () => {
    for (const m of sim.world.memories.secrets) {
      const entry = sim.world.secrets.entries.find((e) => e.quest === m.quest);
      expect(sim.world.quests.find((q) => q.id === m.quest)?.status).toBe('done');
      expect(m.informed).toBe(entry?.informed);
      expect(m.variant).toBe(entry?.variant);
      expect(m.firstTry).toBe(entry?.errors === 0);
    }
  });

  it('chez les deux, chaque entrée a sa date (jour, saison, année) et une vignette dessinée', () => {
    const s = sim.content.settings.memories;
    const souvenirs = loadUiTexts(sim.content).game.souvenirs;
    const total = sim.world.memories.moments.length + sim.world.memories.secrets.length;
    for (const me of ['p1', 'p2'] as const) {
      const page = memoriesPageModel(sim.world, ui(sim.content, me));
      const entries = page.seasons.flatMap((g) => g.entries);
      expect(entries).toHaveLength(total);
      for (const e of entries) {
        expect(e.vignette).not.toBe(GENERIC_VIGNETTE);
        expect(SYMBOLS.has(e.vignette), e.vignette).toBe(true);
        expect(e.alt.length).toBeGreaterThan(10);
        expect(e.date).toMatch(/^Jour \d+ · /);
      }
      for (const m of sim.world.memories.moments) {
        const e = entries.find((x) => x.key === `moment:${m.id}`);
        expect(e?.date).toContain(`Jour ${String(m.first)} `);
        expect(e?.date).toContain(souvenirs.seasons[seasonOf(s, m.first)] ?? '?');
        expect(e?.date).toContain(souvenirs.years[yearOf(s, m.first) - 1] ?? '?');
      }
    }
  });

  it('la mémoire reste sous 1,5 Kio (S-14)', () => {
    expect(memoriesBytes(sim.world.memories)).toBeLessThan(sim.content.settings.memories.maxBytes);
    expect(sim.content.settings.memories.maxBytes).toBe(1536);
  });

  it('se sauvegarde et se relit telle quelle', () => {
    const { map } = contentAndMap();
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(DATA_SCHEMA);
    const restored = restoreWorld(
      sim.content,
      map,
      JSON.parse(JSON.stringify(snap.data)) as unknown,
      snap.dataSchema,
      [B, A],
    );
    expect(restored.world.memories).toEqual(sim.world.memories);
  });
});

describe('souvenirs: borne au long cours (S-14)', () => {
  it('372 journées: chaque jour un moment, chaque quête secrète finie, toujours sous 1,5 Kio', () => {
    const sim = newSim();
    const ambient = sim.content.moments;
    for (let day = 1; day <= 372; day++) {
      sim.world.clock.day = day;
      const def = ambient[day % ambient.length];
      if (def !== undefined)
        recordMoment(
          sim,
          def,
          today(
            sim,
            def.id,
            def.mode === 'quest' ? 'quest' : 'ambient',
            day % 2 === 0 ? 'p1' : 'p2',
          ),
        );
    }
    for (const quest of sim.content.quests.filter((q) => q.secret !== null)) {
      sim.world.secrets.entries.push({
        id: quest.id,
        quest: quest.id,
        informed: 'p1',
        doer: 'p2',
        variant: 0,
        errors: 0,
        revealed: true,
        shared: true,
        nudged: false,
      });
      recordSecret(sim, quest.id);
    }
    expect(sim.world.memories.moments).toHaveLength(ambient.length);
    expect(memoriesBytes(sim.world.memories)).toBeLessThan(1536);
  });

  it('pire cas des douze moments du tour 7 et de six quêtes secrètes, après 372 journées: sous 1,5 Kio', () => {
    const ids = [
      'heron',
      'geese',
      'ladder',
      'tits',
      'fox',
      'glowworms',
      'roe_deer',
      'kingfisher',
      'mist',
      'falling_stars',
      'odette_waltz',
      'train_salute',
    ];
    const memories: MemoriesState = {
      moments: ids.map((id) => ({
        id,
        first: 372,
        hintTo: 'p2',
        hintFrom: 'basile',
        count: 372,
        last: 372,
      })),
      secrets: ['hen_names', 'lucie_note', 'secret_three', 'secret_four'].map((quest) => ({
        quest,
        day: 372,
        informed: 'p2',
        firstTry: false,
        variant: 9,
      })),
    };
    expect(memoriesBytes(memories)).toBeLessThan(1536);
  });
});

describe('souvenirs: sauvegardes', () => {
  function reference(file: string): { dataSchema: number; data: Record<string, unknown> } {
    return JSON.parse(readFileSync(fileURLToPath(new URL(file, SAVES)), 'utf8')) as {
      dataSchema: number;
      data: Record<string, unknown>;
    };
  }

  it('format 3 vers 4: les souvenirs se reconstruisent depuis l’historique et les quêtes secrètes finies', () => {
    const { content, map } = contentAndMap();
    const ref = reference('format-3-milieu-semaine-2.json');
    expect(ref.dataSchema).toBe(3);
    expect(ref.data.memories).toBeUndefined();
    const sim = restoreWorld(content, map, structuredClone(ref.data), ref.dataSchema, [A, B]);
    const history = (
      ref.data.moments as { history: { id: string; day: number; seen: boolean; origin: string }[] }
    ).history.filter((h) => h.seen);
    expect(sim.world.memories.moments.map((m) => m.id).sort()).toEqual(
      [...new Set(history.map((h) => h.id))].sort(),
    );
    for (const m of sim.world.memories.moments) {
      // Le destinataire de la confidence n'était pas gardé: la ligne à soi est omise.
      expect(m.hintTo).toBeNull();
      const origin = history.find((h) => h.id === m.id)?.origin;
      if (origin === 'ambient') expect(m.hintFrom).toBeNull();
    }
    // « Le mot de Lucie » était fini dans cette sauvegarde.
    const lucie = sim.world.memories.secrets.find((s) => s.quest === 'lucie_note');
    const entry = (
      ref.data.secrets as { entries: { quest: string; informed: string; variant: number }[] }
    ).entries.find((e) => e.quest === 'lucie_note');
    expect(lucie?.informed).toBe(entry?.informed);
    expect(lucie?.variant).toBe(entry?.variant);
  });

  it("une sauvegarde d'avant les secrets (format 2) n'invente aucun souvenir de secret", () => {
    const { content } = contentAndMap();
    for (const file of readdirSync(SAVES).filter((f) => /^format-[12]-/.test(f))) {
      const ref = reference(file);
      const data = structuredClone(ref.data);
      // Comme si les quêtes à secret y étaient finies avec leur fiche (cas le plus trompeur).
      data.secrets = {
        turn: 'p1',
        entries: [{ quest: 'lucie_note', informed: 'p1', errors: 0, variant: 0 }],
      };
      data.quests = [{ id: 'lucie_note', status: 'done', startedDay: 3 }];
      expect(memoriesFromSave(data, content, ref.dataSchema).secrets, file).toEqual([]);
    }
  });

  it('des souvenirs abîmés sont refusés par une SaveError', () => {
    const { content, map } = contentAndMap();
    const latest = readdirSync(SAVES)
      .filter((f) => f.startsWith(`format-${String(DATA_SCHEMA)}-`))
      .sort()
      .at(-1);
    if (latest === undefined) throw new Error('aucune référence du format en cours');
    for (const bad of [
      null,
      { moments: [] },
      { moments: [{ id: 'fox' }], secrets: [] },
      {
        moments: [],
        secrets: [{ quest: 'x', day: 1, informed: 'p3', firstTry: true, variant: 0 }],
      },
    ]) {
      const data = structuredClone(reference(latest).data);
      data.memories = bad;
      expect(() => restoreWorld(content, map, data, DATA_SCHEMA, [A, B])).toThrow(SaveError);
    }
  });
});
