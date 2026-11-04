// Patch 0.12.2 (retours de la séance du 2026-11-03): petite déco posée sur la table et jamais
// dessous (R11), râtelier hors de la fenêtre (R15), objets muraux posés sur le mur et pas sur une
// case du sol (R17), colis porté à deux entre les mains des porteurs (R14).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ControlFrame, Intent } from '../src/etat/actions';
import { wallPlacement, wallSpanOf } from '../src/etat/murs';
import type { Character, CharacterId } from '../src/etat/types';
import { windowsNow } from '../src/etat/maison';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { placeFurniture, placementProblem, updatePlacement } from '../src/simulation/amenagement';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { deliverCatalogue } from '../src/simulation/economie';
import { OLD_TOOL_RACK_CELL, TOOL_RACK } from '../src/simulation/ids';
import { step } from '../src/simulation/pas';
import { addToBag, countInBag } from '../src/simulation/sac';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const SOUTH = Math.PI / 2;

function reference(file: string): { dataSchema: number; data: unknown } {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as {
    dataSchema: number;
    data: unknown;
  };
}

/** Jeudi 62 à midi, chez soi (référence du format 8), sans coin à soi. */
function autumn(): Sim {
  const ref = reference('format-8-automne-jour-62.json');
  const { content, map } = contentAndMap();
  const sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
  for (const c of sim.world.characters) c.corner = null;
  return sim;
}

/** La même partie, sauvegardée puis reprise (comme au lancement suivant chez le client). */
function resumed(sim: Sim): Sim {
  const snap = snapshotOf(sim);
  const back = restoreWorld(sim.content, sim.map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
  for (const c of back.world.characters) c.corner = null;
  return back;
}

function at(sim: Sim, id: CharacterId, x: number, y: number, facing: number): Character {
  const c = character(sim, id);
  placeCharacter(sim, c, { x, y });
  c.facing = facing;
  c.status = 'active';
  c.seat = null;
  c.menu = null;
  c.action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
  return c;
}

function send(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

function hold(sim: Sim, c: Character, item: string): void {
  addToBag(sim, c, item, 'ordinary', 1);
  c.selected = c.bag.findIndex((s) => s?.item === item);
}

/** Une table posée par le joueur (case 8, 24, deux cases vers l'est), puis la partie sauvegardée et reprise. */
function playerTable(): { sim: Sim; table: string } {
  const sim = autumn();
  sim.world.furniture = sim.world.furniture.filter((f) => f.item !== 'table');
  const c = at(sim, 'p1', 8.5, 23.2, SOUTH);
  hold(sim, c, 'table');
  expect(placeFurniture(sim, c, { cx: 8, cy: 24 }, 0)).toBe(true);
  const back = resumed(sim);
  const table = back.world.furniture.find((f) => f.item === 'table' && f.placedBy === 'p1')?.id;
  if (table === undefined) throw new Error('table perdue à la reprise');
  return { sim: back, table };
}

describe('petite déco sur la table (R11)', () => {
  for (const who of ['p1', 'p2'] as const) {
    it(`${who === 'p1' ? 'hôte' : 'invité'}: table posée par le joueur, partie reprise: clavier, souris sur la table, souris sur le sol sous la table`, () => {
      const { sim, table } = playerTable();
      const c = at(sim, who, 8.5, 23.4, SOUTH);
      const ways: (Intent | null)[] = [
        null,
        { type: 'point_at', target: { kind: 'furniture', furniture: table } },
        // Le plateau couvre ce point du sol: c'est la table qu'on vise, pas le sol dessous.
        { type: 'point_at', target: { kind: 'ground', x: 9.4, y: 24.6 } },
      ];
      for (const [i, way] of ways.entries()) {
        sim.world.decor = [];
        hold(sim, c, 'small_vase');
        send(sim, who, way ?? { type: 'point_at', target: null });
        expect(c.placement?.on?.furniture, `visée ${String(i)}`).toBe(table);
        expect(c.placement?.valid).toBe(true);
        send(sim, who, { type: 'act' });
        expect(sim.world.decor.map((d) => d.on), `visée ${String(i)}`).toEqual([table]);
        // Rien n'est posé au sol, sous ou à côté de la table.
        expect(sim.world.furniture.some((f) => f.item === 'small_vase')).toBe(false);
        expect(countInBag(c, 'small_vase')).toBe(0);
      }
    });
  }

  it('table pleine ou dans le coin de l’autre: l’aperçu reste rouge sur la table, rien ne tombe au sol', () => {
    const { sim, table } = playerTable();
    const c = at(sim, 'p2', 8.5, 23.4, SOUTH);
    // Le coin de l'hôte couvre la table: l'invité ne peut rien y poser.
    character(sim, 'p1').corner = { cx: 8, cy: 24 };
    hold(sim, c, 'jay_feather');
    send(sim, 'p2', { type: 'point_at', target: { kind: 'furniture', furniture: table } });
    expect(c.placement?.on?.furniture).toBe(table);
    expect(c.placement?.valid).toBe(false);
    send(sim, 'p2', { type: 'act' });
    expect(sim.world.decor).toEqual([]);
    expect(sim.world.furniture.some((f) => f.item === 'jay_feather')).toBe(false);
    expect(countInBag(c, 'jay_feather')).toBe(1);
  });

  it('sans meuble porteur visé, le pot de fleurs se pose toujours au sol', () => {
    const { sim } = playerTable();
    const c = at(sim, 'p1', 7.5, 24.5, -SOUTH);
    hold(sim, c, 'flower_pot');
    send(sim, 'p1', { type: 'point_at', target: null });
    updatePlacement(sim, c);
    expect(c.placement).not.toBeNull();
    expect(c.placement?.on).toBeUndefined();
  });
});

describe('objets muraux (R15, R17): une place sur le mur, jamais sur une fenêtre ni une porte', () => {
  /** La pièce sans meuble posé par le joueur, la table contre le mur est (deux cases, 10, 24 et 10, 25). */
  function room(): Sim {
    const sim = autumn();
    sim.world.furniture = sim.world.furniture.filter((f) => f.placedBy === null || f.item === 'tool_rack');
    sim.world.furniture.push({ id: 'f_table_est', item: 'table', cell: { cx: 10, cy: 24 }, rotation: 1, placedBy: 'p1' });
    return sim;
  }

  it('cadre au-dessus d’une table: accepté (le mobilier bas devant le mur ne gêne pas)', () => {
    const sim = room();
    expect(placementProblem(sim, 'picture_frame', { cx: 10, cy: 25 }, 3, null, 'p1')).toBeNull();
    const c = at(sim, 'p1', 9.5, 25.5, 0);
    hold(sim, c, 'picture_frame');
    expect(placeFurniture(sim, c, { cx: 10, cy: 25 }, 3)).toBe(true);
  });

  it('cadre sur une fenêtre: refusé (aucun pan libre assez près)', () => {
    const sim = room();
    // Fenêtre sud-est de la façade (x 10,2): entre elle et le coin, 25 cm seulement.
    expect(placementProblem(sim, 'picture_frame', { cx: 10, cy: 25 }, 2, null, 'p1')).toBe('wall_opening');
    // Visé sur la fenêtre est, il glisse sur le pan libre à côté: jamais devant elle.
    const span = wallSpanOf(sim.content, sim.map, sim.world, 'picture_frame', { cx: 10, cy: 24 }, 3);
    expect(typeof span).not.toBe('string');
    const east = windowsNow(sim.content, sim.map, sim.world.rooms).find((w) => w.id === 'window_5');
    if (typeof span !== 'string' && east !== undefined) {
      expect(span.from >= east.y + east.width / 2 || span.to <= east.y - east.width / 2).toBe(true);
    }
  });

  it('cadre sur une porte: refusé', () => {
    const sim = room();
    // La porte de la maison (case 8, 26): le cadre sur le mur sud, juste au-dessus d'elle.
    expect(placementProblem(sim, 'picture_frame', { cx: 8, cy: 25 }, 2, null, 'p1')).toBe('wall_opening');
  });

  it('cadre sur un autre cadre: refusé; un meuble haut (étagère) prend le mur au-dessus de lui', () => {
    const sim = room();
    sim.world.furniture.push({ id: 'f_cadre', item: 'picture_frame', cell: { cx: 10, cy: 25 }, rotation: 3, placedBy: 'p1' });
    expect(placementProblem(sim, 'wall_clock', { cx: 10, cy: 25 }, 3, null, 'p1')).toBe('overlap');
    sim.world.furniture.push({ id: 'f_etagere', item: 'shelf', cell: { cx: 7, cy: 22 }, rotation: 0, placedBy: 'p1' });
    expect(placementProblem(sim, 'picture_frame', { cx: 7, cy: 22 }, 0, null, 'p1')).toBe('overlap');
  });

  it('le râtelier est sur un pan de mur libre; à son ancienne place il passait devant la fenêtre', () => {
    const sim = autumn();
    const rack = sim.world.furniture.find((f) => f.item === TOOL_RACK.item);
    expect(rack?.cell).toEqual(TOOL_RACK.cell);
    const span = wallPlacement(sim.content, sim.map, sim.world, TOOL_RACK.item, TOOL_RACK.cell, TOOL_RACK.rotation, TOOL_RACK.id);
    expect(typeof span).not.toBe('string');
    expect(wallSpanOf(sim.content, sim.map, sim.world, TOOL_RACK.item, OLD_TOOL_RACK_CELL, 2)).toBe('wall_opening');
    // Une fois le cellier bâti, sa porte (case 5, 24) ne touche pas le râtelier non plus.
    sim.world.rooms.room_cellar = { ...(sim.world.rooms.room_cellar ?? { builtDay: null }), builtDay: 40 } as never;
    expect(typeof wallSpanOf(sim.content, sim.map, sim.world, TOOL_RACK.item, TOOL_RACK.cell, TOOL_RACK.rotation)).not.toBe('string');
  });

  it('tout objet mural du contenu tient dans la largeur que la règle lui donne (modèle de l’artiste)', () => {
    const { content } = contentAndMap();
    for (const def of Object.values(content.items)) {
      if (!def.wall) continue;
      expect(def.wallWidth, def.id).toBeGreaterThan(0.2);
    }
  });
});

describe('colis porté à deux (R14)', () => {
  function withParcel(): Sim {
    const sim = newSim(5);
    play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null && s.world.beam === null, SIM_HZ * 1200);
    sim.world.catalogueOrders.push('wood_stove');
    deliverCatalogue(sim);
    step(sim, { controls: {}, intents: [] });
    return sim;
  }

  it('soulevé, les deux porteurs se font face de part et d’autre du colis, à `carry.grip.apart` l’un de l’autre', () => {
    const sim = withParcel();
    const beam = sim.world.beam;
    if (beam === null) throw new Error('pas de colis');
    // Côte à côte, du même côté du colis (la capture du client): ils se rangent de part et d'autre.
    placeCharacter(sim, character(sim, 'p1'), { x: beam.pos.x - 0.3, y: beam.pos.y + 0.6 });
    placeCharacter(sim, character(sim, 'p2'), { x: beam.pos.x + 0.5, y: beam.pos.y + 0.6 });
    const frame: ControlFrame = { seq: 1, moveX: 0, moveY: 0, actHeld: true };
    step(sim, { controls: { p1: frame, p2: frame }, intents: [] });
    const a = character(sim, 'p1');
    const b = character(sim, 'p2');
    expect(sim.world.beam?.carried).toBe(true);
    const apart = sim.content.settings.carry.grip.apart;
    expect(Math.hypot(b.pos.x - a.pos.x, b.pos.y - a.pos.y)).toBeCloseTo(apart, 3);
    // Le colis au milieu, chacun tourné vers l'autre.
    expect((a.pos.x + b.pos.x) / 2).toBeCloseTo(beam.pos.x, 3);
    expect((a.pos.y + b.pos.y) / 2).toBeCloseTo(beam.pos.y, 3);
    expect(Math.cos(a.facing - Math.atan2(b.pos.y - a.pos.y, b.pos.x - a.pos.x))).toBeCloseTo(1, 3);
  });
});
