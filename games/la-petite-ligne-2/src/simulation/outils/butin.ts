/**
 * Tables de butin des ressources du monde: chaque entrée a sa plage d'heures, ses météos et ses
 * saisons (rareté, cahier 4.3 et R58; prépare les collections). Tirage par l'aléa à graine.
 */
import type { LootEntry, ResourceDef } from '../../donnees/schemas/recolte';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Content } from '../../donnees/charger';
import type { SimContext } from '../noyau/systemes';
import { rainedOn } from '../monde/meteo';
import { HARVEST_TUNING } from './reglages';
import { allows, inHours, seasonOf } from './saison';

/** L'entrée peut-elle tomber maintenant (heure, météo, saison, pluie de la veille) ? */
export function lootAvailable(content: Content, world: ReadonlyWorld, entry: LootEntry): boolean {
  return (
    inHours(entry.hours, world.minutes) &&
    allows(entry.weathers, world.common.weather) &&
    allows(entry.seasons, seasonOf(content.settings.clock, world.common.day)) &&
    (entry.rainedYesterday === undefined ||
      entry.rainedYesterday ===
        rainedOn(
          content,
          world.seed,
          world.common.place,
          world.common.day - 1,
          HARVEST_TUNING.rainedYesterdayMinutes,
        ))
  );
}

/** Ce qu'un tirage a donné. */
export interface Drawn {
  readonly item: string;
  count: number;
  readonly rare: boolean;
}

/**
 * Tire le butin d'une récolte: `rolls` tirages pondérés parmi les entrées possibles maintenant
 * (poids des entrées rares multiplié par `rareLuck`), chaque tirage avec une chance d'un
 * exemplaire en plus (`extraCatch`). Les tirages d'un même objet se regroupent.
 */
export function drawLoot(
  sim: SimContext,
  resource: ResourceDef,
  rareLuck: number,
  extraCatch: number,
): Drawn[] {
  const open = resource.loot.filter((entry) => lootAvailable(sim.content, sim.world, entry));
  const out: Drawn[] = [];
  if (open.length === 0) return out;
  const weightOf = (entry: LootEntry): number => entry.weight * (entry.rare ? rareLuck : 1);
  const total = open.reduce((sum, entry) => sum + weightOf(entry), 0);
  for (let roll = 0; roll < resource.rolls; roll++) {
    let pick = sim.random.next() * total;
    let chosen = open[open.length - 1];
    for (const entry of open) {
      pick -= weightOf(entry);
      if (pick < 0) {
        chosen = entry;
        break;
      }
    }
    if (chosen === undefined) continue;
    let count = sim.random.int(chosen.min, chosen.max + 1);
    if (extraCatch > 0 && sim.random.chance(extraCatch)) count += 1;
    const same = out.find((drawn) => drawn.item === chosen.item);
    if (same === undefined) out.push({ item: chosen.item, count, rare: chosen.rare });
    else same.count += count;
  }
  return out;
}
