/**
 * Brique `shelter`: l'abri de la basse-cour (cahier 4.7, réponse 31, R20). La touche d'action sur
 * l'abri ouvre son écran; là, chaque geste est une intention: remplir la mangeoire (une seule
 * nourriture, prise dans le sac puis dans les coffres du lieu), ramasser tout le nid, caresser
 * une bête. Lecture pour le rendu et l'interface: `shelterView`.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Animal, ShelterState, SpeciesDef } from '../../donnees/schemas/elevage';
import type { DeepReadonly } from '../../etat/monde';
import type { BrickBehaviour, Look } from '../briques/types';
import { findProp } from '../noyau/obstacles';
import type { SimContext } from '../noyau/systemes';
import { recall } from '../regles/memoire';
import { giveItem } from '../sac/actions';
import { pay } from '../sac/argent';
import { countItem, removeItem } from '../sac/inventaire';
import { FARM_TUNING } from './reglages';

export type ShelterBrick = Extract<Brick, { brick: 'shelter' }>;
type ReadShelter = DeepReadonly<ShelterState>;
type ReadAnimal = DeepReadonly<Animal>;

/** L'abri visé dans le lieu courant: son meuble, ses paramètres, son état. */
export interface ShelterRef<S> {
  readonly id: string;
  /** Type du meuble (`commun/meubles/<type>.json`). */
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: 0 | 1 | 2 | 3;
  readonly params: ShelterBrick;
  readonly species: SpeciesDef;
  readonly state: S;
}

function paramsOf(look: Look, type: string): ShelterBrick | null {
  for (const brick of look.content.props[type]?.bricks ?? [])
    if (brick.brick === 'shelter') return brick;
  return null;
}

/** L'abri de cet identifiant d'instance dans le lieu courant, en lecture. */
export function readShelter(look: Look, id: string): ShelterRef<ReadShelter> | null {
  const place = look.content.places[look.world.common.place];
  const state = look.world.places[look.world.common.place];
  if (place === undefined || state === undefined) return null;
  const prop = findProp(place, state, id);
  const shelter = state.objects[id]?.shelter;
  if (prop === null || shelter === undefined) return null;
  const params = paramsOf(look, prop.type);
  const species = params === null ? undefined : look.content.species[params.species];
  if (params === null || species === undefined) return null;
  return {
    id,
    type: prop.type,
    x: prop.x,
    y: prop.y,
    rotation: prop.rotation,
    params,
    species,
    state: shelter,
  };
}

/** Le même, modifiable (hôte). */
export function writeShelter(sim: SimContext, id: string): ShelterRef<ShelterState> | null {
  const read = readShelter(sim, id);
  const state = sim.world.places[sim.world.common.place]?.objects[id]?.shelter;
  if (read === null || state === undefined) return null;
  return { ...read, state };
}

/** Places permises: la plus grande valeur de `places` dont le fait est retenu (agrandissement). */
export function placeLimit(look: Look, params: ShelterBrick): number {
  let limit = 0;
  for (const step of params.places) {
    const fact = step.fact === null ? null : recall(look.world, step.fact);
    if (step.fact === null || (fact !== null && fact.v !== false && fact.v !== 0))
      limit = Math.max(limit, step.count);
  }
  return Math.min(limit, FARM_TUNING.maxAnimals);
}

export function heartsOf(species: SpeciesDef, animal: ReadAnimal): number {
  return Math.min(species.affection.hearts, Math.floor(animal.love / species.affection.perHeart));
}

export function nestCount(state: ReadShelter): number {
  return state.nest.reduce((sum, stack) => sum + stack.count, 0);
}

/** Rations mangées par jour par tout l'abri. */
function dailyNeed(species: SpeciesDef, state: ReadShelter): number {
  return state.animals.length * species.ration;
}

export type FeederLevel = 'full' | 'low' | 'empty';
export type Mood = 'happy' | 'peckish' | 'hungry';

export interface AnimalView {
  readonly id: number;
  readonly name: string;
  readonly robe: string;
  /** Couleur de la robe, pour la forme simple et la vignette. */
  readonly color: string;
  readonly hearts: number;
  readonly maxHearts: number;
  /** `peckish`: la mangeoire ne tiendra pas demain; `hungry`: elle n'a pas mangé ce matin. */
  readonly mood: Mood;
  /** Onomatopée à montrer au-dessus d'elle. */
  readonly sound: string;
  /** A donné ce matin. */
  readonly laidToday: boolean;
  /** Déjà caressée aujourd'hui par chaque joueur. */
  readonly petted: readonly [boolean, boolean];
}

/** Tout ce que le rendu et l'écran lisent d'un abri, d'un coup d'œil. */
export interface ShelterView {
  readonly id: string;
  readonly species: string;
  readonly food: string;
  readonly feeder: {
    readonly rations: number;
    readonly capacity: number;
    /** Jours de réserve pour les bêtes présentes (`null`: aucune bête). */
    readonly days: number | null;
    readonly level: FeederLevel;
    /** Part remplie, de 0 à 1 (hauteur du grain dans la trémie). */
    readonly fill: number;
  };
  readonly nest: {
    readonly count: number;
    readonly capacity: number;
    /** Produits au nid par pondoir, pour poser les œufs visibles. */
    readonly boxes: readonly number[];
    readonly items: readonly { readonly item: string; readonly count: number }[];
    readonly full: boolean;
  };
  readonly animals: readonly AnimalView[];
  readonly places: number;
}

export function shelterView(look: Look, id: string): ShelterView | null {
  const ref = readShelter(look, id);
  if (ref === null) return null;
  const { params, species, state } = ref;
  const need = dailyNeed(species, state);
  const days = need === 0 ? null : Math.floor(state.feed / need);
  const level: FeederLevel =
    state.feed === 0 || (days !== null && days === 0)
      ? 'empty'
      : days !== null && days <= FARM_TUNING.lowDays
        ? 'low'
        : 'full';
  const count = nestCount(state);
  const boxes = Array.from({ length: params.nests }, (_, box) => {
    const base = Math.floor(count / params.nests);
    return base + (box < count % params.nests ? 1 : 0);
  });
  const today = look.world.common.day;
  const robes = new Map(species.robes.map((robe) => [robe.id, robe.color]));
  const animals = state.animals.map((animal): AnimalView => {
    const mood: Mood = animal.hungry > 0 ? 'hungry' : state.feed < need ? 'peckish' : 'happy';
    const petted: [boolean, boolean] = [animal.petted[0] === today, animal.petted[1] === today];
    return {
      id: animal.id,
      name: animal.name,
      robe: animal.robe,
      color: robes.get(animal.robe) ?? species.robes[0]?.color ?? '#ffffff',
      hearts: heartsOf(species, animal),
      maxHearts: species.affection.hearts,
      mood,
      sound: mood === 'happy' ? species.sounds.happy : species.sounds.hungry,
      laidToday: animal.laid === today,
      petted,
    };
  });
  return {
    id,
    species: species.id,
    food: species.food,
    feeder: {
      rations: state.feed,
      capacity: params.feeder,
      days,
      level,
      fill: Math.min(1, state.feed / params.feeder),
    },
    nest: {
      count,
      capacity: params.nestCapacity,
      boxes,
      items: state.nest.map((stack) => ({ item: stack.item, count: stack.count })),
      full: count >= params.nestCapacity,
    },
    animals,
    places: placeLimit(look, params),
  };
}

/** Nourriture que ce joueur peut verser: son sac, puis les coffres du lieu (la maison). */
export function foodAvailable(look: Look, player: PlayerIndex, food: string): number {
  const actor = look.world.players[player];
  let total = 0;
  for (const stack of [...actor.toolbar, ...(actor.bag?.slots ?? [])])
    if (stack?.item === food) total += stack.count;
  const place = look.world.places[look.world.common.place];
  for (const id in place?.objects ?? {})
    for (const stack of place?.objects[id]?.store ?? [])
      if (stack?.item === food) total += stack.count;
  return total;
}

/** Ce qui empêcherait de remplir, ou `null`. Pur. */
export function fillRefusal(look: Look, player: PlayerIndex, id: string): string | null {
  const ref = readShelter(look, id);
  if (ref === null) return 'no-target';
  if (ref.state.feed >= ref.params.feeder) return 'feeder-full';
  if (foodAvailable(look, player, ref.species.food) === 0) return 'no-feed';
  return null;
}

export function fill(sim: SimContext, player: PlayerIndex, id: string): string | null {
  const refusal = fillRefusal(sim, player, id);
  const ref = writeShelter(sim, id);
  if (refusal !== null || ref === null) return refusal ?? 'no-target';
  const food = ref.species.food;
  let want = ref.params.feeder - ref.state.feed;
  const actor = sim.world.players[player];
  const fromBag = Math.min(want, countItem(actor, food));
  if (fromBag > 0 && removeItem(actor, food, fromBag)) {
    want -= fromBag;
    sim.touch('players');
  }
  let fromStores = 0;
  const place = sim.world.places[sim.world.common.place];
  for (const objectId in place?.objects ?? {}) {
    const slots = place?.objects[objectId]?.store;
    if (slots === undefined) continue;
    for (let i = 0; i < slots.length && want > 0; i++) {
      const stack = slots[i];
      if (stack?.item !== food) continue;
      const taken = Math.min(want, stack.count);
      stack.count -= taken;
      if (stack.count === 0) slots[i] = null;
      want -= taken;
      fromStores += taken;
    }
  }
  const rations = fromBag + fromStores;
  ref.state.feed += rations;
  sim.touch('place');
  sim.emit({ type: 'shelter_filled', player, target: id, rations });
  return null;
}

export function collect(sim: SimContext, player: PlayerIndex, id: string): string | null {
  const ref = writeShelter(sim, id);
  if (ref === null) return 'no-target';
  if (ref.state.nest.length === 0) return 'nest-empty';
  let count = 0;
  for (const stack of ref.state.nest) count += giveItem(sim, player, stack.item, stack.count);
  // Ce qui ne tient pas dans le sac tombe aux pieds du joueur (`giveItem`): le nid est vidé.
  ref.state.nest = [];
  sim.touch('place');
  sim.emit({ type: 'shelter_collected', player, target: id, count });
  return null;
}

export function petRefusal(
  look: Look,
  player: PlayerIndex,
  id: string,
  animal: number,
): string | null {
  const ref = readShelter(look, id);
  const found = ref?.state.animals.find((one) => one.id === animal);
  if (ref === null || found === undefined) return 'no-target';
  return found.petted[player] === look.world.common.day ? 'already-petted' : null;
}

export function pet(
  sim: SimContext,
  player: PlayerIndex,
  id: string,
  animal: number,
): string | null {
  const refusal = petRefusal(sim, player, id, animal);
  const ref = writeShelter(sim, id);
  const found = ref?.state.animals.find((one) => one.id === animal);
  if (refusal !== null || ref === null || found === undefined) return refusal ?? 'no-target';
  found.petted[player] = sim.world.common.day;
  found.love = Math.min(999, found.love + ref.species.affection.perPet);
  sim.touch('place');
  sim.emit({
    type: 'animal_petted',
    player,
    target: id,
    animal,
    hearts: heartsOf(ref.species, found),
  });
  return null;
}

/** Une bête arrive (achat, cadeau de l'histoire): nom proposé libre, robe tirée au sort. */
export function adoptAnimal(
  sim: SimContext,
  player: PlayerIndex | null,
  id: string,
): string | null {
  const ref = writeShelter(sim, id);
  if (ref === null) return 'no-target';
  if (ref.state.animals.length >= placeLimit(sim, ref.params)) return 'shelter-full';
  const taken = new Set(ref.state.animals.map((one) => one.name));
  const name =
    ref.species.names.find((one) => !taken.has(one)) ??
    `${ref.species.names[0] ?? ref.species.name} ${String(ref.state.nextId + 1)}`;
  const robe = sim.random.pick(ref.species.robes).id;
  const animal = ref.state.nextId;
  ref.state.animals.push({
    id: animal,
    name: name.slice(0, 40),
    robe,
    love: 0,
    petted: [0, 0],
    hungry: 0,
    since: 0,
    laid: 0,
  });
  ref.state.nextId += 1;
  sim.touch('place');
  sim.emit({ type: 'animal_arrived', by: player, target: id, animal });
  return null;
}

/** Bête offerte par l'histoire (effet `adopt_animal`), telle que les données la décrivent. */
export interface StoryAnimal {
  readonly species: string;
  readonly name: string;
  /** Identifiant du meuble abri, sur la carte d'un lieu ou posé dans un logement. */
  readonly shelter: string;
  readonly robe?: string;
}

/**
 * L'abri `shelter` où qu'il soit (lieu courant ou autre lieu déjà ouvert): son lieu, ses
 * paramètres et son état. Un même identifiant d'abri ne sert qu'une fois par jeu (`valider.ts`).
 */
function findShelter(
  sim: SimContext,
  shelter: string,
): { params: ShelterBrick; state: ShelterState } | null {
  for (const placeId in sim.world.places) {
    const place = sim.world.places[placeId];
    const state = place?.objects[shelter]?.shelter;
    if (place === undefined || state === undefined) continue;
    const type =
      sim.content.places[placeId]?.map.objects.find((one) => one.id === shelter)?.type ??
      place.placed.find((one) => one.id === shelter)?.type;
    const params = type === undefined ? null : paramsOf(sim, type);
    if (params !== null) return { params, state };
  }
  return null;
}

/**
 * Une bête offerte par l'histoire arrive, nommée, dans l'abri dit. Déjà là (même nom): rien, pour
 * qu'un dialogue redit ou une option choisie par les deux ne la donne pas deux fois. Rend le refus,
 * ou `null`.
 */
export function adoptStoryAnimal(
  sim: SimContext,
  player: PlayerIndex | null,
  gift: StoryAnimal,
): string | null {
  const found = findShelter(sim, gift.shelter);
  const species = sim.content.species[gift.species];
  if (found === null || species === undefined || found.params.species !== gift.species)
    return 'no-target';
  const { params, state } = found;
  if (state.animals.some((one) => one.name === gift.name)) return null;
  if (state.animals.length >= placeLimit(sim, params)) return 'shelter-full';
  const robe =
    species.robes.find((one) => one.id === gift.robe)?.id ?? sim.random.pick(species.robes).id;
  const animal = state.nextId;
  state.animals.push({
    id: animal,
    name: gift.name.slice(0, 40),
    robe,
    love: 0,
    petted: [0, 0],
    hungry: 0,
    since: 0,
    laid: 0,
  });
  state.nextId += 1;
  sim.touch('place');
  sim.emit({ type: 'animal_arrived', by: player, target: gift.shelter, animal });
  return null;
}

export function buy(sim: SimContext, player: PlayerIndex, id: string): string | null {
  const ref = readShelter(sim, id);
  if (ref === null) return 'no-target';
  if (ref.state.animals.length >= placeLimit(sim, ref.params)) return 'shelter-full';
  const paid = pay(sim, player, ref.species.price);
  if (paid !== null) return paid;
  return adoptAnimal(sim, player, id);
}

export function rename(sim: SimContext, id: string, animal: number, name: string): string | null {
  const found = writeShelter(sim, id)?.state.animals.find((one) => one.id === animal);
  if (found === undefined) return 'no-target';
  found.name = name;
  sim.touch('place');
  return null;
}

export const shelterBehaviour: BrickBehaviour<ShelterBrick> = {
  verb: 'Entrer',
  refuse() {
    return null;
  },
  use(sim, player, target) {
    sim.emit({ type: 'shelter_opened', player, target: target.id });
  },
};
