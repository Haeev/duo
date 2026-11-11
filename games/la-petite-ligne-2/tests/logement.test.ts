// Logement et mode déco: restauration complète, règles de pose, deux joueurs sur le même meuble,
// confort, et un logement factice ajouté par les seules données.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { BUDGET_BYTES, SLICE_SCHEMAS } from '../src/reseau/canaux';
import { byteLength, sliceMessage } from '../src/reseau/tranches';
import type { Sim } from '../src/simulation/noyau/pas';
import { comfortLevel } from '../src/simulation/logement/etat';
import { placementRefusal, type Candidate } from '../src/simulation/logement/pose';
import { HOUSING_TUNING } from '../src/simulation/logement/reglages';
import { addItem } from '../src/simulation/sac/inventaire';
import { newSim } from './aides';
import { act, contentWith, wait } from './aides-l3';

const PLACE = 'essai-gare';
const HOUSE = 'maison-essai';

function at(sim: Sim, player: PlayerIndex, x: number, y: number): void {
  sim.world.players[player].body = { x, y, facing: 0, speed: 0 };
}

function housing(sim: Sim) {
  const state = sim.world.places[PLACE]?.housing?.[HOUSE];
  if (state === undefined) throw new Error('logement absent');
  return state;
}

function refusals(events: Sim['events']): string[] {
  return events.flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

/** Une partie où les deux pièces sont déjà restaurées, les deux joueurs dans la salle. */
function restoredSim(content?: Content): Sim {
  const sim = newSim(content);
  wait(sim, 1 / 30);
  for (const room of Object.values(housing(sim).rooms)) room.state = 'restored';
  at(sim, 0, 29.5, 11);
  at(sim, 1, 30.5, 11);
  return sim;
}

function refusalOf(sim: Sim, candidate: Candidate): string | null {
  const place = sim.content.places[PLACE];
  const state = sim.world.places[PLACE];
  const def = place?.housings[HOUSE];
  if (place === undefined || state === undefined || def === undefined) throw new Error('lieu');
  return placementRefusal({
    content: sim.content,
    place,
    state,
    world: sim.world,
    housing: def,
    candidate,
    exclude: new Set(),
  });
}

function put(sim: Sim, type: string, x: number, y: number): void {
  const state = sim.world.places[PLACE];
  if (state === undefined) throw new Error('lieu');
  const id = `pose-${String(state.nextPlacedId++)}`;
  state.placed.push({ id, type, x, y, rotation: 0 });
  state.objects[id] = {};
}

describe('logement', () => {
  it('se restaure en entier: étapes, matériaux, argent du coffre, travail plus vite à deux, fait d’histoire', () => {
    const sim = newSim();
    wait(sim, 1 / 30);
    expect(housing(sim).rooms.salle?.state).toBe('ruin');
    // La chambre attend la salle.
    at(sim, 0, 34, 9);
    expect(
      refusals(act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'chambre', on: true })),
    ).toEqual(['room-needs-other']);

    // Étape 1 (débroussailler, 6 s seul): 2 s seul, puis l'autre aide.
    at(sim, 0, 29.5, 12);
    at(sim, 1, 30.5, 12);
    act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'salle', on: true });
    expect(housing(sim).rooms.salle?.state).toBe('works');
    wait(sim, 2);
    act(sim, 1, { type: 'housing_work', housing: HOUSE, room: 'salle', on: true });
    const duoSeconds = (6 - 2) / HOUSING_TUNING.duoWorkRate;
    const events = wait(sim, duoSeconds + 0.1);
    expect(events).toContainEqual({
      type: 'room_progress',
      housing: HOUSE,
      room: 'salle',
      stage: 0,
      done: false,
    });
    expect(housing(sim).rooms.salle?.stage).toBe(1);

    // Étape 2: planches en deux fois (deux joueurs), 5 € du coffre et de la bourse, puis 10 s de travail.
    const [a, b] = sim.world.players;
    addItem(sim.content, a, 'planche', 3);
    addItem(sim.content, b, 'planche', 1);
    act(sim, 0, { type: 'housing_supply', housing: HOUSE, room: 'salle' });
    expect(
      refusals(act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'salle', on: true })),
    ).toEqual(['room-missing-materials']);
    act(sim, 1, { type: 'housing_supply', housing: HOUSE, room: 'salle' });
    expect(housing(sim).rooms.salle?.delivered).toEqual({ planche: 4 });
    sim.world.common.chest = 300;
    const purse = a.money;
    act(sim, 0, { type: 'housing_pay', housing: HOUSE, room: 'salle' });
    expect(sim.world.common.chest).toBe(0);
    expect(a.money).toBe(purse - 200);
    act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'salle', on: true });
    act(sim, 1, { type: 'housing_work', housing: HOUSE, room: 'salle', on: true });
    const done = wait(sim, 10 / HOUSING_TUNING.duoWorkRate + 0.1);
    expect(done).toContainEqual({
      type: 'room_progress',
      housing: HOUSE,
      room: 'salle',
      stage: 1,
      done: true,
    });
    expect(housing(sim).rooms.salle?.state).toBe('restored');
    expect(sim.world.progress.memory[`${PLACE}.${HOUSE}.salle`]?.v).toBe('restored');

    // La chambre (fait d'histoire « salle restaurée » exigé); bouger arrête le travail.
    addItem(sim.content, a, 'planche', 2);
    addItem(sim.content, a, 'buche', 2);
    at(sim, 0, 34, 9);
    act(sim, 0, { type: 'housing_supply', housing: HOUSE, room: 'chambre' });
    sim.world.common.chest = 1500;
    act(sim, 0, { type: 'housing_pay', housing: HOUSE, room: 'chambre' });
    act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'chambre', on: true });
    a.body.speed = 3;
    wait(sim, 1 / 30);
    expect(housing(sim).working[0]).toBeNull();
    a.body.speed = 0;
    act(sim, 0, { type: 'housing_work', housing: HOUSE, room: 'chambre', on: true });
    wait(sim, 8.1);
    expect(housing(sim).rooms.chambre?.state).toBe('restored');
  });

  it('règles de pose: porte, surface, mur, dehors, pièce, passage libre', () => {
    const sim = restoredSim();
    // Devant la porte d'entrée (29.5, 13.5), un lit bloque le seuil.
    expect(refusalOf(sim, { type: 'lit-double-essai', x: 29, y: 12, rotation: 0 })).toBe('door');
    expect(refusalOf(sim, { type: 'lit-double-essai', x: 28, y: 6, rotation: 0 })).toBeNull();
    // Une lampe va sur une surface, pas par terre.
    expect(refusalOf(sim, { type: 'lampe-essai', x: 30.5, y: 7.5, rotation: 0 })).toBe(
      'no-surface',
    );
    put(sim, 'table-essai', 30, 7.5);
    expect(refusalOf(sim, { type: 'lampe-essai', x: 30.5, y: 7.5, rotation: 0 })).toBeNull();
    // Le tapis passe sous la table; une chaise ne la chevauche pas.
    expect(refusalOf(sim, { type: 'tapis-essai', x: 30, y: 8, rotation: 0 })).toBeNull();
    expect(refusalOf(sim, { type: 'chaise-essai', x: 30.5, y: 7.5, rotation: 0 })).toBe('overlap');
    // Un cadre se pend au mur, dos au mur.
    expect(refusalOf(sim, { type: 'cadre-essai', x: 29.5, y: 9.5, rotation: 0 })).toBe('no-wall');
    expect(refusalOf(sim, { type: 'cadre-essai', x: 28.5, y: 5.5, rotation: 0 })).toBeNull();
    expect(refusalOf(sim, { type: 'cadre-essai', x: 28.5, y: 5.5, rotation: 2 })).toBe('no-wall');
    // Le pot de fleurs va dehors, dans le jardin seulement; rien hors du terrain ni dans un mur.
    expect(refusalOf(sim, { type: 'pot-de-fleurs-essai', x: 28.5, y: 10.5, rotation: 0 })).toBe(
      'wrong-zone',
    );
    expect(
      refusalOf(sim, { type: 'pot-de-fleurs-essai', x: 25.5, y: 15.5, rotation: 0 }),
    ).toBeNull();
    expect(refusalOf(sim, { type: 'pot-de-fleurs-essai', x: 20.5, y: 15.5, rotation: 0 })).toBe(
      'outside',
    );
    expect(refusalOf(sim, { type: 'chaise-essai', x: 26.5, y: 9.5, rotation: 0 })).toBe('wall');
    // Le baquet demande une pièce où l'on se lave: la chambre, pas la salle.
    expect(refusalOf(sim, { type: 'baquet-essai', x: 27.5, y: 10.5, rotation: 0 })).toBe(
      'wrong-room',
    );
    expect(refusalOf(sim, { type: 'baquet-essai', x: 37.5, y: 12.5, rotation: 0 })).toBeNull();
    // Passage: un lit au fond de la salle, puis une barrière de meubles d'un mur à l'autre.
    put(sim, 'lit-double-essai', 28, 6);
    put(sim, 'buffet-essai', 28, 10.5);
    put(sim, 'coffre-deco-essai', 29.5, 10.5);
    expect(refusalOf(sim, { type: 'chaise-essai', x: 30.5, y: 10.5, rotation: 0 })).toBeNull();
    expect(refusalOf(sim, { type: 'buffet-essai', x: 31, y: 10.5, rotation: 0 })).toBe(
      'blocks-path',
    );
    // Une pièce en travaux n'accepte rien.
    const ruin = restoredSim();
    const room = housing(ruin).rooms.chambre;
    if (room !== undefined) room.state = 'works';
    expect(refusalOf(ruin, { type: 'chaise-essai', x: 35.5, y: 9.5, rotation: 0 })).toBe(
      'room-not-ready',
    );
  });

  it('deux joueurs: un meuble tenu est verrouillé pour l’autre, qui voit le geste', () => {
    const sim = restoredSim();
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 1, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'table-essai',
      x: 30.2,
      y: 7.4,
      rotation: 0,
    });
    expect(housing(sim).held[0]).toEqual({
      prop: null,
      type: 'table-essai',
      x: 30,
      y: 7.5,
      rotation: 0,
    });
    expect(housing(sim).stock['table-essai']).toBeUndefined();
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    const table = sim.world.places[PLACE]?.placed.find((p) => p.type === 'table-essai');
    expect(table).toMatchObject({ x: 30, y: 7.5 });
    const id = table?.id ?? '';

    act(sim, 0, { type: 'deco_grab', housing: HOUSE, prop: id });
    expect(refusals(act(sim, 1, { type: 'deco_grab', housing: HOUSE, prop: id }))).toEqual([
      'deco-held-by-other',
    ]);
    expect(refusals(act(sim, 1, { type: 'deco_store', housing: HOUSE, prop: id }))).toEqual([
      'deco-held-by-other',
    ]);
    // Le geste de l'autre part dans la tranche « lieu »: position et rotation en main.
    act(sim, 0, { type: 'deco_move', housing: HOUSE, x: 29, y: 10, rotation: 1 });
    const seen = sliceMessage(sim.world, 'place').place.housing?.[HOUSE]?.held[0];
    expect(seen).toEqual({ prop: id, type: 'table-essai', x: 29, y: 10, rotation: 1 });
    // Pose refusée devant une porte: la raison revient, le meuble reste en main.
    act(sim, 0, { type: 'deco_move', housing: HOUSE, x: 29.5, y: 12, rotation: 0 });
    expect(refusals(act(sim, 0, { type: 'deco_drop', housing: HOUSE }))).toEqual(['deco-door']);
    expect(housing(sim).held[0]?.prop).toBe(id);
    act(sim, 0, { type: 'deco_cancel', housing: HOUSE });
    expect(sim.world.places[PLACE]?.placed.find((p) => p.id === id)).toMatchObject({
      x: 30,
      y: 7.5,
    });
    // Relâché, l'autre peut le ranger.
    act(sim, 1, { type: 'deco_store', housing: HOUSE, prop: id });
    expect(housing(sim).stock['table-essai']).toBe(1);
    expect(sim.world.places[PLACE]?.placed.some((p) => p.id === id)).toBe(false);
  });

  it('tourner un meuble en main émet rotate, une fois par quart de tour', () => {
    const sim = restoredSim();
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'table-essai',
      x: 30,
      y: 7.5,
      rotation: 0,
    });
    const turn = (rotation: 0 | 1): string[] =>
      act(sim, 0, { type: 'deco_move', housing: HOUSE, x: 30, y: 7.5, rotation }).flatMap((e) =>
        e.type === 'deco_changed' ? [e.action] : [],
      );
    expect(turn(1)).toEqual(['rotate']);
    expect(turn(1)).toEqual([]);
  });

  it('un meuble posé sur une table la suit, la table chargée ne se range pas, le confort monte', () => {
    const sim = restoredSim();
    act(sim, 0, { type: 'deco_mode', housing: HOUSE, on: true });
    act(sim, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'table-essai',
      x: 30,
      y: 7.5,
      rotation: 0,
    });
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    act(sim, 0, {
      type: 'deco_take',
      housing: HOUSE,
      prop: 'lampe-essai',
      x: 30.5,
      y: 7.5,
      rotation: 0,
    });
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    const placed = sim.world.places[PLACE]?.placed ?? [];
    const table = placed.find((p) => p.type === 'table-essai');
    const lamp = placed.find((p) => p.type === 'lampe-essai');
    expect(
      refusals(act(sim, 0, { type: 'deco_store', housing: HOUSE, prop: table?.id ?? '' })),
    ).toEqual(['deco-surface-busy']);
    act(sim, 0, { type: 'deco_grab', housing: HOUSE, prop: table?.id ?? '' });
    act(sim, 0, { type: 'deco_move', housing: HOUSE, x: 29.5, y: 10, rotation: 1 });
    act(sim, 0, { type: 'deco_drop', housing: HOUSE });
    expect(table).toMatchObject({ x: 29.5, y: 10, rotation: 1 });
    expect(lamp).toMatchObject({ x: 29.5, y: 10.5, rotation: 1 });
    // Confort: 2 pièces (2 x 2) + table 3 + lampe 2 = 9, premier palier.
    expect(housing(sim).comfort).toBe(9);
    expect(housing(sim).level).toBe(comfortLevel(9));
    expect(sim.world.progress.memory[`${PLACE}.${HOUSE}.confort-1`]?.v).toBe(true);
    // La tranche reste sous son budget.
    const message = sliceMessage(sim.world, 'place');
    expect(byteLength(message)).toBeLessThan(BUDGET_BYTES.place);
    expect(v.safeParse(SLICE_SCHEMAS.place, JSON.parse(JSON.stringify(message))).success).toBe(
      true,
    );
  });

  it('un logement et un meuble factices ajoutés par les seules données fonctionnent', () => {
    const content = contentWith((files) => {
      files['commun/meubles/tabouret-factice.json'] = {
        schema: 1,
        id: 'tabouret-factice',
        name: 'Tabouret',
        model: 'tabouret',
        size: { w: 1, h: 1 },
        solid: true,
        placeable: true,
        series: null,
        bricks: [{ brick: 'sit', seats: 1, restPerMinute: 6 }],
      };
      files['lieux/essai-gare/logements/appartement-factice.json'] = {
        schema: 1,
        id: 'appartement-factice',
        name: 'Appartement',
        kind: 'apartment',
        entrance: { x: 4.5, y: 20 },
        doors: [],
        rooms: [
          {
            id: 'sejour',
            name: 'Séjour',
            area: { x: 2, y: 14, w: 6, h: 6 },
            floor: 0,
            start: 'restored',
            requires: [],
            stages: [],
            unlocks: ['sleep'],
            clue: null,
          },
        ],
        garden: null,
        stock: { 'tabouret-factice': 1 },
      };
    });
    const sim = newSim(content);
    wait(sim, 1 / 30);
    const state = sim.world.places[PLACE]?.housing?.['appartement-factice'];
    expect(state?.rooms.sejour?.state).toBe('restored');
    at(sim, 0, 4.5, 17);
    act(sim, 0, { type: 'deco_mode', housing: 'appartement-factice', on: true });
    act(sim, 0, {
      type: 'deco_take',
      housing: 'appartement-factice',
      prop: 'tabouret-factice',
      x: 2.5,
      y: 14.5,
      rotation: 0,
    });
    act(sim, 0, { type: 'deco_drop', housing: 'appartement-factice' });
    const stool = sim.world.places[PLACE]?.placed.find((p) => p.type === 'tabouret-factice');
    expect(stool).toMatchObject({ x: 2.5, y: 14.5 });
    // Fonctionnel par ses briques: une place assise.
    expect(sim.world.places[PLACE]?.objects[stool?.id ?? '']).toEqual({ sit: [null] });
  });
});
