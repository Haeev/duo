/**
 * Aller parler à un habitant comme un joueur: par les portes (avec leurs règles: commerce fermé,
 * porte que l'histoire tient fermée), puis à une place libre de la pièce, rejointe à pied depuis
 * la porte, d'où la touche d'action le vise. Un commerçant derrière son comptoir, un habitant à
 * l'étage ou au lit: le test échoue si un joueur ne pourrait pas lui parler là où sa vie l'a mené.
 */
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { standUp } from '../src/simulation/briques/postures';
import { aimOf } from '../src/simulation/briques/visee';
import { doorChain, doorRefusal, passDoor } from '../src/simulation/lieux/index';
import { bodyCollides } from '../src/simulation/noyau/grille';
import { currentBlockers } from '../src/simulation/noyau/obstacles';
import type { Sim } from '../src/simulation/noyau/pas';
import { contextOf, wait } from './aides-l3';

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Cases rejointes à pied depuis (x, y) sans passer de porte (le corps tient au milieu de chacune). */
function walkable(sim: Sim, x: number, y: number, reach: number): Set<string> {
  const b = currentBlockers(sim.content, sim.world);
  if (b === null) throw new Error('obstacles absents');
  const radius = sim.content.settings.movement.radius;
  const start = [Math.floor(x), Math.floor(y)] as const;
  const seen = new Set<string>([`${String(start[0])},${String(start[1])}`]);
  const queue = [start];
  for (const [cx, cy] of queue)
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const key = `${String(nx)},${String(ny)}`;
      if (seen.has(key) || Math.hypot(nx - start[0], ny - start[1]) > reach) continue;
      if (bodyCollides(b, nx + 0.5, ny + 0.5, radius)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  return seen;
}

/** Combien de temps un joueur attend un habitant en chemin ou pris dans un groupe (s de jeu). */
const PATIENCE = { tries: 20, seconds: 3 } as const;

/**
 * Mène ce joueur jusqu'à l'habitant: il passe chaque porte de la traversée (refusée, le test
 * échoue avec la raison), puis se tient à la place libre la plus proche d'où il le vise. Un
 * habitant en chemin (il descend du train, il change de poste) se laisse attendre un moment.
 */
export function visit(sim: Sim, player: PlayerIndex, villager: string): void {
  for (let i = 0; ; i++) {
    try {
      approach(sim, player, villager);
      return;
    } catch (error) {
      const moving =
        (sim.world.places[sim.world.common.place]?.villagers[villager]?.body.speed ?? 0) > 0;
      if (i >= PATIENCE.tries || (!moving && i > 0)) throw error;
      wait(sim, PATIENCE.seconds);
    }
  }
}

/**
 * Mène ce joueur devant un meuble de la carte (un comptoir), par les portes, à la place libre la
 * plus proche d'où la touche d'action le vise.
 */
export function visitObject(sim: Sim, player: PlayerIndex, object: string): void {
  approach(sim, player, object);
}

function approach(sim: Sim, player: PlayerIndex, villager: string): void {
  const place = sim.content.places[sim.world.common.place];
  const target =
    sim.world.places[sim.world.common.place]?.villagers[villager]?.body ??
    place?.map.objects.find((o) => o.id === villager);
  if (place === undefined || target === undefined) throw new Error(`cible ${villager}`);
  // Assis ou couché, il se lève d'abord (une direction donnée, en jeu).
  standUp(contextOf(sim), player);
  const body = sim.world.players[player].body;
  const chain = doorChain(place, body.x, body.y, target.x, target.y);
  if (chain === null) throw new Error(`aucune porte ne mène à ${villager}`);
  for (const hop of chain) {
    const door = place.map.doors?.[hop.door];
    if (door === undefined) throw new Error(`porte ${hop.door}`);
    body.x = hop.fromX;
    body.y = hop.fromY;
    const refusal = doorRefusal(sim, player, door);
    if (refusal !== null)
      throw new Error(`pour parler à ${villager}: porte « ${hop.door} » refusée (${refusal})`);
    if (!passDoor(contextOf(sim), player, hop.door))
      throw new Error(`pour parler à ${villager}: porte « ${hop.door} » sans arrivée libre`);
  }
  const b = currentBlockers(sim.content, sim.world);
  if (b === null) throw new Error('obstacles absents');
  const radius = sim.content.settings.movement.radius;
  const reach = sim.content.settings.reach.action;
  // Dans la pièce, depuis la porte; dehors, le bourg est ouvert: depuis l'habitant lui-même.
  const reached =
    chain.length === 0
      ? null
      : walkable(sim, body.x, body.y, Math.max(place.map.width, place.map.height));
  let best: { x: number; y: number; d: number } | null = null;
  for (let dy = -reach; dy <= reach; dy += 0.1)
    for (let dx = -reach; dx <= reach; dx += 0.1) {
      const d = Math.hypot(dx, dy);
      if (d < radius * 2 || d > reach || (best !== null && d >= best.d)) continue;
      const x = target.x + dx;
      const y = target.y + dy;
      if (bodyCollides(b, x, y, radius)) continue;
      if (reached?.has(`${String(Math.floor(x))},${String(Math.floor(y))}`) === false) continue;
      body.x = x;
      body.y = y;
      body.facing = Math.atan2(-dy, -dx);
      if (aimOf(sim, player)?.id === villager) best = { x, y, d };
    }
  if (best === null) {
    const seen = aimOf(sim, player);
    const me = sim.world.players[player];
    throw new Error(
      `aucune place libre d'où la touche d'action vise ${villager} en (${target.x.toFixed(1)}; ${target.y.toFixed(1)}): phase ${sim.world.common.phase}, cible ${seen?.id ?? 'aucune'}, conversation ${me.talk?.villager ?? 'aucune'}, geste ${me.gesture?.clip ?? 'aucun'}`,
    );
  }
  body.x = best.x;
  body.y = best.y;
  body.facing = Math.atan2(target.y - best.y, target.x - best.x);
}
