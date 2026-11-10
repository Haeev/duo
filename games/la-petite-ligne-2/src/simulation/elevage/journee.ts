/**
 * La journée de la basse-cour, vécue d'un coup à chaque nouveau jour (pas de simulation continue).
 * Chaque matin, chaque bête mange sa ration si la mangeoire en a; nourrie, elle donne à son
 * rythme; affamée, elle donne un jour sur deux pendant `hunger.fewer` jours, puis plus rien.
 * Le nid garde ses produits jusqu'à son plafond. Les jours passés ailleurs ou entre deux séances
 * se rattrapent au retour, jour par jour.
 */
import type { ShelterState, SpeciesDef } from '../../donnees/schemas/elevage';
import type { RandomSource } from '@duo/sdk/sim';
import type { SimContext } from '../noyau/systemes';
import { heartsOf, nestCount, writeShelter, type ShelterBrick } from './abri';
import { FARM_TUNING } from './reglages';

/** Le produit d'une bête selon ses cœurs; caressée la veille, une chance de monter d'un cran. */
function productOf(
  species: SpeciesDef,
  hearts: number,
  petted: boolean,
  random: RandomSource,
): string {
  const { qualities, pettedChance } = species.product;
  let level = 0;
  qualities.forEach((quality, index) => {
    if (hearts >= quality.hearts) level = index;
  });
  if (petted && level < qualities.length - 1 && random.chance(pettedChance)) level += 1;
  return qualities[level]?.item ?? qualities[0]?.item ?? species.food;
}

/** Vit le matin du jour `day` (la veille: `day - 1`). */
export function liveMorning(
  species: SpeciesDef,
  params: ShelterBrick,
  state: ShelterState,
  day: number,
  random: RandomSource,
): void {
  for (const animal of state.animals) {
    if (state.feed >= species.ration) {
      state.feed -= species.ration;
      animal.hungry = 0;
    } else animal.hungry = Math.min(999, animal.hungry + 1);
    animal.since = Math.min(999, animal.since + 1);
    const { hungry } = animal;
    const gives = hungry === 0 || (hungry <= species.hunger.fewer && hungry % 2 === 0);
    if (!gives || animal.since < species.product.every) continue;
    if (nestCount(state) >= params.nestCapacity) continue;
    const yesterday = day - 1;
    const petted = animal.petted[0] === yesterday || animal.petted[1] === yesterday;
    const item = productOf(species, heartsOf(species, animal), petted, random);
    const stack = state.nest.find((one) => one.item === item);
    if (stack === undefined) state.nest.push({ item, count: 1 });
    else stack.count += 1;
    animal.since = 0;
    animal.laid = day;
  }
}

/** À chaque pas: les abris du lieu rattrapent les matins qu'ils n'ont pas encore vécus. */
export function liveShelters(sim: SimContext): void {
  const { world } = sim;
  const place = world.places[world.common.place];
  if (place === undefined) return;
  const today = world.common.day;
  let changed = false;
  for (const id in place.objects) {
    const state = place.objects[id]?.shelter;
    if (state === undefined || state.day === today) continue;
    changed = true;
    if (state.day === 0) {
      state.day = today;
      continue;
    }
    const ref = writeShelter(sim, id);
    if (ref !== null) {
      const first = Math.max(state.day + 1, today - FARM_TUNING.catchUpDays + 1);
      for (let day = first; day <= today; day++)
        liveMorning(ref.species, ref.params, state, day, sim.random);
    }
    state.day = today;
  }
  if (changed) sim.touch('place');
}
