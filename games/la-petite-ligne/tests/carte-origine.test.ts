/**
 * 0.13 (v0-13-carte.md, section 2; lot L0): la carte agrandie a une origine de grille (`taille.origine`,
 * x -24, y -30). La lecture la prend en compte: la ligne 0 du terrain est la rangée y -30, le caractère 0
 * la colonne x -24, et les coordonnées du bourg d'avant ne bougent pas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../src/donnees/carte';
import { MAP_FILES } from '../src/donnees/cartes-fichiers';
import { LEVEL_MAP_FILE } from '../src/donnees/carte-niveau';
import { cellIndex, groundAt, inMap, mapMaxX, mapMaxY, mapMinX, mapMinY } from '../src/etat/carte';
import { ALL_DOORS } from '../src/simulation/interieurs';
import { findPath } from '../src/simulation/grille';

interface RawMap {
  taille: { largeur: number; hauteur: number; origine?: { x: number; y: number } };
  terrain: { legende: Record<string, { sol: string }>; lignes: string[] };
  infranchissable: { grille: string[] };
  points: { id: string; x: number; y: number }[];
}

const RAW = MAP_FILES[LEVEL_MAP_FILE] as RawMap;

function withOrigin(origin: { x: number; y: number } | undefined): ReturnType<typeof loadMap> {
  const raw = structuredClone(RAW) as { taille: Record<string, unknown> };
  if (origin === undefined) delete raw.taille.origine;
  else raw.taille.origine = origin;
  return loadMap({ [LEVEL_MAP_FILE]: raw });
}

describe('origine de la grille (0.13, lot L0)', () => {
  const result = loadMap(MAP_FILES);
  const { map } = result;

  it('lit la carte agrandie: 164 x 78 m, grille de x -24 à 139 et de y -30 à 47', () => {
    expect(result.warning).toBeNull();
    expect(result.source).toBe('level');
    expect([map.originX, map.originY, map.width, map.height]).toEqual([-24, -30, 164, 78]);
    expect([mapMinX(map), mapMaxX(map), mapMinY(map), mapMaxY(map)]).toEqual([-24, 139, -30, 47]);
    expect(cellIndex(map, -24, -30)).toBe(0);
    expect(cellIndex(map, 139, 47)).toBe(map.width * map.height - 1);
  });

  it('chaque case est lue à sa place: sol et cases bloquées comme dans le fichier', () => {
    const legend = RAW.terrain.legende;
    for (let row = 0; row < map.height; row += 7) {
      for (let col = 0; col < map.width; col += 5) {
        const cx = col - 24;
        const cy = row - 30;
        const code = RAW.terrain.lignes[row]?.[col] ?? '';
        expect(groundAt(map, cx, cy), `(${String(cx)}, ${String(cy)})`).toBe(legend[code]?.sol);
        const blocked = RAW.infranchissable.grille[row]?.[col] === '#';
        const tree = map.trees.some((t) => Math.floor(t.pos.x) === cx && Math.floor(t.pos.y) === cy);
        if (!tree) expect(map.blocked[cellIndex(map, cx, cy)], `(${String(cx)}, ${String(cy)})`).toBe(blocked);
      }
    }
    // Le bourg d'avant garde ses coordonnées: la porte de la maisonnette et la voie.
    expect(map.house.door).toEqual({ cx: 8, cy: 26 });
    expect(groundAt(map, 30, 13)).toBe('rail');
  });

  it('la carte du tour 10, sans origine, se lit comme avant (grille à partir de 0)', () => {
    const before = JSON.parse(readFileSync(fileURLToPath(new URL('../donnees/cartes-tour-10/halte.json', import.meta.url)), 'utf8')) as unknown;
    const old = loadMap({ [LEVEL_MAP_FILE]: before });
    expect(old.warning).toBeNull();
    expect([old.map.originX, old.map.originY, old.map.width, old.map.height]).toEqual([0, 0, 100, 48]);
    expect(old.map.house.door).toEqual(map.house.door);
    expect(old.map.points.house_door).toEqual(map.points.house_door);
    const fallback = loadMap({});
    expect([fallback.map.originX, fallback.map.originY]).toEqual([0, 0]);
  });

  it('lue sans son origine, la carte agrandie déborde de la grille: refusée, avec la raison', () => {
    for (const origin of [undefined, { x: 0, y: 0 }]) {
      const wrong = withOrigin(origin);
      expect(wrong.source).toBe('fallback');
      expect(wrong.warning).toMatch(/hors de la carte|attendu/);
    }
  });

  it('le point `offstage` est hors de la carte, quelle que soit l’origine', () => {
    for (const m of [map, loadMap({}).map]) {
      const off = m.points.offstage;
      expect(off).toBeDefined();
      if (off !== undefined) expect(inMap(m, Math.floor(off.x), Math.floor(off.y))).toBe(false);
    }
  });

  it('A* (octile, 12 000 nœuds): Barnabé va de la coupe à l’atelier de la forge', () => {
    const from = map.points.forest_cut;
    const to = map.points.forge_inside;
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    if (from === undefined || to === undefined) return;
    const b = { map, dynamic: new Uint8Array(map.width * map.height), door: ALL_DOORS };
    const path = findPath(b, from, to);
    expect(path).not.toBeNull();
    const last = path?.[path.length - 1];
    expect(Math.hypot((last?.x ?? 0) - to.x, (last?.y ?? 0) - to.y)).toBeLessThan(1);
    // Un long trajet: 1 000 nœuds n'y suffisent pas.
    expect(findPath(b, from, to, 1000)).toBeNull();
  });
});
