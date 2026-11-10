/**
 * Pousse du potager, jour par jour (cahier 4.7, R30): un jour sec compte 1, un jour arrosé ou de
 * pluie compte double et monte la qualité. Hors saison, la plante attend; rien ne meurt. Les
 * jours passés loin du lieu se rattrapent au retour (comptés secs: on n'était pas là pour arroser).
 */
import type { CropDef } from '../../donnees/schemas/recolte';
import type { Plot } from '../../donnees/schemas/recolte-briques';
import type { SimContext } from '../noyau/systemes';
import { HARVEST_TUNING } from '../outils/reglages';
import { allows, isRaining, seasonOf } from '../outils/saison';
import { isRipe } from './potager';

/** Avance une parcelle jusqu'au jour `today`; `true` si elle a changé. */
export function growPlot(
  sim: SimContext,
  plot: Plot,
  crop: CropDef | undefined,
  today: number,
  rain: boolean,
): boolean {
  let changed = false;
  if (plot.day < today) {
    for (let day = plot.day; day < today; day++) {
      const watered = day === plot.day && plot.watered;
      const season = seasonOf(sim.content.settings.clock, day);
      if (crop === undefined || isRipe(crop, plot.growth) || !allows(crop.seasons, season))
        continue;
      const { dry, watered: wet } = HARVEST_TUNING.growth;
      plot.growth = Math.min(999, plot.growth + (watered ? wet : dry));
      plot.days = Math.min(999, plot.days + 1);
      if (watered) plot.wet = Math.min(999, plot.wet + 1);
    }
    plot.day = today;
    plot.watered = false;
    changed = true;
  }
  if (rain && crop !== undefined && !plot.watered) {
    plot.watered = true;
    changed = true;
  }
  return changed;
}

/** Ce qui a déjà été vu par lieu: le jour et la météo. Hors de l'état: un recalcul est sans effet. */
const seen = new WeakMap<object, string>();

/** À chaque pas: au changement de jour ou de météo, toutes les terres cultivables du lieu avancent. */
export function growFields(sim: SimContext): void {
  const { world } = sim;
  const place = world.places[world.common.place];
  if (place === undefined) return;
  const key = `${world.common.place}:${String(world.common.day)}:${world.common.weather}`;
  if (seen.get(world) === key) return;
  seen.set(world, key);
  const rain = isRaining(sim);
  let changed = false;
  for (const id in place.objects) {
    const field = place.objects[id]?.field;
    if (field === undefined) continue;
    for (const plot of field.cells) {
      if (plot === null) continue;
      const crop = plot.crop === null ? undefined : sim.content.crops[plot.crop];
      if (growPlot(sim, plot, crop, world.common.day, rain)) changed = true;
    }
  }
  if (changed) sim.touch('place');
}
