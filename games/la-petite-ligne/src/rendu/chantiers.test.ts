import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../donnees/contenu';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../donnees/fichiers';
import { newToday } from '../simulation/moments';
import { createWorld } from '../simulation/monde';
import { SIM_HZ } from '../etat/types';
import { lanternLevel, lanternPlan } from './chantiers';
import { lampIds } from './lampes';
import { MODEL_BY_PROP } from './modeles';
import { RENDER_SETTINGS } from './reglages';

const GLB_HEADER = 12;
const CHUNK_HEADER = 8;

interface GlbJson {
  nodes: { name?: string; extras?: Record<string, unknown>; children?: number[] }[];
  animations?: { name?: string }[];
}

function glb(file: string): GlbJson {
  const data = readFileSync(fileURLToPath(new URL(`../../assets/modeles/${file}`, import.meta.url)));
  const length = data.readUInt32LE(GLB_HEADER);
  return JSON.parse(data.subarray(GLB_HEADER + CHUNK_HEADER, GLB_HEADER + CHUNK_HEADER + length).toString('utf8')) as GlbJson;
}

function node(json: GlbJson, name: string): GlbJson['nodes'][number] | undefined {
  return json.nodes.find((n) => n.name === name);
}

const content = loadContent(CONTENT_FILES);
const { map } = loadMap(MAP_FILES);

describe('tour 9: noms des modèles cherchés par le rendu', () => {
  // Un nom faux ne lève aucune erreur à l'écran (substitut ou objet figé): on les vérifie dans les GLB.
  it('trouve les chantiers, leurs enfants et leurs points de pose dans bourg.glb', () => {
    const bourg = glb('bourg.glb');
    for (const name of ['ford_bench', 'house_bench', 'quay_planter', 'well_roof', 'well_gallows', 'door_canopy', 'lamp_post', 'level_crossing_crank', 'level_crossing_crank_wheel']) {
      expect(node(bourg, name), name).toBeDefined();
    }
    const seasons = node(bourg, 'quay_planter')?.extras?.seasons as Record<string, string>;
    for (const child of Object.values(seasons)) expect(node(bourg, child), child).toBeDefined();
    expect(Array.isArray(node(bourg, 'bush_elder')?.extras?.berry_spots)).toBe(true);
    expect(Array.isArray(node(bourg, 'bush_hazel')?.extras?.nut_spots)).toBe(true);
    expect(Array.isArray(node(bourg, 'bramble')?.extras?.berry_spots)).toBe(true);
    for (const [prop, model] of Object.entries(MODEL_BY_PROP)) {
      expect(map.props.some((p) => p.id === prop), prop).toBe(true);
      expect(node(bourg, model), model).toBeDefined();
    }
  });

  it('trouve outils, cage, perche, objets de maison, équipage, dame blanche et leurs clips', () => {
    const ferme = glb('ferme.glb');
    for (const name of ['watering_can_copper', 'axe_forged', 'fishing_rod_bamboo', 'fishing_rod_bamboo_tip', 'lamp_pole', 'hen_crate', 'cep', 'elderberry', 'hazelnut', 'blackberry']) {
      expect(node(ferme, name), name).toBeDefined();
    }
    const maison = glb('maison.glb');
    for (const name of ['wall_clock_hour', 'wall_clock_minute', 'wall_clock_pendulum', 'coop_calendar', 'wicker_armchair', 'straw_hat']) {
      expect(node(maison, name), name).toBeDefined();
    }
    const personnages = glb('personnages.glb');
    for (const name of ['villager_firmin_scarf', ...RENDER_SETTINGS.salute.crewModels]) expect(node(personnages, name), name).toBeDefined();
    const clips = new Set((personnages.animations ?? []).map((a) => a.name));
    const s = RENDER_SETTINGS.characters;
    for (const clip of [s.edge.clip, s.edge.lookClip, s.crank.hold, s.crank.turn, s.crank.wave, 'pole_raise', 'driver_lean', 'driver_wave']) {
      expect(clips.has(clip), clip).toBe(true);
    }
    const faune = glb('faune.glb');
    expect(node(faune, 'socket_barn_owl_beak')).toBeDefined();
    const owlClips = new Set((faune.animations ?? []).map((a) => a.name));
    const owl = content.moments.find((m) => m.id === 'barn_owl');
    for (const frame of owl?.climax.keyframes.barn_owl ?? []) {
      if (frame[4] !== null) expect(owlClips.has(frame[4]), frame[4]).toBe(true);
    }
  });
});

describe('tour 9: lampadaires', () => {
  it('compte les lampadaires de la carte, ceux des lanternes du quai et le réverbère du chemin', () => {
    const ids = lampIds(map);
    expect(ids).toContain('path_lamp');
    const quay = content.moments.find((m) => m.id === 'quay_lanterns');
    const named = [...((quay?.render.lanterns as string[] | undefined) ?? []), ...((quay?.render.lamps as [string, number][] | undefined) ?? []).map(([id]) => id)];
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) expect(ids, id).toContain(id);
  });

  const def = content.moments.find((m) => m.id === 'quay_lanterns') ?? null;
  const plan = lanternPlan(def);
  const sim = createWorld(content, map, 20_261_030, [
    { id: 'joueur-1', name: 'Camille', color: '#3a7bd5' },
    { id: 'joueur-2', name: 'Sacha', color: '#d55a3a' },
  ]);
  const world = sim.world;

  it('éteint les lampadaires pendant l’attente, allume la flamme seule puis l’éteint', () => {
    if (def === null) throw new Error('moment absent');
    const today = newToday(sim, def, 'ambient');
    today.phase = 'waiting';
    world.moments.today = today;
    world.clock.minutes = def.window.from + 10;
    expect(lanternLevel(plan, world, 'lamp_square_east', 0)).toBe(0);
    expect(lanternLevel(plan, world, 'lamp_quay_east', 0)).toBe(0);
    const place = def.watch.syncPress?.places[0] ?? '';
    today.presses = { p1: { tick: world.tick - Math.round(0.4 * SIM_HZ), place }, p2: null };
    expect(lanternLevel(plan, world, 'lamp_quay_east', 0)).toBeGreaterThan(0.3);
    expect(lanternLevel(plan, world, 'lamp_square_north', 0)).toBe(0);
    today.presses = { p1: { tick: world.tick - Math.round(1.5 * SIM_HZ), place }, p2: null };
    expect(lanternLevel(plan, world, 'lamp_quay_east', 0)).toBe(0);
    // Après la fenêtre, sans apogée: Firmin allume lui-même, tout est allumé.
    world.clock.minutes = def.window.to + 1;
    expect(lanternLevel(plan, world, 'lamp_square_east', 0)).toBe(1);
  });

  it('allume les deux lanternes puis la vague des lampadaires à l’apogée', () => {
    if (def === null) throw new Error('moment absent');
    const today = newToday(sim, def, 'ambient');
    today.phase = 'climax';
    today.paused = true;
    world.moments.today = today;
    today.elapsed = 0.3;
    expect(lanternLevel(plan, world, 'lamp_quay_east', 0)).toBeCloseTo(0.5, 5);
    expect(lanternLevel(plan, world, 'lamp_square_east', 0)).toBe(0);
    today.elapsed = 2.2;
    expect(lanternLevel(plan, world, 'lamp_square_east', 0)).toBe(1);
    expect(lanternLevel(plan, world, 'lamp_quay_west', 0)).toBe(0);
    today.elapsed = 6;
    for (const id of ['lamp_quay_west', 'lamp_level_crossing', 'lamp_square_south']) expect(lanternLevel(plan, world, id, 0)).toBe(1);
  });

  it('ne touche à rien les autres soirs', () => {
    world.moments.today = null;
    expect(lanternLevel(plan, world, 'lamp_square_east', 0)).toBe(1);
  });
});
