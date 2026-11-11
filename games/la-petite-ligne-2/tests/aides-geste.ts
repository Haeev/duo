/** Aides des tests: faire un geste d'outil comme un joueur (outil en main, face à l'objet, Espace). */
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { aimOf } from '../src/simulation/briques/visee';
import { bodyCollides } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import type { Sim } from '../src/simulation/noyau/pas';
import { run, send } from './aides-noyau';

/** Met en main l'outil donné s'il est dans la barre (comme la touche de sa case). */
export function holdFromToolbar(sim: Sim, player: PlayerIndex, item: string): void {
  const index = sim.world.players[player].toolbar.findIndex((s) => s?.item === item);
  if (index < 0) throw new Error(`${item} absent de la barre`);
  sim.world.players[player].selected = index;
}

/**
 * Pose le joueur à la place libre la plus proche d'où la touche d'action vise cet objet de la
 * carte, tourné vers lui. La portée se compte depuis le bord de l'emprise: on cherche jusqu'à une
 * demi-case au-delà (un buisson coincé entre un mur et le potager ne se vise que de côté).
 */
export function faceObject(sim: Sim, player: PlayerIndex, id: string): void {
  const o = sim.content.places[sim.world.common.place]?.map.objects.find((x) => x.id === id);
  const b = currentBlockers(sim.content, sim.world);
  if (o === undefined || b === null) throw new Error(`objet ${id}`);
  const radius = sim.content.settings.movement.radius;
  const body = sim.world.players[player].body;
  for (let d = 0.8; d <= sim.content.settings.reach.action + 0.7; d += 0.1)
    for (let a = 0; a < 2 * Math.PI; a += Math.PI / 16) {
      const x = o.x + d * Math.cos(a);
      const y = o.y + d * Math.sin(a);
      if (bodyCollides(b, x, y, radius)) continue;
      body.x = x;
      body.y = y;
      body.facing = Math.atan2(o.y - y, o.x - x);
      if (aimOf(sim, player)?.id === id) return;
    }
  throw new Error(`aucune place d'où viser ${id}`);
}

/**
 * Frappe (Espace, puis la fin du geste) jusqu'à ce que la ressource de l'objet soit récoltée;
 * rend le nombre de coups. Le joueur doit déjà viser l'objet.
 */
export function strikeUntilHarvested(sim: Sim, player: PlayerIndex, id: string, max = 12): number {
  const state = (): number | null =>
    sim.world.places[sim.world.common.place]?.objects[id]?.harvest?.back ?? null;
  let strokes = 0;
  while (state() === null && strokes < max) {
    send(sim, player, { type: 'act' });
    run(sim, 1.6);
    strokes++;
  }
  return strokes;
}
