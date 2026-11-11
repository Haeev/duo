// Le rendu suit les briques de la simulation: meuble de carte absent non dessiné, porte au sol
// fermée montrée fermée, habitant couché sur son lit, habitant qui franchit une porte sans glisser.
import { Group, type Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import type { CharacterFrame } from '../../src/rendu/bonshommes';
import { createStandInCharacters } from '../../src/rendu/bonshommes';
import { describePlace } from '../../src/rendu/lieu/description';
import { PlaceScene } from '../../src/rendu/lieu/lieu';
import { MAP_STATES, mapSignature, mapStates } from '../../src/rendu/lieu/presents';
import { lyingOn } from '../../src/rendu/personnages/allonge';
import { RENDER_SETTINGS } from '../../src/rendu/reglages';
import { contentWith, wait, withTestProps } from '../aides-l3';
import { newSim } from '../aides';

type Json = Record<string, unknown>;
const FACT = 'essai-gare.reserve.ouverte';
const STAIRS = 'essai-gare.reserve.escalier';

/**
 * Gare d'essai: un coffre qui ne paraît qu'avec `FACT`, et une trappe (porte au sol) que `STAIRS`
 * ouvre, vers une réserve factice d'une pièce.
 */
function content(): ReturnType<typeof contentWith> {
  return contentWith((files) => {
    withTestProps(files);
    const map = files['lieux/essai-gare/carte.json'] as {
      objects: Json[];
      doors?: Json;
      height: number;
      outdoor?: Json;
    };
    map.objects.push({
      id: 'coffre-factice',
      type: 'coffre-essai',
      x: 20.5,
      y: 24.5,
      rotation: 0,
      when: [{ type: 'remembered', key: FACT }],
    });
    // La réserve se range sous le dehors, comme tout intérieur.
    map.height = 56;
    map.outdoor = { x: 0, y: 0, w: 40, h: 40 };
    map.doors = {
      ...map.doors,
      'trappe-factice': {
        x: 22.5,
        y: 24.5,
        facing: 0,
        to: 'reserve-factice-trappe',
        opens: [{ type: 'remembered', key: STAIRS }],
        says: 'La trappe est clouée.',
      },
    };
    files['lieux/essai-gare/interieurs/reserve-factice.json'] = {
      schema: 1,
      id: 'reserve-factice',
      name: 'Réserve factice',
      width: 4,
      height: 4,
      at: { x: 10, y: 44 },
      blocked: [],
      points: {},
      objects: [],
      doors: { 'reserve-factice-trappe': { x: 1.5, y: 1.5, facing: 0, to: 'trappe-factice' } },
    };
  });
}

function materials(): { ground: MeshStandardMaterial; standIn: MeshStandardMaterial } {
  return { ground: new MeshStandardMaterial(), standIn: new MeshStandardMaterial() };
}

function triangles(scene: PlaceScene, id: string): number {
  let count = 0;
  scene.root.getObjectByName(id)?.traverse((o) => {
    const geometry = (o as Partial<Mesh>).geometry;
    if (geometry !== undefined) count += (geometry.index?.count ?? 0) / 3;
  });
  return count;
}

describe('meubles de carte selon la progression', () => {
  it('ne dessine pas le meuble absent, le pose quand sa condition devient vraie', () => {
    const sim = newSim(content());
    wait(sim, 0.1);
    const place = sim.content.places['essai-gare'];
    if (place === undefined) throw new Error('lieu absent');
    const hatch = place.map.doors?.['trappe-factice']?.object;
    if (hatch === undefined) throw new Error('la trappe a un objet visible');
    const scene = new PlaceScene(describePlace(sim.content, place), materials(), null);
    const before = mapSignature(sim, place, 0);
    expect(mapStates(sim, place, 0, new Map())).toEqual(
      new Map([
        ['coffre-factice', MAP_STATES.absent],
        [hatch, MAP_STATES.closed],
      ]),
    );
    scene.setStates(mapStates(sim, place, 0, new Map()));
    // Absent: aucun triangle, aucune cible, rien qui cache un personnage, rien dans les lampes.
    expect(triangles(scene, 'coffre-factice')).toBe(0);
    expect(scene.aimable('coffre-factice')).toBeNull();
    expect([...scene.volumes()].map((v) => v.id)).not.toContain('coffre-factice');
    const feet = [{ x: 20.5, y: 0, z: 23.9 }];
    scene.occlusion.update(1, feet, { x: 0, y: 0.7, z: 0.7 });
    expect(scene.occlusion.isHidden('coffre-factice')).toBe(false);
    // Trappe fermée: planches et traverses, la cible reste (la touche d'action dit pourquoi).
    const closed = triangles(scene, hatch);
    expect(scene.aimable(hatch)).not.toBeNull();

    sim.world.progress.memory[FACT] = { v: true, by: 'duo', day: 1 };
    sim.world.progress.memory[STAIRS] = { v: true, by: 'duo', day: 1 };
    expect(wait(sim, 0.1)).toContainEqual({
      type: 'map_object_changed',
      object: 'coffre-factice',
      present: true,
    });
    expect(mapSignature(sim, place, 0)).not.toBe(before);
    expect(mapStates(sim, place, 0, new Map()).size).toBe(0);
    scene.setStates(mapStates(sim, place, 0, new Map()));
    expect(triangles(scene, 'coffre-factice')).toBeGreaterThan(0);
    expect(scene.aimable('coffre-factice')).not.toBeNull();
    expect([...scene.volumes()].map((v) => v.id)).toContain('coffre-factice');
    // Ouverte: le puits et ses trois marches, une autre forme que la trappe clouée.
    expect(triangles(scene, hatch)).not.toBe(closed);
    scene.dispose();
  });

  it('cache la cuisine de la maison du garde tant qu’elle n’est pas achetée, et ferme ses escaliers', () => {
    const game = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: 'aubrune' };
    });
    const sim = newSim(game);
    const place = game.places.aubrune;
    if (place === undefined) throw new Error('Aubrune absente');
    const states = mapStates(sim, place, 0, new Map());
    expect(states.get('maison-cuisiniere')).toBe(MAP_STATES.absent);
    expect(states.get('maison-plan')).toBe(MAP_STATES.absent);
    const stairs = ['maison-rdc-esc-maison-etage', 'maison-rdc-esc-maison-cave'].map(
      (id) => place.map.doors?.[id]?.object ?? '',
    );
    for (const id of stairs) expect(states.get(id)).toBe(MAP_STATES.closed);
    sim.world.progress.memory['aubrune.maison-du-garde.cuisine'] = { v: true, by: 'duo', day: 1 };
    const after = mapStates(sim, place, 0, new Map());
    expect(after.has('maison-cuisiniere')).toBe(false);
    expect(after.has('maison-plan')).toBe(false);
    expect(after.get(stairs[0] ?? '')).toBe(MAP_STATES.closed);
  });
});

describe('habitant couché', () => {
  it('se couche sur son lit, tête à l’oreiller, pieds dans le lit', () => {
    const game = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Json };
      settings.start = { ...settings.start, place: 'aubrune', minute: 23 * 60 };
    });
    const sim = newSim(game);
    wait(sim, 1);
    const place = game.places.aubrune;
    const state = sim.world.places.aubrune;
    if (place === undefined || state === undefined) throw new Error('Aubrune absente');
    // Le premier habitant que son planning a couché (aucun nom ici: celui des données).
    const sleeper = Object.values(state.villagers).find((v) => v.life?.pose === 'lie');
    const seat = sleeper?.life?.seat;
    if (seat === null || seat === undefined) throw new Error('personne n’est couché à 23 h');
    const bed = place.map.objects.find((o) => o.id === seat[0]);
    const def = bed === undefined ? undefined : game.props[bed.type];
    const brick = def?.bricks.find((b) => b.brick === 'sleep');
    if (bed === undefined || def === undefined || brick?.brick !== 'sleep')
      throw new Error('le lit tenu a la brique sleep');
    const head = 1.5;
    const out = { x: 0, y: 0, facing: 0, height: 0 };
    const pose = lyingOn(
      game,
      sim.world,
      state,
      seat[0],
      seat[1],
      head,
      { height: 0.9, pillowInset: 0.35 },
      out,
    );
    if (pose === null) throw new Error('pose couchée absente');
    // Pieds vers la façade du lit, tête sur l'oreiller (du côté du dos), à la hauteur de la fiche.
    const fx = Math.cos(pose.facing);
    const fy = Math.sin(pose.facing);
    const headX = pose.x - fx * head;
    const headY = pose.y - fy * head;
    const pillow = brick.lie?.pillow ?? 0;
    expect((headX - bed.x) * fx + (headY - bed.y) * fy).toBeCloseTo(-pillow);
    expect(pose.height).toBe(brick.lie?.height);
    // Tête et pieds dans l'emprise du lit (2 m de long): rien ne dépasse.
    const along = (x: number, y: number): number => (x - bed.x) * fx + (y - bed.y) * fy;
    expect(Math.abs(along(headX, headY))).toBeLessThan(def.size.h / 2);
    expect(Math.abs(along(pose.x, pose.y))).toBeLessThan(def.size.h / 2);
  });
});

describe('habitant qui franchit une porte', () => {
  it('disparaît au seuil et se pose de l’autre côté, sans glisser entre les deux', () => {
    const sim = newSim();
    wait(sim, 0.1);
    const state = sim.world.places[sim.world.common.place];
    const [id, villager] = Object.entries(state?.villagers ?? {})[0] ?? [];
    if (state === undefined || id === undefined || villager === undefined)
      throw new Error('aucun habitant à la gare d’essai');
    const root = new Group();
    const layer = createStandInCharacters({ root, playerColors: ['#d9654f', '#4f8fd9'] });
    const frame = (): CharacterFrame => ({
      dt: 1 / 60,
      world: sim.world,
      place: state,
      cameraYaw: 0,
    });
    // Les habitants sont ajoutés après les deux joueurs, dans l'ordre de l'état.
    const figure = (): Group =>
      root.children[2 + Object.keys(state.villagers).indexOf(id)] as Group;
    layer.update(frame());
    layer.update(frame());
    expect(figure().visible).toBe(true);
    const from = { x: villager.body.x, y: villager.body.y };
    // Une marche: il glisse, lissé, et reste visible.
    villager.body.x += 0.05;
    layer.update(frame());
    expect(figure().visible).toBe(true);
    expect(figure().position.x).toBeLessThan(villager.body.x);
    // La porte: l'état le pose 200 m plus loin (plus que `jumpMeters`).
    villager.body.x = from.x + 200;
    expect(200).toBeGreaterThan(RENDER_SETTINGS.passage.jumpMeters);
    layer.update(frame());
    expect(figure().visible, 'caché pendant le saut').toBe(false);
    expect(figure().position.x, 'posé d’un coup à l’arrivée').toBeCloseTo(villager.body.x);
    layer.update(frame());
    expect(figure().visible, 'visible au seuil d’arrivée').toBe(true);
    expect(figure().position.x).toBeCloseTo(villager.body.x);
    layer.dispose();
  });
});
