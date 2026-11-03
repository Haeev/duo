// Format 13 (patch 0.12.1, taille de l'état transmis à l'invité): les champs à leur valeur par
// défaut ne s'écrivent plus (plis de Lucie, quêtes, notifications, séjours près des points,
// chantiers jamais commencés, ombres des poissons), et la lecture retrouve les mêmes valeurs.
// Migration testée depuis le format 12 (juste avant) et depuis le format 11 (chaîne entière).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { questBaselines, questChecklist } from '../src/etat/quete';
import type { WorldState } from '../src/etat/types';
import { decodeSave, migrateToFormat13, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { improvementView } from '../src/simulation/chantiers';
import { DATA_SCHEMA, SIM_HZ } from '../src/simulation/constantes';
import { pliKind } from '../src/simulation/plis';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

interface OldPli {
  kind: string;
  to: string;
  taken: boolean;
  delivered: boolean;
}

interface OldWorld {
  mail: { items: OldPli[] } | null;
  quests: { id: string; checklist: unknown[]; baselines: Record<string, number> }[];
  characters: { notifications: { id: number; hint: string | null; proposal: string | null }[]; stays: Record<string, number> }[];
  improvements: Record<string, { paid: number; planks: number; funded: boolean; builtDay: number | null }>;
}

function reference(file: string): { dataSchema: number; data: unknown } {
  const url = new URL(`./donnees/sauvegardes/${file}`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as { dataSchema: number; data: unknown };
}

/** Chaque valeur par défaut encore écrite dans l'état (vide attendu au format 13). */
function defaultsWritten(world: unknown): string[] {
  const w = world as Record<string, unknown> & {
    mail: { items: Record<string, unknown>[] } | null;
    quests: Record<string, unknown>[];
    characters: { id: string; notifications: Record<string, unknown>[]; stays: Record<string, unknown> }[];
    improvements: Record<string, Record<string, unknown>>;
    fishing: { shadows: Record<string, unknown>[] };
  };
  const out: string[] = [];
  w.mail?.items.forEach((p, i) => {
    if (p.kind === 'letter') out.push(`pli ${String(i)}: kind letter`);
    if (p.taken === false) out.push(`pli ${String(i)}: taken faux`);
    if (p.delivered === false) out.push(`pli ${String(i)}: delivered faux`);
  });
  for (const q of w.quests) {
    if (Array.isArray(q.checklist) && q.checklist.length === 0) out.push(`quête ${String(q.id)}: checklist vide`);
    if (q.baselines !== undefined && Object.keys(q.baselines as object).length === 0) out.push(`quête ${String(q.id)}: baselines vide`);
  }
  for (const c of w.characters) {
    for (const n of c.notifications) {
      if (n.hint === null) out.push(`${c.id}: notification hint nul`);
      if (n.proposal === null) out.push(`${c.id}: notification proposal nul`);
    }
    for (const [id, s] of Object.entries(c.stays)) if (s === 0) out.push(`${c.id}: séjour ${id} à zéro`);
  }
  for (const [id, s] of Object.entries(w.improvements)) {
    if (s.paid === 0 && s.planks === 0 && s.funded === false && s.builtDay === null) out.push(`chantier ${id} à zéro`);
  }
  for (const s of w.fishing.shadows) {
    if (s.move === null || s.line === null || s.watchOnly === false) out.push(`ombre ${String(s.id)}: champ nul`);
  }
  return out;
}

describe('format 13: aucune valeur par défaut écrite', () => {
  it('le format en cours est le 13', () => {
    expect(DATA_SCHEMA).toBe(13);
  });

  it.each([
    ['format-12-ete-jour-25.json', 12],
    ['format-12-fin-semaine-1.json', 12],
    ['format-11-ete-jour-25.json', 11],
  ])('%s: la migration retire les défauts, la lecture redonne les mêmes valeurs', (file, schema) => {
    const ref = reference(file);
    expect(ref.dataSchema).toBe(schema);
    const old = structuredClone(ref.data) as OldWorld;
    // Des plis pris et livrés (aucune référence n'en a): le vrai reste écrit.
    const items = old.mail?.items ?? [];
    if (items[0] !== undefined) items[0].taken = true;
    if (items[1] !== undefined) {
      items[1].taken = true;
      items[1].delivered = true;
    }
    const migrated = structuredClone(old) as unknown as Record<string, unknown>;
    migrateToFormat13(migrated);
    const w = migrated as unknown as WorldState;
    expect(defaultsWritten({ ...w, fishing: { shadows: [] } })).toEqual([]);
    expect(w.mail?.items.map((p) => [pliKind(p), p.to, p.taken === true, p.delivered === true])).toEqual(
      old.mail?.items.map((p) => [p.kind, p.to, p.taken, p.delivered]),
    );
    expect(w.quests.map((q) => [q.id, questChecklist(q), questBaselines(q)])).toEqual(old.quests.map((q) => [q.id, q.checklist, q.baselines]));
    w.characters.forEach((c, i) => {
      const before = old.characters[i];
      expect(c.notifications.map((n) => [n.id, n.hint ?? null, n.proposal ?? null])).toEqual(before?.notifications.map((n) => [n.id, n.hint, n.proposal]));
      for (const [id, s] of Object.entries(before?.stays ?? {})) expect(c.stays[id] ?? 0, `séjour ${id}`).toBe(s);
    });
    const { content } = contentAndMap();
    for (const def of content.improvements) {
      expect(improvementView({ world: w }, def.id), def.id).toEqual(old.improvements[def.id] ?? { paid: 0, planks: 0, funded: false, builtDay: null });
    }
  });

  it.each(['format-12-ete-jour-25.json', 'format-11-ete-jour-25.json'])('%s: se recharge, se joue, et se réécrit au format 13 sans défaut', (file) => {
    const { content, map } = contentAndMap();
    const ref = reference(file);
    const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
    const day = sim.world.clock.day;
    play(sim, createRobot({ stages: 'stay' }), (s) => s.world.clock.day > day, SIM_HZ * 60 * 60);
    expect(sim.world.clock.day).toBe(day + 1);
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(DATA_SCHEMA);
    expect(defaultsWritten(snap.data)).toEqual([]);
    // Relue telle quelle au format courant: aucune migration, même état.
    const again = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(again.world.mail).toEqual(sim.world.mail);
    expect(again.world.quests).toEqual(sim.world.quests);
    expect(again.world.improvements).toEqual(sim.world.improvements);
  });

  it("une partie neuve n'écrit aucun défaut, ombres des poissons comprises (état transmis à l'invité)", () => {
    const sim = newSim(7);
    let worst: string[] = [];
    let shadows = 0;
    play(
      sim,
      createRobot(),
      (s) => {
        if (s.world.tick % (SIM_HZ * 10) === 0) {
          const found = defaultsWritten(s.world);
          if (found.length > worst.length) worst = found;
          shadows = Math.max(shadows, s.world.fishing.shadows.length);
        }
        return s.world.clock.day >= 11;
      },
      SIM_HZ * 60 * 60 * 2,
    );
    expect(sim.world.clock.day).toBe(11);
    expect(shadows, 'des ombres ont été vues').toBeGreaterThan(0);
    expect(worst).toEqual([]);
  });
});
