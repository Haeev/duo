// Retours du client sur les intérieurs et la scène d'accueil (2026-11-10), un bloc par point:
// A fondu du passage, B la pièce seule à l'écran, C portes visibles, visées et passées au seuil,
// D 1,5 m libre devant chaque porte, E l'habitant d'une scène marche au lieu de glisser.
import { describe, expect, it } from 'vitest';
import type { Content, PlaceContent } from '../src/donnees/charger';
import { DOORS, doorSill, doorSills, sillObjectId } from '../src/donnees/seuils';
import { CameraRig } from '../src/rendu/camera';
import { describePlace } from '../src/rendu/lieu/description';
import { Spaces } from '../src/rendu/lieu/espaces';
import { TILE_SETTINGS } from '../src/rendu/lieu/reglages-tuiles';
import { interiorWalls } from '../src/rendu/lieu/terrain-rendu';
import { jumped, PassageFade } from '../src/rendu/passage';
import { standingPosture, strideRate, targetWeights } from '../src/rendu/personnages/animation';
import { CHARACTER_SETTINGS } from '../src/rendu/personnages/reglages';
import { RENDER_SETTINGS } from '../src/rendu/reglages';
import { aimOf } from '../src/simulation/briques/visee';
import { villagerView } from '../src/simulation/habitants/lecture';
import { playerInterior } from '../src/simulation/lieux/index';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { doorClearanceProblems } from './aides-acces';
import { newSim } from './aides';
import { contentWith } from './aides-l3';
import { put, run, send } from './aides-noyau';

type Json = Record<string, unknown>;

const WEST = Math.PI;
const EAST = 0;
/** Porte de la maison du garde-barrière: seuil du dehors (mur est du bâtiment) et de la pièce. */
const STREET = { x: 179, y: 115.5 };
const ROOM = { x: 24, y: 211.5 };

/** Aubrune à l'heure dite; `edit` retouche les fichiers avant le chargement. */
function aubruneContent(minute: number, edit?: (files: Record<string, Json>) => void): Content {
  return contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: 'aubrune', minute };
    edit?.(files);
  });
}

/** Une partie à Aubrune, scène d'accueil passée: les joueurs marchent librement. */
function afterWelcome(content: Content): Sim {
  const sim = newSim(content);
  run(sim, 0.5);
  const story = sim.world.common.story;
  if (story !== undefined) story.scene = null;
  return sim;
}

function aubrune(content: Content): PlaceContent {
  const place = content.places.aubrune;
  if (place === undefined) throw new Error('Aubrune absente');
  return place;
}

function passes(events: readonly GameEvent[]): GameEvent[] {
  return events.filter((e) => e.type === 'door_passed');
}

describe('A. fondu du passage', () => {
  const S = RENDER_SETTINGS.passage;

  it('dure 150 à 250 ms à l’aller comme au retour, réglé en configuration', () => {
    for (const seconds of [S.outSeconds, S.inSeconds]) {
      expect(seconds).toBeGreaterThanOrEqual(0.15);
      expect(seconds).toBeLessThanOrEqual(0.25);
    }
  });

  it('retient la vue d’avant pendant que le noir tombe, pose tout au noir, puis rouvre', () => {
    const fade = new PassageFade();
    const dt = 1 / 60;
    expect(fade.update(dt, false)).toMatchObject({ exposure: 1, hold: false, cut: false });
    // Le saut: l'image d'avant reste (aucun glissement de caméra à travers la carte).
    const frames = [{ ...fade.update(dt, true) }];
    for (let i = 0; i < 60; i++) frames.push({ ...fade.update(dt, false) });
    const cut = frames.findIndex((f) => f.cut);
    expect(cut).toBeGreaterThan(0);
    expect(cut * dt).toBeCloseTo(S.outSeconds, 1);
    for (const f of frames.slice(0, cut)) expect(f.hold).toBe(true);
    // La pose d'un coup se fait au noir complet, vue libérée.
    expect(frames[cut]).toMatchObject({ exposure: 0, hold: false, cut: true });
    const open = frames.findIndex((f, i) => i > cut && f.exposure === 1);
    expect((open - cut) * dt).toBeCloseTo(S.inSeconds, 1);
    // L'exposition ne fait que descendre, puis que monter.
    for (let i = 1; i <= cut; i++)
      expect(frames[i]?.exposure).toBeLessThanOrEqual(frames[i - 1]?.exposure ?? 1);
    for (let i = cut + 1; i <= open; i++)
      expect(frames[i]?.exposure).toBeGreaterThanOrEqual(frames[i - 1]?.exposure ?? 0);
  });

  it('reconnaît un passage à la position seule: une marche ou une course n’en est jamais un', () => {
    // Course pressée (4,5 m/s) sur l'image la plus longue du rendu (0,25 s de jeu): 1,1 m.
    expect(jumped({ x: 0, y: 0 }, { x: 1.2, y: 0 })).toBe(false);
    expect(jumped(null, { x: 100, y: 100 })).toBe(false);
    expect(jumped({ x: STREET.x, y: STREET.y }, { x: ROOM.x, y: ROOM.y })).toBe(true);
  });
});

describe('B. une pièce est un monde clos à l’écran', () => {
  const content = aubruneContent(600);
  const place = aubrune(content);
  const spaces = new Spaces(place.map, place.interiors);
  const description = describePlace(content, place, [], undefined, false);

  it('dedans, seuls les volumes de la pièce se dessinent; dehors, aucun volume de pièce', () => {
    const shown = description.volumes.filter((v) => spaces.shows('maison-rdc', v.x, v.y));
    const ids = shown.map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['maison-table', 'lit-de-la-maison']));
    // Rien des pièces rangées à côté sur la grille (l'étage est à 3 m), rien du dehors.
    const room = place.interiors.find((r) => r.id === 'maison-rdc') ?? expect.unreachable();
    for (const v of shown) {
      expect(v.x, v.id).toBeGreaterThan(room.at.x - 1);
      expect(v.x, v.id).toBeLessThan(room.at.x + room.width + 1);
      expect(v.y, v.id).toBeGreaterThan(room.at.y - 1);
      expect(v.y, v.id).toBeLessThan(room.at.y + room.height + 1);
    }
    expect(ids.some((id) => id.startsWith('etage') || id.startsWith('cave'))).toBe(false);
    const outside = description.volumes.filter((v) => spaces.shows(null, v.x, v.y));
    const outdoor = place.map.outdoor ?? expect.unreachable();
    for (const v of outside) expect(v.y, v.id).toBeLessThanOrEqual(outdoor.y + outdoor.h);
    // Chaque volume appartient à un seul espace.
    const rooms = [null, ...place.interiors.map((r) => r.id)];
    for (const v of description.volumes)
      expect(
        rooms.filter((r) => spaces.shows(r, v.x, v.y)),
        v.id,
      ).toHaveLength(1);
  });

  it('le joueur dedans ne voit pas l’autre resté dehors, ni un habitant d’une autre pièce', () => {
    expect(spaces.at(ROOM.x - 0.6, ROOM.y)).toBe('maison-rdc');
    expect(spaces.at(STREET.x + 2, STREET.y)).toBeNull();
    const upstairs = place.interiors.find((r) => r.id === 'maison-etage') ?? expect.unreachable();
    expect(spaces.at(upstairs.at.x + 1, upstairs.at.y + 1)).toBe('maison-etage');
  });

  it('les cloisons sont dessinées, et le mur s’ouvre à la porte', () => {
    const room = place.interiors.find((r) => r.id === 'maison-rdc') ?? expect.unreachable();
    expect(room.blocked.length).toBeGreaterThan(0);
    const sills = Object.values(doorSills(place.map, DOORS.width));
    const boxes = interiorWalls(room, sills);
    const s = TILE_SETTINGS.interior;
    for (const r of room.blocked) {
      // Un mur (soubassement et mur) dans l'emprise de chaque cloison, à hauteur d'appui.
      const inside = boxes.filter(
        (b) =>
          b.x > room.at.x + r.x &&
          b.x < room.at.x + r.x + r.w &&
          b.z > room.at.y + r.y &&
          b.z < room.at.y + r.y + r.h,
      );
      expect(inside.length, JSON.stringify(r)).toBe(2);
      expect(Math.max(...inside.map((b) => b.base + b.h))).toBeCloseTo(s.wallHeight);
      // Jamais plus épaisse que sa case: pas de mur invisible de plus de 15 cm autour.
      for (const b of inside) expect(Math.min(b.w, b.d)).toBeGreaterThanOrEqual(0.7);
    }
    // Mur est (x = 24): aucune boîte ne recouvre la porte de sortie.
    const east = boxes.filter((b) => Math.abs(b.x - (ROOM.x + s.wallThickness / 2)) < 0.01);
    expect(east.length).toBeGreaterThanOrEqual(4);
    for (const b of east) expect(Math.abs(b.z - ROOM.y) - b.d / 2).toBeGreaterThanOrEqual(0.5);
  });

  it('la vue reste dans les bornes de la pièce, et se pose d’un coup à l’arrivée', () => {
    const bounds = spaces.bounds('maison-rdc');
    expect(bounds).toEqual({ x: 14, y: 210, width: 10, height: 7 });
    const rig = new CameraRig();
    const still = { speed: 0, facing: 0 };
    rig.update(1 / 60, {}, { x: STREET.x + 1, y: STREET.y, ...still }, spaces.bounds(null));
    rig.detach();
    // Le joueur dans l'angle de la pièce: la vue ne sort pas de la pièce pour le centrer.
    rig.update(1 / 60, {}, { x: 23.5, y: 210.5, ...still }, bounds);
    const pose = rig.pose();
    expect(pose.x).toBeGreaterThan(bounds.x);
    expect(pose.x).toBeLessThan(bounds.x + bounds.width);
    expect(pose.y).toBeGreaterThan(bounds.y + 1);
    expect(pose.y).toBeLessThan(bounds.y + bounds.height);
    // Dehors, les bornes sont celles du dehors: l'annexe des pièces n'en fait pas partie.
    const outdoor = place.map.outdoor ?? expect.unreachable();
    expect(spaces.bounds(null)).toEqual({ x: 0, y: 0, width: outdoor.w, height: outdoor.h });
  });
});

describe('C. portes: visibles, visées, passées au seuil', () => {
  it('règle générale du seuil: porte de façade, porte de cloison, porte au sol', () => {
    const wallAt =
      (...cells: [number, number][]) =>
      (x: number, y: number): boolean =>
        cells.some(([cx, cy]) => cx === x && cy === y);
    // Façade: la case de la porte est libre, le mur est derrière elle (au nord): seuil sur ce bord.
    expect(doorSill(wallAt([4, 2]), { x: 4.5, y: 3.5, facing: 0 }, 1)).toMatchObject({
      kind: 'wall',
      x: 4.5,
      y: 3,
      nx: 0,
      ny: 1,
      halfWidth: 0.5,
    });
    // Cloison: la case de la porte est un mur: seuil sur sa face, du côté où l'on arrive.
    expect(doorSill(wallAt([4, 3]), { x: 4.5, y: 3.5, facing: 1 }, 1)).toMatchObject({
      kind: 'wall',
      x: 5,
      y: 3.5,
    });
    // Au sol (escalier, trappe): aucun mur, le seuil est le milieu de la case. Largeur en données.
    expect(doorSill(wallAt(), { x: 4.5, y: 3.5, facing: 2, width: 2 }, 1)).toMatchObject({
      kind: 'floor',
      x: 4.5,
      y: 3.5,
      halfWidth: 1,
    });
  });

  it('chaque porte d’Aubrune a son objet visible, dessiné en porte, cible de la touche d’action', () => {
    const content = aubruneContent(600);
    const place = aubrune(content);
    const description = describePlace(content, place, [], undefined, false);
    const doors = Object.entries(place.map.doors ?? {});
    expect(doors.length).toBeGreaterThan(30);
    for (const [id, door] of doors) {
      const object = place.map.objects.find((o) => o.id === door.object);
      expect(object, id).toBeDefined();
      const bricks = content.props[object?.type ?? '']?.bricks.map((b) => b.brick);
      expect(bricks, id).toContain('passage');
      const volume = description.volumes.find((v) => v.id === door.object);
      expect(volume?.aimable, id).toBe(true);
      expect(['door', 'mat', 'hatch'], id).toContain(volume?.shape);
    }
    // La porte de sortie de la maison: encadrement à taille humaine sur le mur est, et son
    // paillasson dans la pièce, lisible au sol même quand le mur est coupé devant la caméra.
    const exit = sillObjectId('maison-rdc-porte');
    const frame = description.volumes.find((v) => v.id === exit);
    expect(frame).toMatchObject({ shape: 'door', rotation: 3, occludes: true });
    expect(frame?.height).toBeGreaterThan(1.9);
    expect(frame?.x).toBeGreaterThan(ROOM.x);
    const mat = description.volumes.find((v) => v.id === `${exit}-tapis`);
    expect(mat).toMatchObject({ shape: 'mat', occludes: false });
    expect(mat?.x).toBeLessThan(ROOM.x);
    expect(mat?.x).toBeGreaterThan(ROOM.x - 1);
    // Dehors, le bâtiment porte déjà sa porte: le paillasson marque le seuil et se vise.
    const street = description.volumes.find(
      (v) => v.id === sillObjectId('porte-maison-maison-rdc'),
    );
    expect(street).toMatchObject({ shape: 'mat', aimable: true });
  });

  it('on entre en atteignant la porte, pas un mètre avant; on ressort devant elle, face au dehors', () => {
    const content = aubruneContent(600);
    const sim = afterWelcome(content);
    const radius = content.settings.movement.radius;
    // `put` remplace le corps: on le relit à chaque fois.
    const at = (): Sim['world']['players'][0]['body'] => sim.world.players[0].body;
    // À 1,2 m du mur, dans l'axe: la porte est déjà la cible, avec son verbe.
    put(sim, 0, STREET.x + 1.2, STREET.y, WEST);
    expect(aimOf(sim, 0)).toMatchObject({
      id: sillObjectId('porte-maison-maison-rdc'),
      action: 'passage',
      verb: 'Entrer',
      refusal: null,
    });
    // En marchant vers elle: rien avant de toucher le mur.
    let before = at().x;
    let events: GameEvent[] = [];
    for (let i = 0; i < 3 * SIM_HZ && passes(events).length === 0; i++) {
      before = at().x;
      events = run(sim, 1 / SIM_HZ, { moveX: -1 });
    }
    expect(passes(events)).toHaveLength(1);
    expect(before - STREET.x).toBeLessThan(radius + 0.2);
    expect(before - STREET.x).toBeGreaterThanOrEqual(radius);
    // Dedans: devant la porte de la pièce (à 0,6 m de son seuil), tourné vers la pièce.
    expect(playerInterior(sim, 0)).toBe('maison-rdc');
    expect(playerInterior(sim, 1)).toBeNull();
    expect(at().x).toBeCloseTo(ROOM.x - 0.6, 5);
    expect(at().y).toBeCloseTo(ROOM.y, 5);
    expect(Math.cos(at().facing)).toBeCloseTo(-1);
    // La direction tenue fait avancer dans la pièce, sans repasser.
    expect(passes(run(sim, 0.8, { moveX: -1 }))).toHaveLength(0);
    expect(playerInterior(sim, 0)).toBe('maison-rdc');
    expect(at().x).toBeLessThan(ROOM.x - 1);

    // Sortie à la touche d'action: la porte se vise depuis la pièce (« Sortir »).
    put(sim, 0, ROOM.x - 1, ROOM.y, EAST);
    expect(aimOf(sim, 0)).toMatchObject({
      id: sillObjectId('maison-rdc-porte'),
      verb: 'Sortir',
      refusal: null,
    });
    expect(passes(send(sim, 0, { type: 'act' }))).toHaveLength(1);
    expect(playerInterior(sim, 0)).toBeNull();
    expect(at().x).toBeCloseTo(STREET.x + 0.6, 5);
    expect(at().y).toBeCloseTo(STREET.y, 5);
    expect(Math.cos(at().facing)).toBeCloseTo(1);

    // Sortie à pied: on franchit le seuil de la pièce, pas avant.
    put(sim, 0, ROOM.x - 1.5, ROOM.y, EAST);
    events = [];
    for (let i = 0; i < 3 * SIM_HZ && passes(events).length === 0; i++) {
      before = at().x;
      events = run(sim, 1 / SIM_HZ, { moveX: 1 });
    }
    expect(passes(events)).toHaveLength(1);
    expect(ROOM.x - before).toBeLessThan(radius + 0.2);
    expect(at().x).toBeCloseTo(STREET.x + 0.6, 5);
  });

  it('longer le mur devant la porte ne fait pas entrer: il faut avancer vers elle', () => {
    const sim = afterWelcome(aubruneContent(600));
    const radius = sim.content.settings.movement.radius;
    put(sim, 0, STREET.x + radius + 0.02, STREET.y - 1.5, Math.PI / 2);
    expect(passes(run(sim, 2, { moveY: 1 }))).toHaveLength(0);
    expect(sim.world.players[0].body.y).toBeGreaterThan(STREET.y + 0.5);
  });
});

describe('D. 1,5 m libre devant chaque porte, des deux côtés', () => {
  it('toutes les portes de tous les lieux du jeu', () => {
    const content = aubruneContent(600);
    for (const place of Object.values(content.places))
      expect(doorClearanceProblems(content, place), place.def.id).toEqual([]);
  });

  it('casse: une chaise dans l’axe de la porte de la maison est signalée', () => {
    const content = aubruneContent(600, (files) => {
      const room = files['lieux/aubrune/interieurs/maison-rdc.json'] as {
        objects: { id: string; x: number; y: number }[];
      };
      const chair = room.objects.find((o) => o.id === 'maison-chaise-1');
      if (chair === undefined) throw new Error('chaise absente');
      chair.x = 8.5;
      chair.y = 1.5;
    });
    const problems = doorClearanceProblems(content, aubrune(content));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('maison-rdc-porte');
    expect(problems[0]).toContain('maison-chaise-1');
  });
});

describe('E. l’habitant d’une scène marche, il ne glisse pas', () => {
  it('Firmin quitte son balai pour venir: pose de marche, vitesse et cap de sa marche', () => {
    // 8 h: l'heure où le train de nuit dépose les joueurs. Firmin balaie alors le quai.
    const sim = newSim(aubruneContent(480));
    const firmin = (): NonNullable<
      NonNullable<Sim['world']['places'][string]>['villagers'][string]
    > => sim.world.places.aubrune?.villagers.firmin ?? expect.unreachable();
    run(sim, 0.05);
    expect(firmin().life?.gesture).toBe('balayer');
    let walked = 0;
    for (let i = 0; i < 8 * SIM_HZ; i++) {
      const from = { ...firmin().body };
      run(sim, 1 / SIM_HZ);
      const scene = sim.world.common.story?.scene;
      const body = firmin().body;
      const moved = Math.hypot(body.x - from.x, body.y - from.y);
      if (scene?.id !== 'firmin-en-pantoufles' || moved < 1e-6) continue;
      // Le dernier pas le pose sur sa place, à l'arrêt: moins d'une foulée.
      if (body.speed === 0) {
        expect(moved * SIM_HZ).toBeLessThan(from.speed + 1e-6);
        continue;
      }
      walked += 1;
      // La vitesse dite est la vitesse réelle, le cap est celui du déplacement.
      expect(moved * SIM_HZ).toBeCloseTo(body.speed, 3);
      expect(Math.cos(body.facing - Math.atan2(body.y - from.y, body.x - from.x))).toBeCloseTo(1);
      const view = villagerView(sim, 'firmin');
      expect(view).toMatchObject({ pose: 'walk', gesture: null });
      // Au rendu: le clip de marche (ou de course) à la cadence de cette vitesse.
      const posture = standingPosture(body.speed, view?.gesture ?? null);
      expect(posture).toEqual({ kind: 'stand', speed: body.speed });
    }
    expect(walked).toBeGreaterThan(SIM_HZ);
    // Arrivé: à l'arrêt, sans reprendre son balai devant les joueurs.
    expect(firmin().body.speed).toBe(0);
    expect(villagerView(sim, 'firmin')).toMatchObject({ pose: 'stand', gesture: null });
  });

  it('au rendu, qui se déplace marche ou court à sa cadence, même avec un geste en cours', () => {
    const L = CHARACTER_SETTINGS.locomotion;
    const clips = new Set(Object.values(CHARACTER_SETTINGS.clips));
    // À l'arrêt, le geste de l'activité; en marche (planning ou scène), jamais.
    expect(standingPosture(0, 'balayer')).toEqual({ kind: 'clip', clip: 'balayer' });
    for (const speed of [1.4, 1.5, 3.3, 4.5]) {
      const posture = standingPosture(speed, 'balayer');
      expect(posture).toEqual({ kind: 'stand', speed });
      const weights = targetWeights(posture, clips, new Map());
      const run = weights.get(CHARACTER_SETTINGS.clips.run) ?? 0;
      expect(weights.get(CHARACTER_SETTINGS.clips.idle) ?? 0).toBe(0);
      expect(run).toBe(speed >= L.runTo ? 1 : 0);
      // Foulées mesurées des clips: marche 1,46 m par cycle de 1 s, course 1,80 m par 0,625 s.
      const rate = strideRate(speed, 1.46, 1.8, run, 1, 0.625);
      const stride = run === 1 ? 1.8 : 1.46;
      // Un cycle avance le corps d'une foulée: le pied posé ne glisse pas.
      expect(rate * stride).toBeCloseTo(speed, 5);
    }
  });
});
