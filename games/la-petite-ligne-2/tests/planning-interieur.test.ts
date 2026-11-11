// Planning vers un point d'intérieur: un habitant factice passe une ligne dans une pièce (par la
// porte, règle du seuil) et la nuit dans un lit. Tests courts, graine fixe.
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ContentError, loadContent, type Content } from '../src/donnees/charger';
import { WorldSchema } from '../src/etat/monde';
import { SLICE_SCHEMAS } from '../src/reseau/canaux';
import { currentPlace, sliceMessage } from '../src/reseau/tranches';
import { findRoute } from '../src/simulation/habitants/chemins';
import { isShopOpen } from '../src/simulation/habitants/lecture';
import { areaAt, doorChain } from '../src/simulation/lieux/traversee';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { plan } from '../outils/nouveau';
import { contentWith, wait } from './aides-l3';
import { dataFiles, MEMBERS, newSim, SEED } from './aides';

type Json = Record<string, unknown>;
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const ROOM = { x: 2, y: 44 };

/**
 * La gare d'essai avec une chambre en annexe (porte sur la façade sud du bâtiment), et le facteur
 * du gabarit dont deux lignes vont dans la pièce: la sieste au point `chambre`, la nuit au lit.
 */
function filesWithRoom(edit?: (life: Json) => void): Record<string, Json> {
  const files = dataFiles() as Record<string, Json>;
  for (const file of plan(TEMPLATE_DIR, 'habitant', 'facteur', 'essai-gare'))
    files[file.path] = file.value;
  const map = files['lieux/essai-gare/carte.json'];
  if (map === undefined) throw new Error('carte absente');
  map.height = 56;
  map.outdoor = { x: 0, y: 0, w: 40, h: 40 };
  map.doors = { 'porte-gare': { x: 22.5, y: 13.5, facing: 0, to: 'porte-chambre' } };
  files['lieux/essai-gare/interieurs/chambre-d-essai.json'] = {
    schema: 1,
    id: 'chambre-d-essai',
    name: "Chambre d'essai",
    width: 8,
    height: 6,
    at: ROOM,
    blocked: [],
    points: { chambre: { x: 3, y: 3 } },
    objects: [{ id: 'lit-factice', type: 'lit-simple', x: 0.5, y: 1, rotation: 0 }],
    doors: { 'porte-chambre': { x: 4.5, y: 5.5, facing: 2, to: 'porte-gare' } },
  };
  const life = files['lieux/essai-gare/habitants/facteur.json']?.life as Json;
  const schedule = life.schedule as Json[];
  life.home = 'chambre';
  for (const entry of schedule) {
    if (entry.activity === 'dormir') entry.at = { bed: 'lit-factice' };
    if (entry.activity === 'flaner') entry.at = { point: 'chambre' };
  }
  edit?.(life);
  return files;
}

function simAt(content: Content, minutes: number): Sim {
  const world = createWorld(content, SEED, MEMBERS);
  world.minutes = minutes;
  world.players[0].body = { x: 17, y: 18, facing: 0, speed: 0 };
  world.players[1].body = { x: 23, y: 18, facing: 0, speed: 0 };
  return createSim(content, world);
}

function facteur(sim: Sim): NonNullable<ReturnType<typeof currentPlace>['villagers'][string]> {
  const state = currentPlace(sim.world).villagers.facteur;
  if (state === undefined) throw new Error('facteur absent');
  return state;
}

describe('planning vers un intérieur', () => {
  const content = loadContent(filesWithRoom());
  const place = content.places['essai-gare'];
  if (place === undefined) throw new Error('lieu absent');

  it('va dans la pièce par la porte: à pied jusqu’au seuil, puis devant l’autre porte', () => {
    const sim = simAt(content, 11 * 60 + 59);
    wait(sim, 0.2);
    expect(areaAt(place, facteur(sim).body.x, facteur(sim).body.y)).toBe('');
    sim.world.minutes = 12 * 60;
    const events = wait(sim, 9);
    expect(events).toContainEqual({
      type: 'villager_door',
      villager: 'facteur',
      door: 'porte-gare',
    });
    expect(facteur(sim).body).toMatchObject({ x: ROOM.x + 3, y: ROOM.y + 3 });
    expect(facteur(sim).life).toMatchObject({ activity: 'flaner', pose: 'stand' });
    // Retour au guichet à 14 h: il ressort par la même paire de portes.
    sim.world.minutes = 14 * 60;
    const back = wait(sim, 9);
    expect(back).toContainEqual({
      type: 'villager_door',
      villager: 'facteur',
      door: 'porte-chambre',
    });
    expect(areaAt(place, facteur(sim).body.x, facteur(sim).body.y)).toBe('');
    expect(facteur(sim).life?.activity).toBe('travailler');
  });

  it('ne marche jamais d’une grille à l’autre: seule la porte fait changer de pièce', () => {
    const state = currentPlace(simAt(content, 600).world);
    const route = findRoute(content, place, state, 20, 15, ROOM.x + 3, ROOM.y + 3);
    const jumps = route.points.filter((p) => p.jump === true);
    expect(jumps).toHaveLength(1);
    let from = { x: 20, y: 15 };
    for (const p of route.points) {
      if (p.jump !== true) {
        expect(areaAt(place, p.x, p.y)).toBe(areaAt(place, from.x, from.y));
        expect(Math.hypot(p.x - from.x, p.y - from.y)).toBeLessThan(8);
      }
      from = p;
    }
    expect(doorChain(place, 20, 15, 21, 16)).toEqual([]);
    expect(doorChain(place, 20, 15, ROOM.x + 3, ROOM.y + 3)?.map((h) => h.door)).toEqual([
      'porte-gare',
    ]);
  });

  it('couché la nuit dans son lit (pose `lie`), posé là à la reprise; un joueur au lit le laisse debout', () => {
    const sim = simAt(content, 3 * 60);
    wait(sim, 0.2);
    expect(facteur(sim).life).toMatchObject({
      activity: 'dormir',
      pose: 'lie',
      seat: ['lit-factice', 0],
    });
    expect(facteur(sim).body).toMatchObject({ x: ROOM.x + 0.5, y: ROOM.y + 1 });
    // La posture couchée tient dans l'état sauvegardé et dans la tranche « lieu » envoyée à l'invité.
    expect(v.is(WorldSchema, sim.world)).toBe(true);
    expect(v.is(SLICE_SCHEMAS.place, sliceMessage(sim.world, 'place'))).toBe(true);

    const taken = simAt(content, 3 * 60);
    const bed = (currentPlace(taken.world).objects['lit-factice'] ??= {});
    bed.sleep = [0];
    wait(taken, 0.2);
    expect(facteur(taken).life).toMatchObject({ pose: 'stand', seat: null });
  });

  it('refuse un lit qui n’en est pas un, et une nuit hors de chez lui', () => {
    const problems = (edit: (life: Json) => void): string => {
      try {
        loadContent(filesWithRoom(edit));
      } catch (error) {
        if (error instanceof ContentError) return error.problems.join('\n');
        throw error;
      }
      return '';
    };
    expect(
      problems((life) => {
        for (const e of life.schedule as Json[])
          if (e.activity === 'dormir') e.at = { bed: 'banc-du-quai' };
      }),
    ).toContain("n'est pas un lit");
    expect(
      problems((life) => {
        life.home = 'guichet';
      }),
    ).toContain('il doit être chez lui');
  });
});

describe('Aubrune (données livrées): commerçants à leur poste, nuit au lit', () => {
  // Le contenu livré, départ à Aubrune (le jeu, lui, part du prologue).
  const game = contentWith((files) => {
    const settings = files['commun/reglages.json'] as { start: Json };
    settings.start = { ...settings.start, place: 'aubrune' };
  });
  const found = game.places.aubrune;
  if (found === undefined) throw new Error('Aubrune absent');
  const aubrune = found;

  function at(minutes: number): Sim {
    const sim = newSim(game);
    sim.world.minutes = minutes;
    for (const key of ['aubrune.acte2.train', 'aubrune.acte3.train2', 'aubrune.verrou.v3'])
      sim.world.progress.memory[key] = { v: true, by: 'duo', day: 1 };
    wait(sim, 0.2);
    return sim;
  }
  function room(sim: Sim, id: string): string {
    const body = currentPlace(sim.world).villagers[id]?.body;
    if (body === undefined) throw new Error(`${id} absent`);
    return areaAt(aubrune, body.x, body.y);
  }

  it('à 10 h, chacun tient son commerce dans sa boutique (Margot dans sa cour)', () => {
    const sim = at(600);
    expect({
      odette: room(sim, 'odette'),
      achille: room(sim, 'achille'),
      colette: room(sim, 'colette'),
      solange: room(sim, 'solange'),
      mado: room(sim, 'mado'),
      basile: room(sim, 'basile'),
      margot: room(sim, 'margot'),
    }).toEqual({
      odette: 'epicerie-rdc',
      achille: 'fournil',
      colette: 'cafe',
      solange: 'mercerie',
      mado: 'forge',
      basile: 'atelier-basile',
      margot: '',
    });
    for (const shop of Object.keys(aubrune.shops)) expect(isShopOpen(sim, shop), shop).toBe(true);
  });

  it('la nuit, Odette est couchée à l’étage et Berthe dans son grenier; à 7 h Odette descend', () => {
    const sim = at(6 * 60 + 58);
    expect(room(sim, 'odette')).toBe('epicerie-etage');
    expect(currentPlace(sim.world).villagers.odette?.life).toMatchObject({
      pose: 'lie',
      seat: ['odette-lit', 0],
    });
    expect(room(sim, 'berthe')).toBe('moulin-etage');
    // Les joueurs dans la boutique: elle vit à pleine fréquence, on la voit descendre l'escalier.
    const shop = aubrune.map.points['odette-comptoir'];
    if (shop === undefined) throw new Error('point absent');
    for (const p of [0, 1] as const) Object.assign(sim.world.players[p].body, shop);
    sim.world.minutes = 7 * 60;
    const events = wait(sim, 14);
    expect(events).toContainEqual({
      type: 'villager_door',
      villager: 'odette',
      door: 'epicerie-etage-esc-epicerie-rdc',
    });
    expect(room(sim, 'odette')).toBe('epicerie-rdc');
    expect(isShopOpen(sim, 'epicerie-ferrand')).toBe(true);
  });
});
