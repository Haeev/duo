// Pièces du rendu encré (ADR 0023): plan tiré des données (portes, fenêtres des façades ou
// déclarées, appliques), géométries des murs entiers et coupés, style choisi par un champ, coque
// d'ombre, ambiances `piece`. Logique pure: aucun contexte WebGL.
import { Mesh, Scene } from 'three';
import { describe, expect, it } from 'vitest';
import * as v from 'valibot';
import { InteriorSchema } from '../../src/donnees/schemas/lieu';
import { ambianceAt, gameAmbiances } from '../../src/rendu/encre/ambiances';
import { createInkUniforms, InkMaterial } from '../../src/rendu/encre/matiere';
import { SHADOW_ONLY, StageSort, SUN_LAYER } from '../../src/rendu/encre/ombres';
import { doorVolumes } from '../../src/rendu/lieu/description';
import { DOOR_CUT_COUNT, standInGeometry } from '../../src/rendu/lieu/formes';
import { buildRoom } from '../../src/rendu/lieu/piece-geometrie';
import {
  type BuildingSheet,
  type RoomDef,
  type RoomFacade,
  roomFacades,
  roomPlan,
} from '../../src/rendu/lieu/pieces';
import {
  DEFAULT_ROOM_STYLE,
  ROOM_STYLES,
  type RoomStyle,
  roomStyle,
} from '../../src/rendu/lieu/reglages-pieces';

const INTERIORS = import.meta.glob<{ id: string; style?: string }>(
  '../../donnees/lieux/*/interieurs/*.json',
  { import: 'default', eager: true },
);

const ROOM: RoomDef = { id: 'factice', at: { x: 20, y: 300 }, width: 8, height: 6 };
/** Porte au milieu du mur sud de la pièce factice. */
const DOOR = { kind: 'wall', x: 24, y: 306, halfWidth: 0.5 } as const;
/** Façades d'un bâtiment de 9 x 7: deux fenêtres au nord, une à l'est, porte au sud. */
const FACADE: RoomFacade = {
  width: 9,
  depth: 7,
  turns: 0,
  windows: [
    { x: -2, z: -3.5, nx: 0, nz: -1, width: 0.95, sill: 1, height: 1.25 },
    { x: 2, z: -3.5, nx: 0, nz: -1, width: 0.95, sill: 1, height: 1.25 },
    { x: 4.5, z: 0, nx: 1, nz: 0, width: 0.95, sill: 1, height: 1.25 },
  ],
};

function wallOf(plan: ReturnType<typeof roomPlan>, side: string): (typeof plan.walls)[number] {
  const wall = plan.walls.find((w) => w.side === side);
  if (wall === undefined) throw new Error(`mur ${side} absent`);
  return wall;
}

const windowsOf = (plan: ReturnType<typeof roomPlan>, side: string): number =>
  wallOf(plan, side).openings.filter((o) => o.kind === 'window').length;

describe('plan d’une pièce', () => {
  it('la porte perce son mur, les fenêtres viennent des façades du bâtiment', () => {
    const plan = roomPlan(ROOM, [DOOR], FACADE);
    const south = wallOf(plan, 'sud');
    expect(south.openings).toHaveLength(1);
    expect(south.openings[0]?.kind).toBe('door');
    expect(south.openings[0]?.u0).toBeLessThan(4);
    expect(south.openings[0]?.u1).toBeGreaterThan(4);
    expect(windowsOf(plan, 'nord')).toBe(2);
    expect(windowsOf(plan, 'est')).toBe(1);
    expect(windowsOf(plan, 'ouest')).toBe(0);
    // Place le long du mur: à l'échelle de la pièce (8 m pour une façade de 9 m).
    const first = wallOf(plan, 'nord').openings[0];
    expect(((first?.u0 ?? 0) + (first?.u1 ?? 0)) / 2).toBeCloseTo(4 - (2 * 8) / 9, 2);
  });

  it('aucune fenêtre derrière une armoire ni contre une cloison', () => {
    const tall = { x0: 21.4, z0: 300, x1: 23, z1: 300.6, height: 1.9 };
    const masked = roomPlan(ROOM, [DOOR], FACADE, [tall]);
    // La fenêtre de gauche se décale ou disparaît, jamais derrière le meuble.
    for (const o of wallOf(masked, 'nord').openings)
      expect(o.u1 <= 1.4 - 0.08 || o.u0 >= 3 + 0.08).toBe(true);
    const low = roomPlan(ROOM, [DOOR], FACADE, [{ ...tall, height: 0.8 }]);
    expect(windowsOf(low, 'nord')).toBe(2);
    // Une cloison qui s'appuie au mur est (z de 302,3 à 302,7): la fenêtre s'en écarte.
    const parted = roomPlan({ ...ROOM, blocked: [{ x: 6, y: 2, w: 2, h: 1 }] }, [DOOR], FACADE);
    expect(parted.partitions).toHaveLength(1);
    for (const o of wallOf(parted, 'est').openings) expect(o.u1 <= 2.3 || o.u0 >= 2.7).toBe(true);
  });

  it('fenêtres déclarées par la pièce: elles remplacent celles des façades', () => {
    const plan = roomPlan({ ...ROOM, windows: [{ side: 'ouest', at: 3, width: 1.2 }] }, [], FACADE);
    expect(windowsOf(plan, 'nord')).toBe(0);
    const west = wallOf(plan, 'ouest').openings[0];
    expect(west?.kind).toBe('window');
    expect((west?.u1 ?? 0) - (west?.u0 ?? 0)).toBeCloseTo(1.2);
    expect(windowsOf(roomPlan({ ...ROOM, windows: [] }, [], FACADE), 'nord')).toBe(0);
  });

  it('sans façade connue: une fenêtre par travée; une cave n’en a aucune', () => {
    const plan = roomPlan(ROOM, [DOOR]);
    expect(windowsOf(plan, 'nord')).toBeGreaterThanOrEqual(1);
    const cave = roomPlan({ ...ROOM, style: 'cave' }, [DOOR], FACADE);
    for (const wall of cave.walls) expect(wall.openings.every((o) => o.kind === 'door')).toBe(true);
  });

  it('appliques: sur les pans libres, espacées, quatre au plus, sans ombre portée', () => {
    const plan = roomPlan(ROOM, [DOOR], FACADE);
    expect(plan.lamps.length).toBeGreaterThanOrEqual(1);
    expect(plan.lamps.length).toBeLessThanOrEqual(4);
    for (const lamp of plan.lamps) {
      expect(lamp.shadow).toBe(false);
      expect(lamp.x).toBeGreaterThan(20);
      expect(lamp.x).toBeLessThan(28);
      expect(lamp.z).toBeGreaterThan(300);
      expect(lamp.z).toBeLessThan(306);
    }
    const every = plan.style.lamps?.every ?? 0;
    plan.lamps.forEach((a, i) => {
      for (const b of plan.lamps.slice(i + 1))
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(every);
    });
  });
});

describe('porte d’un mur coupé', () => {
  const sill = { kind: 'wall', x: 24, y: 306, nx: 0, ny: -1, halfWidth: 0.5 } as const;

  it('la porte se fabrique en deux parts: le bas seul se dessine quand son mur est coupé', () => {
    const [door] = doorVolumes('porte', sill, true, undefined, 0.42);
    if (door === undefined) throw new Error('porte absente');
    expect(door.cutHeight).toBe(0.42);
    const geometry = standInGeometry(door);
    const index = geometry.getIndex();
    const count: unknown = geometry.userData[DOOR_CUT_COUNT];
    if (index === null || typeof count !== 'number') throw new Error('porte sans partie basse');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(index.count);
    const position = geometry.getAttribute('position');
    let low = 0;
    let high = Infinity;
    for (let i = 0; i < index.count; i += 1) {
      const y = position.getY(index.getX(i));
      if (i < count) low = Math.max(low, y);
      else high = Math.min(high, y);
    }
    expect(low).toBeCloseTo(0.42);
    expect(high).toBeGreaterThanOrEqual(0.42 - 1e-6);
  });

  it('sans hauteur de coupe (porte d’un petit lieu), elle reste entière', () => {
    const [door] = doorVolumes('porte', sill, true);
    if (door === undefined) throw new Error('porte absente');
    expect(standInGeometry(door).userData[DOOR_CUT_COUNT]).toBeUndefined();
  });
});

describe('façades d’une pièce', () => {
  const sheet: BuildingSheet = { width: 9, depth: 7, door: 'sud', windows: FACADE.windows };
  const upstairs: RoomDef = { id: 'etage', at: { x: 40, y: 300 }, width: 8, height: 6 };
  const map = {
    buildings: { maison: { interior: 'factice' }, hangar: { interior: null } },
    doors: {
      dehors: { x: 100.5, y: 50.5, to: 'dedans' },
      dedans: { x: 24.5, y: 305.5, to: 'dehors' },
      'esc-bas': { x: 20.5, y: 300.5, to: 'esc-haut' },
      'esc-haut': { x: 40.5, y: 300.5, to: 'esc-bas' },
    },
  };
  const sills = {
    dedans: { kind: 'wall', x: 24.5, y: 306 },
    dehors: { kind: 'wall', x: 100.5, y: 51 },
    'esc-bas': { kind: 'floor', x: 20.5, y: 300.5 },
    'esc-haut': { kind: 'floor', x: 40.5, y: 300.5 },
  } as const;

  it('la pièce d’un bâtiment et son étage tiennent leurs fenêtres de sa fiche', () => {
    const facades = roomFacades(map, [ROOM, upstairs], sills, (id) =>
      id === 'maison' ? sheet : null,
    );
    expect(facades.get('factice')?.turns).toBe(0);
    expect(facades.get('etage')?.windows).toHaveLength(3);
  });

  it('le bâtiment se cale sur le mur de la porte de la pièce', () => {
    const facades = roomFacades(map, [ROOM], sills, () => ({ ...sheet, door: 'ouest' }));
    // Porte du bâtiment à l'ouest, porte de la pièce au sud: trois quarts de tour.
    expect(facades.get('factice')?.turns).toBe(3);
    const plan = roomPlan(ROOM, [DOOR], facades.get('factice'));
    // Les deux fenêtres du nord du bâtiment se retrouvent sur le mur ouest de la pièce.
    expect(windowsOf(plan, 'ouest')).toBe(2);
  });
});

describe('gabarit: un style de pièce se choisit par un champ', () => {
  /** Style factice: plus haut, carrelé, sans lambris ni lampe. */
  const dummy: RoomStyle = {
    ...roomStyle(undefined),
    pourquoi: 'style factice du test',
    height: 3.1,
    cut: 0.6,
    wainscot: null,
    lamps: null,
    floor: {
      kind: 'carreaux',
      colors: ['#aa5544', '#ddccaa'],
      size: 0.5,
      joint: 0.02,
      jointColor: '#333333',
    },
  };
  const styles = { ...ROOM_STYLES, factice: dummy };

  it('le style nommé est pris, un style absent ou inconnu rend celui d’Aubrune', () => {
    expect(roomStyle('factice', styles)).toBe(dummy);
    expect(roomStyle(undefined)).toBe(ROOM_STYLES[DEFAULT_ROOM_STYLE]);
    expect(roomStyle('inconnu')).toBe(ROOM_STYLES[DEFAULT_ROOM_STYLE]);
  });

  it('une pièce factice au style factice se construit sans autre changement', () => {
    const room: RoomDef = { ...ROOM, style: 'factice', rugs: [{ x: 2, y: 2, w: 2, h: 1.5 }] };
    const plan = roomPlan(room, [DOOR], FACADE, [], roomStyle(room.style, styles));
    expect(plan.lamps).toHaveLength(0);
    const built = buildRoom(plan);
    expect(built.walls).toHaveLength(4);
    for (const wall of built.walls) {
      // Mur du fond à hauteur de pièce, mur du devant coupé bas, les deux sur la même emprise.
      expect(wall.full.boundingBox?.max.y).toBeCloseTo(3.1);
      expect(wall.stub.boundingBox?.max.y).toBeCloseTo(0.6);
      expect(wall.stub.getIndex()?.count ?? 0).toBeLessThan(wall.full.getIndex()?.count ?? 0);
    }
    // Sol posé pièce par pièce, jamais au-dessus du niveau où marchent les personnages (sauf le tapis).
    const floor = built.floor.boundingBox;
    expect(floor?.min.x).toBeCloseTo(20 - 0.05);
    expect(floor?.max.x).toBeCloseTo(28 + 0.05);
    expect(floor?.max.y).toBeLessThan(0.06);
    expect((built.floor.getIndex()?.count ?? 0) / 3).toBeGreaterThan(8 * 6 * 4 * 10 * 0.9);
    // La coque d'ombre ferme la pièce au-dessus de ses murs.
    expect(built.shell.boundingBox?.max.y).toBeGreaterThan(3.1);
    for (const geometry of [
      built.floor,
      built.shell,
      built.backdrop,
      ...built.walls.map((w) => w.full),
    ])
      expect(geometry.getAttribute('aInk').count).toBe(geometry.getAttribute('position').count);
  });

  it('budget: une grande pièce du style par défaut reste sous 12 000 triangles affichés', () => {
    const big: RoomDef = { id: 'grande', at: { x: 0, y: 300 }, width: 20, height: 11 };
    const built = buildRoom(roomPlan(big, []));
    const count = (geometry: { getIndex(): { count: number } | null }): number =>
      (geometry.getIndex()?.count ?? 0) / 3;
    const shown =
      count(built.floor) +
      count(built.backdrop) +
      built.walls.reduce((n, w) => n + count(w.full), 0);
    expect(shown).toBeLessThan(12_000);
  });

  it('les styles cités par les intérieurs livrés existent, le schéma accepte les champs', () => {
    const cited = Object.values(INTERIORS)
      .map((room) => room.style)
      .filter((style): style is string => style !== undefined);
    expect(cited.length).toBeGreaterThan(0);
    for (const style of cited) expect(Object.keys(ROOM_STYLES)).toContain(style);
    const parsed = v.safeParse(InteriorSchema, {
      schema: 1,
      id: 'factice',
      name: 'Pièce factice',
      width: 8,
      height: 6,
      at: { x: 20, y: 300 },
      blocked: [],
      points: {},
      objects: [],
      style: 'factice',
      windows: [{ side: 'nord', at: 2.5 }],
      rugs: [{ x: 2, y: 2, w: 1.5, h: 1.2, color: '#a8443a' }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('lumière d’une pièce', () => {
  it('coque d’ombre: jamais dessinée, elle porte l’ombre du soleil', () => {
    const scene = new Scene();
    const material = new InkMaterial(createInkUniforms());
    const built = buildRoom(roomPlan(ROOM, [DOOR], FACADE));
    const wall = new Mesh(built.walls[0]?.full, material);
    const shell = new Mesh(built.shell, material);
    shell.castShadow = true;
    shell.userData[SHADOW_ONLY] = true;
    scene.add(wall, shell);
    const sort = new StageSort();
    for (let i = 0; i < 6; i += 1) sort.sort(scene);
    expect(sort.pending).toBe(false);
    expect(wall.layers.isEnabled(0)).toBe(true);
    expect(shell.layers.isEnabled(0)).toBe(false);
    expect(shell.layers.isEnabled(SUN_LAYER)).toBe(true);
    expect(wall.layers.isEnabled(SUN_LAYER)).toBe(false);
  });

  it('ambiances « piece »: le soleil suit l’heure et son ombre est entière; le dedans ne change pas', () => {
    const book = gameAmbiances();
    const query = { sheet: null, minutes: 12 * 60, indoor: 1, weather: null };
    const room = ambianceAt(book, { ...query, room: true });
    const closed = ambianceAt(book, query);
    expect(room.sun).toBeNull();
    expect(room.sunShadow).toBe(1);
    expect(closed.sun).not.toBeNull();
    expect(closed.sunShadow).toBe(0);
    // Clair à midi, dense en fin de journée: le ton d'ombre baisse nettement.
    const late = ambianceAt(book, { ...query, minutes: 17 * 60, room: true });
    expect(late.shade[0]).toBeLessThan(room.shade[0] - 0.15);
  });
});
