/**
 * Actions simultanées (SI-01): les deux visent la même récolte ou le même
 * objet au sol. Le premier reçu est servi; l'autre lit « Déjà pris par … »,
 * qu'il ait agi par la touche ou par un clic, à portée ou de loin.
 */
import type { Character, GardenCell, Vec2 } from '../etat/types';
import { type Sim, emit, partnerName, partnerOf, say, secondsToTicks } from './contexte';

/** Ramassages gardés en mémoire: assez pour un clic lointain, qui arrive après coup. */
const PICKUPS_KEPT = 8;

/**
 * La prise de l'autre compte si elle a eu lieu au plus `alreadyTakenSeconds`
 * avant le pas où l'on a visé (`since`): le pas présent pour la touche ou un
 * clic à portée, le pas du clic pour un clic lointain.
 */
function takenSince(sim: Sim, tick: number, since: number): boolean {
  return tick >= since - secondsToTicks(sim.content.settings.feel.alreadyTakenSeconds);
}

function sayTaken(sim: Sim, c: Character, at: Vec2): void {
  say(sim, c.id, 'already_taken', { partner: partnerName(sim, c.id) });
  emit(sim, { type: 'already_taken', by: c.id, other: partnerOf(c.id), cell: { cx: Math.floor(at.x), cy: Math.floor(at.y) } });
}

/** La case vient d'être récoltée par l'autre: « Déjà pris ». Vrai si c'est dit. */
export function harvestTaken(sim: Sim, c: Character, g: GardenCell, since: number): boolean {
  const last = g.lastHarvest;
  if (g.crop !== null || last === null || last.by === c.id || !takenSince(sim, last.tick, since)) return false;
  sayTaken(sim, c, { x: g.cell.cx + 0.5, y: g.cell.cy + 0.5 });
  return true;
}

export function rememberPickup(sim: Sim, c: Character, id: string, pos: Vec2): void {
  const list = sim.runtime.recentPickups;
  list.push({ id, by: c.id, tick: sim.world.tick, pos: { x: pos.x, y: pos.y } });
  if (list.length > PICKUPS_KEPT) list.splice(0, list.length - PICKUPS_KEPT);
}

/** Clic sur un objet au sol que l'autre vient de ramasser. Vrai si « Déjà pris » est dit. */
export function pickupTaken(sim: Sim, c: Character, id: string, since: number): boolean {
  const p = sim.runtime.recentPickups.find((x) => x.id === id);
  if (p === undefined || p.by === c.id || !takenSince(sim, p.tick, since)) return false;
  sayTaken(sim, c, p.pos);
  return true;
}

/** La touche devant un objet que l'autre vient de ramasser (`near`: à portée et dans le regard). */
export function pickupTakenNear(sim: Sim, c: Character, near: (pos: Vec2) => boolean): boolean {
  const list = sim.runtime.recentPickups;
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p === undefined || p.by === c.id || !takenSince(sim, p.tick, sim.world.tick) || !near(p.pos)) continue;
    sayTaken(sim, c, p.pos);
    return true;
  }
  return false;
}
