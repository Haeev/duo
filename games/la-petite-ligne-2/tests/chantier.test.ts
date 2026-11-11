// Chantier d'une pièce (brique `worksite`): la touche d'action ouvre l'écran, chaque geste est
// accepté ou refusé avec sa raison, à deux on va plus vite, l'invité vaut l'hôte, la partie se
// reprend en plein chantier. Tests courts sur la maison d'essai, avec une ardoise factice.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { DATA_SCHEMA } from '../src/etat/monde';
import { worksiteModel } from '../src/interface/chantier/modele';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { aimOf } from '../src/simulation/briques/visee';
import { HOUSING_TUNING } from '../src/simulation/logement/reglages';
import type { Intent } from '../src/simulation/noyau/entrees';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { addItem } from '../src/simulation/sac/inventaire';
import { absentObjects } from '../src/simulation/lieux/index';
import { gameContent, MEMBERS, newSim } from './aides';
import { act, contentWith, wait } from './aides-l3';

const PLACE = 'essai-gare';
const HOUSE = 'maison-essai';
/** Ardoise de la salle (dans la salle) et ardoise de la chambre, posée dans la salle, loin d'elle. */
const SLATE = { id: 'chantier-salle', x: 28.5, y: 6.5 };
const FAR_SLATE = { id: 'chantier-chambre', x: 27.5, y: 11.5 };

type Json = Record<string, unknown>;

/** L'élément `index` d'une liste de fiches, qui doit exister. */
function nth(list: Json[], index: number): Json {
  const found = list[index];
  if (found === undefined) throw new Error(`élément ${String(index)} absent`);
  return found;
}

/** La maison d'essai avec ses deux chantiers; `edit` retouche la fiche du logement. */
function siteContent(edit?: (rooms: Json[]) => void): Content {
  return contentWith((files) => {
    files['commun/meubles/ardoise-factice.json'] = {
      schema: 1,
      id: 'ardoise-factice',
      name: 'Ardoise',
      model: 'chalk-board',
      size: { w: 1, h: 1 },
      solid: true,
      placeable: false,
      series: null,
      bricks: [{ brick: 'worksite' }],
    };
    const restored = { type: 'remembered', key: `${PLACE}.${HOUSE}.salle` };
    const objects = files[`lieux/${PLACE}/carte.json`]?.objects as Json[];
    objects.push({
      ...SLATE,
      type: 'ardoise-factice',
      rotation: 0,
      when: [{ type: 'not', condition: restored }],
    });
    objects.push({ ...FAR_SLATE, type: 'ardoise-factice', rotation: 0 });
    const rooms = files[`lieux/${PLACE}/logements/${HOUSE}.json`]?.rooms as Json[];
    for (const room of rooms) room.site = `chantier-${String(room.id)}`;
    edit?.(rooms);
  });
}

function at(sim: Sim, player: PlayerIndex, x: number, y: number): void {
  sim.world.players[player].body = { x, y, facing: -Math.PI / 2, speed: 0 };
}

/** Devant l'ardoise de la salle, tourné vers elle. */
function atSlate(sim: Sim, player: PlayerIndex): void {
  at(sim, player, SLATE.x + (player === 0 ? -0.2 : 0.2), SLATE.y + 1.1);
}

function housing(sim: Sim) {
  const state = sim.world.places[PLACE]?.housing?.[HOUSE];
  if (state === undefined) throw new Error('logement absent');
  return state;
}

function refused(sim: Sim, player: PlayerIndex, intent: Intent): string[] {
  return act(sim, player, intent).flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

const supply: Intent = { type: 'housing_supply', housing: HOUSE, room: 'salle' };
const pay: Intent = { type: 'housing_pay', housing: HOUSE, room: 'salle' };
const work: Intent = { type: 'housing_work', housing: HOUSE, room: 'salle', on: true };

/** Finit la première étape de la salle (6 s de travail, rien à fournir). */
function clearFirstStage(sim: Sim): void {
  atSlate(sim, 0);
  act(sim, 0, work);
  wait(sim, 6.1);
  expect(housing(sim).rooms.salle?.stage).toBe(1);
}

describe('chantier', () => {
  it('la touche d’action sur l’ardoise ouvre l’écran de sa pièce, chez l’hôte comme chez l’invité', () => {
    const sim = newSim(siteContent());
    wait(sim, 1 / 30);
    for (const player of [0, 1] as const) {
      atSlate(sim, player);
      wait(sim, 1 / 30);
      expect(aimOf(sim, player)).toMatchObject({ id: SLATE.id, verb: 'Restaurer', refusal: null });
      expect(act(sim, player, { type: 'act' })).toContainEqual({
        type: 'worksite_opened',
        player,
        target: SLATE.id,
        housing: HOUSE,
        room: 'salle',
      });
    }
  });

  it('chaque geste est accepté ou refusé avec sa raison', () => {
    const sim = newSim(siteContent());
    wait(sim, 1 / 30);
    clearFirstStage(sim);
    const me = sim.world.players[0];
    me.money = 100;
    sim.world.common.chest = 0;
    // Étape 2: quatre planches, 5 €, 10 s de travail.
    expect(refused(sim, 0, supply)).toEqual(['room-nothing-to-give']);
    expect(refused(sim, 0, pay)).toEqual(['not-enough-money']);
    expect(refused(sim, 0, work)).toEqual(['room-missing-materials']);
    addItem(sim.content, me, 'planche', 4);
    expect(refused(sim, 0, supply)).toEqual([]);
    expect(housing(sim).rooms.salle?.delivered).toEqual({ planche: 4 });
    expect(refused(sim, 0, work)).toEqual(['room-not-paid']);
    // La somme quitte vraiment le coffre commun, pas la bourse.
    sim.world.common.chest = 800;
    expect(refused(sim, 0, pay)).toEqual([]);
    expect(sim.world.common.chest).toBe(300);
    expect(me.money).toBe(100);
    expect(refused(sim, 0, pay)).toEqual(['room-already-paid']);
    // Trop loin de la pièce et de son ardoise: refusé; revenu, on travaille.
    at(sim, 0, 10, 20);
    expect(refused(sim, 0, work)).toEqual(['too-far']);
    atSlate(sim, 0);
    expect(refused(sim, 0, work)).toEqual([]);
    const done = wait(sim, 10.1);
    expect(done).toContainEqual({
      type: 'room_progress',
      housing: HOUSE,
      room: 'salle',
      stage: 1,
      done: true,
    });
    expect(refused(sim, 0, work)).toEqual(['room-done']);
    // Pièce finie: l'ardoise s'en va (condition de la carte) et n'est plus une cible.
    wait(sim, 1 / 30);
    expect(aimOf(sim, 0)).toBeNull();
  });

  it('refuse tant que l’histoire ou une autre pièce manque, et l’écran dit la phrase des données', () => {
    const content = siteContent((rooms) => {
      const stage = nth(nth(rooms, 0).stages as Json[], 0);
      stage.when = [{ type: 'remembered', key: 'essai.devis-entendu' }];
      stage.says = 'Pas encore de devis.';
    });
    const sim = newSim(content);
    wait(sim, 1 / 30);
    atSlate(sim, 0);
    expect(refused(sim, 0, work)).toEqual(['room-story-not-yet']);
    expect(worksiteModel(sim, 0, HOUSE, 'salle')?.lock).toEqual({
      reason: 'room-story-not-yet',
      text: 'Pas encore de devis.',
    });
    expect(refused(sim, 0, { type: 'housing_supply', housing: HOUSE, room: 'chambre' })).toEqual([
      'room-needs-other',
    ]);
    sim.world.progress.memory['essai.devis-entendu'] = { v: true, by: 0, day: 1 };
    expect(refused(sim, 0, work)).toEqual([]);
    expect(worksiteModel(sim, 0, HOUSE, 'salle')?.lock).toBeNull();
  });

  it('à deux le travail va plus vite, et l’étape suivante attend ses matériaux', () => {
    const sim = newSim(siteContent());
    wait(sim, 1 / 30);
    atSlate(sim, 0);
    atSlate(sim, 1);
    act(sim, 0, work);
    act(sim, 1, work);
    expect(worksiteModel(sim, 1, HOUSE, 'salle')?.work).toMatchObject({
      workers: [true, true],
      rate: HOUSING_TUNING.duoWorkRate,
    });
    // 6 s seul: à deux, 6 / 2,5 = 2,4 s. Pas fini juste avant, fini juste après.
    wait(sim, 6 / HOUSING_TUNING.duoWorkRate - 0.2);
    expect(housing(sim).rooms.salle?.stage).toBe(0);
    wait(sim, 0.3);
    expect(housing(sim).rooms.salle?.stage).toBe(1);
    // La nouvelle étape demande planches et argent: personne ne tape dans le vide.
    wait(sim, 1);
    expect(housing(sim).working).toEqual([null, null]);
    expect(housing(sim).rooms.salle?.work).toBe(0);
  });

  it('l’invité apporte et paie comme l’hôte, et chacun lit l’avancement de l’autre', () => {
    const sim = newSim(siteContent());
    wait(sim, 1 / 30);
    clearFirstStage(sim);
    atSlate(sim, 1);
    addItem(sim.content, sim.world.players[0], 'planche', 1);
    addItem(sim.content, sim.world.players[1], 'planche', 3);
    sim.world.common.chest = 500;
    expect(refused(sim, 1, supply)).toEqual([]);
    const seenByHost = worksiteModel(sim, 0, HOUSE, 'salle');
    expect(seenByHost?.materials).toEqual([
      { item: 'planche', name: 'Planche', need: 4, delivered: 3, inBag: 1 },
    ]);
    expect(refused(sim, 0, supply)).toEqual([]);
    expect(refused(sim, 1, pay)).toEqual([]);
    expect(sim.world.common.chest).toBe(0);
    expect(worksiteModel(sim, 0, HOUSE, 'salle')?.cost).toMatchObject({ total: 500, due: 0 });
    expect(refused(sim, 1, work)).toEqual([]);
    wait(sim, 10.1);
    expect(housing(sim).rooms.salle?.state).toBe('restored');
    expect(worksiteModel(sim, 0, HOUSE, 'salle')?.done).toBe(true);
  });

  it('un chantier posé hors de sa pièce (le pied d’un escalier) sert à portée de son ardoise', () => {
    const sim = newSim(siteContent());
    wait(sim, 1 / 30);
    for (const room of Object.values(housing(sim).rooms)) room.state = 'restored';
    const chambre = housing(sim).rooms.chambre;
    if (chambre === undefined) throw new Error('chambre absente');
    chambre.state = 'ruin';
    sim.world.progress.memory[`${PLACE}.${HOUSE}.salle`] = { v: 'restored', by: 0, day: 1 };
    // Devant l'ardoise de la chambre, à plus de 2 m de la chambre elle-même.
    at(sim, 0, FAR_SLATE.x, FAR_SLATE.y - 1.1);
    sim.world.players[0].body.facing = Math.PI / 2;
    wait(sim, 1 / 30);
    expect(aimOf(sim, 0)).toMatchObject({ id: FAR_SLATE.id });
    addItem(sim.content, sim.world.players[0], 'planche', 2);
    expect(refused(sim, 0, { type: 'housing_supply', housing: HOUSE, room: 'chambre' })).toEqual(
      [],
    );
    expect(chambre.delivered).toEqual({ planche: 2 });
  });

  it('se sauvegarde et se reprend en plein chantier', () => {
    const content = siteContent();
    const sim = newSim(content);
    wait(sim, 1 / 30);
    clearFirstStage(sim);
    addItem(sim.content, sim.world.players[0], 'planche', 3);
    sim.world.common.chest = 500;
    act(sim, 0, supply);
    act(sim, 0, pay);
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world, content).data)) as unknown;
    const restored = restoreWorld(content, { dataSchema: DATA_SCHEMA, data: saved }, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const again = createSim(content, restored.world);
    wait(again, 1 / 30);
    expect(housing(again).rooms.salle).toMatchObject({
      state: 'works',
      stage: 1,
      delivered: { planche: 3 },
      paid: 500,
    });
    // Il manquait une planche: on l'apporte après la reprise, puis on finit.
    atSlate(again, 0);
    addItem(again.content, again.world.players[0], 'planche', 1);
    expect(refused(again, 0, supply)).toEqual([]);
    expect(refused(again, 0, work)).toEqual([]);
    wait(again, 10.1);
    expect(housing(again).rooms.salle?.state).toBe('restored');
  });

  it('maison du garde: une ardoise par pièce à refaire, qui paraît à son tour et part à la fin', () => {
    const content = gameContent();
    const place = content.places.aubrune;
    const house = place?.housings['maison-du-garde'];
    if (place === undefined || house === undefined) throw new Error('maison absente');
    const sim = newSim(content);
    sim.world.common.place = 'aubrune';
    const slates = (): string[] => {
      const absent = absentObjects(sim);
      return house.rooms
        .map((room) => room.site ?? '')
        .filter((id) => !absent.has(id))
        .sort();
    };
    const restore = (room: string): void => {
      sim.world.progress.memory[`aubrune.maison-du-garde.${room}`] = {
        v: 'restored',
        by: 'duo',
        day: 3,
      };
    };
    // Chaque pièce à refaire a son chantier, posé dans la maison.
    for (const room of house.rooms) {
      const site = place.map.objects.find((o) => o.id === room.site);
      expect(site?.type, room.id).toBe('ardoise-de-chantier');
      expect(site?.pourquoi, room.id).toBeTypeOf('string');
    }
    expect(slates()).toEqual(['maison-chantier-salle']);
    restore('salle');
    expect(slates()).toEqual([
      'maison-chantier-cave',
      'maison-chantier-chambre',
      'maison-chantier-cuisine',
    ]);
    restore('cuisine');
    restore('chambre');
    expect(slates()).toEqual(['maison-chantier-cave', 'maison-chantier-troisieme-piece']);
    restore('troisieme-piece');
    restore('cave');
    expect(slates()).toEqual(['maison-chantier-etage']);
    restore('etage');
    expect(slates()).toEqual([]);
  });

  it('refuse les données de chantier incohérentes', () => {
    const load = (edit: (rooms: Json[]) => void): string => {
      try {
        siteContent(edit);
        return '';
      } catch (error) {
        return String(error);
      }
    };
    expect(
      load((rooms) => {
        nth(rooms, 0).site = 'chantier-inconnu';
      }),
    ).toMatch(/chantier « chantier-inconnu » absent de la carte/);
    expect(
      load((rooms) => {
        nth(rooms, 1).site = 'chantier-salle';
      }),
    ).toMatch(/sert déjà la pièce « salle »/);
    expect(
      load((rooms) => {
        nth(rooms, 0).site = 'etabli-de-gare';
      }),
    ).toMatch(/n'a pas la brique worksite/);
  });
});
