/**
 * Amitié (cahier 4.9, R39): points par habitant, jamais de perte, modulés par l'hygiène
 * (`bond` des besoins: 1,2 au-dessus de 50, rien sous 20). Chaque cœur atteint s'écrit aussi en
 * fait retenu (`amitie.<habitant>.coeur-<n>`): les dialogues varient selon l'amitié par une
 * simple condition `remembered`.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import { modifiersOf } from '../besoins/jauges';
import type { SimContext } from '../noyau/systemes';
import { recall, remember } from '../regles/memoire';
import { RULES } from '../regles/reglages';

export function bondOf(sim: Pick<SimContext, 'world'>, villager: string): number {
  return sim.world.progress.bonds[villager] ?? 0;
}

export function heartsOf(points: number): number {
  return Math.min(RULES.bonds.hearts, Math.floor(points / RULES.bonds.perHeart));
}

export function heartKey(villager: string, heart: number): string {
  return `amitie.${villager}.coeur-${String(heart)}`;
}

/** Ajoute des points d'amitié gagnés par `player`; renvoie les points vraiment ajoutés. */
export function addBond(
  sim: SimContext,
  player: PlayerIndex,
  villager: string,
  base: number,
): number {
  const factor = modifiersOf(sim.content, sim.world, player).bond;
  const max = RULES.bonds.perHeart * RULES.bonds.hearts;
  const before = bondOf(sim, villager);
  const gained = Math.min(Math.round(base * factor), max - before);
  if (gained <= 0) return 0;
  const after = before + gained;
  sim.world.progress.bonds[villager] = after;
  sim.touch('progress');
  for (let heart = heartsOf(before) + 1; heart <= heartsOf(after); heart++)
    remember(sim, heartKey(villager, heart), true, player);
  return gained;
}

function todayKey(villager: string, player: PlayerIndex): string {
  return `amitie.${villager}.jour-j${String(player)}`;
}

/** Première conversation du jour avec cet habitant: ses points, une fois par jour et par joueur. */
export function greet(sim: SimContext, player: PlayerIndex, villager: string): void {
  const key = todayKey(villager, player);
  if (recall(sim.world, key)?.v === sim.world.common.day) return;
  remember(sim, key, sim.world.common.day, player);
  addBond(sim, player, villager, RULES.bonds.firstTalkOfDay);
}
