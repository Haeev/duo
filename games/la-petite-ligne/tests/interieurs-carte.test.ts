/**
 * Tour 10, lot L0 (ADR 0016): lecture des bâtiments visitables, du ru et de ses passages, `inside`
 * calculé à chaque pas et à chaque placement, champs nouveaux par défaut (monde neuf et sauvegarde
 * du format 6), état borné.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { checkMap, loadMap } from '../src/donnees/carte';
import { MAP_FILES } from '../src/donnees/cartes-fichiers';
import { buildFallbackMap } from '../src/donnees/carte-secours';
import { LEVEL_MAP_FILE } from '../src/donnees/carte-niveau';
import { buildingAt, HOUSE_BUILDING } from '../src/etat/carte';
import { IntentSchema } from '../src/reseau/schemas';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { contentAndMap, newSim } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const MAX_STATE_BYTES = 52_000;

/** La carte du jeu, modifiée par `change` (copie). */
function variant(change: (raw: Record<string, unknown>) => void): ReturnType<typeof loadMap> {
  const raw = structuredClone(MAP_FILES[LEVEL_MAP_FILE]) as Record<string, unknown>;
  change(raw);
  return loadMap({ [LEVEL_MAP_FILE]: raw });
}

interface RawBuilding {
  id: string;
  pieces: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
}

function rawBuildings(raw: Record<string, unknown>): RawBuilding[] {
  return raw.interieurs as RawBuilding[];
}

describe('carte élargie: bâtiments visitables', () => {
  it('lit les trois intérieurs de la carte, et la maisonnette depuis `buildings.house`', () => {
    const result = loadMap(MAP_FILES);
    expect(result.source).toBe('level');
    const { map } = result;
    expect(map.width).toBe(100);
    expect(Object.keys(map.buildings).sort()).toEqual(['grocery', 'house', 'salon']);

    const house = map.buildings.house;
    expect(house?.rooms.map((r) => [r.id, r.build?.room ?? null])).toEqual([
      ['house_main', null],
      ['house_cellar', 'room_cellar'],
      ['house_bedroom', 'room_bedroom'],
    ]);
    expect(map.house.room).toEqual(map.zones.house_interior);
    expect(map.house.door).toEqual({ cx: 8, cy: 26 });
    expect(map.house.spawn).toEqual(map.points.house_spawn);
    expect(house?.hours).toBeNull();
    expect(house?.ambience).toBeNull();
    const bedroom = house?.rooms.find((r) => r.id === 'house_bedroom')?.build;
    expect(bedroom).toMatchObject({
      sharedWall: 'south',
      site: 'room_bedroom_site',
      windows: ['north', 'east'],
      door: { cell: { cx: 9, cy: 21 }, from: 'house_main' },
    });
    const cellar = house?.rooms.find((r) => r.id === 'house_cellar')?.build;
    expect(cellar?.shelves).toHaveLength(2);
    expect(cellar?.sharedWall).toBe('east');

    expect(map.buildings.grocery).toMatchObject({
      prop: 'ferrand_shop',
      hours: 'grocer',
      ambience: 'room-tone-shop',
      spawnPoint: 'grocery_inside',
    });
    expect(map.buildings.grocery?.doors).toEqual([
      {
        id: 'grocery_porte',
        cell: { cx: 30, cy: 30 },
        outside: { cx: 31, cy: 30 },
        point: 'grocery_door',
      },
    ]);
    expect(map.buildings.grocery?.closedParts.map((p) => p.id)).toEqual(['grocery_dining_room']);
    expect(
      map.buildings.grocery?.fixtures.find((f) => f.id === 'grocery_inner_counter')?.cells,
    ).toEqual([
      { cx: 28, cy: 26 },
      { cx: 28, cy: 27 },
    ]);
    expect(map.buildings.salon).toMatchObject({
      prop: 'salon_shop',
      hours: 'salon',
      ambience: 'room-tone-salon',
      spawnPoint: 'salon_inside',
    });

    // Une porte franchissable, devant une case libre du dehors; l'apparition, franchissable aussi.
    for (const b of Object.values(map.buildings)) {
      for (const d of b.doors) {
        expect(map.blocked[d.cell.cy * map.width + d.cell.cx], `${b.id}: porte`).toBe(false);
        expect(map.blocked[d.outside.cy * map.width + d.outside.cx], `${b.id}: dehors`).toBe(false);
      }
      expect(
        map.blocked[Math.floor(b.spawn.y) * map.width + Math.floor(b.spawn.x)],
        `${b.id}: apparition`,
      ).toBe(false);
    }
  });

  it('lit le ru et ses quatre passages', () => {
    const { map } = loadMap(MAP_FILES);
    expect(map.stream).toEqual({ columns: [63, 64], fromY: 0, toY: 37 });
    expect(map.crossings.map((c) => [c.id, c.kind, c.model])).toEqual([
      ['ru_culvert', 'culvert', 'ru_culvert'],
      ['ru_road_bridge', 'bridge', 'ru_road_bridge'],
      ['ru_footbridge', 'footbridge', 'ru_footbridge'],
      ['ru_stepping_stones', 'ford', 'ru_stepping_stones'],
    ]);
    expect(map.crossings.find((c) => c.id === 'ru_road_bridge')?.widthM).toBe(3);
    expect(map.crossings.find((c) => c.id === 'ru_culvert')?.widthM).toBeNull();
  });

  it('refuse une carte abîmée et garde la carte de secours, avec la raison', () => {
    const noHouse = variant((raw) => {
      raw.interieurs = rawBuildings(raw).filter((b) => b.id !== 'house');
    });
    expect(noHouse.source).toBe('fallback');
    expect(noHouse.warning).toContain('« house » absent');

    const shared = variant((raw) => {
      const list = rawBuildings(raw);
      const grocery = list.find((b) => b.id === 'grocery');
      const salon = list.find((b) => b.id === 'salon');
      if (grocery?.pieces[0] === undefined || salon?.pieces[0] === undefined) return;
      salon.pieces[0].rect = { ...grocery.pieces[0].rect };
      (salon as RawBuilding & { apparition: string }).apparition = 'grocery_inside';
    });
    expect(shared.source).toBe('fallback');
    expect(shared.warning).toContain('partagée avec « grocery »');

    const outside = variant((raw) => {
      const salon = rawBuildings(raw).find((b) => b.id === 'salon');
      if (salon?.pieces[0] !== undefined) salon.pieces[0].rect = { x: 98, y: 26, w: 5, h: 5 };
    });
    expect(outside.warning).toContain('rectangle hors de la carte');

    const badCrossing = variant((raw) => {
      const list = raw.ouvrages as { nature: string }[];
      if (list[0] !== undefined) list[0].nature = 'tunnel';
    });
    expect(badCrossing.warning).toContain('ponceau, pont, passerelle ou gue attendu');

    const badSpawn = variant((raw) => {
      const grocery = rawBuildings(raw).find((b) => b.id === 'grocery') as
        (RawBuilding & { apparition: string }) | undefined;
      if (grocery !== undefined) grocery.apparition = 'salon_inside';
    });
    expect(badSpawn.warning).toContain('hors des pièces de « grocery »');
  });

  it('lit une carte d’avant le tour 10 (sans `interieurs`, `ru` ni `ouvrages`): la maisonnette seule', () => {
    const old = variant((raw) => {
      delete raw.interieurs;
      delete raw.ru;
      delete raw.ouvrages;
    });
    expect(old.source).toBe('level');
    expect(Object.keys(old.map.buildings)).toEqual([HOUSE_BUILDING]);
    expect(old.map.buildings.house?.rooms[0]?.rect).toEqual(old.map.house.room);
    expect(old.map.stream).toBeNull();
    expect(old.map.crossings).toEqual([]);
  });

  it('la carte de secours a la maisonnette comme seul bâtiment visitable', () => {
    const map = buildFallbackMap();
    checkMap(map);
    expect(Object.keys(map.buildings)).toEqual([HOUSE_BUILDING]);
    expect(map.buildings.house?.rooms[0]?.rect).toEqual(map.house.room);
    expect(map.buildings.house?.spawn).toEqual(map.house.spawn);
    expect(map.buildings.house?.doors[0]?.cell).toEqual(map.house.door);
    expect(map.stream).toBeNull();
  });
});

describe('Character.inside', () => {
  it('une pièce à bâtir ne compte qu’une fois bâtie', () => {
    const { map } = contentAndMap();
    expect(buildingAt(map, {}, 3.5, 23.5)).toBeNull();
    expect(buildingAt(map, { room_cellar: { builtDay: null } }, 3.5, 23.5)).toBeNull();
    expect(buildingAt(map, { room_cellar: { builtDay: 25 } }, 3.5, 23.5)).toBe(HOUSE_BUILDING);
    expect(buildingAt(map, {}, 8.5, 18.5)).toBeNull();
    expect(buildingAt(map, { room_bedroom: { builtDay: 40 } }, 8.5, 18.5)).toBe(HOUSE_BUILDING);
    // La salle à manger de la pension n'est pas une pièce: on n'y est pas « dedans ».
    expect(buildingAt(map, {}, 26.5, 24.5)).toBeNull();
  });

  it('`placeCharacter` et chaque pas le recalculent, à côté de `inHouse`', () => {
    const sim = newSim();
    const c = character(sim, 'p1');
    const { points } = sim.map;
    expect(c.inside).toBeNull();
    const cases: [string, string | null, boolean][] = [
      ['house_spawn', 'house', true],
      ['grocery_inside', 'grocery', false],
      ['salon_inside', 'salon', false],
      ['train_stop', null, false],
    ];
    for (const [id, building, inHouse] of cases) {
      const at = points[id];
      if (at === undefined) throw new Error(`point ${id} absent`);
      placeCharacter(sim, c, at);
      expect([id, c.inside, c.inHouse]).toEqual([id, building, inHouse]);
    }
    // Déplacé sans `placeCharacter` (comme le fait la marche): le pas suivant suit.
    const shop = points.grocery_inside;
    if (shop === undefined) throw new Error('point grocery_inside absent');
    c.pos = { x: shop.x, y: shop.y };
    step(sim, { controls: {}, intents: [] });
    expect(c.inside).toBe('grocery');
    for (const villager of sim.world.villagers) expect(villager.inside).toBeNull();
  });
});

describe('état du tour 10: valeurs par défaut', () => {
  it('monde neuf: besoins, coiffure, barbe, pièces, râtelier', () => {
    const sim = newSim();
    const [p1, p2] = sim.world.characters;
    expect(p1?.appearance).toMatchObject({ hair: 0, hairColor: 1, beard: 0 });
    expect(p2?.appearance).toMatchObject({ hairColor: 0, beard: 0 });
    expect(p1?.needs).toMatchObject({
      apartMinutes: 0,
      reunionsToday: 0,
      nappedToday: false,
      napStart: null,
      curtainsMorningDone: false,
      missingShown: false,
    });
    expect(p1?.hairChangedDay).toBeNull();
    expect(p1?.hairNoticedBy).toBeNull();
    expect(sim.world.rooms).toEqual({});
    expect(sim.world.rack).toEqual([]);
    expect(sim.world.villagers.every((villager) => villager.inside === null)).toBe(true);
  });

  it('sauvegarde du format 6 (écrite avant le tour 10): champs remplis, `inside` recalculé, état sous la borne', () => {
    const { content, map } = contentAndMap();
    const file = new URL('./donnees/sauvegardes/format-6-automne-jour-62.json', import.meta.url);
    const ref = JSON.parse(readFileSync(fileURLToPath(file), 'utf8')) as {
      dataSchema: number;
      data: Record<string, unknown>;
    };
    expect(ref.dataSchema).toBe(6);
    expect(ref.data.rooms).toBeUndefined();
    const sim = restoreWorld(content, map, structuredClone(ref.data), ref.dataSchema, [A, B]);
    for (const c of sim.world.characters) {
      expect(c.appearance.hairColor).toBe(c.id === 'p1' ? 1 : 0);
      expect(c.appearance.beard).toBe(0);
      expect(c.needs.apartMinutes).toBe(0);
      expect(c.needs.napStart).toBeNull();
      expect(c.inside).toBe(buildingAt(map, {}, c.pos.x, c.pos.y));
      expect(c.inside === HOUSE_BUILDING).toBe(c.inHouse);
    }
    expect(sim.world.rooms).toEqual({});
    expect(sim.world.rack).toEqual([]);
    // L'écriture reste au format 6 (le format 7 vient avec le lot L4) et repasse la lecture.
    const snap = snapshotOf(sim);
    expect(snap.dataSchema).toBe(6);
    const bytes = new TextEncoder().encode(JSON.stringify(snap.data)).length;
    expect(bytes).toBeLessThan(MAX_STATE_BYTES);
    const again = restoreWorld(content, map, structuredClone(snap.data), snap.dataSchema, [A, B]);
    expect(again.world.characters.map((c) => c.inside)).toEqual(
      sim.world.characters.map((c) => c.inside),
    );
  });
});

describe('schémas réseau du tour 10', () => {
  it('la création accepte la couleur des cheveux et la barbe, facultatives', () => {
    const base = { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 };
    expect(v.safeParse(IntentSchema, base).success).toBe(true);
    expect(v.safeParse(IntentSchema, { ...base, hairColor: 3, beard: 2 }).success).toBe(true);
    expect(v.safeParse(IntentSchema, { ...base, hairColor: 'roux' }).success).toBe(false);
    expect(v.safeParse(IntentSchema, { ...base, beard: undefined }).success).toBe(false);
  });
});
