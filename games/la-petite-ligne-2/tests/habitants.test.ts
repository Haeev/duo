// Habitants (planning, sièges, présence, cadeaux, train, basse fréquence): tests courts, graine fixe.
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import { bondKey } from '../src/etat/progression';
import { BUDGET_BYTES, SLICE_SCHEMAS } from '../src/reseau/canaux';
import { byteLength, currentPlace, sliceMessage } from '../src/reseau/tranches';
import { findRoute } from '../src/simulation/habitants/chemins';
import { hasSomethingFor, isShopOpen, villagerView } from '../src/simulation/habitants/lecture';
import { seasonOf, weekdayOf } from '../src/simulation/habitants/planning';
import { VILLAGERS } from '../src/simulation/habitants/reglages';
import { createWorld } from '../src/simulation/noyau/monde';
import { createSim, type Sim } from '../src/simulation/noyau/pas';
import { plan } from '../outils/nouveau';
import { act, wait } from './aides-l3';
import { dataFiles, MEMBERS, SEED } from './aides';

type Json = Record<string, unknown>;
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const MAP = 'lieux/essai-gare/carte.json';

/** Données du jeu plus le gabarit d'habitant copié tel quel (`pnpm nouveau habitant <id> essai-gare`). */
function filesWithVillager(id: string): Record<string, Json> {
  const files = dataFiles() as Record<string, Json>;
  for (const file of plan(TEMPLATE_DIR, 'habitant', id, 'essai-gare'))
    files[file.path] = file.value;
  return files;
}

function mapOf(files: Record<string, Json>): Json {
  const map = files[MAP];
  if (map === undefined) throw new Error('carte absente');
  return map;
}

function lifeOf(files: Record<string, Json>, id: string): Json {
  return files[`lieux/essai-gare/habitants/${id}.json`]?.life as Json;
}

function simOf(content: Content, minutes: number, day = 1): Sim {
  const world = createWorld(content, SEED, MEMBERS);
  world.minutes = minutes;
  world.common.day = day;
  // Les joueurs près du guichet: les habitants vivent à pleine fréquence.
  world.players[0].body = { x: 17, y: 18, facing: 0, speed: 0 };
  world.players[1].body = { x: 23, y: 18, facing: 0, speed: 0 };
  return createSim(content, world);
}

function villager(
  sim: Sim,
  id: string,
): NonNullable<ReturnType<typeof currentPlace>['villagers'][string]> {
  const state = currentPlace(sim.world).villagers[id];
  if (state === undefined) throw new Error(`habitant ${id} absent`);
  return state;
}

describe('habitants', () => {
  it('gabarit: un facteur copié tel quel vit sa journée (poste, flânerie, quai le samedi, chez lui la nuit)', () => {
    const content = loadContent(filesWithVillager('facteur'));
    const sim = simOf(content, 11 * 60 + 59);
    wait(sim, 0.2);
    expect(villager(sim, 'facteur').life).toMatchObject({ activity: 'travailler', pose: 'stand' });
    // La cheffe de gare tient déjà le guichet: il prend la place libre à côté, pas sur elle.
    expect(villager(sim, 'facteur').body).toMatchObject({ x: 20, y: 15.75 });
    // Midi: il marche jusqu'au point de flânerie, à pas d'homme.
    sim.world.minutes = 12 * 60;
    wait(sim, 1.5);
    expect(villager(sim, 'facteur').life?.pose).toBe('walk');
    expect(villager(sim, 'facteur').body.speed).toBe(VILLAGERS.walkSpeed);
    wait(sim, 5);
    expect(villager(sim, 'facteur').life).toMatchObject({ activity: 'flaner', pose: 'stand' });
    expect(villager(sim, 'facteur').body).toMatchObject({ x: 18.5, y: 20 });

    // Le samedi (jour 6), la même heure le mène au quai: il contourne le bâtiment par la grille.
    const saturday = simOf(content, 12 * 60, 6);
    expect(weekdayOf(6)).toBe('sat');
    wait(saturday, 0.1);
    expect(villager(saturday, 'facteur').life?.activity).toBe('attendre-le-train');
    expect(villager(saturday, 'facteur').body).toMatchObject({ x: 20, y: 4 });

    // La nuit, il est chez lui.
    const night = simOf(content, 3 * 60);
    wait(night, 0.1);
    expect(villager(night, 'facteur').life?.activity).toBe('dormir');
  });

  it('trajet sur la grille autour d’un bâtiment, et sur le graphe des chemins quand la carte en a un', () => {
    const content = loadContent(filesWithVillager('facteur'));
    const place = content.places['essai-gare'];
    const sim = simOf(content, 600);
    if (place === undefined) throw new Error('lieu absent');
    const route = findRoute(content, place, currentPlace(sim.world), 20, 15, 20, 4);
    // Aucun point dans le bâtiment bloqué (x 14 à 26, y 8 à 13).
    for (const p of route.points) expect(p.x >= 14 && p.x < 26 && p.y >= 8 && p.y < 13).toBe(false);
    expect(route.points.at(-1)).toEqual({ x: 20, y: 4 });

    const files = filesWithVillager('facteur');
    const map = mapOf(files);
    map.graph = {
      nodes: { a: { x: 20, y: 15 }, b: { x: 27, y: 15 }, c: { x: 27, y: 5 }, d: { x: 20, y: 5 } },
      edges: [
        { a: 'a', b: 'b', kind: 'chemin', lock: null },
        { a: 'b', b: 'c', kind: 'chemin', lock: null },
        { a: 'c', b: 'd', kind: 'chemin', lock: null },
      ],
    };
    const graphed = loadContent(files);
    const gPlace = graphed.places['essai-gare'];
    if (gPlace === undefined) throw new Error('lieu absent');
    const onGraph = findRoute(graphed, gPlace, currentPlace(sim.world), 20, 15, 20, 4);
    expect(onGraph.points).toEqual([
      { x: 20, y: 15 },
      { x: 27, y: 15 },
      { x: 27, y: 5 },
      { x: 20, y: 5 },
      { x: 20, y: 4 },
    ]);
  });

  it('s’assoit sur une vraie place via la brique, et se lève si un joueur la prend', () => {
    const files = filesWithVillager('facteur');
    (mapOf(files).objects as Json[]).push({
      id: 'chaise-1',
      type: 'chaise',
      x: 30.5,
      y: 16.5,
      rotation: 0,
    });
    const life = lifeOf(files, 'facteur');
    (life.schedule as Json[]).unshift({
      from: 600,
      to: 700,
      at: { seat: 'chaise-1' },
      activity: 'lire',
      gesture: 'read',
    });
    const content = loadContent(files);
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    const state = villager(sim, 'facteur');
    expect(state.life).toMatchObject({
      pose: 'sit',
      seat: ['chaise-1', 0],
      activity: 'lire',
      gesture: 'read',
    });
    expect(state.body).toMatchObject({ x: 30.5, y: 16.5 });
    // Le joueur 0 prend la place (brique `sit`): l'habitant se lève, surpris, devant la chaise.
    const seats = currentPlace(sim.world).objects['chaise-1']?.sit;
    if (seats === undefined) throw new Error('chaise sans place');
    seats[0] = 0;
    wait(sim, 0.1);
    expect(villager(sim, 'facteur').life).toMatchObject({
      pose: 'stand',
      seat: null,
      emote: 'surprise',
    });
    expect(villager(sim, 'facteur').body.y).toBeGreaterThan(17);
  });

  it('se tourne vers le joueur qui approche, le salue une fois par jour, et s’en souvient', () => {
    const content = loadContent(filesWithVillager('facteur'));
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    sim.world.players[0].body = { x: 22, y: 15, facing: Math.PI, speed: 0 };
    const events = wait(sim, 0.5);
    expect(events.filter((e) => e.type === 'villager_greeted')).toEqual([
      { type: 'villager_greeted', villager: 'facteur', player: 0, emote: 'joy' },
    ]);
    expect(sim.world.progress.memory['habitants.facteur.salut.j0']).toMatchObject({
      day: 1,
      by: 0,
    });
    expect(villagerView(sim, 'facteur')).toMatchObject({ emote: 'joy', gaze: 0, visible: true });
    // Tourné vers le joueur.
    const me = villager(sim, 'facteur').body;
    expect(me.facing).toBeCloseTo(Math.atan2(15 - me.y, 22 - me.x), 2);
    sim.world.players[0].body.x = 35;
    wait(sim, 0.3);
    sim.world.players[0].body.x = 22;
    expect(wait(sim, 0.3).some((e) => e.type === 'villager_greeted')).toBe(false);
    // Le joueur court près de lui: réaction déclarée dans sa fiche.
    sim.world.players[1].body = { x: 17, y: 17, facing: 0, speed: 0 };
    const running = { seq: 0, moveX: 1, moveY: 0, run: true, act: false };
    const idle = { seq: 0, moveX: 0, moveY: 0, run: false, act: false };
    const reacted = wait(sim, 0.3, [idle, running]).filter((e) => e.type === 'villager_reacted');
    expect(reacted).toEqual([
      { type: 'villager_reacted', villager: 'facteur', player: 1, act: 'runs', emote: 'surprise' },
    ]);
  });

  it('cadeaux: selon ses goûts, un par jour et par joueur, retenu en fait daté', () => {
    const content = loadContent(filesWithVillager('facteur'));
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    const player = sim.world.players[0];
    player.body = { x: 21, y: 15, facing: Math.PI, speed: 0 };
    player.toolbar[0] = { item: 'pomme', count: 2 };
    player.selected = 0;
    const events = act(sim, 0, { type: 'give_gift', villager: 'facteur' });
    const gift = events.find((e) => e.type === 'villager_gift');
    expect(gift).toMatchObject({ item: 'pomme', taste: 'loved' });
    expect(sim.world.progress.bonds[bondKey('facteur', 0)]).toBe(
      gift?.type === 'villager_gift' ? gift.points : -1,
    );
    expect(sim.world.progress.bonds[bondKey('facteur', 0)]).toBeGreaterThanOrEqual(30);
    expect(player.toolbar[0]).toEqual({ item: 'pomme', count: 1 });
    expect(sim.world.progress.memory['habitants.facteur.cadeau.j0']).toMatchObject({
      v: 'pomme',
      day: 1,
    });
    const again = act(sim, 0, { type: 'give_gift', villager: 'facteur' });
    expect(again.find((e) => e.type === 'refused')).toMatchObject({ reason: 'gift-already-today' });
    expect(player.toolbar[0]).toEqual({ item: 'pomme', count: 1 });
  });

  it('arrive par le train quand l’histoire le veut, puis rejoint son poste à pied', () => {
    const files = filesWithVillager('facteur');
    lifeOf(files, 'facteur').arrives = [{ type: 'remembered', key: 'essai-gare.acte-deux' }];
    const content = loadContent(files);
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    expect(villagerView(sim, 'facteur')?.visible).toBe(false);
    expect(villager(sim, 'facteur').body).toMatchObject(VILLAGERS.offstage);
    sim.world.progress.memory['essai-gare.acte-deux'] = { v: true, by: 'duo', day: 1 };
    const events = wait(sim, 1.1);
    expect(events.some((e) => e.type === 'villager_arrived')).toBe(true);
    expect(villager(sim, 'facteur').life?.presence).toBe('arriving');
    expect(villager(sim, 'facteur').body.y).toBeLessThan(10);
    wait(sim, 20);
    expect(villager(sim, 'facteur').life).toMatchObject({
      presence: 'here',
      activity: 'travailler',
    });
    expect(sim.world.progress.memory['habitants.facteur.arrive']).toMatchObject({ day: 1 });
  });

  it('commerce ouvert quand le commerçant est à son comptoir; bulle quand une étape l’attend', () => {
    const files = filesWithVillager('facteur');
    files['lieux/essai-gare/commerces/poste.json'] = {
      schema: 1,
      id: 'poste',
      name: 'Poste',
      keeper: 'facteur',
      hours: { from: 420, to: 720 },
      sells: [],
      buys: [],
    };
    const schedule = lifeOf(files, 'facteur').schedule as Json[];
    const work = schedule.find((e) => e.from === 420);
    if (work === undefined) throw new Error('ligne absente');
    work.shop = 'poste';
    files['lieux/essai-gare/quetes/lettre.json'] = {
      schema: 1,
      id: 'lettre',
      kind: 'side',
      title: 'La lettre',
      giver: 'facteur',
      requires: [],
      chapters: [
        {
          id: 'un',
          title: 'Un',
          steps: [
            {
              id: 'voir',
              objective: 'Va voir le facteur.',
              target: { villager: 'facteur' },
              // Fin atteignable (le validateur de quêtes refuse un fait que rien n'écrit).
              done: [{ type: 'item_in_bag', item: 'pierre', count: 1 }],
              together: false,
              onStart: [],
              onDone: [],
            },
          ],
        },
      ],
    };
    const content = loadContent(files);
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    expect(isShopOpen(sim, 'poste')).toBe(true);
    expect(hasSomethingFor(sim, 'facteur', 0)).toBe(false);
    sim.world.progress.quests.lettre = { chapter: 'un', step: 'voir', done: false };
    expect(hasSomethingFor(sim, 'facteur', 0)).toBe(true);
    sim.world.minutes = 12 * 60;
    wait(sim, 1.1);
    expect(isShopOpen(sim, 'poste')).toBe(false);
  });

  it('discuter à deux: chacun regarde l’autre', () => {
    const files = filesWithVillager('facteur');
    for (const file of plan(TEMPLATE_DIR, 'habitant', 'factrice', 'essai-gare'))
      files[file.path] = file.value;
    const line = (point: string, other: string): Json => ({
      from: 600,
      to: 700,
      at: { point },
      activity: 'discuter',
      gesture: 'talk',
      with: other,
    });
    (lifeOf(files, 'facteur').schedule as Json[]).unshift(line('depart-joueur-1', 'factrice'));
    (lifeOf(files, 'factrice').schedule as Json[]).unshift(line('depart-joueur-2', 'facteur'));
    const content = loadContent(files);
    const sim = simOf(content, 600);
    sim.world.players[0].body = { x: 10, y: 30, facing: 0, speed: 0 };
    sim.world.players[1].body = { x: 11, y: 30, facing: 0, speed: 0 };
    wait(sim, 0.3);
    expect(villager(sim, 'facteur').life?.gaze).toBe('factrice');
    expect(villager(sim, 'factrice').life?.gaze).toBe('facteur');
    // Le facteur (à l'ouest) regarde vers l'est.
    expect(Math.abs(villager(sim, 'facteur').body.facing)).toBeLessThan(0.1);
  });

  it('loin des joueurs: basse fréquence, même arrivée; reprise de sauvegarde à son poste', () => {
    const files = filesWithVillager('facteur');
    // Carte agrandie: les joueurs se tiennent à plus de `nearRadius` du facteur.
    mapOf(files).width = 100;
    mapOf(files).height = 100;
    const content = loadContent(files);
    const near = simOf(content, 719.9);
    const far = simOf(content, 719.9);
    far.world.players[0].body = { x: 90, y: 90, facing: 0, speed: 0 };
    far.world.players[1].body = { x: 91, y: 90, facing: 0, speed: 0 };
    const moves = { near: 0, far: 0 };
    let last = { near: 0, far: 0 };
    for (let i = 0; i < 30 * 8; i++) {
      wait(near, 1 / 30);
      wait(far, 1 / 30);
      const nx = villager(near, 'facteur').body.x;
      const fx = villager(far, 'facteur').body.x;
      if (nx !== last.near) moves.near++;
      if (fx !== last.far) moves.far++;
      last = { near: nx, far: fx };
    }
    expect(moves.far).toBeLessThan(moves.near / 5);
    expect(villager(far, 'facteur').body).toMatchObject({ x: 18.5, y: 20 });
    expect(villager(near, 'facteur').body).toMatchObject({ x: 18.5, y: 20 });
    // Sauvegarde relue en pleine marche: il reprend à son poste du moment.
    const walking = simOf(content, 12 * 60);
    wait(walking, 2);
    const reloaded = createSim(content, structuredClone(walking.world));
    wait(reloaded, 0.1);
    expect(villager(reloaded, 'facteur').body).toMatchObject({ x: 18.5, y: 20 });
  });

  it('validateur: planning troué, pas chez lui la nuit, point absent, siège qui n’en est pas un', () => {
    const files = filesWithVillager('facteur');
    const life = lifeOf(files, 'facteur');
    const schedule = life.schedule as Json[];
    schedule.splice(schedule.length - 1, 1);
    schedule[0] = { ...schedule[0], at: { point: 'quai' } };
    schedule.push({
      from: 840,
      to: 900,
      at: { point: 'nulle-part' },
      activity: 'x',
      gesture: null,
    });
    schedule.push({
      from: 900,
      to: 960,
      days: ['sun'],
      at: { seat: 'pompe' },
      activity: 'x',
      gesture: null,
    });
    expect(() => loadContent(files)).toThrow(/planning troué à 15 h 00/);
    expect(() => loadContent(files)).toThrow(/point « nulle-part » absent/);
    expect(() => loadContent(files)).toThrow(/« pompe » n'est pas un siège/);
    const night = filesWithVillager('facteur');
    (lifeOf(night, 'facteur').schedule as Json[])[0] = {
      from: 1230,
      to: 420,
      at: { point: 'quai' },
      activity: 'dormir',
      gesture: null,
    };
    expect(() => loadContent(night)).toThrow(/à 3 h 00, il doit être chez lui/);
    const story = filesWithVillager('facteur');
    lifeOf(story, 'facteur').arrives = [{ type: 'item_in_bag', item: 'objet-fantome', count: 1 }];
    expect(() => loadContent(story)).toThrow(/arrives: objet inconnu « objet-fantome »/);
  });

  it('état compact: vingt habitants au pire tiennent la tranche « lieu » sous son budget', () => {
    const content = loadContent(filesWithVillager('facteur'));
    const sim = simOf(content, 600);
    wait(sim, 0.1);
    const place = currentPlace(sim.world);
    for (let i = 0; i < 80; i++)
      place.ground.push({ id: i, stack: { item: 'planche', count: 10 }, x: 12.345, y: 23.456 });
    for (let i = 0; i < 200; i++) {
      place.placed.push({ id: `pose-${i}`, type: 'banc', x: 12.5, y: 23.5, rotation: 1 });
      place.objects[`pose-${i}`] = { sit: [0, 1] };
    }
    const long = 'habitant-au-nom-tres-long-numero-00';
    for (let i = 0; i < 20; i++)
      place.villagers[`${long}${String(i).padStart(2, '0')}`] = {
        met: [true, true],
        talkingWith: 1,
        body: { x: 1, y: 1, facing: 0, speed: 0 },
        life: {
          presence: 'arriving',
          entry: 31,
          activity: 'activite-au-nom-tres-long-numero-0000',
          pose: 'stand',
          gesture: 'geste-au-nom-tres-long-numero-000000',
          seat: ['meuble-au-nom-tres-long-numero-0000000', 3],
          emote: 'onomatopee-au-nom-long-00',
          emoteUntil: 99_999_999,
          gaze: 'habitant-au-nom-tres-long-numero-0000',
        },
      };
    const message = sliceMessage(sim.world, 'place');
    expect(v.safeParse(SLICE_SCHEMAS.place, JSON.parse(JSON.stringify(message))).success).toBe(
      true,
    );
    const size = byteLength(message);
    const perVillager = byteLength(message.place.villagers[`${long}00`]);
    process.stdout.write(
      `tranche lieu au pire: ${String(size)} octets, un habitant: ${String(perVillager)}\n`,
    );
    expect(perVillager).toBeLessThan(400);
    expect(size).toBeLessThan(BUDGET_BYTES.place);
    expect(seasonOf(15, 14)).toBe('summer');
  });
});
