// Reprises et bancs (qa-testeur, gauntlet tour 5): les robots jouent la démo entière sur onze
// graines, avec une sauvegarde reprise à chaque aube (hôte et invité inversés), à 17 h 20 (énigme
// de la cloche, passage des oies) et en pleine poussée de la draisine; les vraies sauvegardes du
// format 1 sont jouées jusqu'au jour 15. À chaque pas contrôlé: places des bancs cohérentes, personne
// debout dans l'emprise d'un banc, jamais deux corps assis l'un dans l'autre, draisine hors du train.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BenchSeating, benchesOf, seatPlace } from '../src/etat/bancs';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import type { Sim } from '../src/simulation/contexte';
import { DATA_SCHEMA, SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
/** Borne de sécurité: cinq heures de jeu réel. */
const MAX_TICKS = SIM_HZ * 60 * 300;
const SEEDS = [1, 7, 42, 99, 2026, 31_337, 123_456, 20_261_031, 3, 5150, 777];
const SAVES_DIR = join(import.meta.dirname, 'donnees', 'sauvegardes');
/** Contrôle des bancs tous les trois pas (dix fois par seconde de jeu réel). */
const CHECK_EVERY = 3;
/** Marge (m) retirée de l'emprise d'un banc: un corps qui frôle le bord ne le traverse pas. */
const EDGE = 0.05;
/** Deux corps assis plus proches que cela (m) se dessinent l'un dans l'autre. */
const OVERLAP = 0.5;
/** Trace gardée par catégorie: assez pour diagnostiquer, sans noyer le rapport. */
const MAX_TRACE = 20;

interface Report {
  day: number;
  orders: number;
  ticks: number;
  dawnSaves: number;
  midSaves: string[];
  seatedAtSave: number;
  satDown: number;
  geese: string;
  trainHits: number;
  seatViolations: string[];
  benchCrossers: string[];
}

interface Body {
  id: string;
  x: number;
  y: number;
  seated: boolean;
}

function clockLabel(sim: Sim): string {
  const m = sim.world.clock.minutes;
  return `j${sim.world.clock.day} ${Math.floor(m / 60)}h${String(Math.floor(m % 60)).padStart(2, '0')}`;
}

/** Sauvegarde passée par JSON puis reprise; les places assises survivent à l'identique. */
function roundTrip(sim: Sim, swap: boolean): Sim {
  const snap = snapshotOf(sim);
  const data = JSON.parse(JSON.stringify(snap.data)) as unknown;
  const { content, map } = contentAndMap();
  const restored = restoreWorld(content, map, decodeSave(data), snap.dataSchema, swap ? [B, A] : [A, B]);
  expect(restored.world.characters.find((c) => c.playerId === A.id)?.id).toBe('p1');
  for (const c of sim.world.characters) {
    expect(restored.world.characters.find((x) => x.id === c.id)?.seat ?? null, `place de ${c.id} après reprise`).toEqual(c.seat);
  }
  return restored;
}

function checkBenches(sim: Sim, seating: BenchSeating, report: Report): void {
  const w = sim.world;
  const s = sim.content.settings.benches;
  const benches = benchesOf(sim.map);
  const place = { x: 0, y: 0, facing: 0 };
  const taken = new Set<string>();
  const violation = (text: string): void => {
    if (report.seatViolations.length < MAX_TRACE) report.seatViolations.push(`${clockLabel(sim)} ${text}`);
  };
  for (const c of w.characters) {
    if (c.seat === null) continue;
    const key = `${c.seat.bench}#${c.seat.slot}`;
    if (taken.has(key)) violation(`deux joueurs sur ${key}`);
    taken.add(key);
    if (w.phase !== 'day' || c.inHouse || c.status === 'sleeping' || c.status === 'night') violation(`${c.id} assis en ${w.phase}/${c.status}`);
    const prop = benches.find((b) => b.id === c.seat?.bench);
    if (prop === undefined) {
      violation(`banc inconnu ${key}`);
      continue;
    }
    seatPlace(prop, c.seat.slot, s, place);
    if (Math.hypot(place.x - c.pos.x, place.y - c.pos.y) > 1e-6) violation(`${c.id} assis hors de sa place`);
  }
  // Corps tels que le rendu les pose: les habitants assis à leur place, les autres où ils sont.
  seating.update(benches, s, sim.map.points, w.characters, w.villagers);
  const bodies: Body[] = [];
  for (const c of w.characters) if (c.created && !c.inHouse) bodies.push({ id: c.id, x: c.pos.x, y: c.pos.y, seated: c.seat !== null });
  w.villagers.forEach((v, i) => {
    if (!v.visible) return;
    const prop = seating.bench[i] ?? null;
    const slot = seating.slot[i] ?? -1;
    if (prop === null || slot < 0) {
      bodies.push({ id: v.id, x: v.pos.x, y: v.pos.y, seated: false });
      return;
    }
    if (taken.has(`${prop.id}#${slot}`)) violation(`${v.id} sur la place d'un joueur ${prop.id}#${slot}`);
    seatPlace(prop, slot, s, place);
    bodies.push({ id: v.id, x: place.x, y: place.y, seated: true });
  });
  for (const b of bodies) {
    if (b.seated) continue;
    for (const prop of benches) {
      const r = prop.rect;
      if (r === null || b.x <= r.x + EDGE || b.x >= r.x + r.w - EDGE || b.y <= r.y + EDGE || b.y >= r.y + r.h - EDGE) continue;
      if (report.benchCrossers.length < MAX_TRACE) report.benchCrossers.push(`${clockLabel(sim)} ${b.id} dans ${prop.id} (${b.x.toFixed(2)}, ${b.y.toFixed(2)})`);
    }
  }
  const seated = bodies.filter((b) => b.seated);
  for (let i = 0; i < seated.length; i++) {
    for (let j = i + 1; j < seated.length; j++) {
      const p = seated[i];
      const q = seated[j];
      if (p !== undefined && q !== undefined && Math.hypot(p.x - q.x, p.y - q.y) < OVERLAP) violation(`${p.id} et ${q.id} superposés`);
    }
  }
}

function playAll(start: Sim): Report {
  const report: Report = {
    day: 0, orders: 0, ticks: 0, dawnSaves: 0, midSaves: [], seatedAtSave: 0, satDown: 0, geese: '-',
    trainHits: 0, seatViolations: [], benchCrossers: [],
  };
  const seating = new BenchSeating();
  let sim = start;
  let robot = createRobot();
  let day = sim.world.clock.day;
  let swap = false;
  let bellSaveDay = -1;
  let handcarSaved = false;
  const save = (why: string): void => {
    report.seatedAtSave += sim.world.characters.filter((c) => c.seat !== null).length;
    report.midSaves.push(`j${sim.world.clock.day} ${why}`);
    swap = !swap;
    sim = roundTrip(sim, swap);
    robot = createRobot();
  };
  while (sim.world.phase !== 'ended' && report.ticks < MAX_TICKS) {
    step(sim, robot.decide(sim));
    report.ticks++;
    const w = sim.world;
    for (const e of sim.events) if (e.type === 'sat_down') report.satDown++;
    if (report.ticks % CHECK_EVERY === 0) checkBenches(sim, seating, report);
    if (w.handcarAt !== null && w.train.phase !== 'away') {
      const z = sim.map.zones.train_at_platform;
      const p = w.handcarAt.pos;
      if (z !== undefined && p.x >= z.x - 1 && p.x <= z.x + z.w + 1 && p.y >= z.y && p.y <= z.y + z.h) report.trainHits++;
    }
    if (w.phase === 'day' && w.clock.minutes >= 17 * 60 + 20 && w.clock.minutes < 17 * 60 + 21 && bellSaveDay !== w.clock.day) {
      bellSaveDay = w.clock.day;
      save('17h20');
    } else if (!handcarSaved && w.beam?.purpose === 'handcar' && w.beam.carried && w.beam.leg === 1) {
      handcarSaved = true;
      save('draisine en poussée');
    } else if (w.clock.day !== day && w.phase === 'breakfast') {
      day = w.clock.day;
      swap = !swap;
      sim = roundTrip(sim, swap);
      robot = createRobot();
      report.dawnSaves++;
    }
  }
  report.day = sim.world.clock.day;
  report.orders = sim.world.orderHistory.length;
  report.geese = sim.world.quests.find((q) => q.id === 'wild_geese')?.status ?? '-';
  return report;
}

function expectSound(r: Report): void {
  expect(r.ticks, 'la démo finit avant la borne').toBeLessThan(MAX_TICKS);
  expect(r.day, 'fin au jour 15').toBe(15);
  expect(r.orders, 'deux commandes payées').toBe(2);
  expect(r.trainHits, 'draisine dans l’emprise du train').toBe(0);
  expect(r.seatViolations, 'places des bancs').toEqual([]);
  expect(r.benchCrossers, 'corps debout dans un banc').toEqual([]);
  // Les oies, quand le tirage les propose, demandent les deux assis: la quête doit aboutir.
  if (r.geese !== '-') expect(r.geese, 'les oies sauvages').toBe('done');
}

describe('reprises à chaque aube et en pleine journée, bancs compris', () => {
  for (const seed of SEEDS) {
    it(`graine ${seed}: la démo va au bout, places et emprises respectées`, () => {
      const r = playAll(newSim(seed));
      expectSound(r);
      expect(r.dawnSaves, 'une reprise à chaque aube').toBe(14);
      expect(r.midSaves.some((m) => m.endsWith('draisine en poussée')), 'reprise en pleine poussée').toBe(true);
    }, 300_000);
  }
  for (const file of readdirSync(SAVES_DIR).filter((f) => f.startsWith('format-1'))) {
    it(`sauvegarde réelle ${file} jouée jusqu'au jour 15, reprises comprises`, () => {
      const raw = JSON.parse(readFileSync(join(SAVES_DIR, file), 'utf8')) as { dataSchema: number; data: unknown };
      expect(raw.dataSchema).toBe(1);
      const { content, map } = contentAndMap();
      const restored = restoreWorld(content, map, decodeSave(structuredClone(raw.data)), 1, [B, A]);
      expect(snapshotOf(restored).dataSchema).toBe(DATA_SCHEMA);
      expectSound(playAll(restored));
    }, 300_000);
  }
});
