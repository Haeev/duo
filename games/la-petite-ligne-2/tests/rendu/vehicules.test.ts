// Rendu des véhicules de voie (`rendu/lieu/vehicules.ts`): la draisine dans sa remise puis sur
// les rails, le modèle livré (balancier et roues animés) ou son repli, les joueurs posés à leur
// place sur le véhicule affiché, un mouvement fluide chez l'invité (états espacés), l'indicateur.
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../../src/donnees/schemas/communs';
import type { RailVehicleState } from '../../src/etat/vehicules';
import { leverMark, vehicleLine, vehicleView } from '../../src/interface/vehicule';
import type { ModelSource } from '../../src/rendu/lieu/lieu';
import { DECOR_MANIFEST } from '../../src/rendu/lieu/decors-manifeste';
import { RAIL_VEHICLE_LOOK, RailVehicleLayer } from '../../src/rendu/lieu/vehicules';
import { SIM_HZ } from '../../src/simulation/noyau/constantes';
import { idleInput } from '../../src/simulation/noyau/entrees';
import { step, type Sim } from '../../src/simulation/noyau/pas';
import { remember } from '../../src/simulation/regles/memoire';
import { contentWith, contextOf } from '../aides-l3';
import { newSim } from '../aides';

type Json = Record<string, unknown>;

const content = contentWith((files) => {
  const settings = files['commun/reglages.json'] as { start: Json };
  settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
});
const place = content.places.aubrune ?? fail('Aubrune absente');
const def = place.vehicles.draisine ?? fail('draisine absente');
/** Parties mobiles du modèle livré, lues dans le manifeste des décors. */
const nodes = DECOR_MANIFEST.models.draisine?.nodes ?? {};
const LEVER_ANGLE = ((nodes.balancier?.debattement ?? 0) * Math.PI) / 180;
const WHEEL_RADIUS = nodes['roue-avant']?.rayon ?? 0;

function fail(message: string): never {
  throw new Error(message);
}

/** Un modèle livré: une plateforme et ses nœuds mobiles, nommés comme le demande la fiche. */
function delivered(): Object3D {
  const group = new Group();
  group.add(new Mesh(new BoxGeometry(1.7, 0.5, 2.6), new MeshStandardMaterial()));
  for (const name of ['balancier', 'roue-avant', 'roue-arriere']) {
    const node = new Group();
    node.name = name;
    group.add(node);
  }
  return group;
}

function sourceOf(models: readonly string[]): ModelSource {
  return {
    instantiate(model: string): Object3D | null {
      if (!models.includes(model)) return null;
      if (model === 'draisine') return delivered();
      const group = new Group();
      group.add(new Mesh(new BoxGeometry(2.925, 4.004, 9.92), new MeshStandardMaterial()));
      return group;
    },
  };
}

function layerOf(models: readonly string[]): RailVehicleLayer {
  const standIn = new MeshStandardMaterial();
  return new RailVehicleLayer(place, sourceOf(models), { standIn, ink: null }, () => 0.12);
}

function vehicle(sim: Sim): RailVehicleState {
  return sim.world.places.aubrune?.vehicles?.draisine ?? fail('draisine sans état');
}

function press(sim: Sim, players: readonly PlayerIndex[]): Sim['events'] {
  step(
    sim,
    [idleInput(sim.world.tick), idleInput(sim.world.tick)],
    players.map((player) => ({ player, intent: { type: 'act' } })),
  );
  return [...sim.events];
}

/** La draisine sortie, les deux joueurs à bord. */
function aboard(): Sim {
  const sim = newSim(content);
  remember(contextOf(sim), 'aubrune.draisine.sortie', true, 'duo');
  Object.assign(sim.world.players[0].body, { x: 219.3, y: 92.5, facing: 0 });
  press(sim, [0]);
  Object.assign(sim.world.players[0].body, { x: 214.9, y: 98.6, facing: -Math.PI / 2 });
  Object.assign(sim.world.players[1].body, { x: 213.1, y: 98.6, facing: -Math.PI / 2 });
  press(sim, [0, 1]);
  expect(vehicle(sim).riders).toEqual([0, 1]);
  return sim;
}

/** Pompe en alternance pendant `seconds`, en appelant `each` après chaque pas. */
function pump(sim: Sim, seconds: number, each?: (events: Sim['events']) => void): void {
  for (let i = 0; i < Math.round(seconds * SIM_HZ); i++) {
    const events = press(sim, i % 14 === 0 ? [i % 28 === 0 ? 0 : 1] : []);
    each?.(events);
  }
}

describe('véhicules de voie à l’écran', () => {
  it('dort dans sa remise, puis se pose sur les rails; les joueurs à leur place, face à face', () => {
    const layer = layerOf(['draisine']);
    const sim = newSim(content);
    layer.advance(1 / 60, sim.world);
    const object = layer.root.getObjectByName('vehicule-draisine') ?? fail('véhicule absent');
    // Dans la remise (x 220 à 226, y 90 à 95), posé sur le sol affiché, personne à bord.
    expect(object.visible).toBe(true);
    expect(object.position.x).toBeGreaterThan(221);
    expect(object.position.x).toBeLessThan(225);
    expect(object.position.y).toBeCloseTo(0.12, 5);
    expect(layer.riders).toEqual([null, null]);

    const riding = aboard();
    layer.advance(1 / 60, riding.world);
    // Sur la voie, à la traversée (214; 97,5), l'avant du modèle (+z) vers l'est.
    expect(object.position.x).toBeCloseTo(214, 5);
    expect(object.position.z).toBeCloseTo(97.5, 5);
    expect(object.rotation.y).toBeCloseTo(Math.PI / 2, 5);
    const [front, back] = layer.riders;
    // Le joueur 0 à l'avant regarde l'ouest (son vis-à-vis), les pieds sur le plancher de la fiche.
    expect(front?.x).toBeCloseTo(214.85, 5);
    expect(back?.x).toBeCloseTo(213.15, 5);
    expect(Math.cos(front?.facing ?? 0)).toBeCloseTo(-1, 5);
    expect(Math.cos(back?.facing ?? Math.PI)).toBeCloseTo(1, 5);
    expect(front?.floor).toBeCloseTo(0.12 + def.body.deck, 5);
    expect(front?.height).toBeCloseTo(def.seats[0].height, 5);
    expect(layer.carrying(0)).toBe('draisine');
    // La cible de la touche d'action réagit (lueur), comme un meuble.
    expect(layer.aimable('vehicule-draisine')?.object).toBe(object);
    expect(layer.aimable('remise-draisine')).toBeNull();
    layer.dispose();
    expect(layer.root.parent).toBeNull();
  });

  it('anime le balancier au coup de chacun et fait tourner les roues avec le chemin', () => {
    const layer = layerOf(['draisine']);
    const sim = aboard();
    layer.advance(1 / 60, sim.world);
    const lever = layer.root.getObjectByName('balancier') ?? fail('balancier absent');
    const wheel = layer.root.getObjectByName('roue-avant') ?? fail('roue absente');
    expect(lever.rotation.x).toBeCloseTo(0, 5);
    const seen: number[] = [];
    let from = vehicle(sim).s;
    pump(sim, 4, (events) => {
      // L'événement du coup fait basculer tout de suite, avant l'état suivant.
      for (const event of events)
        if (event.type === 'vehicle_stroke' && event.kind === 'push')
          layer.stroke(event.vehicle, event.player);
      layer.advance(1 / 30, sim.world);
      seen.push(lever.rotation.x);
      from = Math.min(from, vehicle(sim).s);
    });
    // Il descend du côté de l'avant (angle positif) quand le joueur 0 pompe, de l'autre ensuite.
    // Le débattement du modèle livré: 14 degrés de chaque côté.
    expect(LEVER_ANGLE).toBeCloseTo((14 * Math.PI) / 180, 5);
    expect(Math.max(...seen)).toBeGreaterThan(LEVER_ANGLE * 0.9);
    expect(Math.max(...seen)).toBeLessThanOrEqual(LEVER_ANGLE + 1e-9);
    expect(Math.min(...seen)).toBeLessThan(-LEVER_ANGLE * 0.9);
    // Roues: un tour par 2 PI fois le rayon parcouru, dans le sens de la marche.
    const rolled = vehicle(sim).s - 214;
    expect(rolled).toBeGreaterThan(5);
    expect(WHEEL_RADIUS).toBeGreaterThan(0);
    expect(wheel.rotation.x).toBeCloseTo(rolled / WHEEL_RADIUS, 0);
    // À bord, la caméra anticipe vers l'est, à la vitesse du véhicule.
    const motion = { speed: 0, facing: 0 };
    expect(layer.motion(1, motion)).toBe(true);
    expect(motion.speed).toBeCloseTo(vehicle(sim).speed, 5);
    expect(Math.cos(motion.facing)).toBeCloseTo(1, 5);
    layer.dispose();
  });

  it('sans modèle livré: le repli ramené au plancher, bancs et balancier provisoires, jamais un trou', () => {
    for (const models of [['luggage-van'], []]) {
      const layer = layerOf(models);
      const sim = aboard();
      layer.advance(1 / 60, sim.world);
      const object = layer.root.getObjectByName('vehicule-draisine') ?? fail('véhicule absent');
      const lever = object.getObjectByName('balancier') ?? fail('balancier provisoire absent');
      let meshes = 0;
      object.traverse((child) => {
        if (child instanceof Mesh) meshes += 1;
      });
      // Plancher, bancs et montant (un maillage), fléau (un maillage).
      expect(meshes).toBe(3);
      const base = object.children[0] ?? fail('plancher absent');
      if (models.length > 0) {
        // Le fourgon (2,93 x 4,00 x 9,92) ramené au gabarit du plancher de la fiche.
        expect(base.scale.x * 2.925).toBeCloseTo(1.7, 5);
        expect(base.scale.y * 4.004).toBeCloseTo(def.body.deck, 5);
        expect(base.scale.z * 9.92).toBeCloseTo(2.6, 5);
      }
      // Deux coups (pas 0 et 14), puis le fléau a le temps de finir sa bascule.
      pump(sim, 0.9, (events) => {
        for (const event of events)
          if (event.type === 'vehicle_stroke') layer.stroke(event.vehicle, event.player);
        layer.advance(1 / 30, sim.world);
      });
      expect(lever.rotation.x).toBeLessThan(-RAIL_VEHICLE_LOOK.leverAngle * 0.9);
      layer.dispose();
    }
  });

  it('chez l’invité (un état toutes les 200 ms) le véhicule avance sans à-coup, les joueurs avec lui', () => {
    const layer = layerOf(['draisine']);
    const sim = aboard();
    pump(sim, 6);
    // L'invité: une copie de l'état tous les 6 pas, affichée à 60 images par seconde.
    let guest = structuredClone(sim.world);
    layer.advance(1 / 60, guest);
    const object = layer.root.getObjectByName('vehicule-draisine') ?? fail('véhicule absent');
    const truth: number[] = [];
    let last = object.position.x;
    let lag = 0;
    let worst = 0;
    // La cadence se poursuit (180 pas déjà joués): la draisine garde sa vitesse de croisière.
    for (let tick = 180; tick < 300; tick++) {
      press(sim, tick % 14 === 0 ? [tick % 28 === 0 ? 0 : 1] : []);
      truth.push(vehicle(sim).speed);
      if (tick % 6 === 0) guest = structuredClone(sim.world);
      // Vitesse de l'hôte sur le dernier tiers de seconde: un coup de balancier la fait sauter de
      // 0,55 m/s d'un pas à l'autre, l'invité l'apprend jusqu'à 200 ms plus tard.
      const recent = truth.slice(-10);
      const low = Math.min(...recent);
      const high = Math.max(...recent);
      for (let frame = 0; frame < 2; frame++) {
        layer.advance(1 / 60, guest);
        const shown = (object.position.x - last) * 60;
        last = object.position.x;
        if (tick < 192) continue;
        // Jamais de recul ni de saut: la vitesse affichée reste dans celle de l'hôte, à 10 % près.
        worst = Math.max(worst, low * 0.9 - shown, shown - high * 1.1);
      }
      lag = Math.max(lag, Math.abs(vehicle(sim).s - object.position.x));
      // Les joueurs restent à 85 cm du centre affiché: ils ne traînent pas derrière.
      expect((layer.riders[0]?.x ?? 0) - object.position.x).toBeCloseTo(0.85, 5);
    }
    expect(vehicle(sim).speed).toBeGreaterThan(7);
    expect(worst).toBeLessThanOrEqual(0);
    // Et le véhicule affiché suit l'état de l'hôte à moins de 40 cm.
    expect(lag).toBeLessThan(0.4);
    layer.dispose();
  });
});

describe('indicateur de rythme', () => {
  it('montre le battement, la vitesse, l’arrêt d’ici et le prochain, à qui est à bord seulement', () => {
    const walking = newSim(content);
    expect(vehicleView(content, walking.world, 0)).toBeNull();
    const sim = aboard();
    const mine = vehicleView(content, sim.world, 0) ?? fail('indicateur absent');
    expect(mine).toMatchObject({ seat: 0, full: true, moving: false, here: 'halte', last: null });
    // Tous les verrous fermés: vers l'est, le prochain arrêt est le passage de l'Église (45,5 m).
    expect(vehicleLine(mine)).toBe('Halte, puis passage de l’Église à 45 m'.replace('’', "'"));
    expect(leverMark(mine, 0)).toBe(0.5);
    // Le joueur 0 pompe: chez lui le repère part de son jeton (0) et arrive chez l'autre au battement.
    press(sim, [0]);
    const after = vehicleView(content, sim.world, 0) ?? fail('indicateur absent');
    expect(after.last).toBe(0);
    expect(leverMark(after, 0)).toBe(0);
    expect(leverMark(after, after.beat / 2)).toBeCloseTo(0.5, 5);
    expect(leverMark(after, after.beat * 2)).toBe(1);
    // Chez l'autre, le même coup vient vers son jeton.
    const theirs = vehicleView(content, sim.world, 1) ?? fail('indicateur absent');
    expect(leverMark(theirs, 0)).toBe(1);
    expect(leverMark(theirs, theirs.beat)).toBe(0);
    pump(sim, 5);
    const rolling = vehicleView(content, sim.world, 1) ?? fail('indicateur absent');
    expect(rolling.moving).toBe(true);
    expect(rolling.here).toBeNull();
    expect(rolling.speed).toBeGreaterThan(0.5);
    expect(rolling.rhythm).toBeGreaterThan(0.9);
    expect(vehicleLine(rolling)).toMatch(/^Passage de l'Église à \d+ m$/);
  });
});
